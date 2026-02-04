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
  // SEC-compliant Independent Engineer Design Review prompts
  const systemPrompts: Record<DeliverableType, string> = {
    ai_prompt_log: `You are a Saudi Electricity Company (SEC)–compliant Independent Electrical Engineer.

Generate an **AI Prompt Log** as Markdown for regulatory audit trail.

REQUIRED SECTIONS:
1. **Audit Trail Header**
   - Project ID, Review Date, Engineer ID (placeholder)
   - AI Model(s) used

2. **Prompt Categories**
   - Extraction prompts (data extraction from drawings)
   - Compliance prompts (standards verification)
   - Calculation prompts (engineering verifications)
   - Deliverables prompts (report generation)

3. **For Each Prompt Entry**
   - Timestamp (if available)
   - Prompt type
   - Input summary (file names, data types)
   - Output summary (findings count, data extracted)
   - Token usage (if available)
   - Validation status

4. **AI Governance Statement**
   - Limitations acknowledged
   - Human verification requirements
   - Model version and date

Rules:
- Use only facts from inputs
- Mark "INSUFFICIENT DATA" for missing information
- Include SEC/WERA/IEC reference where applicable`,

    design_review_report: `You are acting as a Saudi Electricity Company (SEC)–compliant Independent Electrical Engineer.

Generate an **SEC-Ready Design Review Report** as Markdown.

THIS IS A REGULATORY AUDIT – NOT A DESCRIPTIVE REVIEW.
Assume any requirement not explicitly demonstrated with evidence is NON-COMPLIANT.

## REQUIRED STRUCTURE:

### 1. TITLE BLOCK
- Project Name, Location, System Type
- Review Date, Report Version
- Independent Engineer: [Placeholder]
- SEC Application Reference: [If available]

### 2. EXECUTIVE SUMMARY (Critical for SEC approval)
- **Approval Recommendation**: One of:
  - "NOT SEC-APPROVABLE until Critical Issues are closed"
  - "CONDITIONALLY APPROVABLE subject to listed actions"
  - "SEC-COMPLIANT for connection"
- Total Compliance Score: X%
- Critical Issues: X, Major Issues: X, Minor Issues: X
- Key blocking items (if any)

### 3. PROJECT OVERVIEW
- DC Capacity (kWp), AC Capacity (kW)
- Module count and model
- Inverter count and model
- **String Configuration**: stringCount, modulesPerString, stringsPerMPPT
- Connection type (grid-tied, standalone, hybrid)

### 4. STANDARDS COMPLIANCE MATRIX
| Standard | Clause | Requirement | Evidence | Status |
|----------|--------|-------------|----------|--------|
| SEC REG | X.X.X | Requirement text | File/Page | PASS/FAIL |
| IEC 62116 | X.X | Anti-islanding | File/Page | PASS/FAIL |
| SASO IEC 62548 | X.X | Installation | File/Page | PASS/FAIL |

### 5. PHASE 1 – GAP & DEFICIENCY AUDIT
For EACH category, state:
- What the design/report claims
- What SEC/standards actually require
- Whether evidence EXISTS
- Verdict: COMPLIANT / NON-COMPLIANT / INSUFFICIENT DATA

Audit categories:
1. Interface Protection / Anti-Islanding (SASO IEC 62116)
2. Short-circuit level & MCCB breaking capacity (IEC 60947, IEC 60909)
3. Protection coordination & selectivity
4. Metering requirements (if >100 kW)
5. Surge Protection Devices (IEC 61643)
6. Earthing system & testing
7. Safety labeling & firefighter information
8. Documentation completeness (SEC checklist)

### 6. DATA SOURCES & TRACEABILITY
For each key value, cite: File Name + Page/Section

### 7. STRING CONFIGURATION ANALYSIS
- Voc calculations with temperature coefficients
- Comparison vs inverter max input voltage
- Current calculations vs inverter limits

### 8. DETAILED FINDINGS (from Issue Register)
Summary table with Issue ID, Severity, Standard, Action

### 9. INDEPENDENT ENGINEER FINAL JUDGMENT
Use deterministic language:
- "The design is NOT SEC-approvable until Critical Issues are closed."
- "The design is conditionally approvable subject to listed actions."
- "The design is SEC-compliant."

NO vague conclusions allowed.`,

    issue_register: `You are a SEC-compliant Independent Electrical Engineer.

Generate an **Issue Register (NCR Log)** as Markdown for SEC design approval.

## SEVERITY DEFINITIONS (SEC/WERA):
- **CRITICAL (P0)**: SEC approval blocker, safety hazard, code violation
- **MAJOR (P1)**: Must be corrected before energization, performance/warranty risk
- **MINOR (P2)**: Editorial, documentation improvement, optimization

## REQUIRED TABLE FORMAT:

| Issue ID | Severity | Title | Description | Location | Standard Reference | Evidence | Required Action | Verification Method |
|----------|----------|-------|-------------|----------|-------------------|----------|-----------------|---------------------|
| NCR-001 | CRITICAL | [Short title] | [Technical description] | [Drawing/Section] | [Standard Clause] | [File, Page] | [Exact correction] | [How to verify] |

## FOR EACH ISSUE INCLUDE:
1. **Issue ID**: NCR-XXX format
2. **Severity**: CRITICAL/MAJOR/MINOR with justification
3. **Title**: Clear, specific issue name
4. **Description**: Technical details with calculations if applicable
5. **Location**: Exact location in drawings/documents
6. **Standard Reference**: Specific clause (e.g., "IEC 62548 §7.2.1")
7. **Evidence Pointer**: File name + page/section/cell
8. **Required Action**: Specific, testable corrective action
9. **Verification Method**: How to confirm resolution

## RULES:
- Use only findings from inputs
- If evidence is missing, state "INSUFFICIENT DATA"
- Keep actions specific and testable
- Reference SEC/WERA/IEC clauses explicitly`,

    compliance_checklist: `You are a SEC-compliant Independent Electrical Engineer.

Generate a **Standards Compliance Checklist** as Markdown for SEC design approval submission.

## REQUIRED FORMAT:

### APPLICABLE STANDARDS
- SEC Distribution Code
- WERA Grid Connection Requirements
- IEC 62548 (PV Array Design)
- IEC 62116 (Anti-Islanding)
- IEC 60947 (Switchgear)
- IEC 61643 (Surge Protection)
- SASO Standards (Saudi)
- SBC (Saudi Building Code)

### COMPLIANCE MATRIX

| # | Category | Requirement | Standard Clause | Evidence | Status | Notes |
|---|----------|-------------|-----------------|----------|--------|-------|
| 1 | Anti-Islanding | System shall disconnect within 2s | IEC 62116 §5.2 | [File/Page] | PASS/FAIL/N-A | |
| 2 | Protection | MCCB breaking capacity ≥ Isc | IEC 60947-2 | [File/Page] | PASS/FAIL | |

### CATEGORIES TO CHECK:
1. Grid Connection Requirements (SEC/WERA)
2. Anti-Islanding Protection
3. Overcurrent Protection
4. Overvoltage Protection
5. Surge Protection
6. Earthing & Bonding
7. Cable Sizing & Installation
8. String Configuration Limits
9. Inverter Compliance
10. Metering (if applicable)
11. Safety Labeling
12. Documentation Completeness

## RULES:
- Mark PASS only if evidence explicitly confirms compliance
- Mark FAIL if non-conformance identified
- Mark N/A with explanation if not applicable
- Mark INSUFFICIENT DATA if cannot verify`,

    recalculation_sheet: `You are a SEC-compliant Independent Electrical Engineer.

Generate a **Recalculation Sheet** as Markdown with explicit engineering calculations for SEC approval.

## REQUIRED CALCULATIONS (show ALL steps):

### A) STRING VOLTAGE CALCULATIONS
\`\`\`
Given:
  Voc_STC = [value from datasheet] V
  Temp coefficient (γ) = [value]%/°C
  T_min = [value]°C (lowest ambient)
  Modules per string = [N]

Voc at T_min:
  Voc_cold = Voc_STC × [1 + γ × (T_min - 25)]
  Voc_cold = [value] × [1 + [value] × ([T_min] - 25)]
  Voc_cold = [result] V

String Voc_cold = N × Voc_cold(module)
  = [N] × [Voc_cold]
  = [result] V

Inverter Max DC Input = [value] V
Check: [String Voc] < [Inverter Max] → PASS/FAIL
\`\`\`

### B) CURRENT CALCULATIONS
\`\`\`
Isc (module) = [value] A
Imp (module) = [value] A
Strings in parallel = [N]

Total Isc = Isc × N_parallel = [value] × [N] = [result] A
Total Imp = Imp × N_parallel = [value] × [N] = [result] A

Inverter Max DC Current = [value] A
Check: [Total current] < [Inverter Max] → PASS/FAIL
\`\`\`

### C) INVERTER COMPATIBILITY
| Parameter | Design Value | Inverter Limit | Status |
|-----------|--------------|----------------|--------|
| String Voc (cold) | X V | Max Y V | PASS/FAIL |
| String Vmp | X V | MPPT Y-Z V | PASS/FAIL |
| Input Current | X A | Max Y A | PASS/FAIL |
| DC:AC Ratio | X | Recommended ≤1.3 | PASS/FAIL |

### D) CABLE SIZING VERIFICATION
\`\`\`
Cable: [type] [size] mm²
Length: [L] m
Current: [I] A
ρ (resistivity): [value] Ω·mm²/m

Voltage drop:
  ΔV = (2 × L × I × ρ) / A
  ΔV = (2 × [L] × [I] × [ρ]) / [A]
  ΔV = [result] V
  ΔV% = (ΔV / Vmp) × 100 = [result]%

Limit: ≤3% (DC) / ≤2% (AC)
Check: [ΔV%] < [Limit] → PASS/FAIL
\`\`\`

### E) PROTECTION DEVICE VERIFICATION
\`\`\`
Prospective fault current at PCC: [value] kA
MCCB breaking capacity: [value] kA
Check: Breaking capacity > Fault current → PASS/FAIL
\`\`\`

## RULES:
- Show formula → inputs → substitution → result → verdict
- Cite source for each input (File + Page/Cell)
- Mark "INSUFFICIENT DATA" if values missing
- Use actual numbers from extracted data`,

    redline_notes: `You are a SEC-compliant Independent Electrical Engineer.

Generate **Redline Notes** as Markdown – actionable markup corrections for design drawings.

## FORMAT FOR EACH REDLINE:

### REDLINE-XXX: [Short Title]

| Field | Value |
|-------|-------|
| **File Name** | [Exact filename] |
| **Page/Sheet** | [Page number or sheet ID] |
| **Location on Drawing** | [e.g., "Zone B, String #3 label"] |
| **Current State** | [What is currently shown/written] |
| **Required Correction** | [Exact edit to make] |
| **Standard Reference** | [e.g., "IEC 62548 §7.2.1"] |
| **Priority** | CRITICAL / MAJOR / MINOR |

---

## EXAMPLE:

### REDLINE-001: String Label Incorrect

| Field | Value |
|-------|-------|
| **File Name** | Project_SLD.pdf |
| **Page/Sheet** | Page 3, Sheet E-01 |
| **Location on Drawing** | Combiner Box CB-1, String 3 |
| **Current State** | Label shows "22 modules" |
| **Required Correction** | Change to "20 modules" per recalculation |
| **Standard Reference** | IEC 62548 §7.2.1 – Max string voltage |
| **Priority** | CRITICAL |

---

## RULES:
- One redline entry per issue
- Use findings.evidencePointer as primary source
- If location unknown, state "LOCATION TBD - Requires drawing review"
- Keep corrections unambiguous (exact text/value changes)
- Reference applicable SEC/IEC/SASO clause`,

    bom_boq: `You are a SEC-compliant Independent Electrical Engineer.

Generate an **Optimized BoM (Bill of Materials) & BoQ (Bill of Quantities)** as Markdown.

## BILL OF MATERIALS (BoM)

| # | Category | Item Description | Specification | Qty | Unit | Manufacturer | Model | Source Reference |
|---|----------|------------------|---------------|-----|------|--------------|-------|------------------|
| 1 | PV Modules | [Description] | [Pmax, Voc, Isc] | [N] | pcs | [Mfr] | [Model] | [File/Page] |
| 2 | Inverters | [Description] | [Power, MPPT] | [N] | pcs | [Mfr] | [Model] | [File/Page] |
| 3 | DC Cables | [Description] | [Size, Type] | [L] | m | [Mfr] | [Type] | [File/Page] |

### CATEGORIES:
1. PV Modules
2. Inverters
3. Mounting Structure
4. DC Cables & Connectors
5. AC Cables
6. Protection Devices (MCCBs, Fuses, SPDs)
7. Combiner Boxes
8. Metering Equipment
9. Earthing Materials
10. Labeling & Signage

## BILL OF QUANTITIES (BoQ)

| # | Work Item | Description | Qty | Unit | Remarks |
|---|-----------|-------------|-----|------|---------|
| 1 | Module Installation | PV module mounting and connection | [N] | modules | |
| 2 | Cable Installation | DC cable routing and termination | [L] | m | |

## OPTIMIZATION NOTES
- Any identified oversizing/undersizing
- Cost optimization opportunities
- Alternative specifications (if applicable)

## RULES:
- Use extractedData.bom / extractedData.boq when available
- Do not invent quantities – mark "INSUFFICIENT DATA" if missing
- Include source reference for each line item`,

    risk_reflection: `You are a SEC-compliant Independent Electrical Engineer.

Generate a **Risk Reflection** as Markdown – a 1-page AI reliability and data quality assessment.

## REQUIRED SECTIONS:

### 1. AI CONFIDENCE ASSESSMENT

| Data Category | Confidence | Justification |
|---------------|------------|---------------|
| String Configuration | HIGH/MEDIUM/LOW | [Evidence basis] |
| Module Parameters | HIGH/MEDIUM/LOW | [Evidence basis] |
| Inverter Parameters | HIGH/MEDIUM/LOW | [Evidence basis] |
| Cable Specifications | HIGH/MEDIUM/LOW | [Evidence basis] |
| Protection Devices | HIGH/MEDIUM/LOW | [Evidence basis] |
| Standards Compliance | HIGH/MEDIUM/LOW | [Evidence basis] |
| BoM/BoQ | HIGH/MEDIUM/LOW | [Evidence basis] |

**Confidence Definitions:**
- HIGH: Direct evidence from uploaded documents with clear traceability
- MEDIUM: Inferred from partial data or standard assumptions
- LOW: Insufficient data, estimated, or not verifiable

### 2. DATA QUALITY ISSUES

**Missing Fields:**
- [List specific missing data from extractedData.missingData]

**Low-Quality Sources:**
- [PDFs with no extractable text]
- [Unsupported file types]
- [Truncated or incomplete documents]

**Data Conflicts:**
- [Any contradictions between documents]

### 3. HUMAN VERIFICATION CHECKLIST

The following items MUST be verified by a qualified engineer:

- [ ] String voltage calculations at site minimum temperature
- [ ] Inverter MPPT range compatibility
- [ ] Cable ampacity derating for installation conditions
- [ ] Protection device coordination study
- [ ] Earthing system resistance measurements
- [ ] Anti-islanding test certificates
- [ ] [Add specific items based on findings]

### 4. AI LIMITATIONS IN THIS REVIEW

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Cannot read DWG files natively | May miss drawing details | Request PDF exports |
| Cannot perform dynamic simulations | No thermal/shade analysis | Recommend PVsyst review |
| Standards database limited to uploaded | May miss amendments | Verify current versions |
| Cannot verify site conditions | Assumes design accuracy | Site survey required |

### 5. INDEPENDENT ENGINEER STATEMENT

This AI-assisted review supplements but does not replace professional engineering judgment. The Independent Engineer must:
1. Verify all AI-extracted data against original documents
2. Confirm all calculations with independent tools
3. Validate compliance with current SEC/WERA requirements
4. Conduct physical site inspection before energization

## RULES:
- Base confidence on presence of traceable evidence
- Be explicit about uncertainty
- Do not overstate AI capabilities`,
  };

  const userPrompt = `INPUTS (treat missing data as failure):

PROJECT ID: ${extractedData?.projectId || "Unknown"}

## COMPLIANCE FINDINGS (${findings.length} issues)
${JSON.stringify(findings, null, 2)}

## EXTRACTED DATA
${JSON.stringify(extractedData, null, 2)}

## INSTRUCTIONS
Generate the ${getDeliverableName(type)} following the SEC-compliant format exactly.
- Use deterministic language (PASS/FAIL, not "appears to" or "seems")
- Include file/page references for every claim
- Mark "INSUFFICIENT DATA" for anything not verifiable
- This is a regulatory submission document`;

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
      temperature: 0.1,
      max_completion_tokens: 6000,
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
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return json({ error: "AI service not configured" }, 500);
    }

    // Use anon key client with user's auth header for JWT validation
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth validation failed:", authError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
