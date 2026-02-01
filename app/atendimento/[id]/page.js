'use client';

import { useEffect, useState, use } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Camera, Save, ArrowLeft, DollarSign, Package, CreditCard, Image as ImageIcon, Calculator } from 'lucide-react';

export default function AtendimentoPage({ params }) {
  // Desembrulha os params (Padrão novo do Next.js)
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const router = useRouter();

  // Cliente Supabase Correto (Baseado em Cookies)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [appointment, setAppointment] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados do Formulário
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [amount, setAmount] = useState(''); // Valor Bruto (Cobrado)
  
  // Financeiro
  const [paymentMethod, setPaymentMethod] = useState(''); // credito, debito, pix, dinheiro
  const [installments, setInstallments] = useState(1); // Parcelas
  const [rates, setRates] = useState([]); // Taxas vindas do banco
  const [accounts, setAccounts] = useState([]); // Contas disponíveis
  
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      // 1. Busca o Agendamento
      const { data: appData, error: appError } = await supabase
        .from('appointments').select('*').eq('id', id).single();
      if (appError) throw appError;
      setAppointment(appData);

      if (appData.region_id) {
        // 2. Busca Estoque da Região
        const { data: invData } = await supabase
          .from('inventory').select('*').eq('region_id', appData.region_id).gt('quantity', 0).order('name');
        setInventory(invData || []);

        // 3. Busca Contas da Região (Banco e Carteira)
        const { data: accData } = await supabase
          .from('accounts').select('*').or(`region_id.eq.${appData.region_id},region_id.is.null`);
        setAccounts(accData || []);
      }

      // 4. Busca Taxas de Pagamento
      const { data: ratesData } = await supabase.from('payment_rates').select('*').order('installments');
      setRates(ratesData || []);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Função que calcula o Líquido em tempo real para exibir na tela
  const getSimulatedNet = () => {
    if (!amount || !paymentMethod) return 0;
    
    // Define parcelas: se não for crédito, é sempre 1x
    const currentInstallments = paymentMethod === 'credito' ? parseInt(installments) : 1;

    // Acha a taxa correspondente no banco
    const rateObj = rates.find(r => 
        r.method === paymentMethod && 
        r.installments === currentInstallments
    );

    // Se não achar taxa específica, assume 0%
    const taxPercent = rateObj ? rateObj.rate_percent : 0;
    const gross = parseFloat(amount);
    const taxValue = gross * (taxPercent / 100);
    return gross - taxValue;
  };

  const handleFinish = async () => {
    if (!selectedMaterial || !paymentMethod || !photoFile || !amount) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }
    setSubmitting(true);
    
    try {
      // 1. Upload da Foto
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('service-photos').upload(filePath, photoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('service-photos').getPublicUrl(filePath);

      // 2. Cálculos Financeiros Finais
      const grossVal = parseFloat(amount);
      const finalInstallments = paymentMethod === 'credito' ? parseInt(installments) : 1;
      
      // Busca a taxa exata
      const rateObj = rates.find(r => r.method === paymentMethod && r.installments === finalInstallments);
      const taxPercent = rateObj ? rateObj.rate_percent : 0;
      const netVal = grossVal - (grossVal * (taxPercent / 100));

      // Decide a conta de destino
      let targetAccountId = null;
      if (paymentMethod === 'dinheiro') {
        // Prioriza conta do tipo 'carteira', senão pega a primeira disponível
        targetAccountId = accounts.find(a => a.type === 'carteira')?.id || accounts[0]?.id;
      } else {
        // Prioriza conta do tipo 'banco'
        targetAccountId = accounts.find(a => a.type === 'banco')?.id || accounts[0]?.id;
      }

      // 3. Atualiza Agendamento (Com Financeiro Completo)
      const { error: updateError } = await supabase.from('appointments').update({
          status: 'concluido',
          material_used_id: selectedMaterial,
          
          // Dados Financeiros
          payment_method: paymentMethod,
          installments: finalInstallments,
          gross_amount: grossVal,
          net_amount: netVal,
          payment_rate_snapshot: taxPercent,
          account_id: targetAccountId, // Joga saldo na conta certa
          
          photo_url: publicUrl,
          completed_at: new Date().toISOString(),
        }).eq('id', id);

      if (updateError) throw updateError;
      
      // 4. Baixa no estoque
      const material = inventory.find(i => i.id === selectedMaterial);
      if (material) {
         await supabase.from('inventory').update({ quantity: material.quantity - 1 }).eq('id', selectedMaterial);
      }
      
      // 5. Atualiza Saldo da Conta (Soma o valor líquido)
      if (targetAccountId) {
         const { data: accNow } = await supabase.from('accounts').select('balance').eq('id', targetAccountId).single();
         if (accNow) {
            await supabase.from('accounts').update({ balance: (accNow.balance || 0) + netVal }).eq('id', targetAccountId);
         }
      }

      router.push('/'); router.refresh();
      
    } catch (error) { 
        alert('Erro ao finalizar: ' + error.message); 
        setSubmitting(false); 
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-200">
      
      {/* Header */}
      <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-bold text-lg text-white">Finalizar Serviço</h1>
      </div>

      <main className="max-w-md mx-auto p-5 space-y-6 mt-2">
        
        {/* Resumo Card */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
          <p className="text-xs text-blue-400 font-bold uppercase mb-1">Veículo</p>
          <h2 className="font-bold text-white text-xl">{appointment.vehicle_model}</h2>
          <p className="text-slate-500 text-sm mt-1">{appointment.customer_name}</p>
        </div>

        {/* 1. Foto */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 ml-1">1. Comprovante (Foto)</label>
            <label className="cursor-pointer block w-full aspect-video rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-800 transition-all flex flex-col items-center justify-center relative overflow-hidden group">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {photoPreview ? (
                <img src={photoPreview} className="w-full h-full object-cover" />
                ) : (
                <div className="text-center text-slate-500 group-hover:text-blue-400 transition-colors">
                    <div className="flex justify-center gap-2 mb-2">
                        <Camera size={24} /> <ImageIcon size={24} />
                    </div>
                    <span className="text-xs font-medium">Toque para Câmera ou Galeria</span>
                </div>
                )}
            </label>
        </div>

        {/* 2. Material */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2">
            <Package size={14}/> 2. Material Usado
          </label>
          <div className="relative">
            <select 
                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none"
                value={selectedMaterial}
                onChange={e => setSelectedMaterial(e.target.value)}
            >
                <option value="" className="text-slate-500">Selecione o revestimento...</option>
                {inventory.map(i => (
                <option key={i.id} value={i.id}>{i.name} (Estoque: {i.quantity})</option>
                ))}
            </select>
            <div className="absolute right-4 top-4 text-slate-500 pointer-events-none">▼</div>
          </div>
        </div>

        {/* 3. Financeiro Grid */}
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Valor Cobrado */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2">
                        <DollarSign size={14}/> Valor Cobrado
                    </label>
                    <input 
                        type="number" step="0.01" placeholder="0.00"
                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                </div>
                
                {/* Método Pagamento */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2">
                        <CreditCard size={14}/> Forma Pagto
                    </label>
                    <select 
                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        value={paymentMethod}
                        onChange={e => {
                            setPaymentMethod(e.target.value);
                            setInstallments(1); // Reseta parcelas ao mudar método
                        }}
                    >
                        <option value="">...</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                    </select>
                </div>
            </div>

            {/* SELECIONAR PARCELAS (Só aparece se for Crédito e existirem taxas cadastradas) */}
            {paymentMethod === 'credito' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2 mb-2">
                        Parcelamento Disponível
                    </label>
                    <select 
                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none"
                        value={installments}
                        onChange={e => setInstallments(e.target.value)}
                    >
                        {rates
                            .filter(r => r.method === 'credito')
                            .sort((a, b) => a.installments - b.installments)
                            .map(r => (
                                <option key={r.id} value={r.installments}>
                                    {r.installments}x {amount ? `de R$ ${(amount/r.installments).toFixed(2)}` : ''}
                                </option>
                        ))}
                    </select>
                    {rates.filter(r => r.method === 'credito').length === 0 && (
                        <p className="text-red-400 text-xs mt-2 bg-red-900/20 p-2 rounded">Atenção: Nenhuma taxa de crédito configurada no Painel Admin.</p>
                    )}
                </div>
            )}

            {/* SIMULAÇÃO DE VALOR LÍQUIDO (Feedback Visual) */}
            {amount && paymentMethod && (
                <div className="bg-slate-900/50 p-3 rounded-xl border border-dashed border-slate-700 flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-2"><Calculator size={14}/> Líquido (Empresa):</span>
                    <span className="font-mono font-bold text-green-400">R$ {getSimulatedNet().toFixed(2)}</span>
                </div>
            )}
        </div>

        {/* Botão Final */}
        <button
          onClick={handleFinish}
          disabled={submitting}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg shadow-green-900/20 flex justify-center items-center gap-2 transition-all active:scale-95 mt-4
            ${submitting ? 'bg-slate-700 cursor-not-allowed text-slate-400' : 'bg-green-600 hover:bg-green-500'}`}
        >
          {submitting ? 'Salvando...' : <><Save size={22}/> Confirmar Serviço</>}
        </button>

      </main>
    </div>
  );
}