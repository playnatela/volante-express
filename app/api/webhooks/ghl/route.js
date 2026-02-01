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
    const forcedStatus = searchParams.get('status');

    if (!region) return NextResponse.json({ error: 'Região não informada.' }, { status: 400 });

    const body = await request.json();
    
    // 1. ID ÚNICO
    const uniqueId = body.calendar?.appointmentId || body.appointment?.id || body.id || body.contact_id; 
    if (!uniqueId) return NextResponse.json({ error: 'Nenhum ID identificável.' }, { status: 400 });

    // 2. FUSO HORÁRIO
    let rawDate = body.calendar?.startTime || body.appointment?.start_time || body.start_time;
    let finalDate = undefined;
    if (rawDate) {
      if (!rawDate.includes('Z') && !rawDate.includes('+') && !rawDate.match(/-\d\d:\d\d$/)) {
        finalDate = rawDate + '-03:00';
      } else { finalDate = rawDate; }
    }

    // 3. STATUS
    let appStatus = 'pendente'; 
    if (forcedStatus) {
        appStatus = forcedStatus;
    } else {
        const ghlStatus = body.calendar?.appointmentStatus || body.appointment?.status || body.status || 'confirmed';
        const statusLower = ghlStatus.toLowerCase();
        if (['cancelled', 'canceled', 'noshow', 'invalid', 'abandoned'].includes(statusLower)) {
            appStatus = 'cancelado';
        } else if (['completed', 'finished', 'executed'].includes(statusLower)) {
            appStatus = 'concluido';
        }
    }

    // 4. PREPARAR DADOS
    const model = body['Marca e Modelo do Veículo'] || body.contact?.['Marca e Modelo do Veículo'] || body.marca_e_modelo_do_veculo || 'Modelo ñ informado';
    const year = body['Ano do Veículo'] || body.contact?.['Ano do Veículo'] || body.ano_do_veculo || '';
    
    // CAPTURA O NOME DA CIDADE (Calendar Name)
    const calendarName = body.calendar?.calendarName || body.calendar_name || '';

    const appointmentData = {
      ghl_id: uniqueId,
      customer_name: body.contact?.name || body.full_name || (body.first_name ? `${body.first_name} ${body.last_name}` : 'Sem Nome'),
      customer_phone: body.contact?.phone || body.phone || '',
      vehicle_model: model,
      vehicle_year: year,
      status: appStatus,
      region_id: region,
      calendar_name: calendarName // <--- CAMPO NOVO
    };

    if (finalDate) appointmentData.appointment_at = finalDate;

    const { error } = await supabase.from('appointments').upsert(appointmentData, { onConflict: 'ghl_id' });

    if (error) throw error;

    return NextResponse.json({ message: 'Sincronizado!', id: uniqueId, city: calendarName }, { status: 200 });

  } catch (err) {
    console.error('Erro Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}