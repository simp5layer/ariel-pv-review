import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  projectId: string;
  files?: unknown;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function extractPdfText(data: Uint8Array, maxPages = 20): Promise<string> {
  try {
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    const pagesToRead = Math.min(doc.numPages, maxPages);
    const chunks: string[] = [];
    for (let i = 1; i <= pagesToRead; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as any[])
        .map((it) => (typeof it?.str === "string" ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) chunks.push(`[Page ${i}] ${pageText}`);
    }
    return chunks.join("\n");
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "";
  }
}

async function processExtractionJob(
  jobId: string,
  projectId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Update job to processing
    await supabase
      .from("processing_jobs")
      .update({ status: "processing", progress: 10 })
      .eq("id", jobId);

    // Load project files
    const { data: projectFiles, error: filesErr } = await supabase
      .from("project_files")
      .select("name,file_type,storage_path,size")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: true });

    if (filesErr || !projectFiles || projectFiles.length === 0) {
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: "No project files found",
      }).eq("id", jobId);
      return;
    }

    await supabase.from("processing_jobs").update({ progress: 20 }).eq("id", jobId);

    // Extract text from files (limit to avoid CPU timeout)
    const fileContexts: Array<{
      name: string;
      type: string;
      size: number;
      extractedText: string;
      extractionStatus: "ok" | "no_text" | "unsupported" | "download_failed";
    }> = [];

    for (const f of projectFiles.slice(0, 5)) { // Limit to 5 files
      const name = String(f.name ?? "unknown");
      const type = String(f.file_type ?? "unknown");
      const size = Number(f.size ?? 0);
      const storagePath = f.storage_path as string | null;

      if (!storagePath) {
        fileContexts.push({ name, type, size, extractedText: "", extractionStatus: "download_failed" });
        continue;
      }

      const { data: blob, error: dlErr } = await supabase.storage.from("project-files").download(storagePath);
      if (dlErr || !blob) {
        console.error("Download failed:", name, dlErr);
        fileContexts.push({ name, type, size, extractedText: "", extractionStatus: "download_failed" });
        continue;
      }

      const buf = new Uint8Array(await blob.arrayBuffer());

      if (type === "pdf") {
        const text = await extractPdfText(buf, 15); // Limit to 15 pages
        fileContexts.push({
          name,
          type,
          size,
          extractedText: text,
          extractionStatus: text ? "ok" : "no_text",
        });
      } else if (type === "excel") {
        fileContexts.push({
          name,
          type,
          size,
          extractedText: "[UNPARSED_SPREADSHEET] Upload a CSV export for guaranteed text extraction.",
          extractionStatus: "unsupported",
        });
      } else {
        fileContexts.push({
          name,
          type,
          size,
          extractedText: "[UNSUPPORTED_FILE_TYPE]",
          extractionStatus: "unsupported",
        });
      }
    }

    await supabase.from("processing_jobs").update({ progress: 50 }).eq("id", jobId);

    const totalTextChars = fileContexts.reduce((acc, f) => acc + (f.extractedText?.length ?? 0), 0);

    // Build prompt
    const systemPrompt = `You are GPT-5.2, acting as a senior PV design engineer conducting a comprehensive design review and data extraction.

CRITICAL GOVERNANCE RULES:
1. Extract ONLY data explicitly present in the uploaded files - never guess or estimate.
2. If a value cannot be extracted, set it to null and add an entry to missingData with a clear reason and sourceHint.
3. Every extracted numeric value MUST have traceability (source file + page/cell reference) in the trace object.
4. Perform engineering calculations where applicable based on international standards (IEC 60364, IEC 62446, IEC 61215).

EXTRACTION TASKS:
1. **PV SYSTEM PARAMETERS**: moduleCount, inverterCount, stringCount, arrayCount, modulesPerString, totalCapacity (kWp), acCapacity (kW)
2. **MAX DC VOLTAGE CALCULATION** (per IEC 62548): Voc_max = Voc_stc × [1 + (Tmin - 25) × TempCoef_Voc / 100] × modules_per_string
3. **CABLE LENGTHS**: Return in METERS (convert from km if needed)
4. **INVERTER SPECIFICATIONS**: model, ratedPower, maxDcVoltage, mpptVoltageMin/Max, maxInputCurrent, mpptCount, quantity
5. **MODULE SPECIFICATIONS**: model, pmax, voc, vmp, isc, imp, tempCoeffVoc, tempCoeffPmax
6. **BILL OF MATERIALS (BoM)**: List all equipment with category, description, quantity, unit, specification, source
7. **BILL OF QUANTITIES (BoQ)**: Measured quantities
8. **DRAWING LAYERS**: If CAD layer names are visible
9. **TEXT LABELS**: Significant equipment labels
10. **MISSING DATA**: For each field that cannot be extracted

Return all data using the extract_pv_data tool.`;

    const MAX_PER_FILE = 40000; // Reduced to avoid timeout
    const filesForPrompt = fileContexts
      .map((f) => {
        const clipped = (f.extractedText || "").slice(0, MAX_PER_FILE);
        const clippedNote = clipped.length < (f.extractedText || "").length ? "\n[TRUNCATED]" : "";
        return `--- ${f.name} (${f.type}, ${f.size} bytes) [${f.extractionStatus}] ---\n${clipped}${clippedNote}`;
      })
      .join("\n\n");

    const userPrompt = `PROJECT FILES (${projectFiles.length})\nTotal extracted text characters: ${totalTextChars}\n\n${filesForPrompt}\n\nAnalyze all files and extract comprehensive PV system data. Calculate max DC voltage if module specs are available. All cable lengths must be in METERS.`;

    await supabase.from("processing_jobs").update({ progress: 60 }).eq("id", jobId);

    const body: any = {
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_pv_data",
            description: "Return extracted PV design quantities, BOM/BOQ, inverter/module specs, and traceability pointers.",
            parameters: {
              type: "object",
              properties: {
                layers: { type: "array", items: { type: "string" } },
                textLabels: { type: "array", items: { type: "string" } },
                cableSummary: {
                  type: "object",
                  properties: {
                    dcLength: { type: ["number", "null"], description: "DC cable length in meters" },
                    acLength: { type: ["number", "null"], description: "AC cable length in meters" },
                    dcCableSpec: { type: ["string", "null"] },
                    acCableSpec: { type: ["string", "null"] },
                  },
                  required: ["dcLength", "acLength"],
                  additionalProperties: false,
                },
                pvParameters: {
                  type: "object",
                  properties: {
                    moduleCount: { type: ["number", "null"] },
                    inverterCount: { type: ["number", "null"] },
                    stringCount: { type: ["number", "null"] },
                    arrayCount: { type: ["number", "null"] },
                    modulesPerString: { type: ["number", "null"] },
                    maxVoltage: { type: ["number", "null"] },
                    maxVoltageCalculation: { type: ["string", "null"] },
                    totalCapacity: { type: ["number", "null"] },
                    acCapacity: { type: ["number", "null"] },
                  },
                  required: ["moduleCount", "inverterCount", "stringCount", "maxVoltage", "totalCapacity"],
                  additionalProperties: false,
                },
                inverterSpecs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      model: { type: ["string", "null"] },
                      manufacturer: { type: ["string", "null"] },
                      ratedPower: { type: ["number", "null"] },
                      maxDcVoltage: { type: ["number", "null"] },
                      mpptVoltageMin: { type: ["number", "null"] },
                      mpptVoltageMax: { type: ["number", "null"] },
                      maxInputCurrent: { type: ["number", "null"] },
                      mpptCount: { type: ["number", "null"] },
                      quantity: { type: ["number", "null"] },
                    },
                    required: ["ratedPower", "quantity"],
                    additionalProperties: false,
                  },
                },
                moduleSpecs: {
                  type: "object",
                  properties: {
                    model: { type: ["string", "null"] },
                    manufacturer: { type: ["string", "null"] },
                    pmax: { type: ["number", "null"] },
                    voc: { type: ["number", "null"] },
                    vmp: { type: ["number", "null"] },
                    isc: { type: ["number", "null"] },
                    imp: { type: ["number", "null"] },
                    tempCoeffVoc: { type: ["number", "null"] },
                    tempCoeffPmax: { type: ["number", "null"] },
                  },
                  additionalProperties: false,
                },
                bom: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      description: { type: "string" },
                      quantity: { type: ["number", "null"] },
                      unit: { type: "string" },
                      specification: { type: "string" },
                    },
                    required: ["category", "description", "quantity", "unit"],
                    additionalProperties: false,
                  },
                },
                boq: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      description: { type: "string" },
                      quantity: { type: ["number", "null"] },
                      unit: { type: "string" },
                    },
                    required: ["category", "description", "quantity", "unit"],
                    additionalProperties: false,
                  },
                },
                trace: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      value: { type: ["string", "number"] },
                      sourceFile: { type: "string" },
                      sourceReference: { type: "string" },
                      unit: { type: "string" },
                    },
                    required: ["value", "sourceFile", "sourceReference"],
                    additionalProperties: false,
                  },
                },
                missingData: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      reason: { type: "string" },
                      sourceHint: { type: "string" },
                    },
                    required: ["field", "reason"],
                    additionalProperties: false,
                  },
                },
                notes: { type: "array", items: { type: "string" } },
              },
              required: ["layers", "textLabels", "cableSummary", "pvParameters", "bom", "boq", "trace", "missingData", "notes"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_pv_data" } },
      temperature: 0.1,
      max_completion_tokens: 6000,
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    await supabase.from("processing_jobs").update({ progress: 85 }).eq("id", jobId);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI gateway error:", resp.status, text);
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: resp.status === 429 
          ? "Rate limit exceeded. Please try again later."
          : resp.status === 402
          ? "AI credits exhausted. Please add credits."
          : `AI gateway error: ${resp.status}`,
      }).eq("id", jobId);
      return;
    }

    const aiResult = await resp.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;

    if (!argsStr) {
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: "Empty AI response",
      }).eq("id", jobId);
      return;
    }

    let extractedData: any;
    try {
      extractedData = JSON.parse(argsStr);
    } catch (e) {
      console.error("Failed to parse tool arguments:", e);
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: "Invalid AI response format",
      }).eq("id", jobId);
      return;
    }

    await supabase.from("processing_jobs").update({ progress: 95 }).eq("id", jobId);

    // Persist to extracted_data table
    try {
      const payload = {
        project_id: projectId,
        layers: extractedData.layers ?? [],
        text_labels: extractedData.textLabels ?? [],
        cable_summary: extractedData.cableSummary ?? {},
        pv_parameters: extractedData.pvParameters ?? {},
        module_parameters: extractedData.moduleSpecs ?? null,
        inverter_parameters: extractedData.inverterSpecs ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("extracted_data")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("extracted_data").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("extracted_data").insert(payload);
      }
    } catch (persistErr) {
      console.error("Persist extracted_data failed:", persistErr);
    }

    // Log prompt/response for audit
    try {
      const tokensUsed = aiResult.usage?.total_tokens ?? null;
      await supabase.from("ai_prompt_logs").insert({
        project_id: projectId,
        prompt_type: "extraction",
        prompt: userPrompt.slice(0, 10000),
        response: JSON.stringify(extractedData).slice(0, 10000),
        model: "openai/gpt-5.2",
        tokens_used: tokensUsed,
        validation_status: "validated",
      });
    } catch (logErr) {
      console.error("Persist ai_prompt_logs failed:", logErr);
    }

    // Complete the job
    await supabase.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: {
        success: true,
        projectId,
        extractedData,
        model: "openai/gpt-5.2",
        timestamp: new Date().toISOString(),
      },
    }).eq("id", jobId);

  } catch (error) {
    console.error("Background extraction error:", error);
    await supabase.from("processing_jobs").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Extraction failed",
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing bearer token" }, 401);

    const { projectId } = (await req.json()) as RequestBody;
    if (!projectId) return json({ error: "Missing projectId" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) return json({ error: "SUPABASE_URL is not configured" }, 500);

    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI service not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user and project ownership
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    const user = userRes?.user;
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("id,user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr) return json({ error: `Failed to load project: ${projectErr.message}` }, 500);
    if (!project) return json({ error: "Project not found" }, 404);
    if (project.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Create a job record immediately
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        job_type: "extraction",
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Failed to create job:", jobError);
      return json({ error: "Failed to create processing job" }, 500);
    }

    // Start background processing
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processExtractionJob(
        job.id,
        projectId,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        LOVABLE_API_KEY
      )
    );

    // Return immediately with job ID
    return json({
      jobId: job.id,
      status: "pending",
      message: "Data extraction started. Poll for results.",
    });

  } catch (error) {
    console.error("Extract data error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
