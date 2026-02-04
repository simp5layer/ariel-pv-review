import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

interface AnalysisRequest {
  projectId: string;
  projectFiles?: { name: string; content: string }[];
}

async function processComplianceJob(
  jobId: string,
  projectId: string,
  clientProjectFiles: { name: string; content: string }[],
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

    // Fetch global standards
    const { data: standards, error: standardsError } = await supabase
      .from("standards_library")
      .select("*")
      .eq("is_global", true);

    if (standardsError || !standards || standards.length === 0) {
      await supabase.from("processing_jobs").update({
        status: "completed",
        progress: 100,
        result: {
          findings: [],
          compliancePercentage: 0,
          summary: "No standards found in library. Please upload standards first.",
          standardsUsed: [],
        },
      }).eq("id", jobId);
      return;
    }

    await supabase.from("processing_jobs").update({ progress: 20 }).eq("id", jobId);

    // Extract standards text (limit pages to reduce CPU)
    const standardContents: { name: string; content: string; status: string }[] = [];
    for (const standard of standards.slice(0, 5)) { // Limit to 5 standards
      if (!standard.storage_path) continue;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("standards")
        .download(standard.storage_path);

      if (downloadError || !fileData) {
        console.error("Standard download error:", standard.file_name, downloadError);
        continue;
      }

      const buf = new Uint8Array(await fileData.arrayBuffer());
      const extractedText = await extractPdfText(buf, 15); // Limit to 15 pages per standard
      standardContents.push({
        name: standard.file_name,
        content: extractedText,
        status: extractedText ? "ok" : "no_text",
      });
    }

    await supabase.from("processing_jobs").update({ progress: 40 }).eq("id", jobId);

    // Load project files
    const { data: projectFilesDb } = await supabase
      .from("project_files")
      .select("name,file_type,storage_path,size")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: true });

    const projectFileContents: { name: string; content: string; status: string }[] = [];
    for (const f of (projectFilesDb || []).slice(0, 5)) { // Limit to 5 files
      if (!f.storage_path) continue;
      const { data: blob, error: dlErr } = await supabase.storage
        .from("project-files")
        .download(f.storage_path);
      if (dlErr || !blob) {
        console.error("Project file download error:", f.name, dlErr);
        continue;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      if (f.file_type === "pdf") {
        const text = await extractPdfText(buf, 15); // Limit to 15 pages
        projectFileContents.push({ name: f.name, content: text, status: text ? "ok" : "no_text" });
      } else {
        projectFileContents.push({
          name: f.name,
          content: `[UNSUPPORTED_FILE_TYPE: ${f.file_type}]`,
          status: "unsupported",
        });
      }
    }

    await supabase.from("processing_jobs").update({ progress: 60 }).eq("id", jobId);

    // Build prompt
    const systemPrompt = `You are an expert PV (photovoltaic) design engineer conducting a comprehensive design review. Your task is to analyze project files against uploaded standards and identify compliance issues.

CRITICAL RULES:
1. ONLY reference clauses and requirements that are explicitly stated in the uploaded standards documents
2. Never invent or assume requirements - if data is missing, mark as "INSUFFICIENT DATA"
3. Every finding MUST include specific clause reference and evidence pointer

SEVERITY CLASSIFICATION:
- CRITICAL: Safety hazards, code violations, system won't function
- MAJOR: Performance degradation, warranty issues, significant rework needed
- MINOR: Optimization opportunities, documentation gaps
- PASS: Requirement verified and met

OUTPUT FORMAT (JSON object):
{
  "findings": [
    {
      "issueId": "unique-id",
      "name": "Short issue title",
      "description": "Detailed description",
      "location": "Where found",
      "standardReference": "Standard name, clause number",
      "severity": "critical|major|minor|pass",
      "actionType": "corrective|recommendation",
      "action": "Steps to resolve",
      "evidencePointer": "File: X, Page: Y",
      "violatedRequirement": "Requirement text",
      "riskExplanation": "What happens if not fixed",
      "impactIfUnresolved": "Consequences"
    }
  ],
  "compliancePercentage": 85,
  "summary": "Brief executive summary"
}`;

    const MAX_PER_DOC = 40000; // Reduced from 80000
    const standardsText = standardContents
      .map((s) => {
        const clipped = (s.content || "").slice(0, MAX_PER_DOC);
        return `\n--- ${s.name} [${s.status}] ---\n${clipped}`;
      })
      .join("\n");

    const clientProvided = (clientProjectFiles || [])
      .map((f) => `\n--- ${f.name} [client-provided] ---\n${(f.content || "").slice(0, MAX_PER_DOC)}`)
      .join("\n");

    const projectText = projectFileContents
      .map((f) => {
        const clipped = (f.content || "").slice(0, MAX_PER_DOC);
        return `\n--- ${f.name} [${f.status}] ---\n${clipped}`;
      })
      .join("\n");

    const userPrompt = `STANDARDS LIBRARY (${standardContents.length} documents):
${standardsText}

PROJECT FILES TO REVIEW (${projectFileContents.length} files):
${projectText}

ADDITIONAL STRUCTURED CONTEXT (client-provided):
${clientProvided}

Analyze these project files against ALL uploaded standards and provide compliance assessment. Return JSON with findings, compliancePercentage, and summary.`;

    await supabase.from("processing_jobs").update({ progress: 70 }).eq("id", jobId);

    // Call GPT-5.2
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 6000,
        response_format: { type: "json_object" }
      }),
    });

    await supabase.from("processing_jobs").update({ progress: 90 }).eq("id", jobId);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: aiResponse.status === 429 
          ? "Rate limit exceeded. Please try again later."
          : aiResponse.status === 402
          ? "AI credits exhausted. Please add credits."
          : `AI analysis failed: ${aiResponse.status}`,
      }).eq("id", jobId);
      return;
    }

    const aiResult = await aiResponse.json();
    const analysisContent = aiResult.choices?.[0]?.message?.content;

    if (!analysisContent) {
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: "Empty AI response",
      }).eq("id", jobId);
      return;
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      await supabase.from("processing_jobs").update({
        status: "failed",
        error: "Invalid AI response format",
      }).eq("id", jobId);
      return;
    }

    // Log AI interaction
    const tokensUsed = aiResult.usage?.total_tokens || 0;
    await supabase.from("ai_prompt_logs").insert({
      project_id: projectId,
      prompt_type: "compliance",
      prompt: userPrompt.substring(0, 10000),
      response: analysisContent.substring(0, 10000),
      model: "openai/gpt-5.2",
      tokens_used: tokensUsed,
      validation_status: "validated"
    });

    // Complete the job
    await supabase.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: {
        findings: analysis.findings || [],
        compliancePercentage: analysis.compliancePercentage || 0,
        summary: analysis.summary || "Analysis complete",
        standardsUsed: standards.map(s => s.file_name),
        tokensUsed,
      },
    }).eq("id", jobId);

  } catch (error) {
    console.error("Background processing error:", error);
    await supabase.from("processing_jobs").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Processing failed",
    }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return json({ error: "AI service not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { projectId, projectFiles } = await req.json() as AnalysisRequest;

    if (!projectId) {
      return json({ error: "Missing projectId" }, 400);
    }

    // Create a job record immediately
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        job_type: "compliance",
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Failed to create job:", jobError);
      return json({ error: "Failed to create processing job" }, 500);
    }

    // Start background processing using EdgeRuntime.waitUntil
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processComplianceJob(
        job.id,
        projectId,
        projectFiles || [],
        supabaseUrl,
        supabaseServiceKey,
        lovableApiKey
      )
    );

    // Return immediately with job ID
    return json({
      jobId: job.id,
      status: "pending",
      message: "Compliance analysis started. Poll for results.",
    });

  } catch (error) {
    console.error("Analyze compliance error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
