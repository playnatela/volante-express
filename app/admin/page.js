'use client';
import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  TrendingDown, Filter, Settings, Trash2, Banknote, Calendar, 
  Star, Package, Plus, Save, Eye, X, PieChart as PieIcon, 
  BarChart3, Users, LayoutDashboard, LogOut, Wallet, 
  ArrowRightLeft, Pencil
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#3b82f6'];

export default function AdminPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [activeTab, setActiveTab] = useState('dashboard');
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  
  // Dados
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState([]);
  const [inventory, setInventory] = useState([]); 
  const [installers, setInstallers] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modais
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ from: '', to: '', amount: '', date: new Date().toISOString().slice(0,10) });
  const [editingItem, setEditingItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Forms
  const [newAccount, setNewAccount] = useState({ name: '', type: 'banco', initial_balance: 0 });
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category_id: '', account_id: '' });
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, min_threshold: 5 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [isEditingInv, setIsEditingInv] = useState(null);
  const [editInvForm, setEditInvForm] = useState({});
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => { loadRegions(); }, []);
  useEffect(() => { fetchData(); }, [selectedRegion, activeTab, selectedMonth]);

  async function loadRegions() {
    const { data } = await supabase.from('regions').select('*');
    if (data?.length) setRegions(data);
  }

  async function fetchData() {
    setLoading(true);
    
    const [ano, mes] = selectedMonth.split('-');
    const startOfMonth = new Date(Number(ano), Number(mes) - 1, 1).toISOString();
    const endOfMonth = new Date(Number(ano), Number(mes), 0, 23, 59, 59).toISOString();

    // 1. Serviços
    let appQuery = supabase.from('appointments').select('*').eq('status', 'concluido').gte('completed_at', startOfMonth).lte('completed_at', endOfMonth);
    if (selectedRegion !== 'all') appQuery = appQuery.eq('region_id', selectedRegion);
    const { data: apps } = await appQuery;
    setAppointments(apps || []);

    // 2. Despesas
    let expQuery = supabase.from('expenses').select('*, expense_categories(name)').gte('date', startOfMonth).lte('date', endOfMonth);
    if (selectedRegion !== 'all') expQuery = expQuery.eq('region_id', selectedRegion);
    const { data: exps } = await expQuery;
    setExpenses(exps || []);

    // 3. Contas
    const { data: allAccs } = await supabase.from('accounts').select('*').order('name');
    setAccounts(allAccs || []);

    // 4. Estoque
    let invQuery = supabase.from('inventory').select('*').order('name');
    if (selectedRegion !== 'all') invQuery = invQuery.eq('region_id', selectedRegion);
    const { data: inv } = await invQuery;
    setInventory(inv || []);

    // 5. Globais
    const { data: profs } = await supabase.from('profiles').select('*');
    setInstallers(profs || []);
    
    const { data: cats } = await supabase.from('expense_categories').select('*').order('name');
    setCategories(cats || []);

    const { data: rt } = await supabase.from('payment_rates').select('*').order('installments');
    setRates(rt || []);

    setLoading(false);
  }

  // --- CRUD GERAL ---
  async function handleDelete(table, id) {
    if(!confirm('Tem certeza? Isso ajustará o saldo da conta automaticamente.')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else fetchData();
  }

  function openEditModal(type, item) {
    setModalType(type);
    setEditingItem({ ...item });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    let table = '';
    if (modalType === 'appointment') table = 'appointments';
    if (modalType === 'expense') table = 'expenses';
    if (modalType === 'installer') table = 'profiles';

    const payload = { ...editingItem };
    
    // LOGICA CRÍTICA: Se for agendamento, recalcula o Líquido ao mudar o Bruto
    if (modalType === 'appointment') {
        const gross = parseFloat(payload.gross_amount);
        // Tenta achar a taxa usada originalmente (snapshot) ou recalcula (menos preciso, mas ok pra edição)
        const currentNet = parseFloat(payload.net_amount);
        const currentGross = parseFloat(appointments.find(a => a.id === payload.id)?.gross_amount || 0);
        
        // Se mudou o valor bruto
        if (gross !== currentGross) {
            // Se tiver snapshot da taxa salvo, usa ele. Se não, tenta calcular proporcionalmente
            let ratePercent = payload.payment_rate_snapshot || 0;
            if (ratePercent === 0 && currentGross > 0) {
                ratePercent = 100 - ((currentNet / currentGross) * 100);
            }
            // Novo Líquido
            payload.net_amount = gross - (gross * (ratePercent / 100));
        }
    }

    // Limpeza de campos virtuais
    const forbiddenFields = ['expense_categories', 'label', 'type', 'date', 'val', 'desc', 'email'];
    forbiddenFields.forEach(field => delete payload[field]);

    const { error } = await supabase.from(table).update(payload).eq('id', editingItem.id);
    
    if (error) {
        alert('Erro ao atualizar: ' + error.message);
    } else { 
        setShowEditModal(false); 
        fetchData(); 
    }
  }

  // --- AÇÕES FINANCEIRAS ---
  async function handleAddAccount(e) {
    e.preventDefault();
    const reg = newAccount.type === 'banco' ? null : (selectedRegion === 'all' ? 'divinopolis' : selectedRegion);
    const { error } = await supabase.from('accounts').insert([{ ...newAccount, region_id: reg, balance: newAccount.initial_balance }]);
    if (!error) { setNewAccount({ name: '', type: 'banco', initial_balance: 0 }); fetchData(); alert('Conta criada!'); }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    if(transferData.from === transferData.to) return alert('Contas iguais!');
    const amount = Number(transferData.amount);
    
    const { data: fromAcc } = await supabase.from('accounts').select('balance').eq('id', transferData.from).single();
    await supabase.from('accounts').update({ balance: (fromAcc?.balance || 0) - amount }).eq('id', transferData.from);

    const { data: toAcc } = await supabase.from('accounts').select('balance').eq('id', transferData.to).single();
    await supabase.from('accounts').update({ balance: (toAcc?.balance || 0) + amount }).eq('id', transferData.to);

    await supabase.from('transfers').insert([{ from_account_id: transferData.from, to_account_id: transferData.to, amount, date: transferData.date, description: 'Transf. Interna' }]);
    setShowTransferModal(false); fetchData(); alert('Sucesso!');
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    const reg = selectedRegion === 'all' ? 'divinopolis' : selectedRegion;
    const { error } = await supabase.from('expenses').insert([{ ...newExpense, region_id: reg, date: new Date().toISOString() }]);
    if (!error) {
        const acc = accounts.find(a => a.id === newExpense.account_id);
        if(acc) await supabase.from('accounts').update({ balance: (acc.balance || 0) - Number(newExpense.amount) }).eq('id', newExpense.account_id);
        setNewExpense({ description: '', amount: '', category_id: '', account_id: '' }); fetchData();
    }
  }

  async function handleAddCategory(e) {
      e.preventDefault();
      await supabase.from('expense_categories').insert([{ name: newCategory }]);
      setNewCategory(''); fetchData();
  }

  async function handleSetDefault(accountId) { await supabase.from('accounts').update({ is_default: false }).is('region_id', null); await supabase.from('accounts').update({ is_default: true }).eq('id', accountId); fetchData(); }
  async function handleUpdateRate(rate) { await supabase.from('payment_rates').update({ rate_percent: rate.rate_percent }).eq('id', rate.id); setEditingRate(null); fetchData(); }
  async function handleAddInventory(e) { e.preventDefault(); const reg = selectedRegion === 'all' ? 'divinopolis' : selectedRegion; await supabase.from('inventory').insert([{ ...newItem, region_id: reg }]); setNewItem({ name: '', quantity: 0, min_threshold: 5 }); setShowAddForm(false); fetchData(); }
  async function handleUpdateInventory(id) { await supabase.from('inventory').update({ quantity: editInvForm.quantity }).eq('id', id); setIsEditingInv(null); fetchData(); }
  async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

  // --- CÁLCULOS ---
  const dashboardStats = useMemo(() => {
    const totalGrossIncome = appointments.reduce((acc, curr) => acc + (Number(curr.gross_amount) || Number(curr.amount) || 0), 0);
    const totalNetIncome = appointments.reduce((acc, curr) => acc + (Number(curr.net_amount) || Number(curr.amount) || 0), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const expByCategory = {};
    expenses.forEach(e => {
        const catName = e.expense_categories?.name || 'Outros';
        expByCategory[catName] = (expByCategory[catName] || 0) + Number(e.amount);
    });
    const pieData = Object.keys(expByCategory).map(k => ({ name: k, value: expByCategory[k] }));

    const clientsByDay = {};
    appointments.forEach(a => {
        const day = new Date(a.completed_at || a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        clientsByDay[day] = (clientsByDay[day] || 0) + 1;
    });
    const barData = Object.keys(clientsByDay).sort((a,b) => a.localeCompare(b)).map(k => ({ name: k, clientes: clientsByDay[k] }));

    return { 
        totalGrossIncome, // Bruto
        totalNetIncome,   // Líquido (Real que entra na conta)
        totalExpense, 
        profit: totalNetIncome - totalExpense, 
        pieData, barData 
    };
  }, [appointments, expenses]);

  const commissionReport = useMemo(() => {
    return installers.map(inst => {
        const myApps = appointments.filter(a => a.user_id === inst.id);
        const total = myApps.reduce((acc, curr) => acc + (Number(curr.commission_amount) || 0), 0);
        return {
            id: inst.id,
            name: inst.full_name || inst.email,
            count: myApps.length,
            total: total,
            commission_rate: inst.commission_rate,
            full_name: inst.full_name,
            email: inst.email,
            region_id: inst.region_id
        };
    });
  }, [appointments, installers]);

  // Filtra contas para dashboard (respeitando a Regional)
  const displayAccounts = useMemo(() => {
      return accounts.filter(acc => selectedRegion === 'all' || acc.type === 'banco' || acc.region_id === selectedRegion);
  }, [accounts, selectedRegion]);

  const Sidebar = () => (
    <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-300 h-screen fixed left-0 top-0 z-50">
        <div className="p-6 flex justify-center border-b border-slate-800">
            <img src="/icon-horizontal.png" alt="Logo" className="h-10 object-contain brightness-0 invert opacity-90" />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {['dashboard', 'financeiro', 'equipe', 'estoque', 'configuracoes'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
                    {tab === 'dashboard' && <LayoutDashboard size={20}/>}
                    {tab === 'financeiro' && <Banknote size={20}/>}
                    {tab === 'equipe' && <Users size={20}/>}
                    {tab === 'estoque' && <Package size={20}/>}
                    {tab === 'configuracoes' && <Settings size={20}/>}
                    {tab === 'configuracoes' ? 'Configurações' : tab}
                </button>
            ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-900/30 text-red-400 transition-all font-medium"><LogOut size={20}/> Sair</button>
        </div>
    </aside>
  );

  const BottomNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom">
        {['dashboard', 'financeiro', 'equipe', 'estoque', 'configuracoes'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === tab ? 'text-blue-500' : 'text-slate-500'}`}>
                {tab === 'dashboard' && <LayoutDashboard size={22}/>}
                {tab === 'financeiro' && <Banknote size={22}/>}
                {tab === 'equipe' && <Users size={22}/>}
                {tab === 'estoque' && <Package size={22}/>}
                {tab === 'configuracoes' && <Settings size={22}/>}
                <span className="text-[10px] font-medium capitalize">{tab === 'configuracoes' ? 'Config' : tab}</span>
            </button>
        ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex">
      <Sidebar />

      {/* MODAL EDITAR */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-xl font-bold mb-4 text-slate-900 flex items-center gap-2"><Pencil size={20}/> Editar Item</h3>
                <div className="space-y-4">
                    {modalType === 'appointment' && (
                        <>
                            <div><label className="text-xs font-bold text-slate-500">Veículo</label><input className="w-full p-3 border rounded-xl" value={editingItem.vehicle_model} onChange={e => setEditingItem({...editingItem, vehicle_model: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500">Cliente</label><input className="w-full p-3 border rounded-xl" value={editingItem.customer_name} onChange={e => setEditingItem({...editingItem, customer_name: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500">Valor Bruto (R$)</label><input type="number" className="w-full p-3 border rounded-xl" value={editingItem.gross_amount} onChange={e => setEditingItem({...editingItem, gross_amount: e.target.value})} /></div>
                            <p className="text-xs text-blue-500 bg-blue-50 p-2 rounded">ℹ️ O valor líquido e o saldo da conta serão recalculados automaticamente.</p>
                        </>
                    )}
                    {modalType === 'expense' && (
                        <>
                            <div><label className="text-xs font-bold text-slate-500">Descrição</label><input className="w-full p-3 border rounded-xl" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500">Valor (R$)</label><input type="number" className="w-full p-3 border rounded-xl" value={editingItem.amount} onChange={e => setEditingItem({...editingItem, amount: e.target.value})} /></div>
                        </>
                    )}
                    {modalType === 'installer' && (
                        <>
                            <div><label className="text-xs font-bold text-slate-500">Nome Completo</label><input className="w-full p-3 border rounded-xl" value={editingItem.full_name || ''} onChange={e => setEditingItem({...editingItem, full_name: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500">Comissão Padrão (R$)</label><input type="number" className="w-full p-3 border rounded-xl" value={editingItem.commission_rate} onChange={e => setEditingItem({...editingItem, commission_rate: e.target.value})} /></div>
                        </>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                    <button onClick={handleSaveEdit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500">Salvar Alterações</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL TRANSFERÊNCIA */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2"><ArrowRightLeft size={20}/> Transferência</h3>
                <form onSubmit={handleTransfer} className="space-y-4">
                    <div><label className="text-xs font-bold text-slate-500">De (Origem)</label><select className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({...transferData, from: e.target.value})}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} (R$ {Number(a.balance).toFixed(2)})</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">Para (Destino)</label><select className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({...transferData, to: e.target.value})}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">Valor (R$)</label><input type="number" step="0.01" className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({...transferData, amount: e.target.value})} /></div>
                    <button className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 mt-2">Confirmar</button>
                    <button type="button" onClick={() => setShowTransferModal(false)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                </form>
            </div>
        </div>
      )}

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-40 relative text-white">
            <div className="md:hidden w-full flex justify-center mb-2">
                <img src="/icon-horizontal.png" alt="Logo" className="h-8 object-contain brightness-0 invert" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight hidden md:block">Painel Administrativo</h1>
                <p className="text-slate-400 text-sm hidden md:block">Visão Geral da Operação</p>
            </div>
            <div className="flex w-full md:w-auto gap-3">
                <div className="flex-1 md:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                    <Calendar size={18} className="text-slate-400"/>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none cursor-pointer w-full filter invert-0"/>
                </div>
                <div className="flex-1 md:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                    <Filter size={18} className="text-slate-400"/>
                    <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none cursor-pointer w-full uppercase">
                        <option value="all" className="text-black font-bold">🌐 Visão Global</option>
                        {regions.map(r => <option key={r.slug} value={r.slug} className="text-black">{r.name}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-gray-100">
            {loading ? <div className="h-full flex items-center justify-center text-slate-400">Carregando dados...</div> : (
                <div className="max-w-6xl mx-auto animate-in fade-in space-y-6">
                    
                    {/* DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500 text-sm font-medium">Receita Bruta</p><h3 className="text-3xl font-bold text-slate-900 mt-1">R$ {dashboardStats.totalGrossIncome.toFixed(2)}</h3></div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500 text-sm font-medium">Receita Líquida (Real)</p><h3 className="text-3xl font-bold text-emerald-600 mt-1">R$ {dashboardStats.totalNetIncome.toFixed(2)}</h3></div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500 text-sm font-medium">Despesas</p><h3 className="text-3xl font-bold text-red-600 mt-1">R$ {dashboardStats.totalExpense.toFixed(2)}</h3></div>
                                <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white"><p className="text-slate-400 text-sm font-medium flex justify-between">Lucro Líquido</p><h3 className="text-3xl font-bold mt-1">R$ {dashboardStats.profit.toFixed(2)}</h3></div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={20} className="text-blue-600"/> Saldos em Conta</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {displayAccounts.map(acc => (
                                        <div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{acc.type === 'banco' ? 'Banco Global' : `Caixa ${acc.region_id || 'Regional'}`}</p>
                                            <p className="font-bold text-lg text-slate-900 truncate">{acc.name}</p>
                                            <p className={`text-xl font-bold mt-1 ${Number(acc.balance) < 0 ? 'text-red-600' : 'text-slate-700'}`}>R$ {Number(acc.balance).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80"><h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm uppercase tracking-wide"><PieIcon size={18}/> Despesas por Categoria</h4><ResponsiveContainer width="100%" height="85%"><PieChart><Pie data={dashboardStats.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dashboardStats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80"><h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm uppercase tracking-wide"><BarChart3 size={18}/> Clientes por Dia</h4><ResponsiveContainer width="100%" height="85%"><BarChart data={dashboardStats.barData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize: 10}} /><YAxis allowDecimals={false} /><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey="clientes" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                            </div>
                        </>
                    )}

                    {/* FINANCEIRO */}
                    {activeTab === 'financeiro' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={20} className="text-blue-600"/> Saldos</h3><button onClick={() => setShowTransferModal(true)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><ArrowRightLeft size={14}/> Transferir</button></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{displayAccounts.map(acc => (<div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{acc.type === 'banco' ? 'Banco Global' : `Caixa ${acc.region_id || 'Regional'}`}</p><p className="font-bold text-lg text-slate-900 truncate">{acc.name}</p><p className={`text-xl font-bold mt-1 ${Number(acc.balance) < 0 ? 'text-red-600' : 'text-slate-700'}`}>R$ {Number(acc.balance).toFixed(2)}</p></div>))}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingDown className="text-red-500" size={20}/> Nova Despesa</h3>
                                <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Descrição</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">Valor (R$)</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">Categoria</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.category_id} onChange={e => setNewExpense({...newExpense, category_id: e.target.value})}><option value="">...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                    <div className="md:col-span-3"><label className="text-xs font-bold text-slate-500 mb-1 block">Conta de Saída</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.account_id} onChange={e => setNewExpense({...newExpense, account_id: e.target.value})}><option value="">Selecione a conta...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                                    <button className="w-full bg-red-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-700">Lançar</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-100"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th>{selectedRegion === 'all' && <th className="p-4">Regional</th>}<th className="p-4 text-right">Valor</th><th className="p-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{[...appointments.map(a => ({...a, type: 'in', date: a.completed_at, val: a.gross_amount, label: `${a.vehicle_model} - ${a.customer_name}`})), ...expenses.map(e => ({...e, type: 'out', date: e.date, val: e.amount, label: e.description}))].sort((a,b) => new Date(b.date) - new Date(a.date)).map((t, i) => (<tr key={i} className="hover:bg-slate-50 transition-colors"><td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td><td className="p-4 font-bold text-slate-700 capitalize flex flex-col">{t.label} {t.type === 'out' && t.expense_categories && <span className="text-[10px] text-slate-400 font-normal uppercase bg-slate-100 w-fit px-1 rounded">{t.expense_categories.name}</span>}</td>{selectedRegion === 'all' && <td className="p-4 text-slate-500 uppercase text-xs">{t.region_id || 'Global'}</td>}<td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}</td><td className="p-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => openEditModal(t.type === 'in' ? 'appointment' : 'expense', t)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={() => handleDelete(t.type === 'in' ? 'appointments' : 'expenses', t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table>
                            </div>
                        </div>
                    )}

                    {/* EQUIPE */}
                    {activeTab === 'equipe' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600"/> Gestão de Equipe</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {commissionReport.map((rep, i) => (
                                    <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 group relative">
                                        <button onClick={() => {
                                            const installer = installers.find(inst => inst.id === rep.id);
                                            if(installer) openEditModal('installer', installer);
                                        }} className="absolute top-4 right-4 text-slate-300 hover:text-blue-500"><Pencil size={16}/></button>
                                        <p className="font-bold text-slate-800 text-lg">{rep.name}</p>
                                        <p className="text-xs text-slate-500 font-medium mb-4">{rep.count} serviços • Regional {rep.region_id || 'N/A'}</p>
                                        <div className="border-t border-slate-200 pt-4 flex justify-between items-center"><span className="text-slate-400 text-xs font-medium">A Pagar</span><p className="text-2xl font-bold text-slate-900">R$ {rep.total.toFixed(2)}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ESTOQUE */}
                    {activeTab === 'estoque' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <div><h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={20} className="text-blue-600"/> Inventário {selectedRegion === 'all' ? 'Global' : selectedRegion}</h3></div>
                                {selectedRegion !== 'all' && <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-500"><Plus size={18}/> Adicionar</button>}
                            </div>
                            {showAddForm && (<form onSubmit={handleAddInventory} className="bg-slate-50 p-6 rounded-2xl grid grid-cols-4 gap-4 items-end border border-slate-200 animate-in slide-in-from-top-2"><div className="col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Item</label><input className="w-full p-3 border border-gray-200 rounded-xl" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Qtd Inicial</label><input className="w-full p-3 border border-gray-200 rounded-xl" type="number" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} /></div><button className="bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-500">Salvar</button></form>)}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{inventory.map(item => (<div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group hover:border-blue-200 transition-colors">{item.quantity <= item.min_threshold && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}<div><h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{item.name}</h4><span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${item.quantity <= item.min_threshold ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{item.quantity <= item.min_threshold ? 'Repor Estoque' : 'Disponível'}</span></div><div className="text-right">{isEditingInv === item.id ? (<div className="flex items-center gap-2"><input className="w-16 p-2 border border-blue-200 bg-blue-50 rounded-lg text-center font-bold text-blue-700 outline-none" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} /><button onClick={() => handleUpdateInventory(item.id)} className="bg-emerald-100 text-emerald-700 p-2 rounded-lg hover:bg-emerald-200"><Save size={18}/></button></div>) : (<div className="flex flex-col items-end gap-1"><span className="text-4xl font-bold text-slate-900 tracking-tight">{item.quantity}</span><button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:text-blue-800 font-bold">Ajustar</button></div>)}</div></div>))}</div>
                        </div>
                    )}

                    {/* CONFIGURAÇÕES */}
                    {activeTab === 'configuracoes' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {/* LISTA DE CONTAS EXISTENTES */}
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={18} className="text-blue-600"/> Contas Cadastradas</h4>
                                        <div className="space-y-3">
                                            {accounts.map(acc => (
                                                <div key={acc.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${acc.is_default ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                                    <div className="flex items-center gap-3">
                                                        {acc.type === 'banco' && (<button onClick={() => handleSetDefault(acc.id)} className={`p-1.5 rounded-full transition-colors ${acc.is_default ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400 hover:text-yellow-500'}`}><Star size={16} fill={acc.is_default ? "currentColor" : "none"} /></button>)}
                                                        {acc.type === 'carteira' && <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Wallet size={14}/></div>}
                                                        <div><p className={`font-bold text-sm ${acc.is_default ? 'text-blue-800' : 'text-slate-700'}`}>{acc.name} {acc.is_default && <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-bold">PADRÃO</span>}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{acc.type === 'banco' ? 'Global' : `Regional ${acc.region_id || ''}`}</p></div>
                                                    </div>
                                                    <button onClick={() => handleDelete('accounts', acc.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Nova Conta</h4>
                                        <form onSubmit={handleAddAccount} className="space-y-4">
                                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nome da Instituição</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none" required value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} placeholder="Ex: Nubank" /></div>
                                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 mb-1 block">Tipo de Conta</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value})}><option value="banco">Banco Global</option><option value="carteira">Caixa Regional</option></select></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Saldo Inicial</label><input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" value={newAccount.initial_balance} onChange={e => setNewAccount({...newAccount, initial_balance: e.target.value})} /></div></div>
                                            <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">Criar Conta</button>
                                        </form>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Categorias de Despesa</h4>
                                        <div className="flex gap-2 mb-4"><input className="flex-1 p-2 border rounded-lg text-sm" placeholder="Nova Categoria..." value={newCategory} onChange={e => setNewCategory(e.target.value)} /><button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Add</button></div>
                                        <div className="flex flex-wrap gap-2">{categories.map(c => <span key={c.id} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">{c.name} <button onClick={() => handleDelete('expense_categories', c.id)} className="text-slate-400 hover:text-red-500"><X size={12}/></button></span>)}</div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-slate-400"/> Taxas da Maquininha</h4>
                                    <div className="overflow-hidden rounded-xl border border-gray-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-3 text-left">Parcelamento</th><th className="p-3 text-right">Taxa (%)</th></tr></thead><tbody className="divide-y divide-gray-100">{rates.map(rate => (<tr key={rate.id} className="hover:bg-slate-50 transition-colors"><td className="p-3 font-medium text-slate-700 capitalize">{rate.method} {rate.installments > 1 && `${rate.installments}x`}</td><td className="p-3 text-right">{editingRate?.id === rate.id ? (<div className="flex justify-end gap-2"><input className="w-16 p-1 border border-blue-300 rounded text-center font-bold text-blue-600 outline-none" type="number" step="0.01" autoFocus value={editingRate.rate_percent} onChange={e => setEditingRate({...editingRate, rate_percent: e.target.value})} /><button onClick={() => handleUpdateRate(editingRate)} className="text-emerald-600 font-bold hover:text-emerald-700 text-xs">OK</button></div>) : (<button onClick={() => setEditingRate(rate)} className="text-slate-500 hover:text-blue-600 font-bold transition-colors border-b border-dashed border-slate-300 hover:border-blue-400">{rate.rate_percent}%</button>)}</td></tr>))}</tbody></table></div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </main>
      </div>
      <BottomNav />
      {/* MODAL DETALHES */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Eye size={18} className="text-blue-400"/> Detalhes</h3>
                    <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-6">
                    {selectedTransaction.photo_url ? (<div className="rounded-2xl overflow-hidden border-4 border-slate-100 bg-slate-50 shadow-inner"><img src={selectedTransaction.photo_url} alt="Comprovante" className="w-full h-auto object-cover" /></div>) : <div className="h-32 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200"><Eye size={32} className="mb-2 opacity-50"/><span className="text-xs font-medium">Sem foto</span></div>}
                    <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-4"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Veículo / Cliente</p><p className="font-bold text-xl text-slate-900">{selectedTransaction.vehicle_model}</p><p className="text-sm text-slate-500">{selectedTransaction.customer_name}</p></div><div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Valor Bruto</p><p className="font-bold text-xl text-emerald-600">R$ {Number(selectedTransaction.gross_amount || selectedTransaction.amount).toFixed(2)}</p></div></div>
                        <div className="grid grid-cols-2 gap-4"><div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Método</p><p className="font-medium text-slate-700 capitalize">{selectedTransaction.payment_method}</p></div><div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Parcelas</p><p className="font-medium text-slate-700">{selectedTransaction.installments}x</p></div>{selectedTransaction.net_amount && <div className="bg-blue-50 p-3 rounded-xl col-span-2 border border-blue-100"><p className="text-[10px] font-bold text-blue-400 uppercase">Líquido (Empresa)</p><p className="font-bold text-blue-700 text-lg">R$ {Number(selectedTransaction.net_amount).toFixed(2)}</p></div>}{selectedTransaction.commission_amount > 0 && <div className="bg-emerald-50 p-3 rounded-xl col-span-2 border border-emerald-100"><p className="text-[10px] font-bold text-emerald-500 uppercase">Comissão (Instalador)</p><p className="font-bold text-emerald-700 text-lg">R$ {Number(selectedTransaction.commission_amount).toFixed(2)}</p></div>}</div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}