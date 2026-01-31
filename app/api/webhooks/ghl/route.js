import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usa a chave Service Role para ter permissão de escrita sem login
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // 1. Identificar a Região pela URL (ex: ?region=divinopolis)
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    if (!region) {
      return NextResponse.json({ error: 'Região não informada na URL.' }, { status: 400 });
    }

    // 2. Receber dados do GHL
    const body = await request.json();
    console.log('Recebido do GHL:', body); // Para debug na VPS

    // 3. Mapeamento dos Campos (GHL -> Banco de Dados)
    const appointmentData = {
      // ID único (tenta pegar o ID do calendário ou gera um provisório)
      ghl_id: body.calendar_id || body.contact_id + '_' + Date.now(),
      
      // Dados do Cliente (Padrão)
      customer_name: body.contact?.name || body.full_name || body.first_name + ' ' + body.last_name || 'Sem Nome',
      customer_phone: body.contact?.phone || body.phone || '',
      
      // SEUS CAMPOS PERSONALIZADOS (Ajustados conforme solicitado)
      // O GHL costuma enviar esses campos dentro de "contact" ou soltos no body
      vehicle_model: body.contact?.marca_e_modelo_do_veculo || body.marca_e_modelo_do_veculo || 'Modelo ñ informado',
      vehicle_year: body.contact?.ano_do_veculo || body.ano_do_veculo || '',
      
      // Data e Status
      appointment_at: body.appointment?.start_time || body.start_time || new Date().toISOString(),
      status: 'pendente',
      region_id: region
    };

    // 4. Salvar no Supabase (Upsert: se já existe, atualiza; se não, cria)
    const { data, error } = await supabase
      .from('appointments')
      .upsert(appointmentData, { onConflict: 'ghl_id' })
      .select();

    if (error) {
      console.error('Erro no Supabase:', error);
      throw error;
    }

    return NextResponse.json({ message: 'Agendamento recebido!', id: data[0]?.id }, { status: 200 });

  } catch (err) {
    console.error('Erro Geral:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}