'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Erro: Verifique e-mail e senha.');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Efeito de Fundo (Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10">
        
        {/* Cabeçalho com Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner border border-slate-700">
             {/* Usa o ícone do PWA se existir, senão um ícone padrão */}
             <img src="/icon.png" alt="Logo" className="w-16 h-16 object-contain rounded-xl" onError={(e) => e.target.style.display='none'} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Volante Express</h1>
          <p className="text-slate-500 text-sm mt-1">Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">E-mail</label>
            <div className="relative">
                <div className="absolute left-4 top-3.5 text-slate-500"><Mail size={20}/></div>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder="seu@email.com"
                    required
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Senha</label>
            <div className="relative">
                <div className="absolute left-4 top-3.5 text-slate-500"><Lock size={20}/></div>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder="••••••••"
                    required
                />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Entrar <ArrowRight size={20}/></>}
          </button>
        </form>
      </div>
    </div>
  );
}