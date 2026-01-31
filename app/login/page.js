'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Erro: ' + error.message);
      setLoading(false);
    } else {
      router.push('/'); // Manda para a home
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-slate-800">Acesso Volante Express</h1>
        <input 
          type="email" placeholder="Email" 
          className="w-full p-3 mb-4 border rounded-lg"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        <input 
          type="password" placeholder="Senha" 
          className="w-full p-3 mb-6 border rounded-lg"
          value={password} onChange={e => setPassword(e.target.value)}
        />
        <button disabled={loading} className="w-full bg-slate-900 text-white p-3 rounded-lg font-bold">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}