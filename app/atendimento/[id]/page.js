'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Camera, Save, ArrowLeft, DollarSign, Package, CreditCard, Image as ImageIcon } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AtendimentoPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [appointment, setAppointment] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      const { data: appData, error: appError } = await supabase
        .from('appointments').select('*').eq('id', id).single();
      if (appError) throw appError;
      setAppointment(appData);

      if (appData.region_id) {
        const { data: invData } = await supabase
          .from('inventory').select('*').eq('region_id', appData.region_id).gt('quantity', 0).order('name');
        setInventory(invData || []);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleFinish = async () => {
    if (!selectedMaterial || !paymentMethod || !photoFile || !amount) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }
    setSubmitting(true);
    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('service-photos').upload(filePath, photoFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('service-photos').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('appointments').update({
          status: 'concluido',
          material_used_id: selectedMaterial,
          payment_method: paymentMethod,
          amount: parseFloat(amount),
          photo_url: publicUrl,
          completed_at: new Date().toISOString(),
        }).eq('id', id);

      if (updateError) throw updateError;
      
      // Baixa no estoque
      const material = inventory.find(i => i.id === selectedMaterial);
      if (material) {
         await supabase.from('inventory').update({ quantity: material.quantity - 1 }).eq('id', selectedMaterial);
      }

      router.push('/'); router.refresh();
    } catch (error) { alert('Erro ao finalizar.'); setSubmitting(false); }
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

        {/* 1. Foto (Galeria ou Câmera) */}
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
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2">
                    <DollarSign size={14}/> Valor
                </label>
                <div className="relative">
                    <input 
                        type="number" step="0.01" placeholder="0.00"
                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 ml-1 flex items-center gap-2">
                    <CreditCard size={14}/> Pagto
                </label>
                <div className="relative">
                    <select 
                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                    >
                        <option value="">...</option>
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_credito">Crédito</option>
                        <option value="cartao_debito">Débito</option>
                        <option value="faturado">Faturado</option>
                    </select>
                </div>
            </div>
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