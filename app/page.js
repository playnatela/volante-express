'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Clock, Car, ChevronRight, LogOut, MapPin, CalendarDays, Navigation } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function HomePage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const router = useRouter();

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (!userProfile?.region_id) return;
    const channel = supabase.channel('realtime_appointments')
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'appointments',
        filter: `region_id=eq.${userProfile.region_id}`
      }, () => fetchAppointments(userProfile.region_id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setUserProfile(profile);
    fetchAppointments(profile?.region_id);
  }

  async function fetchAppointments(regionId) {
    if (!regionId) return setLoading(false);
    const { data } = await supabase.from('appointments').select('*')
      .eq('status', 'pendente').eq('region_id', regionId).order('appointment_at', { ascending: true });
    setAppointments(data || []);
    setLoading(false);
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const formatData = (isoString) => {
    if (!isoString) return '--:--';
    const date = parseISO(isoString);
    return isToday(date) ? `Hoje, ${format(date, 'HH:mm')}` : format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  // Função inteligente para corrigir o WhatsApp
  const getWhatsappLink = (phone) => {
    if (!phone) return '#';
    const clean = phone.replace(/\D/g, '');
    // Se começar com 55 e tiver mais de 11 digitos (DDD + 9 digitos = 11), assume que já tem DDI
    const final = clean.startsWith('55') && clean.length > 11 ? clean : `55${clean}`;
    return `https://wa.me/${final}`;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 p-5 sticky top-0 z-10 flex justify-between items-center shadow-lg safe-area-top">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Volante Express</h1>
          <p className="text-xs text-blue-400 font-medium uppercase tracking-wider flex items-center gap-1">
            <MapPin size={10} /> {userProfile?.region_id || '...'}
          </p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400"><LogOut size={18} /></button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4 mt-2">
        {appointments.length === 0 ? (
          <div className="text-center mt-20 p-8 bg-slate-900 rounded-2xl border border-slate-800 border-dashed">
            <CalendarDays size={48} className="mx-auto text-slate-700 mb-4"/>
            <p className="text-slate-400 font-medium">Sem serviços agora.</p>
          </div>
        ) : (
          appointments.map((item) => (
            <div key={item.id} className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden relative">
              <div className="bg-slate-950/50 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold"><Clock size={16} /> {formatData(item.appointment_at)}</div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div><h2 className="text-xl font-bold text-white leading-tight">{item.vehicle_model}</h2><p className="text-slate-500 text-sm mt-1">Ano: {item.vehicle_year}</p></div>
                  <div className="bg-slate-800 p-3 rounded-xl text-blue-400"><Car size={24} /></div>
                </div>
                <div className="mb-4 pb-4 border-b border-slate-800/50">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Cliente</p>
                    <p className="text-slate-300 font-medium text-lg">{item.customer_name}</p>
                </div>
                <div className="flex gap-3">
                  {item.customer_phone && (
                    <a href={getWhatsappLink(item.customer_phone)} target="_blank" className="flex-1 bg-slate-800 hover:bg-slate-700 text-green-500 py-3 rounded-xl flex justify-center items-center gap-2 text-sm font-bold border border-slate-700">
                      <Phone size={18} /> WhatsApp
                    </a>
                  )}
                  <Link href={`/atendimento/${item.id}`} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl flex justify-center items-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20">
                    Iniciar <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}