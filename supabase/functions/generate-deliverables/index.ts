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

    // Upsert deliverables to database
    for (const del of generatedDeliverables) {
      const { error } = await supabase
        .from("deliverables")
        .upsert({
          submission_id: submissionId,
          type: del.type,
          name: getDeliverableName(del.type),
          status: "generated",
          content: del.content,
          generated_at: new Date().toISOString(),
        }, { onConflict: "submission_id,type" });

      if (error) {
        console.error(`Failed to save deliverable ${del.type}:`, error);
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
    ai_prompt_log: `Generate a formatted AI Prompt Log documenting all AI interactions for this PV design review. Include timestamps, prompt types (extraction/calculation/compliance), token usage, and validation status. Format as Markdown.`,
    design_review_report: `Generate a comprehensive Design Review Report with Executive Summary for this PV project. Include project overview, methodology, key findings summary, compliance status, and recommendations. Format as professional engineering report in Markdown.`,
    issue_register: `Generate a Non-Conformity Report (NCR) / Issue Register in tabular format. List all findings with: Issue ID, Name, Description, Location, Standard Reference, Severity (P0/P1/P2), Action Type, and Required Action. Format as Markdown table.`,
    compliance_checklist: `Generate a Standards Compliance Checklist covering IEC, SEC, SBC, SASO, MOMRA, SERA regulations. For each applicable clause, indicate PASS/FAIL/N/A with evidence references. Format as Markdown checklist.`,
    recalculation_sheet: `Generate a Recalculation Sheet showing all engineering calculations with explicit formulas, inputs, assumptions, and results. Include voltage calculations, current checks, cable sizing verification. Format as Markdown with formulas.`,
    redline_notes: `Generate Redline Notes listing specific corrections needed on the design drawings. Reference exact locations (file, page, section) and describe the required changes. Format as numbered list in Markdown.`,
    bom_boq: `Generate an Optimized Bill of Materials (BoM) and Bill of Quantities (BoQ) based on extracted data. Include component counts, specifications, and any optimization recommendations. Format as Markdown tables.`,
    risk_reflection: `Generate a 1-page Risk Reflection document assessing AI reliability and limitations in this review. Discuss confidence levels, areas requiring human verification, and potential blind spots. Format as Markdown.`,
  };

  const userPrompt = `
PROJECT FINDINGS (${findings.length} items):
${JSON.stringify(findings, null, 2)}

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

Generate the ${getDeliverableName(type)} based on this data. Be thorough, professional, and cite specific evidence where applicable.
`;

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

    // Get or create submission
    let actualSubmissionId: string = submissionId || "";
    if (!actualSubmissionId) {
      // Create a new submission
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
