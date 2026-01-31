'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Clock, Car, ChevronRight, LogOut, MapPin } from 'lucide-react';
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

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    // 1. Verifica se está logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 2. Busca perfil para saber a região
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // Se não tiver perfil criado ainda, assume um padrão ou mostra erro
    if (!profile) {
        console.log("Usuário sem perfil na tabela 'profiles'.");
    }

    setUserProfile(profile);
    fetchAppointments(profile?.region_id);
  }

  async function fetchAppointments(regionId) {
    if (!regionId) return setLoading(false);

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pendente')
      .eq('region_id', regionId)
      .order('appointment_at', { ascending: true });

    setAppointments(data || []);
    setLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const formatData = (isoString) => {
    if (!isoString) return '--:--';
    const date = parseISO(isoString);
    return isToday(date) 
      ? `Hoje, ${format(date, 'HH:mm')}` 
      : format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando agenda...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-lg font-bold">Volante Express</h1>
          <p className="text-xs text-slate-400">Região: {userProfile?.region_id || '...'}</p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <LogOut size={16} />
        </button>
      </header>

      {/* Lista */}
      <main className="p-4 max-w-md mx-auto space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center mt-10 p-6 bg-white rounded-xl shadow-sm text-slate-500">
            Nenhum serviço pendente nesta região.
          </div>
        ) : (
          appointments.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2 text-blue-800 text-sm font-medium">
                <Clock size={16} /> {formatData(item.appointment_at)}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{item.vehicle_model}</h2>
                    <p className="text-slate-500 text-sm">Ano: {item.vehicle_year}</p>
                  </div>
                  <div className="bg-slate-100 p-2 rounded-full"><Car size={20} className="text-slate-600"/></div>
                </div>
                
                <p className="text-slate-700 font-medium mb-4">{item.customer_name}</p>

                <div className="flex gap-2">
                  {item.customer_phone && (
                    <a href={`https://wa.me/55${item.customer_phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold border border-green-200">
                      <Phone size={16} /> WhatsApp
                    </a>
                  )}
                  <Link href={`/atendimento/${item.id}`} className="flex-1 bg-slate-900 text-white py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-bold">
                    Iniciar <ChevronRight size={16} />
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