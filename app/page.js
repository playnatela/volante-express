'use client';

import { useEffect, useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Car, MapPin, Calendar, ChevronRight, Loader2, ListTodo, Wallet, User, Clock, Lock, LogOut, Camera } from 'lucide-react';

// --- COMPONENTE INTERNO (Lógica Principal) ---
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Agora o useSearchParams está seguro dentro do Suspense
  const isPreviewMode = searchParams.get('mode') === 'preview';

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('agenda');

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

    const email = currentUser.email;
    const isAdmin = email.includes('wildson') || email === 'admin@volantepro.app';
    
    // REGRA DE REDIRECIONAMENTO COM EXCEÇÃO (ESPIÃO)
    if (isAdmin && !isPreviewMode) {
        router.push('/admin');
        return; 
    }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    setProfile(profileData);

    fetchData(currentUser.id);
    setupRealtime(currentUser.id);
  }

  async function fetchData(userId) {
    const { data: apps } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'concluido')
      .neq('status', 'cancelado')
      .order('appointment_at', { ascending: true });
      
    setAppointments(apps || []);
    setLoading(false);
  }

  function setupRealtime(userId) {
    const channel = supabase
      .channel('installer-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` },
        () => fetchData(userId)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  function formatDate(dateString) {
    if (!dateString) return 'Data a definir';
    const date = new Date(dateString);
    const hoje = new Date();
    if (date.toDateString() === hoje.toDateString()) {
        return `Hoje, ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const handleNewService = async () => {
    const model = prompt("Qual o modelo do veículo?");
    if (!model) return;
    setCreating(true);
    const { data, error } = await supabase.from('appointments').insert([{
        user_id: user.id, vehicle_model: model, customer_name: 'Cliente Avulso',
        status: 'agendado', appointment_at: new Date().toISOString(),
        region_id: profile?.region_id || 'divinopolis'
    }]).select().single();
    if (error) alert('Erro: ' + error.message);
    else router.push(`/atendimento/${data.id}`);
    setCreating(false);
  };

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

  async function handleUpdatePassword() {
      const newPass = prompt("Digite a nova senha (mínimo 6 dígitos):");
      if(!newPass) return;
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if(error) alert('Erro: ' + error.message); else alert('Senha alterada com sucesso!');
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32 font-sans">
      <div className="bg-slate-900 pt-10 pb-8 rounded-b-[40px] shadow-2xl border-b border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
        {activeTab === 'agenda' && (
            <>
                <div className="relative z-10 mb-2 px-6"><img src="/icon-horizontal.png" alt="Volante Express" className="h-16 object-contain drop-shadow-lg" /></div>
                <p className="text-slate-400 text-sm">Bem-vindo, <span className="text-blue-400 font-bold">{user?.email?.split('@')[0]}</span></p>
                {isPreviewMode && <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded mt-2">MODO ESPIÃO</span>}
            </>
        )}
        {activeTab === 'perfil' && (
            <div className="text-center z-10">
                <div className="w-24 h-24 bg-slate-800 rounded-full mx-auto mb-4 border-4 border-slate-700 flex items-center justify-center relative"><User size={40} className="text-slate-500"/><button className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white hover:bg-blue-500"><Camera size={14}/></button></div>
                <h2 className="text-xl font-bold text-white">{profile?.full_name || 'Instalador'}</h2>
                <p className="text-slate-400 text-sm">{user?.email}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 font-bold uppercase tracking-wider">{profile?.region_id || 'Sem Regional'}</span>
            </div>
        )}
      </div>

      <main className="p-6 space-y-4">
        {activeTab === 'agenda' && (
            <>
                <div className="flex items-center justify-between"><h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Calendar size={14}/> Serviços Pendentes</h3><span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-lg">{appointments.length} itens</span></div>
                <div className="space-y-3">
                    {appointments.length === 0 && (<div className="text-center py-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30"><Car size={40} className="mx-auto text-slate-700 mb-3"/><p className="text-slate-500 text-sm font-medium">Tudo limpo por aqui.</p><p className="text-slate-600 text-xs mt-1">Aguarde novos agendamentos.</p></div>)}
                    {appointments.map(app => (
                        <div key={app.id} onClick={() => router.push(`/atendimento/${app.id}`)} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden active:scale-95 transition-transform cursor-pointer hover:border-blue-500/30 shadow-md">
                            <div className="absolute top-0 right-0 bg-slate-800 pl-3 pr-2 py-1 rounded-bl-xl border-b border-l border-slate-700 flex items-center gap-1"><MapPin size={10} className="text-blue-400" /><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide truncate max-w-[100px]">{app.calendar_name || app.region_id || 'Regional'}</span></div>
                            <div className="flex items-start gap-4 mt-2">
                                <div className="bg-blue-950/50 p-3 rounded-xl text-blue-400 border border-blue-900/30 self-center"><Car size={20}/></div>
                                <div className="flex-1"><h4 className="font-bold text-white text-lg leading-tight">{app.vehicle_model}</h4><p className="text-xs text-slate-500 mb-2">{app.customer_name}</p><div className="inline-flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded-lg border border-slate-800/50"><Clock size={12} className="text-blue-500"/><span className="text-xs font-medium text-slate-300">{formatDate(app.appointment_at)}</span></div></div>
                                <div className="self-center"><ChevronRight className="text-slate-600" size={16}/></div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}
        {activeTab === 'perfil' && (
            <div className="space-y-4">
                <button onClick={handleUpdatePassword} className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-blue-500/50 transition-colors"><div className="flex items-center gap-4"><div className="bg-slate-800 p-2 rounded-xl text-slate-400 group-hover:text-blue-400"><Lock size={20}/></div><div className="text-left"><h4 className="text-slate-200 font-bold">Alterar Senha</h4><p className="text-xs text-slate-500">Atualize sua segurança</p></div></div><ChevronRight size={16} className="text-slate-600"/></button>
                <button onClick={handleLogout} className="w-full bg-red-950/20 p-4 rounded-2xl border border-red-900/30 flex items-center justify-between group hover:bg-red-950/30 transition-colors"><div className="flex items-center gap-4"><div className="bg-red-900/20 p-2 rounded-xl text-red-500"><LogOut size={20}/></div><div className="text-left"><h4 className="text-red-400 font-bold">Sair da Conta</h4><p className="text-xs text-red-500/60">Encerrar sessão</p></div></div></button>
            </div>
        )}
      </main>

      {activeTab === 'agenda' && (<button onClick={handleNewService} disabled={creating} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center text-white transition-transform active:scale-90 z-30">{creating ? <Loader2 className="animate-spin"/> : <Plus size={28}/>}</button>)}

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
            <button onClick={() => setActiveTab('agenda')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'agenda' ? 'text-blue-500' : 'text-slate-500'}`}><ListTodo size={24} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} /><span className="text-[10px] font-bold">Agenda</span></button>
            <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Wallet size={24} /><span className="text-[10px] font-medium">Comissões</span></button>
            <button onClick={() => setActiveTab('perfil')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'perfil' ? 'text-blue-500' : 'text-slate-500'}`}><User size={24} strokeWidth={activeTab === 'perfil' ? 2.5 : 2} /><span className="text-[10px] font-bold">Perfil</span></button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE EXPORTADO (A Proteção) ---
export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>}>
      <HomeContent />
    </Suspense>
  );
}