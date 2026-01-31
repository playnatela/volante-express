'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Package, DollarSign, BarChart3, TrendingUp, TrendingDown, Filter, Plus, Save, X, AlertTriangle } from 'lucide-react';
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
  
  // Dados
  const [inventory, setInventory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Forms
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Operacional' });
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, min_threshold: 5 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingInv, setIsEditingInv] = useState(null);
  const [editInvForm, setEditInvForm] = useState({});

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) fetchData();
  }, [selectedRegion, activeTab]);

  async function loadRegions() {
    const { data } = await supabase.from('regions').select('*');
    if (data?.length) {
      setRegions(data);
      setSelectedRegion(data[0].slug);
    }
  }

  async function fetchData() {
    setLoading(true);
    // Estoque
    const { data: inv } = await supabase.from('inventory').select('*').eq('region_id', selectedRegion).order('name');
    setInventory(inv || []);
    // Entradas
    const { data: apps } = await supabase.from('appointments').select('*').eq('status', 'concluido').eq('region_id', selectedRegion);
    setAppointments(apps || []);
    // Saídas
    const { data: exp } = await supabase.from('expenses').select('*').eq('region_id', selectedRegion);
    setExpenses(exp || []);
    setLoading(false);
  }

  // --- LÓGICA FINANCEIRA ---
  const financeSummary = useMemo(() => {
    const totalIncome = appointments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return { totalIncome, totalExpense, profit: totalIncome - totalExpense };
  }, [appointments, expenses]);

  const chartData = [
    { name: 'Entradas', valor: financeSummary.totalIncome, color: '#16a34a' },
    { name: 'Saídas', valor: financeSummary.totalExpense, color: '#dc2626' },
  ];

  // --- AÇÕES ---
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
    await supabase.from('inventory').update({ 
      quantity: editInvForm.quantity, 
      min_threshold: editInvForm.min_threshold 
    }).eq('id', id);
    setIsEditingInv(null);
    fetchData();
  }

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Admin Volante Express</h1>
          <div className="flex items-center gap-2 bg-white p-2 rounded shadow border">
            <Filter size={16}/>
            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold outline-none">
              {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
            {['dashboard', 'financeiro', 'estoque'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 capitalize font-medium ${activeTab === tab ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500'}`}>
                    {tab}
                </button>
            ))}
        </div>

        {loading ? <p>Carregando...</p> : (
            <>
            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
                            <p className="text-slate-500">Receita</p>
                            <h3 className="text-2xl font-bold text-green-600">R$ {financeSummary.totalIncome.toFixed(2)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded shadow border-l-4 border-red-500">
                            <p className="text-slate-500">Despesas</p>
                            <h3 className="text-2xl font-bold text-red-600">R$ {financeSummary.totalExpense.toFixed(2)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
                            <p className="text-slate-500">Lucro</p>
                            <h3 className="text-2xl font-bold text-blue-600">R$ {financeSummary.profit.toFixed(2)}</h3>
                        </div>
                    </div>
                    <div className="h-64 bg-white p-4 rounded shadow">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* FINANCEIRO */}
            {activeTab === 'financeiro' && (
                <div className="space-y-6">
                    <form onSubmit={handleAddExpense} className="bg-white p-4 rounded shadow flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs">Descrição</label>
                            <input className="w-full p-2 border rounded" required placeholder="Ex: Gasolina" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                        </div>
                        <div className="w-32">
                            <label className="text-xs">Valor</label>
                            <input className="w-full p-2 border rounded" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                        </div>
                        <button className="bg-red-600 text-white px-4 py-2 rounded font-bold">Lançar Saída</button>
                    </form>
                    
                    <table className="w-full bg-white rounded shadow text-sm">
                        <tbody className="divide-y">
                            {[...appointments.map(a => ({...a, type: 'in', desc: `Serviço ${a.vehicle_model}`, val: a.amount})), 
                              ...expenses.map(e => ({...e, type: 'out', desc: e.description, val: e.amount}))]
                              .sort((a,b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
                              .map((t, i) => (
                                <tr key={i}>
                                    <td className="p-3 text-slate-500">{new Date(t.created_at || t.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-medium">{t.desc}</td>
                                    <td className={`p-3 text-right font-bold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ESTOQUE */}
            {activeTab === 'estoque' && (
                <div className="space-y-4">
                    <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 w-fit">
                        <Plus size={16}/> Novo Material
                    </button>
                    
                    {showAddForm && (
                        <form onSubmit={handleAddInventory} className="bg-slate-100 p-4 rounded grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                            <input className="p-2 border rounded col-span-2" placeholder="Nome" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                            <input className="p-2 border rounded" type="number" placeholder="Qtd" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                            <button className="bg-green-600 text-white p-2 rounded">Salvar</button>
                        </form>
                    )}

                    <div className="bg-white rounded shadow overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-3">Material</th>
                                    <th className="p-3 text-center">Qtd</th>
                                    <th className="p-3 text-center">Mín</th>
                                    <th className="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {inventory.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-3">{item.name}</td>
                                        <td className="p-3 text-center">
                                            {isEditingInv === item.id ? (
                                                <input className="w-16 border text-center" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} />
                                            ) : (
                                                <span className={`px-2 py-1 rounded-full font-bold ${item.quantity <= item.min_threshold ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.quantity} {item.quantity <= item.min_threshold && '!'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                             {isEditingInv === item.id ? (
                                                <input className="w-12 border text-center" type="number" value={editInvForm.min_threshold} onChange={e => setEditInvForm({...editInvForm, min_threshold: e.target.value})} />
                                            ) : item.min_threshold}
                                        </td>
                                        <td className="p-3 text-right">
                                            {isEditingInv === item.id ? (
                                                <button onClick={() => handleUpdateInventory(item.id)} className="text-green-600 p-1"><Save size={18}/></button>
                                            ) : (
                                                <button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-blue-600 p-1">Editar</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </>
        )}
      </div>
    </div>
  );
}