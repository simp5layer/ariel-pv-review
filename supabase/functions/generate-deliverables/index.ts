import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

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

interface GenerateRequest {
  projectId: string;
  submissionId?: string;
  findings: any[];
  extractedData: any;
}

const deliverableTypes = [
  "ai_prompt_log",
  "design_review_report",
  "issue_register",
  "compliance_checklist",
  "recalculation_sheet",
  "redline_notes",
  "bom_boq",
  "risk_reflection",
] as const;

type DeliverableType = typeof deliverableTypes[number];

async function processDeliverablesJob(
  jobId: string,
  projectId: string,
  submissionId: string,
  findings: any[],
  extractedData: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    await supabase.from("processing_jobs").update({ status: "processing", progress: 10 }).eq("id", jobId);

    // Count existing deliverables
    const { data: existingDeliverables } = await supabase
      .from("deliverables")
      .select("type, status")
      .eq("submission_id", submissionId);

    const existingTypes = new Set((existingDeliverables || []).filter(d => d.status !== "not_generated").map(d => d.type));
    const missingTypes = deliverableTypes.filter(t => !existingTypes.has(t));

    await supabase.from("processing_jobs").update({ progress: 20 }).eq("id", jobId);

    // Generate each missing deliverable
    const generatedDeliverables: { type: DeliverableType; content: string }[] = [];
    const progressPerType = 60 / Math.max(missingTypes.length, 1);

    for (let i = 0; i < missingTypes.length; i++) {
      const type = missingTypes[i];
      const content = await generateDeliverableContent(type, findings, extractedData, lovableApiKey);
      generatedDeliverables.push({ type, content });

      await supabase.from("processing_jobs").update({ progress: Math.round(20 + (i + 1) * progressPerType) }).eq("id", jobId);
    }

    await supabase.from("processing_jobs").update({ progress: 85 }).eq("id", jobId);

    // Save deliverables to database (avoid relying on a DB unique constraint for upsert)
    for (const del of generatedDeliverables) {
      const now = new Date().toISOString();
      const { data: existing, error: selErr } = await supabase
        .from("deliverables")
        .select("id")
        .eq("submission_id", submissionId)
        .eq("type", del.type)
        .maybeSingle();

      if (selErr) {
        console.error(`Failed to check existing deliverable ${del.type}:`, selErr);
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("deliverables")
          .update({
            name: getDeliverableName(del.type),
            status: "updated",
            content: del.content,
            updated_at: now,
          })
          .eq("id", existing.id);
        if (updErr) console.error(`Failed to update deliverable ${del.type}:`, updErr);
      } else {
        const { error: insErr } = await supabase
          .from("deliverables")
          .insert({
            submission_id: submissionId,
            type: del.type,
            name: getDeliverableName(del.type),
            status: "generated",
            content: del.content,
            generated_at: now,
          });
        if (insErr) console.error(`Failed to insert deliverable ${del.type}:`, insErr);
      }
    }

    await supabase.from("processing_jobs").update({
      status: "completed",
      progress: 100,
      result: {
        generated: generatedDeliverables.map(d => d.type),
        totalGenerated: generatedDeliverables.length,
      },
    }).eq("id", jobId);

  } catch (error) {
    console.error("Deliverables generation error:", error);
    await supabase.from("processing_jobs").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Generation failed",
    }).eq("id", jobId);
  }
}

function getDeliverableName(type: DeliverableType): string {
  const names: Record<DeliverableType, string> = {
    ai_prompt_log: "AI Prompt Log",
    design_review_report: "Design Review Report",
    issue_register: "Issue Register (NCR)",
    compliance_checklist: "Standards Compliance Checklist",
    recalculation_sheet: "Recalculation Sheet",
    redline_notes: "Redline Notes",
    bom_boq: "Optimized BoM & BoQ",
    risk_reflection: "Risk Reflection",
  };
  return names[type];
}

