import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Positional character corrections
function correctPlateCharacters(text: string): string {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 7) return cleaned;

  const letterCorrections: Record<string, string> = {
    '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '8': 'B', '9': 'G',
  };
  const numberCorrections: Record<string, string> = {
    'O': '0', 'Q': '0', 'D': '0',
    'I': '1', 'L': '1',
    'Z': '2',
    'A': '4',
    'S': '5',
    'G': '6',
    'B': '8',
  };

  let result = '';

  // Positions 0, 1, 2: ALWAYS letters
  for (let i = 0; i < 3; i++) {
    const char = cleaned[i];
    if (/[0-9]/.test(char)) {
      result += letterCorrections[char] || char;
    } else {
      result += char;
    }
  }

  // Position 3: ALWAYS number
  const pos3 = cleaned[3];
  if (/[A-Z]/.test(pos3)) {
    result += numberCorrections[pos3] || pos3;
  } else {
    result += pos3;
  }

  // Position 4: Check if Mercosul (letter) or old format (number)
  const pos4 = cleaned[4];
  const pos5 = cleaned[5];
  const pos6 = cleaned[6];

  // Determine format based on positions 5 and 6
  const pos5Corrected = /[A-Z]/.test(pos5) ? (numberCorrections[pos5] || pos5) : pos5;
  const pos6Corrected = /[A-Z]/.test(pos6) ? (numberCorrections[pos6] || pos6) : pos6;

  // If 5 and 6 are numbers, position 4 should be a letter (Mercosul)
  if (/[0-9]/.test(pos5Corrected) && /[0-9]/.test(pos6Corrected)) {
    if (/[0-9]/.test(pos4)) {
      result += letterCorrections[pos4] || pos4;
    } else {
      result += pos4;
    }
    result += pos5Corrected;
    result += pos6Corrected;
  } else {
    // Old format - all should be numbers
    if (/[A-Z]/.test(pos4)) {
      result += numberCorrections[pos4] || pos4;
    } else {
      result += pos4;
    }
    result += /[A-Z]/.test(pos5) ? (numberCorrections[pos5] || pos5) : pos5;
    result += /[A-Z]/.test(pos6) ? (numberCorrections[pos6] || pos6) : pos6;
  }

  return result;
}

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

    const systemPrompt = `Você é um especialista em reconhecimento de placas de veículos brasileiros (ANPR/ALPR).

FORMATOS VÁLIDOS DE PLACAS BRASILEIRAS:
1. Mercosul (atual): ABC1D23
   - Posições 1-3: LETRAS (A-Z)
   - Posição 4: NÚMERO (0-9)
   - Posição 5: LETRA (A-Z)
   - Posições 6-7: NÚMEROS (0-9)
   - Exemplos: RIO2A18, BRA2E19, ABC4X56

2. Antigo: ABC-1234
   - Posições 1-3: LETRAS (A-Z)
   - Posições 4-7: NÚMEROS (0-9)
   - Exemplos: ABC-1234, XYZ-9876

CARACTERES FREQUENTEMENTE CONFUNDIDOS - CORREÇÕES POR POSIÇÃO:
- Posições de LETRAS (1-3 e 5 no Mercosul):
  • 0 (zero) → O (letra O)
  • 1 (um) → I (letra I)
  • 8 (oito) → B
  • 5 (cinco) → S
  • 6 (seis) → G
  • 2 (dois) → Z
  • 4 (quatro) → A

- Posições de NÚMEROS (4 e 6-7 no Mercosul, 4-7 no antigo):
  • O (letra O) → 0 (zero)
  • I (letra I) → 1 (um)
  • L (letra L) → 1 (um)
  • B → 8
  • S → 5
  • G → 6
  • Z → 2

INSTRUÇÕES IMPORTANTES:
1. IGNORE a faixa azul superior da placa (contém "BRASIL" e "MERCOSUL")
2. FOQUE APENAS na área branca com os caracteres pretos
3. A placa sempre tem EXATAMENTE 7 caracteres
4. Se a imagem estiver em ângulo, compense mentalmente
5. Se houver sujeira ou desgaste, faça sua melhor estimativa
6. Considere reflexos e condições de iluminação

RESPONDA APENAS com a placa em MAIÚSCULAS (formato ABC1D23 ou ABC1234).
NÃO inclua hífen, espaços ou qualquer outro texto.
Se não conseguir identificar, responda: NAO_IDENTIFICADO`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifique a placa do veículo nesta imagem. Lembre-se: ignore o texto da faixa azul (BRASIL/MERCOSUL) e foque apenas nos 7 caracteres da placa."
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
    
    console.log("Raw OCR result:", plateText);

    // Clean and validate the plate text
    let cleanPlate = plateText.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    
    // Apply positional corrections
    if (cleanPlate.length === 7) {
      cleanPlate = correctPlateCharacters(cleanPlate);
      console.log("After corrections:", cleanPlate);
    }
    
    // Validate against known patterns
    const mercosulPattern = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    const oldPattern = /^[A-Z]{3}[0-9]{4}$/;
    
    let validPlate = null;
    if (mercosulPattern.test(cleanPlate)) {
      validPlate = cleanPlate;
      console.log("Valid Mercosul plate:", validPlate);
    } else if (oldPattern.test(cleanPlate)) {
      validPlate = cleanPlate;
      console.log("Valid old format plate:", validPlate);
    } else if (cleanPlate.length === 7) {
      // Try additional corrections for edge cases
      const corrected = correctPlateCharacters(cleanPlate);
      if (mercosulPattern.test(corrected) || oldPattern.test(corrected)) {
        validPlate = corrected;
        console.log("Valid plate after additional corrections:", validPlate);
      }
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
