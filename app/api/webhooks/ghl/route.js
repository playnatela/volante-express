import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    if (!region) {
      return NextResponse.json({ error: 'Região não informada.' }, { status: 400 });
    }

    const body = await request.json();
    console.log('DEBUG GHL:', JSON.stringify(body, null, 2)); // Ajuda a ver o log formatado

    // --- BLOCO DE CAÇA AOS DADOS ---
    
    // 1. Veículo (Tenta pegar com acento, espaço ou snake_case)
    const model = 
      body['Marca e Modelo do Veículo'] || 
      body.contact?.['Marca e Modelo do Veículo'] || 
      body.marca_e_modelo_do_veculo || 
      'Modelo ñ informado';

    const year = 
      body['Ano do Veículo'] || 
      body.contact?.['Ano do Veículo'] || 
      body.ano_do_veculo || 
      '';

    // 2. Horário do Agendamento (O GHL mandou dentro de 'calendar.startTime')
    const rawDate = 
      body.calendar?.startTime || 
      body.appointment?.start_time || 
      body.start_time;
      
    // Se não achar data, usa AGORA (new Date), senão usa a data que veio
    const finalDate = rawDate ? rawDate : new Date().toISOString();

    // 3. Cliente
    const name = 
      body.contact?.name || 
      body.full_name || 
      (body.first_name ? `${body.first_name} ${body.last_name}` : 'Sem Nome');
      
    const phone = body.contact?.phone || body.phone || '';

    // --- FIM DO BLOCO ---

    const appointmentData = {
      ghl_id: body.calendar_id || body.contact_id + '_' + Date.now(),
      customer_name: name,
      customer_phone: phone,
      vehicle_model: model,
      vehicle_year: year,
      appointment_at: finalDate,
      status: 'pendente',
      region_id: region
    };

    const { data, error } = await supabase
      .from('appointments')
      .upsert(appointmentData, { onConflict: 'ghl_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'Recebido e corrigido!', id: data[0]?.id }, { status: 200 });

  } catch (err) {
    console.error('Erro Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}