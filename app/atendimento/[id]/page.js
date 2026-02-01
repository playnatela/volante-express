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
  const [rates, setRates] = useState([]); 
  const [accounts, setAccounts] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
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
    setSubmitting(true);
    
    try {
      // 1. Upload Foto
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('service-photos').upload(filePath, photoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('service-photos').getPublicUrl(filePath);

      // 2. Cálculos Financeiros (Internos)
      const grossVal = parseFloat(amount);
      const finalInstallments = paymentMethod === 'credito' ? parseInt(installments) : 1;
      const rateObj = rates.find(r => r.method === paymentMethod && r.installments === finalInstallments);
      const taxPercent = rateObj ? rateObj.rate_percent : 0;
      const netVal = grossVal - (grossVal * (taxPercent / 100));

      // 3. Escolher Conta de Destino
      let targetAccountId = null;
      if (paymentMethod === 'dinheiro') {
        targetAccountId = accounts.find(a => a.type === 'carteira' && a.region_id === appointment.region_id)?.id;
        if (!targetAccountId) targetAccountId = accounts.find(a => a.type === 'carteira')?.id;
      } else {
        targetAccountId = accounts.find(a => a.type === 'banco' && a.is_default)?.id;
        if (!targetAccountId) targetAccountId = accounts.find(a => a.type === 'banco')?.id;
      }

      if (!targetAccountId) {
         if(!confirm('Atenção: Nenhuma conta compatível encontrada. Salvar sem vincular financeiro?')) {
             setSubmitting(false); return;
         }
      }

      // 4. Salvar no Banco
      const { error: updateError } = await supabase.from('appointments').update({
          status: 'concluido',
          material_used_id: selectedMaterial,
          payment_method: paymentMethod,
          installments: finalInstallments,
          gross_amount: grossVal,
          net_amount: netVal,
          payment_rate_snapshot: taxPercent,
          account_id: targetAccountId,
          photo_url: publicUrl,
          completed_at: new Date().toISOString(),
        }).eq('id', id);

      if (updateError) throw updateError;
      
      // 5. Baixa Estoque
      const material = inventory.find(i => i.id === selectedMaterial);
      if (material) await supabase.from('inventory').update({ quantity: material.quantity - 1 }).eq('id', selectedMaterial);
      
      // 6. Atualiza Saldo da Conta
      if (targetAccountId) {
         const { data: accNow } = await supabase.from('accounts').select('balance').eq('id', targetAccountId).single();
         if (accNow) await supabase.from('accounts').update({ balance: (accNow.balance || 0) + netVal }).eq('id', targetAccountId);
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
                <div className="text-center text-slate-500 group-hover:text-blue-400"><Camera size={24} className="mx-auto mb-2"/><span className="text-xs font-medium">Toque para adicionar foto</span></div>)}
            </label>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><Package size={14}/> 2. Material Usado</label>
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
                    <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><DollarSign size={14}/> Valor Cobrado</label>
                    <input type="number" step="0.01" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg outline-none" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2"><CreditCard size={14}/> Forma Pagto</label>
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
                    <label className="text-sm font-medium text-slate-400 ml-1 mb-2 block">Parcelamento Disponível</label>
                    <select className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none" value={installments} onChange={e => setInstallments(e.target.value)}>
                        {rates.filter(r => r.method === 'credito').sort((a, b) => a.installments - b.installments).map(r => (
                            <option key={r.id} value={r.installments}>{r.installments}x {amount ? `de R$ ${(amount/r.installments).toFixed(2)}` : ''}</option>
                        ))}
                    </select>
                    {rates.filter(r => r.method === 'credito').length === 0 && <p className="text-red-400 text-xs mt-2">Sem taxas cadastradas no Admin.</p>}
                </div>
            )}
        </div>

        <button onClick={handleFinish} disabled={submitting} className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg flex justify-center items-center gap-2 transition-all mt-4 ${submitting ? 'bg-slate-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
          {submitting ? 'Salvando...' : <><Save size={22}/> Confirmar Serviço</>}
        </button>
      </main>
    </div>
  );
}