import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing plate OCR request...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em reconhecimento de placas de veículos brasileiros.
Analise a imagem e extraia APENAS o texto da placa do veículo.
Formatos válidos:
- Mercosul: ABC1D23 (3 letras, 1 número, 1 letra, 2 números)
- Antigo: ABC-1234 (3 letras, hífen, 4 números)

Responda APENAS com a placa identificada em letras maiúsculas, sem nenhum texto adicional.
Se não conseguir identificar a placa, responda apenas: NAO_IDENTIFICADO`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifique a placa do veículo nesta imagem:"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const plateText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("OCR result:", plateText);

    // Validate and clean the plate text
    const cleanPlate = plateText.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
    
    // Check if it matches valid plate formats
    const mercosulPattern = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    const oldPattern = /^[A-Z]{3}-?[0-9]{4}$/;
    
    let validPlate = null;
    if (mercosulPattern.test(cleanPlate)) {
      validPlate = cleanPlate;
    } else if (oldPattern.test(cleanPlate.replace("-", ""))) {
      // Format old plates with hyphen
      const withoutHyphen = cleanPlate.replace("-", "");
      validPlate = `${withoutHyphen.slice(0, 3)}-${withoutHyphen.slice(3)}`;
    }

    return new Response(
      JSON.stringify({ 
        plate: validPlate,
        raw: plateText,
        success: validPlate !== null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
