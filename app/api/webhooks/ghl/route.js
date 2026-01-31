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
    console.log('WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2)); // Log para debug

    // 1. ID ÚNICO BLINDADO
    const uniqueId = 
      body.calendar?.appointmentId || 
      body.appointment?.id || 
      body.id ||
      body.contact_id; 

    if (!uniqueId) {
      return NextResponse.json({ error: 'Nenhum ID identificável.' }, { status: 400 });
    }

    // 2. CORREÇÃO DE FUSO HORÁRIO (A Mágica das 3 horas)
    // O GHL manda ex: "2026-02-01T11:00:00". O servidor lê como UTC.
    // Vamos forçar o sufixo "-03:00" para dizer que isso é Brasil.
    let rawDate = 
      body.calendar?.startTime || 
      body.appointment?.start_time || 
      body.start_time;

    let finalDate = undefined;

    if (rawDate) {
      // Se a data não tem "Z" (UTC) nem fuso (+/-), adicionamos -03:00
      if (!rawDate.includes('Z') && !rawDate.includes('+') && !rawDate.match(/-\d\d:\d\d$/)) {
        finalDate = rawDate + '-03:00';
      } else {
        finalDate = rawDate;
      }
    }

    // 3. STATUS INTELIGENTE
    const ghlStatus = 
      body.calendar?.appointmentStatus || 
      body.appointment?.status || 
      body.status || 
      'confirmed';

    console.log('Status Recebido:', ghlStatus); // Para vermos nos logs se o cancelamento chega

    let appStatus = 'pendente'; 
    const statusLower = ghlStatus.toLowerCase();

    // Lista ampliada de status de cancelamento
    if (['cancelled', 'canceled', 'noshow', 'invalid', 'abandoned'].includes(statusLower)) {
      appStatus = 'cancelado';
    } else if (['completed', 'finished', 'executed'].includes(statusLower)) {
      appStatus = 'concluido';
    }

    // 4. RECUPERAÇÃO DE DADOS
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

    // 5. SALVAR
    const appointmentData = {
      ghl_id: uniqueId,
      customer_name: body.contact?.name || body.full_name || (body.first_name ? `${body.first_name} ${body.last_name}` : 'Sem Nome'),
      customer_phone: body.contact?.phone || body.phone || '',
      vehicle_model: model,
      vehicle_year: year,
      status: appStatus, 
      region_id: region
    };

    if (finalDate) {
      appointmentData.appointment_at = finalDate;
    }

    const { error } = await supabase
      .from('appointments')
      .upsert(appointmentData, { onConflict: 'ghl_id' });

    if (error) throw error;

    return NextResponse.json({ 
      message: 'Sincronizado!', 
      id: uniqueId, 
      status: appStatus,
      time_fixed: finalDate 
    }, { status: 200 });

  } catch (err) {
    console.error('Erro Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}