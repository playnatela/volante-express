'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Package, Search, ListTodo, Wallet, User, AlertTriangle } from 'lucide-react';

export default function EstoquePage() {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [regionName, setRegionName] = useState('Sua Região');

    useEffect(() => {
        fetchInventory();
    }, []);

    async function fetchInventory() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('region_id')
                .eq('id', user.id)
                .single();

            if (profile?.region_id) {
                setRegionName(profile.region_id);
                const { data: invData } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('region_id', profile.region_id)
                    .order('name');

                setInventory(invData || []);
            }
        }
        setLoading(false);
    }

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-950 pb-32 text-slate-200 font-sans">
            <div className="bg-slate-900 pt-10 pb-8 rounded-b-[40px] shadow-2xl border-b border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="relative z-10 mb-2 px-6">
                    <img src="/icon-horizontal.png" alt="Volante Express" className="h-16 object-contain drop-shadow-lg" />
                </div>
                <p className="text-slate-400 text-sm">Controle de Estoque</p>
                <span className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold px-3 py-1 rounded-full mt-3 tracking-wider">
                    {regionName}
                </span>
            </div>

            <main className="max-w-md mx-auto p-5 space-y-6">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-slate-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar material..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-400 text-sm uppercase ml-1 flex items-center gap-2">
                            <Package size={14} /> Itens Disponíveis
                        </h3>
                        <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">{filteredInventory.length}</span>
                    </div>

                    {loading ? <div className="text-center py-10 text-slate-600">Buscando estoque...</div> : (
                        <div className="space-y-3">
                            {filteredInventory.length === 0 && (
                                <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
                                    <Package size={32} className="mx-auto text-slate-700 mb-2" />
                                    <p className="text-slate-500 text-sm">Nenhum item encontrado.</p>
                                </div>
                            )}

                            {filteredInventory.map(item => {
                                const isLow = item.quantity <= item.min_threshold;
                                return (
                                    <div key={item.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center relative overflow-hidden group">
                                        {isLow && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>}

                                        <div className={`pl-${isLow ? '2' : '0'}`}>
                                            <h4 className="font-bold text-slate-200 text-base">{item.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isLow ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                    {isLow ? 'Baixo Estoque' : 'Normal'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className={`text-2xl font-bold tracking-tight ${item.quantity === 0 ? 'text-red-500' : 'text-white'}`}>
                                                {item.quantity}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium uppercase">Unidades</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
                <div className="flex justify-around items-center">
                    <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <ListTodo size={24} />
                        <span className="text-[10px] font-medium">Agenda</span>
                    </button>
                    <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-blue-500 transition-colors">
                        <Package size={24} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold">Estoque</span>
                    </button>
                    <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <Wallet size={24} />
                        <span className="text-[10px] font-medium">Comissões</span>
                    </button>
                    <button onClick={() => router.push('/?activeTab=perfil')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <User size={24} />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
