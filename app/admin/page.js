'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Package, DollarSign, BarChart3, TrendingUp, TrendingDown, Filter, Plus, Save, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [inventory, setInventory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Operacional' });
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, min_threshold: 5 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingInv, setIsEditingInv] = useState(null);
  const [editInvForm, setEditInvForm] = useState({});

  useEffect(() => { loadRegions(); }, []);
  useEffect(() => { if (selectedRegion) fetchData(); }, [selectedRegion, activeTab]);

  async function loadRegions() {
    const { data } = await supabase.from('regions').select('*');
    if (data?.length) { setRegions(data); setSelectedRegion(data[0].slug); }
  }

  async function fetchData() {
    setLoading(true);
    const { data: inv } = await supabase.from('inventory').select('*').eq('region_id', selectedRegion).order('name');
    setInventory(inv || []);
    const { data: apps } = await supabase.from('appointments').select('*').eq('status', 'concluido').eq('region_id', selectedRegion);
    setAppointments(apps || []);
    const { data: exp } = await supabase.from('expenses').select('*').eq('region_id', selectedRegion);
    setExpenses(exp || []);
    setLoading(false);
  }

  const financeSummary = useMemo(() => {
    const totalIncome = appointments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return { totalIncome, totalExpense, profit: totalIncome - totalExpense };
  }, [appointments, expenses]);

  const chartData = [
    { name: 'Entradas', valor: financeSummary.totalIncome, color: '#16a34a' },
    { name: 'Saídas', valor: financeSummary.totalExpense, color: '#dc2626' },
  ];

  async function handleAddExpense(e) {
    e.preventDefault();
    await supabase.from('expenses').insert([{ ...newExpense, region_id: selectedRegion }]);
    setNewExpense({ description: '', amount: '', category: 'Operacional' });
    fetchData();
  }

  async function handleAddInventory(e) {
    e.preventDefault();
    await supabase.from('inventory').insert([{ ...newItem, region_id: selectedRegion }]);
    setShowAddForm(false);
    fetchData();
  }

  async function handleUpdateInventory(id) {
    await supabase.from('inventory').update({ quantity: editInvForm.quantity, min_threshold: editInvForm.min_threshold }).eq('id', id);
    setIsEditingInv(null);
    fetchData();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Elegante */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Volante Express</h1>
            <p className="text-slate-500 text-sm">Painel de Gestão</p>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            <Filter size={18} className="text-slate-400"/>
            <span className="text-sm font-medium text-slate-500 uppercase">Região:</span>
            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer">
              {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {/* Abas Estilizadas */}
        <div className="flex gap-2 p-1 bg-white rounded-xl w-fit shadow-sm border border-gray-200">
            {['dashboard', 'financeiro', 'estoque'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} 
                  className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-gray-50'}`}>
                    {tab}
                </button>
            ))}
        </div>

        {loading ? <div className="text-center py-20 text-slate-400">Carregando dados...</div> : (
            <>
            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <p className="text-slate-500 font-medium relative z-10">Receita Total</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1 relative z-10">R$ {financeSummary.totalIncome.toFixed(2)}</h3>
                            <div className="flex items-center gap-1 text-green-600 text-xs font-bold mt-2 relative z-10"><TrendingUp size={14}/> Entradas Confirmadas</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                             <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <p className="text-slate-500 font-medium relative z-10">Despesas</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-1 relative z-10">R$ {financeSummary.totalExpense.toFixed(2)}</h3>
                            <div className="flex items-center gap-1 text-red-600 text-xs font-bold mt-2 relative z-10"><TrendingDown size={14}/> Saídas Lançadas</div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg shadow-slate-900/10 text-white relative overflow-hidden">
                            <div className="absolute -right-6 -bottom-6 text-slate-800 opacity-20"><DollarSign size={100}/></div>
                            <p className="text-slate-400 font-medium">Lucro Líquido</p>
                            <h3 className="text-4xl font-bold mt-1">R$ {financeSummary.profit.toFixed(2)}</h3>
                            <div className="mt-4 text-xs bg-slate-800 w-fit px-2 py-1 rounded text-slate-300">Saldo Atual</div>
                        </div>
                    </div>
                    <div className="h-80 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="font-bold text-slate-700 mb-6">Fluxo Financeiro</h4>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={chartData} barSize={60}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* FINANCEIRO */}
            {activeTab === 'financeiro' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingDown className="text-red-500" size={20}/> Registrar Nova Despesa</h3>
                        <form onSubmit={handleAddExpense} className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Descrição</label>
                                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 transition-colors" required placeholder="Ex: Gasolina, Almoço..." value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                            </div>
                            <div className="w-32">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Valor</label>
                                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 transition-colors" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                            </div>
                            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-transform active:scale-95">Lançar</button>
                        </form>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="p-4 text-left">Data</th>
                                    <th className="p-4 text-left">Descrição</th>
                                    <th className="p-4 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...appointments.map(a => ({...a, type: 'in', desc: `Serviço ${a.vehicle_model}`, val: a.amount})), 
                                  ...expenses.map(e => ({...e, type: 'out', desc: e.description, val: e.amount}))]
                                  .sort((a,b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
                                  .map((t, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-slate-500">{new Date(t.created_at || t.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-slate-700">{t.desc}</td>
                                        <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ESTOQUE */}
            {activeTab === 'estoque' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center">
                         <h3 className="font-bold text-slate-700">Inventário: {selectedRegion}</h3>
                         <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-900/20">
                            <Plus size={18}/> Novo Material
                        </button>
                    </div>
                    
                    {showAddForm && (
                        <form onSubmit={handleAddInventory} className="bg-blue-50 p-6 rounded-2xl border border-blue-100 grid grid-cols-2 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-2">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-blue-800 uppercase ml-1">Nome do Material</label>
                                <input className="w-full p-3 border border-blue-200 rounded-xl" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-blue-800 uppercase ml-1">Qtd Inicial</label>
                                <input className="w-full p-3 border border-blue-200 rounded-xl" type="number" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                            </div>
                            <button className="bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700">Salvar</button>
                        </form>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inventory.map(item => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-blue-200 transition-all">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-xs bg-gray-100 text-slate-500 px-2 py-1 rounded-md">Min: {item.min_threshold}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {isEditingInv === item.id ? (
                                        <div className="flex items-center gap-2">
                                            <input className="w-16 p-2 border rounded-lg text-center font-bold" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} />
                                            <button onClick={() => handleUpdateInventory(item.id)} className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200"><Save size={18}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`text-2xl font-bold ${item.quantity <= item.min_threshold ? 'text-red-500' : 'text-slate-800'}`}>
                                                {item.quantity}
                                            </span>
                                            <button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:underline font-medium">Ajustar</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </>
        )}
      </div>
    </div>
  );
}