'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Camera, Save, ArrowLeft, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AtendimentoPage({ params }) {
  // Desembrulha os params (necessário no Next.js mais novo)
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const router = useRouter();

  // Estados
  const [appointment, setAppointment] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Formulário
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState(''); // Valor cobrado
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      // 1. Busca dados do agendamento
      const { data: appData, error: appError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (appError) throw appError;
      setAppointment(appData);

      // 2. Busca estoque DA MESMA REGIÃO
      if (appData.region_id) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('*')
          .eq('region_id', appData.region_id) // Segurança de região
          .gt('quantity', 0)
          .order('name');
        setInventory(invData || []);
      }

    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
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
      alert('Preencha tudo: Material, Valor, Pagamento e Foto.');
      return;
    }

    setSubmitting(true);

    try {
      // A. Upload da Foto
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-photos')
        .getPublicUrl(filePath);

      // B. Atualiza Agendamento
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'concluido',
          material_used_id: selectedMaterial,
          payment_method: paymentMethod,
          amount: parseFloat(amount), // Salva o valor financeiro
          photo_url: publicUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      alert('Sucesso! Estoque atualizado.');
      router.push('/'); 
      router.refresh();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao finalizar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando...</div>;
  if (!appointment) return <div className="p-10 text-center text-red-500">Agendamento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <h1 className="font-bold text-slate-800">Finalizar Serviço</h1>
      </div>

      <main className="max-w-md mx-auto p-4 space-y-5">
        
        {/* Resumo */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h2 className="font-bold text-blue-900 text-lg">{appointment.vehicle_model}</h2>
          <p className="text-blue-700 text-sm">Cliente: {appointment.customer_name}</p>
        </div>

        {/* 1. Foto */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">1. Foto do Resultado</label>
          <label className="cursor-pointer block w-full aspect-video rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" // Abre câmera traseira no celular
              onChange={handleFileChange} 
              className="hidden" 
            />
            {photoPreview ? (
              <img src={photoPreview} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-400">
                <Camera size={32} className="mx-auto mb-2" />
                <span className="text-xs">Toque para fotografar</span>
              </div>
            )}
          </label>
        </div>

        {/* 2. Material */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">2. Material Usado</label>
          <select 
            className="w-full p-3 border rounded-lg bg-white"
            value={selectedMaterial}
            onChange={e => setSelectedMaterial(e.target.value)}
          >
            <option value="">Selecione...</option>
            {inventory.map(i => (
              <option key={i.id} value={i.id}>{i.name} (Restam: {i.quantity})</option>
            ))}
          </select>
          {inventory.length === 0 && <p className="text-xs text-red-500 mt-1">Estoque vazio nesta região.</p>}
        </div>

        {/* 3. Financeiro */}
        <div className="flex gap-4">
            <div className="flex-1 bg-white p-4 rounded-xl shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">3. Valor (R$)</label>
                <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-3 text-slate-400"/>
                    <input 
                        type="number" 
                        step="0.01"
                        className="w-full p-2 pl-8 border rounded-lg"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 bg-white p-4 rounded-xl shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">4. Pagamento</label>
                <select 
                    className="w-full p-2 border rounded-lg bg-white h-[42px]"
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

        {/* Botão Final */}
        <button
          onClick={handleFinish}
          disabled={submitting}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-md flex justify-center items-center gap-2 ${submitting ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {submitting ? 'Salvando...' : <><Save size={20}/> Finalizar Serviço</>}
        </button>

      </main>
    </div>
  );
}