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
    console.log('WEBHOOK GHL:', JSON.stringify(body, null, 2));

    // 1. O SEGREDO DO ID ÚNICO (Correção da Duplicidade)
    // Pega o ID fixo do agendamento. Se não tiver, usa o ID do contato (mas nunca Date.now)
    const uniqueId = 
      body.calendar?.appointmentId || 
      body.appointment?.id || 
      body.id ||
      body.contact_id; // Último recurso

    if (!uniqueId) {
      return NextResponse.json({ error: 'Nenhum ID identificável encontrado.' }, { status: 400 });
    }

    // 2. STATUS INTELIGENTE (Cancelamento e No-Show)
    // Lê o status que veio do GHL
    const ghlStatus = 
      body.calendar?.appointmentStatus || 
      body.appointment?.status || 
      body.status || 
      'confirmed';

    // Traduz para o App
    let appStatus = 'pendente'; // Padrão
    const statusLower = ghlStatus.toLowerCase();

    if (statusLower === 'cancelled' || statusLower === 'canceled' || statusLower === 'noshow' || statusLower === 'invalid') {
      appStatus = 'cancelado';
    } else if (statusLower === 'completed' || statusLower === 'finished') {
      appStatus = 'concluido';
    }

    // 3. RECUPERAÇÃO DE DADOS (Igual ao anterior que funcionou)
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

    const rawDate = 
      body.calendar?.startTime || 
      body.appointment?.start_time || 
      body.start_time;
    
    // Se não vier data (ex: atualização só de contato), mantém a que já existe no banco ou usa agora
    const finalDate = rawDate ? rawDate : undefined; 

    // 4. PREPARAR DADOS PARA SALVAR
    const appointmentData = {
      ghl_id: uniqueId, // <--- O ID CORRETO
      customer_name: body.contact?.name || body.full_name || (body.first_name ? `${body.first_name} ${body.last_name}` : 'Sem Nome'),
      customer_phone: body.contact?.phone || body.phone || '',
      vehicle_model: model,
      vehicle_year: year,
      status: appStatus, // <--- STATUS ATUALIZADO
      region_id: region
    };

    // Só atualiza a data se ela veio no payload (para não estragar edições manuais)
    if (finalDate) {
      appointmentData.appointment_at = finalDate;
    }

    // 5. SALVAR (Upsert)
    const { data, error } = await supabase
      .from('appointments')
      .upsert(appointmentData, { onConflict: 'ghl_id' }) // Usa o ID Único para saber se atualiza ou cria
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'Sincronizado com sucesso!', id: uniqueId, status: appStatus }, { status: 200 });

  } catch (err) {
    console.error('Erro Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}