import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usa a chave poderosa para gravar sem login
);

export async function POST(request) {
  try {
    // 1. Identificar a Região pela URL (ex: ?region=divinopolis)
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    if (!region) {
      return NextResponse.json({ error: 'Região não informada na URL (use ?region=slug)' }, { status: 400 });
    }

    // 2. Receber dados do GHL
    const body = await request.json();
    console.log('Webhook recebido:', body); // Aparecerá no seu terminal do VS Code

    // 3. Mapear dados
    // ATENÇÃO: Verifique se as chaves (ex: modelo_veiculo) batem com seus Custom Fields no GHL
    const appointmentData = {
      ghl_id: body.calendar_id || body.contact_id + '_' + Date.now(),
      customer_name: body.contact?.name || body.first_name + ' ' + body.last_name || 'Sem Nome',
      customer_phone: body.contact?.phone || body.phone || '',
      vehicle_model: body.contact?.customFields?.modelo_veiculo || body.customData?.modelo_veiculo || 'Modelo ñ informado',
      vehicle_year: body.contact?.customFields?.ano_veiculo || body.customData?.ano_veiculo || '',
      appointment_at: body.appointment?.start_time || body.start_time || new Date().toISOString(),
      status: 'pendente',
      region_id: region
    };

    // 4. Salvar no Banco
    const { data, error } = await supabase
      .from('appointments')
      .upsert(appointmentData, { onConflict: 'ghl_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'Agendamento salvo!', id: data[0]?.id }, { status: 200 });

  } catch (err) {
    console.error('Erro no Webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}