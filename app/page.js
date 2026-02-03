'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw, Calendar, MapPin, DollarSign, CheckCircle2, Clock } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    checkUserAndRedirect();
  }, []);

  async function checkUserAndRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const email = session.user.email;
    setUser(session.user);

    // PORTEIRO INTELIGENTE
    if (email.includes('wildson') || email === 'admin@volantepro.app') {
        router.push('/admin');
        return; 
    }

    fetchAppointments(session.user.id);
    setupRealtime(session.user.id);
  }

  async function fetchAppointments(userId) {
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelado')
      .order('appointment_at', { ascending: true });
      
    if (data) setAppointments(data);
    setLoading(false);
  }

  // REALTIME
  function setupRealtime(userId) {
    const channel = supabase
      .channel('installer-view')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'appointments',
          filter: `user_id=eq.${userId}`, 
        },
        (payload) => {
          console.log('Atualização recebida!', payload);
          fetchAppointments(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function formatDate(dateString) {
    if (!dateString) return 'Data a definir';
    const date = new Date(dateString);
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    const time = date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    if (date.toDateString() === hoje.toDateString()) return `Hoje às ${time}`;
    if (date.toDateString() === amanha.toDateString()) return `Amanhã às ${time}`;
    
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
  }

  async function updateStatus(id, newStatus) {
    if(!confirm('Confirmar finalização do serviço?')) return;
    
    setAppointments(prev => prev.map(app => app.id === id ? {...app, status: newStatus} : app));

    await supabase.from('appointments').update({ 
        status: newStatus, 
        completed_at: newStatus === 'concluido' ? new Date().toISOString() : null 
    }).eq('id', id);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-24">
      
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Bem-vindo,</p>
                <h1 className="text-xl font-bold truncate max-w-[200px]">{user?.email?.split('@')[0]}</h1>
            </div>
            <button onClick={handleLogout} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition-colors">
                <LogOut size={18} className="text-slate-300" />
            </button>
        </div>
        
        {/* RESUMO */}
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-[10px] uppercase font-bold text-blue-200">Pendentes</p>
                <p className="text-2xl font-bold">{appointments.filter(a => a.status === 'pendente').length}</p>
            </div>
            <div className="bg-emerald-600/20 border border-emerald-500/30 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-[10px] uppercase font-bold text-emerald-200">Feitos</p>
                <p className="text-2xl font-bold">{appointments.filter(a => a.status === 'concluido').length}</p>
            </div>
        </div>
      </header>

      {/* LISTA */}
      <main className="p-4 space-y-4">
        {appointments.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                <CheckCircle2 size={48} className="mb-4 opacity-20"/>
                <p>Tudo limpo por aqui!</p>
                <button onClick={() => fetchAppointments(user.id)} className="mt-6 text-blue-500 font-bold text-sm flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm"><RefreshCw size={14}/> Atualizar</button>
            </div>
        ) : (
            appointments.map(app => (
                <div key={app.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden transition-all ${app.status === 'concluido' ? 'opacity-60 grayscale-[50%]' : ''}`}>
                    
                    {/* FAIXA STATUS */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        app.status === 'concluido' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}></div>

                    {/* CABEÇALHO DO CARD: PIN E CIDADE (NO TOPO DIREITO) */}
                    <div className="flex justify-between items-start mb-2 pl-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                            app.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {app.status}
                        </span>

                        {/* PIN E CIDADE */}
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-slate-600 border border-slate-200">
                            <MapPin size={12} className="text-red-500 fill-red-500" />
                            <span className="text-[10px] font-bold uppercase truncate max-w-[100px]">
                                {app.calendar_name || app.region_id || 'Regional'}
                            </span>
                        </div>
                    </div>

                    {/* CONTEÚDO PRINCIPAL */}
                    <div className="pl-2 mb-4">
                        <h3 className="font-bold text-slate-900 text-xl leading-tight mb-1">{app.vehicle_model} {app.vehicle_year && <span className="text-sm font-normal text-slate-500">({app.vehicle_year})</span>}</h3>
                        <p className="text-sm text-slate-500 font-medium mb-3">{app.customer_name}</p>
                        
                        {/* DATA E HORÁRIO BEM VISÍVEL */}
                        <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 w-fit">
                            <Calendar size={16} className="text-blue-500"/>
                            <span className="font-bold text-sm">{formatDate(app.appointment_at)}</span>
                        </div>
                    </div>

                    {/* BOTÃO DE AÇÃO */}
                    {app.status !== 'concluido' && (
                        <div className="pl-2 pt-2">
                            <button onClick={() => updateStatus(app.id, 'concluido')} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20">
                                <CheckCircle2 size={18} className="text-emerald-400"/> Confirmar Serviço Realizado
                            </button>
                        </div>
                    )}
                </div>
            ))
        )}
      </main>
    </div>
  );
}