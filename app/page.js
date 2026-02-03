'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Plus, Car, MapPin, Calendar, ChevronRight, Loader2, ListTodo, Wallet, User, Clock } from 'lucide-react';

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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const currentUser = session.user;
    setUser(currentUser);

    // 1. PORTEIRO INTELIGENTE (Redireciona Admin)
    const email = currentUser.email;
    if (email.includes('wildson') || email === 'admin@volantepro.app') {
        router.push('/admin');
        return; 
    }

    fetchData(currentUser.id);
    setupRealtime(currentUser.id);
  }

  async function fetchData(userId) {
    // 2. BUSCA SERVIÇOS (Inclui campos novos: calendar_name, appointment_at)
    const { data: apps } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'concluido')
      .neq('status', 'cancelado') // Filtra cancelados para limpar a view
      .order('appointment_at', { ascending: true }); // Ordena por data do agendamento
      
    setAppointments(apps || []);
    setLoading(false);
  }

  // 3. REALTIME (Atualização Automática)
  function setupRealtime(userId) {
    const channel = supabase
      .channel('installer-view')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta tudo
          schema: 'public',
          table: 'appointments',
          filter: `user_id=eq.${userId}`, 
        },
        (payload) => {
          console.log('Mudança detectada!', payload);
          fetchData(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Formatação de data amigável
  function formatDate(dateString) {
    if (!dateString) return 'Data a definir';
    const date = new Date(dateString);
    const hoje = new Date();
    
    // Ajuste simples para exibir "Hoje" ou Data completa
    if (date.toDateString() === hoje.toDateString()) {
        return `Hoje, ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    }
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
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
        appointment_at: new Date().toISOString(), // Ajustado para coluna correta
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
                    <p className="text-slate-600 text-xs mt-1">Aguarde novos agendamentos.</p>
                </div>
            )}

            {appointments.map(app => (
                <div key={app.id} onClick={() => router.push(`/atendimento/${app.id}`)} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden active:scale-95 transition-transform cursor-pointer hover:border-blue-500/30 shadow-md">
                    
                    {/* NOVO: Pin e Cidade no Topo Direito (Estilo "Tag") */}
                    <div className="absolute top-0 right-0 bg-slate-800 pl-3 pr-2 py-1 rounded-bl-xl border-b border-l border-slate-700 flex items-center gap-1">
                        <MapPin size={10} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide truncate max-w-[100px]">
                            {app.calendar_name || app.region_id || 'Regional'}
                        </span>
                    </div>

                    <div className="flex items-start gap-4 mt-2">
                        <div className="bg-blue-950/50 p-3 rounded-xl text-blue-400 border border-blue-900/30 self-center">
                            <Car size={20}/>
                        </div>
                        <div className="flex-1">
                            {/* Modelo e Nome */}
                            <h4 className="font-bold text-white text-lg leading-tight">{app.vehicle_model}</h4>
                            <p className="text-xs text-slate-500 mb-2">{app.customer_name}</p>

                            {/* NOVO: Data e Hora Destacada */}
                            <div className="inline-flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded-lg border border-slate-800/50">
                                <Clock size={12} className="text-blue-500"/>
                                <span className="text-xs font-medium text-slate-300">
                                    {formatDate(app.appointment_at)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="self-center">
                            <ChevronRight className="text-slate-600" size={16}/>
                        </div>
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