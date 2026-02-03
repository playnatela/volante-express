import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionSlug = searchParams.get('region'); // ex: 'belo-horizonte'
    const forcedStatus = searchParams.get('status');

    if (!regionSlug) return NextResponse.json({ error: 'Região não informada.' }, { status: 400 });

    const body = await request.json();
    
    // 1. BUSCA O INSTALADOR PADRÃO DA REGIÃO
    let assignedUserId = null;
    const { data: regionData } = await supabase
        .from('regions')
        .select('default_user_id')
        .eq('slug', regionSlug)
        .single();
    
    if (regionData && regionData.default_user_id) {
        assignedUserId = regionData.default_user_id;
    }

    // 2. ID ÚNICO E FUSO
    const uniqueId = body.calendar?.appointmentId || body.appointment?.id || body.id || body.contact_id; 
    if (!uniqueId) return NextResponse.json({ error: 'Nenhum ID identificável.' }, { status: 400 });

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

    // 4. DADOS FINAIS
    const model = body['Marca e Modelo do Veículo'] || body.contact?.['Marca e Modelo do Veículo'] || body.marca_e_modelo_do_veculo || 'Modelo ñ informado';
    const year = body['Ano do Veículo'] || body.contact?.['Ano do Veículo'] || body.ano_do_veculo || '';
    const calendarName = body.calendar?.calendarName || body.calendar_name || '';

    const appointmentData = {
      ghl_id: uniqueId,
      customer_name: body.contact?.name || body.full_name || (body.first_name ? `${body.first_name} ${body.last_name}` : 'Sem Nome'),
      customer_phone: body.contact?.phone || body.phone || '',
      vehicle_model: model,
      vehicle_year: year,
      status: appStatus,
      region_id: regionSlug,
      calendar_name: calendarName,
      user_id: assignedUserId // <--- ATRIBUIÇÃO AUTOMÁTICA
    };

    if (finalDate) appointmentData.appointment_at = finalDate;

    const { error } = await supabase.from('appointments').upsert(appointmentData, { onConflict: 'ghl_id' });

    if (error) throw error;

    return NextResponse.json({ 
        message: 'Sincronizado!', 
        assigned_to: assignedUserId ? 'Instalador Definido' : 'Pendente (Sem dono)',
        region: regionSlug 
    }, { status: 200 });

  } catch (err) {
    console.error('Erro Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}