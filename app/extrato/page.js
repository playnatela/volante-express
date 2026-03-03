'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Wallet, Calendar, TrendingUp, ListTodo, User, Package } from 'lucide-react';

export default function ExtratoPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    fetchCommissions();
  }, [month]);

  async function fetchCommissions() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // CORREÇÃO: Define inicio e fim do Mês selecionado
      const [ano, mes] = month.split('-');
      const startOfMonth = new Date(ano, mes - 1, 1).toISOString();
      // O dia "0" do mês seguinte é o último dia deste mês
      const endOfMonth = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      const { data: services, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'concluido')
        .gte('completed_at', startOfMonth) // Maior ou igual dia 1
        .lte('completed_at', endOfMonth)   // Menor ou igual dia 30/31
        .order('completed_at', { ascending: false });

      if (services) {
        setTransactions(services);
        const total = services.reduce((acc, curr) => acc + (Number(curr.commission_amount) || 0), 0);
        setTotalCommission(total);
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-32 text-slate-200 font-sans">
      <div className="bg-slate-900 pt-10 pb-8 rounded-b-[40px] shadow-2xl border-b border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 mb-2 px-6"><img src="/icon-horizontal.png" alt="Volante Express" className="h-16 object-contain drop-shadow-lg" /></div>
        <p className="text-slate-400 text-sm">Controle de Comissões</p>
      </div>

      <main className="max-w-md mx-auto p-5 space-y-6">
        <div className="flex justify-end">
          <div className="relative">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-slate-900 text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 font-bold cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-emerald-800 p-6 rounded-3xl shadow-xl shadow-green-900/20 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-green-100 text-sm font-medium mb-1 flex items-center gap-2"><Wallet size={16} /> Comissões em {month.split('-')[1]}/{month.split('-')[0]}</p>
            <h2 className="text-4xl font-bold tracking-tight">R$ {totalCommission.toFixed(2)}</h2>
            <p className="text-green-200 text-xs mt-2 opacity-80">{transactions.length} serviços realizados</p>
          </div>
          <TrendingUp className="absolute right-4 bottom-4 text-green-400 opacity-20" size={80} />
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-400 text-sm uppercase ml-1">Histórico do Mês</h3>

          {loading ? <div className="text-center py-10 text-slate-600">Carregando...</div> : (
            <div className="space-y-3">
              {transactions.length === 0 && (
                <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
                  <p className="text-slate-500">Nenhum serviço finalizado neste mês.</p>
                </div>
              )}

              {transactions.map(t => (
                <div key={t.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white text-sm">{t.vehicle_model}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={10} /> {new Date(t.completed_at).toLocaleDateString()} • {new Date(t.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-green-400">+ R$ {Number(t.commission_amount).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full uppercase">Concluído</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
          <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><ListTodo size={24} /><span className="text-[10px] font-medium">Agenda</span></button>
          <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Package size={24} /><span className="text-[10px] font-medium">Estoque</span></button>
          <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-blue-500 transition-colors"><Wallet size={24} strokeWidth={2.5} /><span className="text-[10px] font-bold">Comissões</span></button>
          <button onClick={() => router.push('/?activeTab=perfil')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><User size={24} /><span className="text-[10px] font-medium">Perfil</span></button>
        </div>
      </div>
    </div>
  );
}