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
    const { imageBase64, weightType } = await req.json();
    
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

    const typeLabel = weightType === 'tare' ? 'TARA (T)' : 'BRUTO (B)';
    console.log(`Processing weight OCR request for ${typeLabel}...`);

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
            content: `Você é um especialista em leitura de displays de balanças industriais.
Analise a imagem e extraia o valor de peso exibido no display.

IMPORTANTE:
- Procure por displays digitais, visores de balança, ou marcações de peso
- O peso geralmente aparece como número seguido de "kg", "Kg", "KG" ou "t" (toneladas)
- Identifique especificamente o peso ${typeLabel} se houver múltiplos valores
- Indicadores comuns: "T" ou "TARA" para tara, "B" ou "BRUTO" para peso bruto, "L" ou "LÍQUIDO" para peso líquido
- Converta toneladas para quilogramas (1t = 1000kg)

Responda APENAS com o valor numérico do peso em quilogramas, sem unidade.
Exemplo: se o display mostra "12.500 kg" ou "12,5 t", responda: 12500
Se não conseguir identificar o peso, responda apenas: NAO_IDENTIFICADO`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Identifique o peso ${typeLabel} exibido nesta imagem de balança:`
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
    const weightText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("OCR weight result:", weightText);

    // Validate and clean the weight text
    const cleanWeight = weightText.replace(/[^0-9.,]/g, "").replace(",", ".");
    const weightValue = parseFloat(cleanWeight);
    
    const isValid = !isNaN(weightValue) && weightValue > 0 && weightValue < 1000000;

    return new Response(
      JSON.stringify({ 
        weight: isValid ? weightValue : null,
        raw: weightText,
        success: isValid
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR weight error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
