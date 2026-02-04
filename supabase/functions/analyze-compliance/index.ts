import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ComplianceFinding {
  issueId: string;
  name: string;
  description: string;
  location: string;
  standardReference: string;
  severity: "critical" | "major" | "minor" | "pass";
  actionType: "corrective" | "recommendation";
  action: string;
  evidencePointer: string;
  violatedRequirement: string;
  riskExplanation: string;
  impactIfUnresolved: string;
}

interface AnalysisRequest {
  projectId: string;
  projectFiles: { name: string; content: string }[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { projectId, projectFiles } = await req.json() as AnalysisRequest;

    if (!projectId || !projectFiles || projectFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing projectId or projectFiles" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all global standards from the library
    const { data: standards, error: standardsError } = await supabase
      .from("standards_library")
      .select("*")
      .eq("is_global", true);

    if (standardsError) {
      console.error("Error fetching standards:", standardsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch standards library" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!standards || standards.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No standards found in library. Please upload standards first.",
          findings: [],
          compliancePercentage: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download standard files from storage
    const standardContents: { name: string; content: string }[] = [];
    
    for (const standard of standards) {
      if (standard.storage_path) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("standards")
          .download(standard.storage_path);

        if (!downloadError && fileData) {
          // For PDFs, we'll need to extract text - for now, just note the file name
          // In production, you'd use a PDF parsing library or service
          standardContents.push({
            name: standard.file_name,
            content: `[PDF Document: ${standard.file_name}] - Standard requirements from ${standard.name}`
          });
        }
      }
    }

    // Build the prompt for GPT-5.2 analysis
    const systemPrompt = `You are an expert PV (photovoltaic) design engineer conducting a comprehensive design review. Your task is to analyze project files against uploaded standards and identify compliance issues.

CRITICAL RULES:
1. ONLY reference clauses and requirements that are explicitly stated in the uploaded standards documents
2. Never invent or assume requirements - if data is missing, mark as "INSUFFICIENT DATA"
3. Every finding MUST include:
   - Specific clause reference from the standards
   - Evidence pointer (file name + page/section)
   - Explicit calculation or comparison showing pass/fail
   - Recommended corrective action

SEVERITY CLASSIFICATION:
- CRITICAL: Safety hazards, code violations, system won't function
- MAJOR: Performance degradation, warranty issues, significant rework needed
- MINOR: Optimization opportunities, documentation gaps
- PASS: Requirement verified and met

OUTPUT FORMAT (JSON array of findings):
{
  "findings": [
    {
      "issueId": "unique-id",
      "name": "Short issue title",
      "description": "Detailed description of the non-compliance",
      "location": "Where in the project files this was found",
      "standardReference": "Standard name, clause number, exact text",
      "severity": "critical|major|minor|pass",
      "actionType": "corrective|recommendation",
      "action": "Specific steps to resolve",
      "evidencePointer": "File: X, Page/Section: Y",
      "violatedRequirement": "Exact requirement text from standard",
      "riskExplanation": "What happens if not fixed",
      "impactIfUnresolved": "Consequences of inaction"
    }
  ],
  "compliancePercentage": 85,
  "summary": "Brief executive summary"
}`;

    const userPrompt = `STANDARDS LIBRARY (${standardContents.length} documents):
${standardContents.map(s => `\n--- ${s.name} ---\n${s.content}`).join("\n")}

PROJECT FILES TO REVIEW (${projectFiles.length} files):
${projectFiles.map(f => `\n--- ${f.name} ---\n${f.content}`).join("\n")}

Please analyze these project files against ALL uploaded standards and provide a comprehensive compliance assessment. Check every line and parameter for alignment with the standards. Return the analysis as a JSON object with findings array, compliancePercentage, and summary.`;

    // Call GPT-5.2 via Lovable AI Gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        max_tokens: 8000,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const analysisContent = aiResult.choices?.[0]?.message?.content;

    if (!analysisContent) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI response
    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the AI interaction for audit trail
    const tokensUsed = aiResult.usage?.total_tokens || 0;
    
    await supabase.from("ai_prompt_logs").insert({
      project_id: projectId,
      prompt_type: "compliance",
      prompt: userPrompt.substring(0, 10000), // Truncate for storage
      response: analysisContent.substring(0, 10000),
      model: "openai/gpt-5.2",
      tokens_used: tokensUsed,
      validation_status: "validated"
    });

    return new Response(
      JSON.stringify({
        findings: analysis.findings || [],
        compliancePercentage: analysis.compliancePercentage || 0,
        summary: analysis.summary || "Analysis complete",
        standardsUsed: standards.map(s => s.file_name),
        tokensUsed
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analyze compliance error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
