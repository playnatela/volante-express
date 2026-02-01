'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Plus, Car, MapPin, Calendar, ChevronRight, Loader2, ListTodo, Wallet, User } from 'lucide-react';

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
    const { data: apps } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'concluido')
      .order('date', { ascending: true });
    
    setAppointments(apps || []);
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32">
      
      {/* --- HEADER COM LOGO HORIZONTAL --- */}
      <div className="bg-slate-900 pt-10 pb-8 rounded-b-[40px] shadow-2xl border-b border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Efeito de Fundo (Glow) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>

        {/* LOGO HORIZONTAL */}
        {/* Certifique-se de que o arquivo está na pasta 'public' */}
        <div className="relative z-10 mb-2 px-6">
             <img 
                src="/icon-horizontal.png" 
                alt="Volante Express" 
                className="h-16 object-contain drop-shadow-lg" 
             />
        </div>

        {/* Boas-vindas */}
        <p className="text-slate-400 text-sm">Bem-vindo, <span className="text-blue-400 font-bold">{user?.email?.split('@')[0]}</span></p>
      </div>

      {/* --- CONTEÚDO (AGENDA) --- */}
      <main className="p-6 space-y-4">
        <div className="flex items-center justify-between">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14}/> Serviços Pendentes
            </h3>
            <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-lg">{appointments.length} itens</span>
        </div>
        
        <div className="space-y-3">
            {appointments.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
                    <Car size={40} className="mx-auto text-slate-700 mb-3"/>
                    <p className="text-slate-500 text-sm font-medium">Tudo limpo por aqui.</p>
                    <p className="text-slate-600 text-xs mt-1">Toque no "+" para iniciar.</p>
                </div>
            )}

            {appointments.map(app => (
                <div key={app.id} onClick={() => router.push(`/atendimento/${app.id}`)} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center active:scale-95 transition-transform cursor-pointer hover:border-blue-500/30 shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-950/50 p-3 rounded-xl text-blue-400 border border-blue-900/30">
                            <Car size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-lg">{app.vehicle_model}</h4>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
                                <MapPin size={12}/> {app.customer_name}
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-full">
                        <ChevronRight className="text-slate-500" size={16}/>
                    </div>
                </div>
            ))}
        </div>
      </main>

      {/* --- BOTÃO FLUTUANTE (FAB) --- */}
      <button 
        onClick={handleNewService}
        disabled={creating}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center text-white transition-transform active:scale-90 z-30"
      >
        {creating ? <Loader2 className="animate-spin"/> : <Plus size={28}/>}
      </button>

      {/* --- MENU INFERIOR FIXO --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
            
            {/* Botão Agenda (Ativo) */}
            <button className="flex flex-col items-center gap-1 p-2 text-blue-500">
                <ListTodo size={24} strokeWidth={2.5} />
                <span className="text-[10px] font-bold">Agenda</span>
            </button>

            {/* Botão Comissões */}
            <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                <Wallet size={24} />
                <span className="text-[10px] font-medium">Comissões</span>
            </button>

            {/* Botão Perfil */}
            <button onClick={() => alert('Configurações de perfil em breve!')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                <User size={24} />
                <span className="text-[10px] font-medium">Perfil</span>
            </button>

        </div>
      </div>

    </div>
  );
}