async function generateDeliverableContent(
  type: DeliverableType,
  findings: any[],
  extractedData: any,
  lovableApiKey: string
): Promise<string> {
  const systemPrompts: Record<DeliverableType, string> = {
    ai_prompt_log: `You are a PV engineering QA assistant.

Create an **AI Prompt Log** for this project as Markdown.

Rules:
- Only include facts present in inputs.
- If the inputs do not contain real prompts/timestamps, explicitly state "INSUFFICIENT DATA" and list what is missing.

Include:
- Prompt types used (extraction/compliance/deliverables)
- Models used (if provided)
- Token usage (if provided)
- Validation status (if provided)
- A clear audit trail section`,

    design_review_report: `You are a senior PV design engineer writing an ITRFFE-style Design Review Report.

Write a **Design Review Report** as Markdown with the following REQUIRED sections and formatting:

1) Title block (Project name/location/system type if available)
2) Executive Summary (5–10 bullet points + short paragraph)
3) Project Overview
   - System capacity (DC kWp, AC kW) if available
   - Module count
   - Inverter count + key inverter limits (max DC voltage/current, MPPT range)
   - **String configuration**: stringCount, modulesPerString, stringsPerMPPT
4) Data Sources & Traceability
   - For each key quantity (moduleCount, inverterCount, stringCount, modulesPerString, maxVoltage, totalCapacity), include **Source File + Page/Section/Cell**.
   - Use extractedData.trace and/or findings.evidencePointer.
   - Do NOT invent references. If missing, write "INSUFFICIENT DATA" for that item.
5) Compliance Status
   - Compliance percentage + explanation of scoring basis (if provided)
   - Summary table of findings by severity
6) String Configuration Analysis
   - Validate string Voc/Vmp vs inverter limits (use actual numbers; show intermediate steps)
   - Highlight any over-voltage / over-current risks
7) Detailed Findings
   - For each finding: Issue ID, severity (P0/P1/P2), standard clause, evidence pointer, required action
8) Recommendations & Next Steps

Strict rules:
- Do not assume values not present.
- If module/inverter data is incomplete, include a Missing Inputs section instead of guessing.`,

    issue_register: `You are a PV compliance engineer.

Generate an **Issue Register (NCR-style)** as a Markdown table.

Columns (required): Issue ID | Severity (P0/P1/P2) | Title | Description | Location | Standard Reference | Evidence (File+Ref) | Required Action.

Rules:
- Use findings array only.
- If evidencePointer is missing, write "INSUFFICIENT DATA" in Evidence.
- Keep actions specific and testable.`,

    compliance_checklist: `You are a PV compliance engineer.

Generate a **Standards Compliance Checklist** as Markdown.

Rules:
- Derive checklist items from the *provided findings* and any explicit standard references found in inputs.
- Each checklist item must include: Clause | Requirement | Status (PASS/FAIL/N/A) | Evidence (File+Ref).
- Do not fabricate clauses. If you cannot cite a clause, mark N/A and explain in one sentence.`,

    recalculation_sheet: `You are a PV design engineer producing an ITRFFE-style recalculation sheet.

Generate a **Recalculation Sheet** as Markdown with explicit formulas and substituted numbers.

REQUIRED calculations (if inputs exist; otherwise mark "INSUFFICIENT DATA" and list missing fields):

A) String voltage calculations
   - Voc_STC (module)
   - Voc_cold (module) using temperature coefficient and Tmin
   - String Voc_cold = modulesPerString × Voc_cold(module)
   - Vmp_STC (module) and String Vmp_STC

B) Current calculations
   - Isc, Imp (module)
   - String current (Imp)
   - Total array current based on stringsPerMPPT / total string count

C) Inverter compatibility checks
   - Compare String Voc_cold vs inverter max DC voltage
   - Compare string current / parallel strings vs inverter max input current
   - Compare String Vmp vs MPPT voltage range

D) Cable sizing verification
   - If conductor size/length/current is available, show voltage drop and ampacity check.

Formatting rules:
- Every calculation must show: Formula → Inputs → Substitution → Result → Pass/Fail/Insufficient.
- Cite sources for each input (File + Page/Cell), using extractedData.trace or findings.evidencePointer.
- Do not invent Tmin; if not provided, request it.`,

    redline_notes: `You are a PV QA reviewer creating actionable redline notes.

Generate **Redline Notes** as a Markdown list.

For EACH issue (from findings), include ALL fields:
- File name
- Page number / section / cell
- Location on drawing/document
- Current state (what is shown)
- Required correction (exact edit)
- Standard reference (clause)

Rules:
- Use findings.evidencePointer as primary source.
- If a field is missing, write "INSUFFICIENT DATA" and specify what to provide.
- Keep corrections as unambiguous markup instructions.`,

    bom_boq: `You are a PV engineer preparing BoM/BoQ deliverables.

Generate an **Optimized BoM & BoQ** as Markdown tables.

Requirements:
- Separate BoM and BoQ sections.
- For each line item include: Category | Description | Qty | Unit | Specification | Source (File+Ref).
- Use extractedData.bom / extractedData.boq when available.
- Do not invent quantities/specs; if missing, list as "INSUFFICIENT DATA".`,

    risk_reflection: `You are a PV engineering auditor writing a 1-page risk reflection on AI reliability.

Generate **Risk Reflection** as Markdown with these REQUIRED sections:

1) Confidence by data category (High/Medium/Low)
   - String configuration
   - Module parameters
   - Inverter parameters
   - Cable lengths/sizing
   - BoM/BoQ
   - Standards clause mapping

2) Data quality issues
   - Missing fields (use extractedData.missingData)
   - Low-quality sources (e.g., PDFs with no text)

3) Human verification checklist
   - Specific items an engineer must verify in drawings/datasheets

4) AI limitations in this review
   - Explicitly call out any unsupported file types / truncated text

Rules:
- Base confidence on presence/traceability of inputs (trace/evidencePointer).
- If missingData is absent, state that limitation.
`,
  };

  const userPrompt = `INPUTS (do not assume missing data):

FINDINGS (${findings.length}):
${JSON.stringify(findings, null, 2)}

EXTRACTED_DATA:
${JSON.stringify(extractedData, null, 2)}

OUTPUT:
Generate the ${getDeliverableName(type)}. Use only the provided inputs, and include file/page/section/cell references wherever possible.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: systemPrompts[type] },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed for ${type}: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || `[${type} content could not be generated]`;
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

    const { projectId, submissionId, findings, extractedData } = await req.json() as GenerateRequest;

    if (!projectId) {
      return json({ error: "Missing projectId" }, 400);
    }

    // Get or create submission - ALWAYS validate submission exists in DB
    let actualSubmissionId: string = "";
    
    if (submissionId) {
      // Verify submission exists
      const { data: existingSub, error: subCheckError } = await supabase
        .from("submissions")
        .select("id")
        .eq("id", submissionId)
        .maybeSingle();
      
      if (existingSub) {
        actualSubmissionId = existingSub.id;
      } else {
        console.log("Provided submissionId not found in DB, will create new:", submissionId);
      }
    }
    
    // If no valid submission, create one
    if (!actualSubmissionId) {
      const { data: newSubmission, error: subError } = await supabase
        .from("submissions")
        .insert({
          project_id: projectId,
          submitted_by: user.email || "Unknown",
          status: "pending",
          compliance_percentage: 0,
        })
        .select()
        .single();

      if (subError) {
        console.error("Failed to create submission:", subError);
        return json({ error: "Failed to create submission" }, 500);
      }
      actualSubmissionId = newSubmission.id;
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        job_type: "deliverables",
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      return json({ error: "Failed to create processing job" }, 500);
    }

    // Start background processing
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processDeliverablesJob(
        job.id,
        projectId,
        actualSubmissionId,
        findings || [],
        extractedData || {},
        supabaseUrl,
        supabaseServiceKey,
        lovableApiKey
      )
    );

    return json({
      jobId: job.id,
      submissionId: actualSubmissionId,
      status: "pending",
      message: "Deliverables generation started. Poll for results.",
    });

  } catch (error) {
    console.error("Generate deliverables error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
