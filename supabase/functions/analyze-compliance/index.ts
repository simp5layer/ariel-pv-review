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

type ExtractedDataLike = Record<string, unknown> | null;

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getClientExtractedData(projectFiles: { name: string; content: string }[]): ExtractedDataLike {
  const extracted = projectFiles.find((f) => (f?.name || "").toLowerCase() === "extracted_data.json");
  if (!extracted?.content) return null;
  return safeJsonParse<Record<string, unknown>>(extracted.content);
}

async function triggerDeliverablesGeneration(opts: {
  supabaseUrl: string;
  userAccessToken: string;
  projectId: string;
  submissionId: string;
  findings: unknown[];
  extractedData: ExtractedDataLike;
}) {
  const { supabaseUrl, userAccessToken, projectId, submissionId, findings, extractedData } = opts;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-deliverables`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        projectId,
        submissionId,
        findings,
        extractedData,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("Auto deliverables trigger failed:", resp.status, t);
      return { ok: false, status: resp.status };
    }

    const data = await resp.json().catch(() => ({}));
    return { ok: true, data };
  } catch (e) {
    console.error("Auto deliverables trigger error:", e);
    return { ok: false, status: 0 };
  }
}

async function processComplianceJob(
  jobId: string,
  projectId: string,
  userId: string,
  userEmail: string,
  userAccessToken: string,
  clientProjectFiles: { name: string; content: string }[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create a real submission record first
  let submissionId: string | null = null;
  try {
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        project_id: projectId,
        submitted_by: userEmail || "Engineer",
        status: "pending",
        compliance_percentage: 0,
      })
      .select()
      .single();

    if (subError) {
      console.error("Failed to create submission:", subError);
    } else {
      submissionId = submission.id;
    }
  } catch (err) {
    console.error("Submission creation error:", err);
  }

  try {
    // Update job to processing
    await supabase
      .from("processing_jobs")
      .update({ status: "processing", progress: 10 })
      .eq("id", jobId);

    // Fetch global standards (user's standards library)
    const { data: standards, error: standardsError } = await supabase
      .from("standards_library")
      .select("*");

    if (standardsError || !standards || standards.length === 0) {
      await supabase.from("processing_jobs").update({
        status: "completed",
        progress: 100,
        result: {
          findings: [],
          compliancePercentage: 0,
          summary: "No standards found in library. Please upload standards first.",
          standardsUsed: [],
          submissionId,
        },
      }).eq("id", jobId);
      return;
    }

    await supabase.from("processing_jobs").update({ progress: 15 }).eq("id", jobId);

    // Extract standards text (limit pages to reduce CPU)
    const standardContents: { name: string; content: string; status: string }[] = [];
    for (const standard of standards.slice(0, 8)) { // Allow up to 8 standards
      if (!standard.storage_path) continue;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("standards")
        .download(standard.storage_path);

      if (downloadError || !fileData) {
        console.error("Standard download error:", standard.file_name, downloadError);
        continue;
      }

      const buf = new Uint8Array(await fileData.arrayBuffer());
      const extractedText = await extractPdfText(buf, 20); // Limit to 20 pages per standard
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

    // Build prompt with enhanced instructions for deep analysis
    const systemPrompt = `You are an expert PV (photovoltaic) design engineer with 20+ years of experience conducting comprehensive design reviews per IEC, SEC, SBC, SASO, MOMRA, SERA, WERA, and NEC standards.

MISSION: Perform DEEP ANALYSIS of ALL provided project files (drawings, specifications, datasheets) against ALL provided regulatory standards. Extract every technical parameter, calculation, and design decision. Verify each against applicable clauses.

ANALYSIS METHODOLOGY:
1. DOCUMENT PARSING: Extract ALL technical data from project files:
   - Module specifications (Pmax, Voc, Isc, Vmp, Imp, temperature coefficients)
   - Inverter specifications (MPPT range, max input voltage/current, efficiency)
   - String configurations (modules per string, strings per inverter)
   - Cable specifications (type, cross-section, length, voltage drop)
   - Protection devices (fuses, breakers, surge protectors)
   - Grounding and bonding details

2. STANDARDS VERIFICATION: For EACH extracted parameter:
   - Identify applicable standard clause(s)
   - Quote the requirement verbatim
   - Compare design value vs required value
   - Calculate margins and verify compliance

3. ENGINEERING CALCULATIONS: Verify with explicit formulas:
   - String Voc = N_modules × Voc_module × (1 + Voc_temp_coeff × (T_min - 25))
   - Voltage drop = (2 × L × I × ρ) / A
   - Cable ampacity vs operating current
   - Protection device coordination

CRITICAL RULES:
- Reference ONLY clauses explicitly present in uploaded standards
- If data is missing, mark finding as "INSUFFICIENT DATA" and list what's missing
- Every finding MUST cite: file name, page/section, and exact clause number
- Target approximately 8 findings: 1 Critical, 5 Major, 2 Minor (if issues exist)

SEVERITY (use engineering judgment):
- CRITICAL (P0): Safety hazards, code violations blocking commissioning
- MAJOR (P1): Performance issues, warranty risks, rework needed
- MINOR (P2): Optimizations, documentation gaps

OUTPUT FORMAT (JSON):
{
  "findings": [
    {
      "issueId": "NCR-001",
      "name": "String Voltage Exceeds Inverter Max Input",
      "description": "Detailed technical description with calculations",
      "location": "SLD Drawing, Section 3.2",
      "standardReference": "IEC 62548 Clause 7.2.1",
      "severity": "critical",
      "actionType": "corrective",
      "action": "Reduce modules per string from 22 to 20 to maintain Voc < 1000V",
      "evidencePointer": "File: Project_SLD.pdf, Page: 3",
      "violatedRequirement": "String open-circuit voltage shall not exceed inverter maximum input voltage under lowest operating temperature",
      "riskExplanation": "Over-voltage can damage inverter input stage and void warranty",
      "impactIfUnresolved": "System cannot be commissioned; potential equipment damage"
    }
  ],
  "compliancePercentage": 72,
  "summary": "Brief executive summary of overall compliance status"
}`;

    const MAX_PER_DOC = 50000;
    const standardsText = standardContents
      .map((s) => {
        const clipped = (s.content || "").slice(0, MAX_PER_DOC);
        return `\n=== STANDARD: ${s.name} [${s.status}] ===\n${clipped}`;
      })
      .join("\n\n");

    const clientProvided = (clientProjectFiles || [])
      .map((f) => `\n=== PROJECT FILE: ${f.name} ===\n${(f.content || "").slice(0, MAX_PER_DOC)}`)
      .join("\n\n");

    const projectText = projectFileContents
      .map((f) => {
        const clipped = (f.content || "").slice(0, MAX_PER_DOC);
        return `\n=== PROJECT FILE: ${f.name} [${f.status}] ===\n${clipped}`;
      })
      .join("\n\n");

    const userPrompt = `## REGULATORY STANDARDS LIBRARY (${standardContents.length} documents)
These are the applicable international and national standards that MUST be used for compliance verification:
${standardsText}

## PROJECT DESIGN FILES (${projectFileContents.length} uploaded files)
These are the engineering drawings, specifications, and calculations to review:
${projectText}

## ADDITIONAL CONTEXT
${clientProvided}

INSTRUCTIONS:
1. Parse ALL project files thoroughly - extract every technical specification
2. Cross-reference EACH specification against the applicable standards
3. Perform independent calculations to verify design values
4. Generate detailed findings with evidence pointers
5. Calculate overall compliance percentage using weighted scoring

Provide your analysis as JSON with findings array, compliancePercentage, and summary.`;

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
      validation_status: "validated",
      submission_id: submissionId,
    });

    // Calculate compliance percentage with weighted scoring (ITRFFE model)
    const findings = analysis.findings || [];
    const criticalCount = findings.filter((f: any) => f.severity === "critical").length;
    const majorCount = findings.filter((f: any) => f.severity === "major").length;
    const minorCount = findings.filter((f: any) => f.severity === "minor").length;
    const weightedScore = Math.max(0, 100 - (criticalCount * 15 + majorCount * 8 + minorCount * 3));
    const finalCompliance = analysis.compliancePercentage ?? weightedScore;

    // Update the submission with final compliance percentage
    if (submissionId) {
      await supabase.from("submissions").update({
        status: finalCompliance >= 80 ? "passed" : "failed",
        compliance_percentage: finalCompliance,
        completed_at: new Date().toISOString(),
      }).eq("id", submissionId);

      // Store compliance findings in database
      for (const finding of findings) {
        await supabase.from("compliance_findings").insert({
          submission_id: submissionId,
          issue_id: finding.issueId || `NCR-${crypto.randomUUID().slice(0, 8)}`,
          name: finding.name || "Unnamed Finding",
          description: finding.description || "",
          location: finding.location || "Unknown",
          standard_reference: finding.standardReference || "N/A",
          severity: finding.severity || "minor",
          action_type: finding.actionType || "recommendation",
          action: finding.action || "Review required",
          evidence_pointer: finding.evidencePointer,
          violated_requirement: finding.violatedRequirement,
          risk_explanation: finding.riskExplanation,
          impact_if_unresolved: finding.impactIfUnresolved,
        });
      }
    }

    // Complete the job
    await supabase.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: {
        findings,
        compliancePercentage: finalCompliance,
        summary: analysis.summary || "Analysis complete",
        standardsUsed: standards.map(s => s.file_name),
        tokensUsed,
        submissionId,
      },
    }).eq("id", jobId);

    // Auto-trigger deliverables generation (async) once compliance is completed successfully.
    // We use the *same user access token* from the original request to satisfy auth in generate-deliverables.
    if (submissionId && userAccessToken) {
      // Prefer the full extracted_data.json provided by the client (contains trace/bom/boq/missingData)
      // Fallback to DB extracted_data if not provided.
      let extractedData: ExtractedDataLike = getClientExtractedData(clientProjectFiles);
      if (!extractedData) {
        const { data: dbExtracted } = await supabase
          .from("extracted_data")
          .select("layers,text_labels,cable_summary,pv_parameters,module_parameters,inverter_parameters")
          .eq("project_id", projectId)
          .maybeSingle();

        if (dbExtracted) {
          extractedData = {
            layers: dbExtracted.layers,
            textLabels: dbExtracted.text_labels,
            cableSummary: dbExtracted.cable_summary,
            pvParameters: dbExtracted.pv_parameters,
            moduleParameters: dbExtracted.module_parameters,
            inverterParameters: dbExtracted.inverter_parameters,
          };
        }
      }

      const delRes = await triggerDeliverablesGeneration({
        supabaseUrl,
        userAccessToken,
        projectId,
        submissionId,
        findings,
        extractedData,
      });

      if (!delRes.ok) {
        // Do not fail compliance job for deliverables issues; user can still retry manually.
        console.warn("Deliverables auto-generation was not started.");
      } else {
        // Attach job reference to compliance job result for debugging/traceability.
        await supabase
          .from("processing_jobs")
          .update({
            result: {
              findings,
              compliancePercentage: finalCompliance,
              summary: analysis.summary || "Analysis complete",
              standardsUsed: standards.map((s) => s.file_name),
              tokensUsed,
              submissionId,
              deliverablesJob: (delRes as any).data,
            },
          })
          .eq("id", jobId);
      }
    }

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
        user.id,
        user.email || "Engineer",
        token,
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
