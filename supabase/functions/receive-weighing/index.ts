import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeighingPayload {
  vehicle_plate: string;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  ticket_number?: string;
  vehicle_type?: string;
  driver_name?: string;
  supplier?: string;
  origin?: string;
  destination?: string;
  product?: string;
  harvest?: string;
  scale_number?: string;
  entry_time?: string;
  exit_time?: string;
  weight_method?: string;
  is_estimated?: boolean;
  estimated_reason?: string;
  notes?: string;
  photo_urls?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Initialize Supabase client with user token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Parse request body
    const payload: WeighingPayload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const requiredFields = ['vehicle_plate', 'gross_weight', 'tare_weight', 'net_weight'];
    for (const field of requiredFields) {
      if (payload[field as keyof WeighingPayload] === undefined || payload[field as keyof WeighingPayload] === null) {
        console.error(`Missing required field: ${field}`);
        return new Response(
          JSON.stringify({ error: `Campo obrigatório ausente: ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate weight values
    if (typeof payload.gross_weight !== 'number' || payload.gross_weight <= 0) {
      return new Response(
        JSON.stringify({ error: 'Peso bruto deve ser um número positivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof payload.tare_weight !== 'number' || payload.tare_weight < 0) {
      return new Response(
        JSON.stringify({ error: 'Tara deve ser um número não negativo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.gross_weight <= payload.tare_weight) {
      return new Response(
        JSON.stringify({ error: 'Peso bruto deve ser maior que a tara' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate ticket number if not provided
    let ticketNumber = payload.ticket_number;
    if (!ticketNumber) {
      const { data: ticketData, error: ticketError } = await supabase
        .rpc('generate_ticket_number');
      
      if (ticketError) {
        console.error('Error generating ticket number:', ticketError);
        // Generate fallback ticket number
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        ticketNumber = `${yearMonth}-${Date.now().toString().slice(-4)}`;
      } else {
        ticketNumber = ticketData;
      }
    }

    console.log(`Ticket number: ${ticketNumber}`);

    // Insert weighing record with offline/pending_approval status
    const recordData = {
      user_id: user.id,
      ticket_number: ticketNumber,
      vehicle_plate: payload.vehicle_plate.toUpperCase().trim(),
      vehicle_type: payload.vehicle_type || null,
      driver_name: payload.driver_name || null,
      supplier: payload.supplier || null,
      origin: payload.origin || null,
      destination: payload.destination || null,
      product: payload.product || null,
      harvest: payload.harvest || null,
      scale_number: payload.scale_number || null,
      gross_weight: payload.gross_weight,
      tare_weight: payload.tare_weight,
      net_weight: payload.net_weight,
      entry_time: payload.entry_time || null,
      exit_time: payload.exit_time || null,
      weight_method: payload.weight_method || 'scale',
      is_estimated: payload.is_estimated || false,
      estimated_reason: payload.estimated_reason || null,
      notes: payload.notes || null,
      photo_urls: payload.photo_urls || {},
      created_offline: true,
      status: 'pending_approval',
      synced_at: new Date().toISOString(),
    };

    console.log('Inserting record:', JSON.stringify(recordData, null, 2));

    const { data: record, error: insertError } = await supabase
      .from('weighing_records')
      .insert(recordData)
      .select('id, ticket_number')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: `Erro ao salvar registro: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Record created successfully: ${record.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        record_id: record.id,
        ticket_number: record.ticket_number,
        message: 'Pesagem registrada com sucesso. Aguardando aprovação.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: `Erro interno: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
