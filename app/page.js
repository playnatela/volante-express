'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Wallet, Car, MapPin, Calendar, ChevronRight, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [todayCommission, setTodayCommission] = useState(0);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
      fetchData(user.id);
    }
  }

  async function fetchData(userId) {
    // CORREÇÃO DE DATA: Cria o intervalo de Hoje (Inicio 00:00 - Fim 23:59)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    // 1. Busca Pendentes
    const { data: apps } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'concluido') // Traz tudo que NÃO está concluído (agendado, em_andamento)
      .order('date', { ascending: true });
    
    setAppointments(apps || []);

    // 2. Busca Ganho de Hoje (Com filtro robusto gte/lte)
    const { data: doneToday, error } = await supabase
      .from('appointments')
      .select('commission_amount')
      .eq('user_id', userId)
      .eq('status', 'concluido')
      .gte('completed_at', startOfDay) // Maior ou igual inicio do dia
      .lte('completed_at', endOfDay);  // Menor ou igual fim do dia
    
    if (error) console.error("Erro ao buscar comissão:", error);

    const totalToday = doneToday?.reduce((acc, curr) => acc + (Number(curr.commission_amount) || 0), 0) || 0;
    setTodayCommission(totalToday);

    setLoading(false);
  }

  const handleNewService = async () => {
    const model = prompt("Qual o modelo do veículo?");
    if (!model) return;

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: profile } = await supabase.from('profiles').select('region_id').eq('id', user.id).single();

    const { data, error } = await supabase.from('appointments').insert([{
        user_id: user.id,
        vehicle_model: model,
        customer_name: 'Cliente Avulso',
        status: 'agendado',
        date: new Date().toISOString(),
        region_id: profile?.region_id || 'divinopolis'
    }]).select().single();

    if (error) {
        alert('Erro detalhado: ' + error.message);
        setCreating(false);
    } else {
        router.push(`/atendimento/${data.id}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24">
      {/* Header */}
      <div className="bg-slate-900 p-6 rounded-b-3xl shadow-2xl border-b border-slate-800">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">
                    {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-xs text-slate-400">Bem-vindo,</p>
                    <p className="font-bold text-white leading-none">{user?.email?.split('@')[0]}</p>
                </div>
            </div>
            <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <LogOut size={20}/>
            </button>
        </div>

        {/* Card Ganho Hoje */}
        <div onClick={() => router.push('/extrato')} className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-5 rounded-2xl shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform">
            <div className="relative z-10 flex justify-between items-center">
                <div>
                    <p className="text-emerald-100 text-xs font-medium mb-1 flex items-center gap-1"><Wallet size={14}/> Ganho Hoje</p>
                    <h2 className="text-3xl font-bold text-white">R$ {todayCommission.toFixed(2)}</h2>
                </div>
                <div className="bg-white/20 p-2 rounded-full">
                    <ChevronRight className="text-white" size={20}/>
                </div>
            </div>
            <div className="absolute -right-6 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      <main className="p-6 space-y-6">
        {/* Agendamentos */}
        <div>
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 flex items-center gap-2">
                <Calendar size={16}/> Agenda / Pendentes
            </h3>
            
            <div className="space-y-3">
                {appointments.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                        <p className="text-slate-500 text-sm">Sua lista está vazia.</p>
                        <p className="text-slate-600 text-xs mt-1">Toque em "+" para iniciar um serviço.</p>
                    </div>
                )}

                {appointments.map(app => (
                    <div key={app.id} onClick={() => router.push(`/atendimento/${app.id}`)} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center active:scale-95 transition-transform cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-900/30 p-3 rounded-lg text-blue-400">
                                <Car size={20}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-white">{app.vehicle_model}</h4>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <MapPin size={12}/> {app.customer_name}
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-600" size={20}/>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* Botão Flutuante */}
      <button 
        onClick={handleNewService}
        disabled={creating}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-full shadow-2xl shadow-blue-900/50 flex items-center justify-center text-white transition-transform active:scale-90 z-30"
      >
        {creating ? <Loader2 className="animate-spin"/> : <Plus size={32}/>}
      </button>
    </div>
  );
}