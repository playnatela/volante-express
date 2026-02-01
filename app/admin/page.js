'use client';
import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { TrendingDown, Filter, Settings, Trash2, Banknote, Calendar, Star, Package, Plus, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [activeTab, setActiveTab] = useState('dashboard');
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  
  // Dados Principais
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState([]);
  const [inventory, setInventory] = useState([]); 
  
  // Forms & Edição
  const [newAccount, setNewAccount] = useState({ name: '', type: 'banco' });
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Operacional', account_id: '' });
  const [editingRate, setEditingRate] = useState(null);
  
  // Estoque (Trazendo de volta!)
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
    
    // 1. Estoque (Restaurado)
    const { data: inv } = await supabase.from('inventory').select('*').eq('region_id', selectedRegion).order('name');
    setInventory(inv || []);
    
    // 2. Agendamentos e Despesas
    const { data: apps } = await supabase.from('appointments').select('*').eq('status', 'concluido').eq('region_id', selectedRegion);
    setAppointments(apps || []);
    
    const { data: exp } = await supabase.from('expenses').select('*').eq('region_id', selectedRegion);
    setExpenses(exp || []);
    
    // 3. Contas (Globais ou da Região)
    const { data: acc } = await supabase.from('accounts')
        .select('*')
        .or(`region_id.is.null,region_id.eq.${selectedRegion}`) 
        .order('type', { ascending: true })
        .order('name', { ascending: true });
    setAccounts(acc || []);

    // 4. Taxas
    const { data: rt } = await supabase.from('payment_rates').select('*').order('installments');
    setRates(rt || []);

    setLoading(false);
  }

  // --- AÇÕES CONFIGURAÇÕES ---
  async function handleAddAccount(e) {
    e.preventDefault();
    const regionToSave = newAccount.type === 'banco' ? null : selectedRegion;
    const { error } = await supabase.from('accounts').insert([{ ...newAccount, region_id: regionToSave, balance: 0 }]);
    if (!error) { 
        setNewAccount({ name: '', type: 'banco' }); 
        fetchData(); 
        alert('Conta criada com sucesso!');
    }
  }

  async function handleDeleteAccount(id) {
    if(!confirm('Tem certeza? Se houver movimentações, isso causará erro.')) return;
    await supabase.from('accounts').delete().eq('id', id);
    fetchData();
  }

  // NOVA FUNÇÃO: Definir conta padrão
  async function handleSetDefault(accountId) {
    // 1. Remove padrão de todas as contas globais (bancos)
    await supabase.from('accounts').update({ is_default: false }).is('region_id', null);
    // 2. Define a nova padrão
    await supabase.from('accounts').update({ is_default: true }).eq('id', accountId);
    fetchData();
  }

  async function handleUpdateRate(rate) {
    await supabase.from('payment_rates').update({ rate_percent: rate.rate_percent }).eq('id', rate.id);
    setEditingRate(null);
    fetchData();
  }

  // --- AÇÕES FINANCEIRO ---
  async function handleAddExpense(e) {
    e.preventDefault();
    if (!newExpense.account_id) return alert('Selecione a conta!');
    const { error } = await supabase.from('expenses').insert([{ ...newExpense, region_id: selectedRegion, date: new Date().toISOString() }]);
    if (!error) {
        const acc = accounts.find(a => a.id === newExpense.account_id);
        if(acc) {
            await supabase.from('accounts').update({ balance: acc.balance - Number(newExpense.amount) }).eq('id', newExpense.account_id);
        }
        setNewExpense({ description: '', amount: '', category: 'Operacional', account_id: '' });
        fetchData();
    }
  }

  // --- AÇÕES ESTOQUE (RESTAURADAS) ---
  async function handleAddInventory(e) {
    e.preventDefault();
    await supabase.from('inventory').insert([{ ...newItem, region_id: selectedRegion }]);
    setNewItem({ name: '', quantity: 0, min_threshold: 5 });
    setShowAddForm(false);
    fetchData();
  }
  async function handleUpdateInventory(id) {
    await supabase.from('inventory').update({ quantity: editInvForm.quantity }).eq('id', id);
    setIsEditingInv(null);
    fetchData();
  }

  // Cálculos Dashboard
  const filteredData = useMemo(() => {
    const apps = appointments.filter(a => (a.completed_at || a.created_at).startsWith(selectedMonth));
    const exps = expenses.filter(e => (e.date || e.created_at).startsWith(selectedMonth));
    return { apps, exps };
  }, [appointments, expenses, selectedMonth]);

  const dashboardStats = useMemo(() => {
    const totalIncome = filteredData.apps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpense = filteredData.exps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return { totalIncome, totalExpense, profit: totalIncome - totalExpense };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Volante Express</h1>
            <p className="text-slate-500 text-sm">Visão Regional: <span className="font-bold text-blue-600 uppercase">{selectedRegion}</span></p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
                <Calendar size={18} className="text-slate-500"/>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="outline-none text-slate-700 font-bold bg-transparent cursor-pointer"/>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                <Filter size={18} className="text-slate-400"/>
                <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer">
                {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                </select>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 overflow-x-auto pb-2">
            {['dashboard', 'financeiro', 'estoque', 'configuracoes'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} 
                  className={`px-6 py-2 rounded-lg text-sm font-bold capitalize whitespace-nowrap ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-gray-50'}`}>
                    {tab === 'configuracoes' ? <span className="flex items-center gap-2"><Settings size={14}/> Config</span> : tab}
                </button>
            ))}
        </div>

        {loading ? <div className="text-center py-20 text-slate-400">Carregando...</div> : (
            <>
            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500">Receita ({selectedRegion})</p><h3 className="text-3xl font-bold text-green-600">R$ {dashboardStats.totalIncome.toFixed(2)}</h3></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500">Despesas ({selectedRegion})</p><h3 className="text-3xl font-bold text-red-600">R$ {dashboardStats.totalExpense.toFixed(2)}</h3></div>
                        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white"><p className="text-slate-400">Lucro Líquido</p><h3 className="text-3xl font-bold">R$ {dashboardStats.profit.toFixed(2)}</h3></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Banknote size={20}/> Saldos Atuais</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {accounts.filter(a => a.type === 'banco').map(acc => (
                                <div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-400' : 'bg-blue-50 border-blue-200'}`}>
                                    <p className="text-xs font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                        Banco Global {acc.is_default && '⭐'}
                                        <span className="text-blue-600">🏢</span>
                                    </p>
                                    <p className="font-bold text-lg text-slate-800">{acc.name}</p>
                                    <p className="text-2xl font-bold mt-2 text-slate-900">R$ {Number(acc.balance).toFixed(2)}</p>
                                </div>
                            ))}
                            {accounts.filter(a => a.type === 'carteira').map(acc => (
                                <div key={acc.id} className="p-4 rounded-xl border bg-yellow-50 border-yellow-200">
                                    <p className="text-xs font-bold uppercase text-slate-500 mb-1 flex justify-between">Caixa {selectedRegion} <span className="text-yellow-600">💰</span></p>
                                    <p className="font-bold text-lg text-slate-800">{acc.name}</p>
                                    <p className="text-2xl font-bold mt-2 text-slate-900">R$ {Number(acc.balance).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* FINANCEIRO */}
            {activeTab === 'financeiro' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingDown className="text-red-500" size={20}/> Lançar Despesa</h3>
                        <form onSubmit={handleAddExpense} className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1"><label className="text-xs font-bold text-slate-500">Descrição</label><input className="w-full p-3 bg-gray-50 border rounded-xl" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} /></div>
                            <div className="w-32"><label className="text-xs font-bold text-slate-500">Valor</label><input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                            <div className="min-w-[200px]"><label className="text-xs font-bold text-slate-500">Origem (Conta)</label>
                                <select className="w-full p-3 bg-gray-50 border rounded-xl" required value={newExpense.account_id} onChange={e => setNewExpense({...newExpense, account_id: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type === 'banco' ? 'Global' : 'Regional'})</option>)}
                                </select>
                            </div>
                            <button className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700">Salvar</button>
                        </form>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                             <thead className="bg-gray-50 text-slate-500 font-medium"><tr><th className="p-4 text-left">Data</th><th className="p-4 text-left">Desc</th><th className="p-4 text-right">Valor</th></tr></thead>
                             <tbody className="divide-y divide-gray-100">
                                {[...filteredData.apps.map(a => ({date: a.created_at, desc: `Receita: ${a.vehicle_model}`, val: a.amount, type: 'in'})), 
                                  ...filteredData.exps.map(e => ({date: e.date, desc: `Despesa: ${e.description}`, val: e.amount, type: 'out'}))]
                                  .sort((a,b) => new Date(b.date) - new Date(a.date)).map((t, i) => (
                                    <tr key={i}>
                                        <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-slate-700">{t.desc}</td>
                                        <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ESTOQUE (DE VOLTA E COMPLETO) */}
            {activeTab === 'estoque' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                         <div>
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={20}/> Inventário: {selectedRegion}</h3>
                            <p className="text-xs text-slate-500">Gerencie os materiais desta regional.</p>
                         </div>
                         <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-500"><Plus size={18}/> Novo Item</button>
                    </div>
                    
                    {showAddForm && (
                        <form onSubmit={handleAddInventory} className="bg-blue-50 p-6 rounded-2xl grid grid-cols-4 gap-4 items-end border border-blue-100">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500">Nome do Material</label><input className="w-full p-3 border rounded-xl" placeholder="Ex: Capa Lisa Preta" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500">Quantidade</label><input className="w-full p-3 border rounded-xl" type="number" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} /></div>
                            <button className="bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-500">Salvar</button>
                        </form>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inventory.map(item => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
                                {item.quantity <= item.min_threshold && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                    <span className={`text-xs px-2 py-1 rounded-md font-bold ${item.quantity <= item.min_threshold ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-slate-500'}`}>
                                        {item.quantity <= item.min_threshold ? 'Estoque Baixo' : 'Normal'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    {isEditingInv === item.id ? (
                                        <div className="flex items-center gap-2">
                                            <input className="w-16 p-2 border rounded-lg text-center font-bold" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} />
                                            <button onClick={() => handleUpdateInventory(item.id)} className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200"><Save size={18}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-3xl font-bold text-slate-800">{item.quantity}</span>
                                            <button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:underline font-bold">Ajustar</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {inventory.length === 0 && <p className="col-span-full text-center py-10 text-slate-400">Nenhum item cadastrado nesta região.</p>}
                    </div>
                </div>
            )}

            {/* CONFIGURAÇÕES (ATUALIZADO COM CONTA PADRÃO) */}
            {activeTab === 'configuracoes' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h4 className="font-bold text-slate-800 mb-4">Contas Disponíveis</h4>
                            <div className="space-y-2">
                                {accounts.map(acc => (
                                    <div key={acc.id} className={`flex justify-between items-center p-3 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-3">
                                            {/* CHECKBOX DE CONTA PADRÃO */}
                                            {acc.type === 'banco' && (
                                                <button 
                                                    onClick={() => handleSetDefault(acc.id)}
                                                    className={`p-1 rounded-full transition-colors ${acc.is_default ? 'text-yellow-500' : 'text-gray-300