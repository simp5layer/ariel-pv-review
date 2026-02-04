import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, files } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build file context for GPT-5.2
    const fileDescriptions = files.map((f: { name: string; type: string; content?: string }) => 
      `File: ${f.name} (Type: ${f.type})${f.content ? `\nContent preview:\n${f.content.substring(0, 5000)}` : ''}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are an expert PV solar system engineer AI assistant. Your task is to analyze project files (DWG drawings, PDF reports, datasheets, Excel files) and extract structured technical data.

You must extract and return the following information in JSON format:
1. layers: Array of detected CAD layer names (e.g., PV_MODULES, DC_CABLES, AC_CABLES, INVERTERS)
2. textLabels: Array of important text annotations found in drawings/documents
3. cableSummary: Object with dcLength (meters) and acLength (meters)
4. pvParameters: Object with moduleCount, inverterCount, stringCount, maxVoltage (V), totalCapacity (kWp)
5. moduleParameters: Object with manufacturer, model, power (W), voc, isc, vmp, imp, efficiency
6. inverterParameters: Object with manufacturer, model, power (kW), maxDcVoltage, mpptCount

If you cannot find specific values, estimate reasonable values based on typical PV system designs or mark as "NOT_FOUND".

Always include a sourceReference for each extracted value indicating which file and location (page/cell) the data came from.`;

    const userPrompt = `Analyze the following project files and extract all PV system technical data:

${fileDescriptions}

Return a JSON object with the extracted data structure. Include sourceReference for traceability.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse the JSON from GPT response
    let extractedData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a structured error response
      return new Response(JSON.stringify({ 
        error: "Failed to parse extraction results",
        rawContent: content.substring(0, 1000)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      projectId,
      extractedData,
      model: "openai/gpt-5.2",
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Extract data error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
