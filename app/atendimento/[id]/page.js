'use client';

import { useEffect, useState, use } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Camera, Save, ArrowLeft, DollarSign, Package, CreditCard, Image as ImageIcon } from 'lucide-react';

export default function AtendimentoPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [appointment, setAppointment] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [installments, setInstallments] = useState(1);

  // Split payment support
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [amount2, setAmount2] = useState('');
  const [paymentMethod2, setPaymentMethod2] = useState('');
  const [installments2, setInstallments2] = useState(1);

  const [rates, setRates] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // NOVO: Estado para armazenar a comissão do usuário logado
  const [myCommission, setMyCommission] = useState(0);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      // 0. Busca Usuário Logado e sua Comissão Fixa
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('commission_rate')
          .eq('id', user.id)
          .single();
        // Se tiver valor no banco usa ele, senão assume 0
        setMyCommission(profile?.commission_rate || 0);
      }

      // 1. Busca Agendamento
      const { data: appData, error: appError } = await supabase.from('appointments').select('*').eq('id', id).single();
      if (appError) throw appError;
      setAppointment(appData);

      if (appData.region_id) {
        // 2. Busca Estoque
        const { data: invData } = await supabase.from('inventory').select('*').eq('region_id', appData.region_id).gt('quantity', 0).order('name');
        setInventory(invData || []);

        // 3. Busca Contas
        const { data: accData } = await supabase.from('accounts').select('*').or(`region_id.is.null,region_id.eq.${appData.region_id}`);
        setAccounts(accData || []);
      }

      // 4. Busca Taxas
      const { data: ratesData } = await supabase.from('payment_rates').select('*').order('installments');
      setRates(ratesData || []);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const handleFinish = async () => {
    if (!selectedMaterial || !paymentMethod || !photoFile || !amount) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    if (isSplitPayment && (!paymentMethod2 || !amount2)) {
      alert('Preencha os campos da 2ª Forma de Pagamento!');
      return;
    }
    setSubmitting(true);

    try {
      // 1. Upload Foto
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('service-photos').upload(filePath, photoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('service-photos').getPublicUrl(filePath);

      // 2. Cálculos Financeiros (Internos) - Pagamento 1
      const grossVal = parseFloat(amount);
      const finalInstallments = paymentMethod === 'credito' ? parseInt(installments) : 1;
      const rateObj = rates.find(r => r.method === paymentMethod && r.installments === finalInstallments);
      const taxPercent = rateObj ? rateObj.rate_percent : 0;
      const netVal = grossVal - (grossVal * (taxPercent / 100));

      // 2.1 Cálculos Financeiros - Pagamento 2 (Se houver)
      let grossVal2 = 0, finalInstallments2 = 1, taxPercent2 = 0, netVal2 = 0;
      if (isSplitPayment) {
        grossVal2 = parseFloat(amount2);
        finalInstallments2 = paymentMethod2 === 'credito' ? parseInt(installments2) : 1;
        const rateObj2 = rates.find(r => r.method === paymentMethod2 && r.installments === finalInstallments2);
        taxPercent2 = rateObj2 ? rateObj2.rate_percent : 0;
        netVal2 = grossVal2 - (grossVal2 * (taxPercent2 / 100));
      }

      // 3. Escolher Conta de Destino - Pagamento 1
      let targetAccountId = null;
      if (paymentMethod === 'dinheiro') {
        targetAccountId = accounts.find(a => a.type === 'carteira' && a.region_id === appointment.region_id)?.id;
        if (!targetAccountId) targetAccountId = accounts.find(a => a.type === 'carteira')?.id;
      } else {
        targetAccountId = accounts.find(a => a.type === 'banco' && a.is_default)?.id;
        if (!targetAccountId) targetAccountId = accounts.find(a => a.type === 'banco')?.id;
      }

      // 3.1 Escolher Conta de Destino - Pagamento 2
      let targetAccountId2 = null;
      if (isSplitPayment) {
        if (paymentMethod2 === 'dinheiro') {
          targetAccountId2 = accounts.find(a => a.type === 'carteira' && a.region_id === appointment.region_id)?.id;
          if (!targetAccountId2) targetAccountId2 = accounts.find(a => a.type === 'carteira')?.id;
        } else {
          targetAccountId2 = accounts.find(a => a.type === 'banco' && a.is_default)?.id;
          if (!targetAccountId2) targetAccountId2 = accounts.find(a => a.type === 'banco')?.id;
        }
      }

      if (!targetAccountId || (isSplitPayment && !targetAccountId2)) {
        if (!confirm('Atenção: Alguma conta destino não foi encontrada. Salvar assim mesmo? O financeiro poderá ficar incorreto.')) {
          setSubmitting(false); return;
        }
      }

      // 4. Salvar no Banco (AGORA COM COMISSÃO E PAGAMENTO DIVIDIDO)
      const updatePayload = {
        status: 'concluido',
        material_used_id: selectedMaterial,
        payment_method: paymentMethod,
        installments: finalInstallments,
        gross_amount: grossVal,
        net_amount: netVal,
        payment_rate_snapshot: taxPercent,
        account_id: targetAccountId,
        commission_amount: myCommission, // <--- SALVA AQUI OS R$ 25,00
        photo_url: publicUrl,
        completed_at: new Date().toISOString(),
        is_split_payment: isSplitPayment
      };

      if (isSplitPayment) {
        updatePayload.payment_method_2 = paymentMethod2;
        updatePayload.installments_2 = finalInstallments2;
        updatePayload.gross_amount_2 = grossVal2;
        updatePayload.net_amount_2 = netVal2;
        updatePayload.payment_rate_snapshot_2 = taxPercent2;
        updatePayload.account_id_2 = targetAccountId2;
      }

      const { error: updateError } = await supabase.from('appointments').update(updatePayload).eq('id', id);

      if (updateError) throw updateError;

      // 5. Baixa Estoque
      const material = inventory.find(i => i.id === selectedMaterial);
      if (material) await supabase.from('inventory').update({ quantity: material.quantity - 1 }).eq('id', selectedMaterial);

      // 6. Atualiza Saldo da Conta 1
      if (targetAccountId) {
        const { data: accNow } = await supabase.from('accounts').select('balance').eq('id', targetAccountId).single();
        if (accNow) await supabase.from('accounts').update({ balance: (accNow.balance || 0) + netVal }).eq('id', targetAccountId);
      }

      // 6.1 Atualiza Saldo da Conta 2
      if (isSplitPayment && targetAccountId2) {
        const { data: accNow2 } = await supabase.from('accounts').select('balance').eq('id', targetAccountId2).single();
        if (accNow2) await supabase.from('accounts').update({ balance: (accNow2.balance || 0) + netVal2 }).eq('id', targetAccountId2);
      }

      router.push('/'); router.refresh();

    } catch (error) { alert('Erro: ' + error.message); setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-200">
      <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ArrowLeft size={22} /></button>
        <h1 className="font-bold text-lg text-white">Finalizar Serviço</h1>
      </div>

      <main className="max-w-md mx-auto p-5 space-y-6 mt-2">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
          <p className="text-xs text-blue-400 font-bold uppercase mb-1">Veículo</p>
          <h2 className="font-bold text-white text-xl">{appointment.vehicle_model}</h2>
          <p className="text-slate-500 text-sm mt-1">{appointment.customer_name}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 ml-1">1. Comprovante (Foto)</label>
          <label className="cursor-pointer block w-full aspect-video rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : (
              <div className="text-center text-slate-500 group-hover:text-blue-400"><Camera size={24} className="mx-auto mb-2" /><span className="text-xs font-medium">Toque para adicionar foto</span></div>)}
          </label>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><Package size={14} /> 2. Material Usado</label>
          <div className="relative">
            <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none appearance-none" value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)}>
              <option value="">Selecione...</option>
              {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Estoque: {i.quantity})</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><DollarSign size={14} /> Valor {isSplitPayment ? "1" : "Cobrado"}</label>
              <input type="number" step="0.01" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg outline-none" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><CreditCard size={14} /> Forma Pagto {isSplitPayment ? "1" : ""}</label>
              <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none appearance-none" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setInstallments(1); }}>
                <option value="">...</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          {paymentMethod === 'credito' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium text-slate-400 ml-1 mb-2 block">Parcelamento Disponível {isSplitPayment ? "1" : ""}</label>
              <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none" value={installments} onChange={e => setInstallments(e.target.value)}>
                {rates.filter(r => r.method === 'credito').sort((a, b) => a.installments - b.installments).map(r => (
                  <option key={r.id} value={r.installments}>{r.installments}x {amount ? `de R$ ${(amount / r.installments).toFixed(2)}` : ''}</option>
                ))}
              </select>
              {rates.filter(r => r.method === 'credito').length === 0 && <p className="text-red-400 text-xs mt-2">Sem taxas cadastradas no Admin.</p>}
            </div>
          )}

          <label className="flex items-center gap-2 mt-4 cursor-pointer text-sm font-medium text-slate-400 ml-1">
            <input
              type="checkbox"
              checked={isSplitPayment}
              onChange={e => setIsSplitPayment(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
            Dividir pagamento em 2 formas
          </label>

          {isSplitPayment && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><DollarSign size={14} /> Valor 2</label>
                  <input type="number" step="0.01" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg outline-none" value={amount2} onChange={e => setAmount2(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><CreditCard size={14} /> Forma Pagto 2</label>
                  <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none appearance-none" value={paymentMethod2} onChange={e => { setPaymentMethod2(e.target.value); setInstallments2(1); }}>
                    <option value="">...</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>

              {paymentMethod2 === 'credito' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-slate-400 ml-1 mb-2 block">Parcelamento Disponível 2</label>
                  <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none" value={installments2} onChange={e => setInstallments2(e.target.value)}>
                    {rates.filter(r => r.method === 'credito').sort((a, b) => a.installments - b.installments).map(r => (
                      <option key={r.id} value={r.installments}>{r.installments}x {amount2 ? `de R$ ${(amount2 / r.installments).toFixed(2)}` : ''}</option>
                    ))}
                  </select>
                  {rates.filter(r => r.method === 'credito').length === 0 && <p className="text-red-400 text-xs mt-2">Sem taxas cadastradas no Admin.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={handleFinish} disabled={submitting} className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg flex justify-center items-center gap-2 transition-all mt-4 ${submitting ? 'bg-slate-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
          {submitting ? 'Salvando...' : <><Save size={22} /> Confirmar Serviço</>}
        </button>
      </main>
    </div>
  );
}