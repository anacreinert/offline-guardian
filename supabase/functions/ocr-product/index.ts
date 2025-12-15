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

    console.log("Processing product recognition request...");

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
            content: `Você é um especialista em identificação de cargas e produtos agrícolas em veículos de transporte.
Analise a imagem e identifique qual produto/carga está sendo transportado no veículo.

Produtos comuns incluem:
- Soja
- Milho
- Trigo
- Arroz
- Feijão
- Café
- Algodão
- Cana-de-açúcar
- Fertilizantes
- Calcário
- Areia
- Brita
- Cimento
- Madeira
- Gado (bovinos)
- Aves
- Suínos

Responda APENAS com o nome do produto identificado em português, sem nenhum texto adicional.
Se não conseguir identificar o produto ou a imagem não mostrar uma carga, responda apenas: NAO_IDENTIFICADO`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifique o produto/carga que está sendo transportado neste veículo:"
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
    const productText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("Product recognition result:", productText);

    // Clean and validate the product text
    const cleanProduct = productText.replace(/[^a-zA-ZÀ-ÿ\s-]/g, "").trim();
    const isValid = cleanProduct && cleanProduct !== "NAO_IDENTIFICADO" && cleanProduct.length > 1;

    return new Response(
      JSON.stringify({ 
        product: isValid ? cleanProduct : null,
        raw: productText,
        success: isValid
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Product recognition error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
