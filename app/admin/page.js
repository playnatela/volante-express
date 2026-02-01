'use client';
import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  TrendingDown, Filter, Settings, Trash2, Banknote, Calendar, 
  Star, Package, Plus, Save, Eye, X, PieChart as PieIcon, 
  BarChart3, Users, LayoutDashboard, LogOut, Menu
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
  const [installers, setInstallers] = useState([]);
  
  // Forms & Edição
  const [newAccount, setNewAccount] = useState({ name: '', type: 'banco' });
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Operacional', account_id: '' });
  const [editingRate, setEditingRate] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, min_threshold: 5 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingInv, setIsEditingInv] = useState(null);
  const [editInvForm, setEditInvForm] = useState({});
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => { loadRegions(); }, []);
  useEffect(() => { if (selectedRegion) fetchData(); }, [selectedRegion, activeTab]);

  async function loadRegions() {
    const { data } = await supabase.from('regions').select('*');
    if (data?.length) { setRegions(data); setSelectedRegion(data[0].slug); }
  }

  async function fetchData() {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*');
    setInstallers(profiles || []);
    const { data: inv } = await supabase.from('inventory').select('*').eq('region_id', selectedRegion).order('name');
    setInventory(inv || []);
    const { data: apps } = await supabase.from('appointments').select('*').eq('status', 'concluido').eq('region_id', selectedRegion);
    setAppointments(apps || []);
    const { data: exp } = await supabase.from('expenses').select('*').eq('region_id', selectedRegion);
    setExpenses(exp || []);
    const { data: acc } = await supabase.from('accounts').select('*').or(`region_id.is.null,region_id.eq.${selectedRegion}`).order('type', { ascending: true }).order('name', { ascending: true });
    setAccounts(acc || []);
    const { data: rt } = await supabase.from('payment_rates').select('*').order('installments');
    setRates(rt || []);
    setLoading(false);
  }

  // --- AÇÕES (Mantidas Idênticas) ---
  async function handleAddAccount(e) { e.preventDefault(); const regionToSave = newAccount.type === 'banco' ? null : selectedRegion; const { error } = await supabase.from('accounts').insert([{ ...newAccount, region_id: regionToSave, balance: 0 }]); if (!error) { setNewAccount({ name: '', type: 'banco' }); fetchData(); alert('Conta criada!'); } }
  async function handleDeleteAccount(id) { if(!confirm('Tem certeza?')) return; await supabase.from('accounts').delete().eq('id', id); fetchData(); }
  async function handleSetDefault(accountId) { await supabase.from('accounts').update({ is_default: false }).is('region_id', null); await supabase.from('accounts').update({ is_default: true }).eq('id', accountId); fetchData(); }
  async function handleUpdateRate(rate) { await supabase.from('payment_rates').update({ rate_percent: rate.rate_percent }).eq('id', rate.id); setEditingRate(null); fetchData(); }
  async function handleAddExpense(e) { e.preventDefault(); if (!newExpense.account_id) return alert('Selecione a conta!'); const { error } = await supabase.from('expenses').insert([{ ...newExpense, region_id: selectedRegion, date: new Date().toISOString() }]); if (!error) { const acc = accounts.find(a => a.id === newExpense.account_id); if(acc) await supabase.from('accounts').update({ balance: acc.balance - Number(newExpense.amount) }).eq('id', newExpense.account_id); setNewExpense({ description: '', amount: '', category: 'Operacional', account_id: '' }); fetchData(); } }
  async function handleAddInventory(e) { e.preventDefault(); await supabase.from('inventory').insert([{ ...newItem, region_id: selectedRegion }]); setNewItem({ name: '', quantity: 0, min_threshold: 5 }); setShowAddForm(false); fetchData(); }
  async function handleUpdateInventory(id) { await supabase.from('inventory').update({ quantity: editInvForm.quantity }).eq('id', id); setIsEditingInv(null); fetchData(); }
  async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

  // --- CÁLCULOS ---
  const filteredData = useMemo(() => {
    const apps = appointments.filter(a => (a.completed_at || a.created_at).startsWith(selectedMonth));
    const exps = expenses.filter(e => (e.date || e.created_at).startsWith(selectedMonth));
    return { apps, exps };
  }, [appointments, expenses, selectedMonth]);

  const dashboardStats = useMemo(() => {
    const totalIncome = filteredData.apps.reduce((acc, curr) => acc + (Number(curr.gross_amount) || Number(curr.amount) || 0), 0);
    const totalNetIncome = filteredData.apps.reduce((acc, curr) => acc + (Number(curr.net_amount) || Number(curr.amount) || 0), 0);
    const totalExpense = filteredData.exps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const paymentsMap = {}; filteredData.apps.forEach(a => { const method = a.payment_method || 'outros'; const val = Number(a.gross_amount) || Number(a.amount) || 0; paymentsMap[method] = (paymentsMap[method] || 0) + val; });
    const paymentChartData = Object.keys(paymentsMap).map(k => ({ name: k, value: paymentsMap[k] }));
    const materialsMap = {}; filteredData.apps.forEach(a => { if(a.material_used_id) { const matName = inventory.find(i => i.id === a.material_used_id)?.name || 'Desconhecido'; materialsMap[matName] = (materialsMap[matName] || 0) + 1; } });
    const materialsChartData = Object.keys(materialsMap).map(k => ({ name: k, value: materialsMap[k] }));
    return { totalIncome, totalExpense, profit: totalNetIncome - totalExpense, paymentChartData, materialsChartData };
  }, [filteredData, inventory]);

  const commissionReport = useMemo(() => {
    const report = {};
    filteredData.apps.forEach(app => {
        if (!report[app.user_id]) report[app.user_id] = { count: 0, total: 0, name: 'Desconhecido' };
        report[app.user_id].count += 1;
        report[app.user_id].total += (Number(app.commission_amount) || 0);
        const installer = installers.find(i => i.id === app.user_id);
        if (installer) report[app.user_id].name = installer.full_name || installer.email;
    });
    return Object.values(report);
  }, [filteredData, installers]);

  // --- COMPONENTE DE MENU LATERAL (DESKTOP) ---
  const Sidebar = () => (
    <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-300 h-screen fixed left-0 top-0 z-50">
        <div className="p-6 flex justify-center border-b border-slate-800">
            <img src="/icon-horizontal.png" alt="Logo" className="h-10 object-contain brightness-0 invert opacity-90" />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={20}/> Dashboard</button>
            <button onClick={() => setActiveTab('financeiro')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'financeiro' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Banknote size={20}/> Financeiro</button>
            <button onClick={() => setActiveTab('equipe')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'equipe' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Users size={20}/> Equipe</button>
            <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'estoque' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Package size={20}/> Estoque</button>
            <button onClick={() => setActiveTab('configuracoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'configuracoes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Settings size={20}/> Config</button>
        </nav>
        <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-900/30 text-red-400 transition-all font-medium"><LogOut size={20}/> Sair</button>
        </div>
    </aside>
  );

  // --- COMPONENTE DE MENU INFERIOR (MOBILE) ---
  const BottomNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}><LayoutDashboard size={22}/><span className="text-[10px] font-medium">Dash</span></button>
        <button onClick={() => setActiveTab('financeiro')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'financeiro' ? 'text-blue-500' : 'text-slate-500'}`}><Banknote size={22}/><span className="text-[10px] font-medium">Finan</span></button>
        <button onClick={() => setActiveTab('equipe')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'equipe' ? 'text-blue-500' : 'text-slate-500'}`}><Users size={22}/><span className="text-[10px] font-medium">Equipe</span></button>
        <button onClick={() => setActiveTab('estoque')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'estoque' ? 'text-blue-500' : 'text-slate-500'}`}><Package size={22}/><span className="text-[10px] font-medium">Estoque</span></button>
        <button onClick={() => setActiveTab('configuracoes')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'configuracoes' ? 'text-blue-500' : 'text-slate-500'}`}><Settings size={22}/><span className="text-[10px] font-medium">Config</span></button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex">
      
      {/* Sidebar Desktop */}
      <Sidebar />

      {/* Área Principal */}
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        
        {/* Header Superior (Filtros) */}
        <div className="bg-white border-b border-gray-200 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-40 relative">
            <div className="md:hidden w-full flex justify-center mb-2">
                <img src="/icon-horizontal.png" alt="Logo" className="h-8 object-contain" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight hidden md:block">Painel Administrativo</h1>
                <p className="text-slate-500 text-sm hidden md:block">Visão Geral da Operação</p>
            </div>
            <div className="flex w-full md:w-auto gap-3">
                <div className="flex-1 md:flex-none flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                    <Calendar size={18} className="text-slate-400"/>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer w-full"/>
                </div>
                <div className="flex-1 md:flex-none flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                    <Filter size={18} className="text-slate-400"/>
                    <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer w-full uppercase">
                        {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* Conteúdo com Scroll */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
            {loading ? <div className="h-full flex items-center justify-center text-slate-400">Carregando dados...</div> : (
                <div className="max-w-6xl mx-auto animate-in fade-in space-y-6">
                    
                    {/* DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500 text-sm font-medium">Receita Bruta</p><h3 className="text-3xl font-bold text-slate-900 mt-1">R$ {dashboardStats.totalIncome.toFixed(2)}</h3></div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500 text-sm font-medium">Despesas Operacionais</p><h3 className="text-3xl font-bold text-red-600 mt-1">R$ {dashboardStats.totalExpense.toFixed(2)}</h3></div>
                                <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white"><p className="text-slate-400 text-sm font-medium flex justify-between">Lucro Líquido <span className="bg-slate-800 px-2 rounded text-xs py-0.5">Real</span></p><h3 className="text-3xl font-bold mt-1">R$ {dashboardStats.profit.toFixed(2)}</h3></div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={20} className="text-blue-600"/> Saldos em Conta</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {accounts.map(acc => (
                                        <div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{acc.type === 'banco' ? 'Banco Global' : `Caixa ${selectedRegion}`}</span>
                                                {acc.is_default && <Star size={14} className="text-yellow-500 fill-current"/>}
                                            </div>
                                            <p className="font-bold text-lg text-slate-900 truncate">{acc.name}</p>
                                            <p className={`text-xl font-bold mt-1 ${Number(acc.balance) < 0 ? 'text-red-600' : 'text-slate-700'}`}>R$ {Number(acc.balance).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                                    <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm uppercase tracking-wide"><BarChart3 size={18}/> Faturamento por Método</h4>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <BarChart data={dashboardStats.paymentChartData} layout="vertical" margin={{left: 0}}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 12, fill: '#64748b', textTransform: 'capitalize'}} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24}>
                                                {dashboardStats.paymentChartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                                    <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm uppercase tracking-wide"><PieIcon size={18}/> Materiais Mais Saídos</h4>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <PieChart>
                                            <Pie data={dashboardStats.materialsChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {dashboardStats.materialsChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                            </Pie>
                                            <Tooltip contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{fontSize:'12px'}}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}

                    {/* EQUIPE */}
                    {activeTab === 'equipe' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600"/> Gestão de Comissões</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {commissionReport.map((rep, i) => (
                                    <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 hover:border-blue-400 transition-colors group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{rep.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{rep.count} serviços este mês</p>
                                            </div>
                                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">A Pagar</div>
                                        </div>
                                        <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                                            <span className="text-slate-400 text-xs font-medium">Total Acumulado</span>
                                            <p className="text-2xl font-bold text-slate-900">R$ {rep.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                                {commissionReport.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Nenhuma atividade registrada nesta competência.</div>}
                            </div>
                        </div>
                    )}

                    {/* FINANCEIRO (Transações) */}
                    {activeTab === 'financeiro' && (
                        <>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingDown className="text-red-500" size={20}/> Nova Despesa</h3>
                                <form onSubmit={handleAddExpense} className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">Descrição</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="Ex: Combustível, Aluguel..." /></div>
                                    <div className="w-full md:w-32"><label className="text-xs font-bold text-slate-500 mb-1 block">Valor (R$)</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                                    <div className="w-full md:w-64"><label className="text-xs font-bold text-slate-500 mb-1 block">Conta de Saída</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors" required value={newExpense.account_id} onChange={e => setNewExpense({...newExpense, account_id: e.target.value})}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                                    <button className="w-full md:w-auto bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20">Lançar</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-100"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4 text-right">Valor</th><th className="p-4 text-center">Ação</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {[...filteredData.apps.map(a => ({...a, date: a.completed_at || a.created_at, desc: `${a.vehicle_model} - ${a.customer_name}`, val: Number(a.gross_amount) > 0 ? a.gross_amount : a.amount, type: 'in'})), ...filteredData.exps.map(e => ({...e, date: e.date, desc: `Despesa: ${e.description}`, val: e.amount, type: 'out'}))].sort((a,b) => new Date(b.date) - new Date(a.date)).map((t, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="p-4 font-bold text-slate-700 capitalize">{t.desc}</td>
                                                <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}</td>
                                                <td className="p-4 text-center">{t.type === 'in' && <button onClick={() => setSelectedTransaction(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={18}/></button>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* ESTOQUE */}
                    {activeTab === 'estoque' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <div><h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={20} className="text-blue-600"/> Inventário Local</h3></div>
                                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-900/20"><Plus size={18}/> Adicionar</button>
                            </div>
                            {showAddForm && (<form onSubmit={handleAddInventory} className="bg-slate-50 p-6 rounded-2xl grid grid-cols-4 gap-4 items-end border border-slate-200 animate-in slide-in-from-top-2"><div className="col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Item</label><input className="w-full p-3 border border-gray-200 rounded-xl" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Qtd Inicial</label><input className="w-full p-3 border border-gray-200 rounded-xl" type="number" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} /></div><button className="bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-500">Salvar</button></form>)}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inventory.map(item => (
                                    <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group hover:border-blue-200 transition-colors">
                                        {item.quantity <= item.min_threshold && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{item.name}</h4>
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${item.quantity <= item.min_threshold ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{item.quantity <= item.min_threshold ? 'Repor Estoque' : 'Disponível'}</span>
                                        </div>
                                        <div className="text-right">
                                            {isEditingInv === item.id ? (
                                                <div className="flex items-center gap-2"><input className="w-16 p-2 border border-blue-200 bg-blue-50 rounded-lg text-center font-bold text-blue-700 outline-none" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} /><button onClick={() => handleUpdateInventory(item.id)} className="bg-emerald-100 text-emerald-700 p-2 rounded-lg hover:bg-emerald-200"><Save size={18}/></button></div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1"><span className="text-4xl font-bold text-slate-900 tracking-tight">{item.quantity}</span><button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:text-blue-800 font-bold">Ajustar</button></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CONFIGURAÇÕES */}
                    {activeTab === 'configuracoes' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={18} className="text-blue-600"/> Contas Financeiras</h4>
                                        <div className="space-y-3">
                                            {accounts.map(acc => (
                                                <div key={acc.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${acc.is_default ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                                    <div className="flex items-center gap-3">
                                                        {acc.type === 'banco' && (<button onClick={() => handleSetDefault(acc.id)} className={`p-1.5 rounded-full transition-colors ${acc.is_default ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400 hover:text-yellow-500'}`}><Star size={16} fill={acc.is_default ? "currentColor" : "none"} /></button>)}
                                                        {acc.type === 'carteira' && <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Wallet size={14}/></div>}
                                                        <div><p className={`font-bold text-sm ${acc.is_default ? 'text-blue-800' : 'text-slate-700'}`}>{acc.name} {acc.is_default && <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-bold">PADRÃO</span>}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{acc.type === 'banco' ? 'Global' : 'Regional'}</p></div>
                                                    </div>
                                                    <button onClick={() => handleDeleteAccount(acc.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Nova Conta</h4>
                                        <form onSubmit={handleAddAccount} className="space-y-4">
                                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nome da Instituição</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none" required value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} placeholder="Ex: Nubank" /></div>
                                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">Tipo de Conta</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value})}><option value="banco">Banco Digital/Físico (Global)</option><option value="carteira">Caixa Físico/Dinheiro (Regional)</option></select></div>
                                            <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">Criar Conta</button>
                                        </form>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-slate-400"/> Taxas da Maquininha</h4>
                                    <div className="overflow-hidden rounded-xl border border-gray-100">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-3 text-left">Parcelamento</th><th className="p-3 text-right">Taxa (%)</th></tr></thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {rates.map(rate => (
                                                    <tr key={rate.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 font-medium text-slate-700 capitalize">{rate.method} {rate.installments > 1 && `${rate.installments}x`}</td>
                                                        <td className="p-3 text-right">
                                                            {editingRate?.id === rate.id ? (
                                                                <div className="flex justify-end gap-2"><input className="w-16 p-1 border border-blue-300 rounded text-center font-bold text-blue-600 outline-none" type="number" step="0.01" autoFocus value={editingRate.rate_percent} onChange={e => setEditingRate({...editingRate, rate_percent: e.target.value})} /><button onClick={() => handleUpdateRate(editingRate)} className="text-emerald-600 font-bold hover:text-emerald-700 text-xs">OK</button></div>
                                                            ) : (
                                                                <button onClick={() => setEditingRate(rate)} className="text-slate-500 hover:text-blue-600 font-bold transition-colors border-b border-dashed border-slate-300 hover:border-blue-400">{rate.rate_percent}%</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </main>
      </div>

      {/* Bottom Nav Mobile */}
      <BottomNav />

      {/* Modal de Detalhes (Mantido Visual) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Eye size={18} className="text-blue-400"/> Detalhes</h3>
                    <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-6">
                    {selectedTransaction.photo_url ? (
                        <div className="rounded-2xl overflow-hidden border-4 border-slate-100 bg-slate-50 shadow-inner">
                            <img src={selectedTransaction.photo_url} alt="Comprovante" className="w-full h-auto object-cover" />
                        </div>
                    ) : <div className="h-32 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200"><Eye size={32} className="mb-2 opacity-50"/><span className="text-xs font-medium">Sem foto</span></div>}
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                            <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Veículo / Cliente</p><p className="font-bold text-xl text-slate-900">{selectedTransaction.vehicle_model}</p><p className="text-sm text-slate-500">{selectedTransaction.customer_name}</p></div>
                            <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Valor Bruto</p><p className="font-bold text-xl text-emerald-600">R$ {Number(selectedTransaction.gross_amount || selectedTransaction.amount).toFixed(2)}</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Método</p><p className="font-medium text-slate-700 capitalize">{selectedTransaction.payment_method}</p></div>
                            <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Parcelas</p><p className="font-medium text-slate-700">{selectedTransaction.installments}x</p></div>
                            {selectedTransaction.net_amount && <div className="bg-blue-50 p-3 rounded-xl col-span-2 border border-blue-100"><p className="text-[10px] font-bold text-blue-400 uppercase">Líquido (Empresa)</p><p className="font-bold text-blue-700 text-lg">R$ {Number(selectedTransaction.net_amount).toFixed(2)}</p></div>}
                            {selectedTransaction.commission_amount > 0 && <div className="bg-emerald-50 p-3 rounded-xl col-span-2 border border-emerald-100"><p className="text-[10px] font-bold text-emerald-500 uppercase">Comissão (Instalador)</p><p className="font-bold text-emerald-700 text-lg">R$ {Number(selectedTransaction.commission_amount).toFixed(2)}</p></div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}