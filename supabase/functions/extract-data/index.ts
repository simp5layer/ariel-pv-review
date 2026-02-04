import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  projectId: string;
  // backward-compat (ignored): previous client sent { files: [...] }
  files?: unknown;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function extractPdfText(data: Uint8Array): Promise<string> {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const maxPages = Math.min(doc.numPages, 50);
  const chunks: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
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

    const { data: projectFiles, error: filesErr } = await supabase
      .from("project_files")
      .select("name,file_type,storage_path,size")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: true });

    if (filesErr) return json({ error: `Failed to load project files: ${filesErr.message}` }, 500);
    if (!projectFiles || projectFiles.length === 0) return json({ error: "No project files found" }, 400);

    const fileContexts: Array<{
      name: string;
      type: string;
      size: number;
      extractedText: string;
      extractionStatus: "ok" | "no_text" | "unsupported" | "download_failed";
    }> = [];

    for (const f of projectFiles) {
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
        const text = await extractPdfText(buf);
        fileContexts.push({
          name,
          type,
          size,
          extractedText: text,
          extractionStatus: text ? "ok" : "no_text",
        });
      } else if (type === "excel") {
        // We don't parse XLSX in this iteration; still provide a placeholder so the model can ask for missing fields.
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

    const totalTextChars = fileContexts.reduce((acc, f) => acc + (f.extractedText?.length ?? 0), 0);

    const systemPrompt = `You are GPT-5.2 acting as a PV design engineer.

CRITICAL GOVERNANCE:
- Do NOT guess or estimate. If a value is not explicitly present in the files, output it as null and add it to missingData with a clear reason.
- Every extracted numeric value must have traceability (source file + page/cell reference) in the trace object.
- If a PDF has no extractable text, say so in notes and request the missing input (DWG, native CAD export, or a text-based PDF).

TASK:
Extract PV system quantities and key parameters so the UI can show:
- Bill of Materials (BoM)
- Bill of Quantities (BoQ)
- Module count, inverter count, string count, array count (if available)
- DC cable length (m) and AC cable length (m)
- Maximum DC voltage (V)

Return structured data ONLY via the provided tool call.`;

    // Limit per-file text so prompts don't explode
    const MAX_PER_FILE = 80_000;
    const filesForPrompt = fileContexts
      .map((f) => {
        const clipped = (f.extractedText || "").slice(0, MAX_PER_FILE);
        const clippedNote = clipped.length < (f.extractedText || "").length ? "\n[TRUNCATED]" : "";
        return `--- ${f.name} (${f.type}, ${f.size} bytes) [${f.extractionStatus}] ---\n${clipped}${clippedNote}`;
      })
      .join("\n\n");

    const userPrompt = `PROJECT FILES (${projectFiles.length})\nTotal extracted text characters: ${totalTextChars}\n\n${filesForPrompt}`;

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
            description: "Return extracted PV design quantities, BOM/BOQ, and traceability pointers.",
            parameters: {
              type: "object",
              properties: {
                layers: { type: "array", items: { type: "string" } },
                textLabels: { type: "array", items: { type: "string" } },
                cableSummary: {
                  type: "object",
                  properties: {
                    dcLength: { type: ["number", "null"] },
                    acLength: { type: ["number", "null"] },
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
                    maxVoltage: { type: ["number", "null"] },
                    totalCapacity: { type: ["number", "null"] },
                  },
                  required: ["moduleCount", "inverterCount", "stringCount", "maxVoltage", "totalCapacity"],
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
                      source: {
                        type: "object",
                        properties: {
                          sourceFile: { type: "string" },
                          sourceReference: { type: "string" },
                        },
                        required: ["sourceFile", "sourceReference"],
                        additionalProperties: false,
                      },
                      notes: { type: "string" },
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
                      specification: { type: "string" },
                      source: {
                        type: "object",
                        properties: {
                          sourceFile: { type: "string" },
                          sourceReference: { type: "string" },
                        },
                        required: ["sourceFile", "sourceReference"],
                        additionalProperties: false,
                      },
                      notes: { type: "string" },
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
      max_completion_tokens: 8000,
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted. Please add credits to continue." }, 402);
      console.error("AI gateway error:", resp.status, text);
      return json({ error: `AI gateway error: ${resp.status}` }, 500);
    }

    const aiResult = await resp.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) return json({ error: "Empty AI response" }, 500);

    let extractedData: any;
    try {
      extractedData = JSON.parse(argsStr);
    } catch (e) {
      console.error("Failed to parse tool arguments:", e);
      return json({ error: "Invalid AI response format" }, 500);
    }

    // Persist to extracted_data table (best-effort, no schema changes)
    try {
      const payload = {
        project_id: projectId,
        layers: extractedData.layers ?? [],
        text_labels: extractedData.textLabels ?? [],
        cable_summary: extractedData.cableSummary ?? {},
        pv_parameters: extractedData.pvParameters ?? {},
        module_parameters: extractedData.moduleParameters ?? null,
        inverter_parameters: extractedData.inverterParameters ?? null,
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

    // Log prompt/response for audit (best-effort)
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

    return json({
      success: true,
      projectId,
      extractedData,
      model: "openai/gpt-5.2",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Extract data error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
