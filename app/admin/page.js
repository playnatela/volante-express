'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown, Filter, Plus, Save, X, Eye, DollarSign, Package, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Cores para gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [inventory, setInventory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Estado para o Modal de Detalhes
  const [selectedTransaction, setSelectedTransaction] = useState(null);

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
    // Buscando todos os campos necessários para os detalhes
    const { data: apps } = await supabase.from('appointments').select('*').eq('status', 'concluido').eq('region_id', selectedRegion);
    setAppointments(apps || []);
    const { data: exp } = await supabase.from('expenses').select('*').eq('region_id', selectedRegion);
    setExpenses(exp || []);
    setLoading(false);
  }

  // Cálculos do Dashboard
  const dashboardStats = useMemo(() => {
    const totalIncome = appointments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    
    // Gráfico de Pagamentos
    const paymentsMap = {};
    appointments.forEach(a => {
        const method = a.payment_method || 'Outros';
        paymentsMap[method] = (paymentsMap[method] || 0) + Number(a.amount);
    });
    const paymentChartData = Object.keys(paymentsMap).map(k => ({ name: k, value: paymentsMap[k] }));

    // Gráfico de Materiais (Revestimentos)
    const materialsMap = {};
    appointments.forEach(a => {
        if(a.material_used_id) {
            // Tenta achar o nome do material no inventário carregado
            const matName = inventory.find(i => i.id === a.material_used_id)?.name || 'Desconhecido';
            materialsMap[matName] = (materialsMap[matName] || 0) + 1;
        }
    });
    const materialsChartData = Object.keys(materialsMap).map(k => ({ name: k, value: materialsMap[k] }));

    return { totalIncome, totalExpense, profit: totalIncome - totalExpense, paymentChartData, materialsChartData };
  }, [appointments, expenses, inventory]);

  // Função para abrir detalhes
  const handleViewDetails = (transaction) => {
    if (transaction.type === 'in') {
      setSelectedTransaction(transaction);
    }
  };

  // Funções de Ação (Adicionar/Editar)
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
    await supabase.from('inventory').update({ quantity: editInvForm.quantity }).eq('id', id);
    setIsEditingInv(null);
    fetchData();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-slate-800 relative">
      
      {/* MODAL DE DETALHES (OVERLAY) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg">Detalhes do Serviço</h3>
                    <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-700 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Foto */}
                    {selectedTransaction.photo_url ? (
                        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                            <img src={selectedTransaction.photo_url} alt="Comprovante" className="w-full h-auto object-contain max-h-96" />
                        </div>
                    ) : (
                        <div className="h-32 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">Sem foto disponível</div>
                    )}

                    {/* Dados */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase">Veículo</label>
                            <p className="font-bold text-lg text-slate-800">{selectedTransaction.vehicle_model} <span className="text-sm font-normal text-gray-500">({selectedTransaction.vehicle_year})</span></p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase">Cliente</label>
                            <p className="font-bold text-lg text-slate-800">{selectedTransaction.customer_name}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                             <label className="text-xs font-bold text-gray-500 uppercase">Pagamento</label>
                             <div className="flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">{selectedTransaction.payment_method}</span>
                                <span className="font-bold text-lg">R$ {Number(selectedTransaction.amount).toFixed(2)}</span>
                             </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                             <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
                             <p className="font-medium text-slate-700">{new Date(selectedTransaction.completed_at || selectedTransaction.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                    <button onClick={() => setSelectedTransaction(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800">Fechar</button>
                </div>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
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

        {/* Abas */}
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
                    {/* Cards Topo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500">Receita Total</p><h3 className="text-3xl font-bold text-green-600">R$ {dashboardStats.totalIncome.toFixed(2)}</h3></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><p className="text-slate-500">Despesas</p><h3 className="text-3xl font-bold text-red-600">R$ {dashboardStats.totalExpense.toFixed(2)}</h3></div>
                        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white"><p className="text-slate-400">Lucro Líquido</p><h3 className="text-3xl font-bold">R$ {dashboardStats.profit.toFixed(2)}</h3></div>
                    </div>

                    {/* Gráficos Novos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gráfico de Formas de Pagamento */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                             <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><DollarSign size={16}/> Receita por Pagamento</h4>
                             <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={dashboardStats.paymentChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip contentStyle={{borderRadius: '8px'}} cursor={{fill: '#f8fafc'}} />
                                    <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={20}>
                                        {dashboardStats.paymentChartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                        </div>

                        {/* Gráfico de Revestimentos (Pizza) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                             <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Package size={16}/> Revestimentos Utilizados</h4>
                             <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie data={dashboardStats.materialsChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {dashboardStats.materialsChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                             </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* FINANCEIRO */}
            {activeTab === 'financeiro' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingDown className="text-red-500" size={20}/> Registrar Despesa</h3>
                        <form onSubmit={handleAddExpense} className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1"><label className="text-xs font-bold text-slate-500">Descrição</label><input className="w-full p-3 bg-gray-50 border rounded-xl" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} /></div>
                            <div className="w-32"><label className="text-xs font-bold text-slate-500">Valor</label><input className="w-full p-3 bg-gray-50 border rounded-xl" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold">Lançar</button>
                        </form>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="p-4 text-left">Data</th>
                                    <th className="p-4 text-left">Descrição</th>
                                    <th className="p-4 text-center">Pagamento</th>
                                    <th className="p-4 text-right">Valor</th>
                                    <th className="p-4 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[...appointments.map(a => ({
                                    ...a, 
                                    type: 'in', 
                                    // FORMATO NOVO DA DESCRIÇÃO
                                    desc: `${a.vehicle_model || 'Carro'} ${a.vehicle_year || ''} - ${a.customer_name}`, 
                                    val: a.amount
                                  })), 
                                  ...expenses.map(e => ({...e, type: 'out', desc: e.description, val: e.amount}))]
                                  .sort((a,b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
                                  .map((t, i) => (
                                    <tr key={i} onClick={() => handleViewDetails(t)} className={`transition-colors ${t.type === 'in' ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-red-50'}`}>
                                        <td className="p-4 text-slate-500">{new Date(t.created_at || t.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-slate-700">{t.desc}</td>
                                        <td className="p-4 text-center">
                                            {t.type === 'in' && <span className="text-xs bg-gray-100 px-2 py-1 rounded uppercase font-semibold text-slate-500">{t.payment_method || '-'}</span>}
                                        </td>
                                        <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-center">
                                            {t.type === 'in' && <Eye size={16} className="mx-auto text-blue-400"/>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ESTOQUE (Mantido Igual) */}
            {activeTab === 'estoque' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center">
                         <h3 className="font-bold text-slate-700">Inventário: {selectedRegion}</h3>
                         <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={18}/> Novo</button>
                    </div>
                    {showAddForm && (
                        <form onSubmit={handleAddInventory} className="bg-blue-50 p-6 rounded-2xl grid grid-cols-4 gap-4 items-end">
                            <div className="col-span-2"><input className="w-full p-3 border rounded-xl" placeholder="Nome" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div>
                            <div><input className="w-full p-3 border rounded-xl" type="number" placeholder="Qtd" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} /></div>
                            <button className="bg-green-600 text-white p-3 rounded-xl font-bold">Salvar</button>
                        </form>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inventory.map(item => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                <div><h4 className="font-bold text-slate-800 text-lg">{item.name}</h4><span className="text-xs bg-gray-100 text-slate-500 px-2 py-1 rounded-md">Min: {item.min_threshold}</span></div>
                                <div className="text-right">
                                    {isEditingInv === item.id ? (
                                        <div className="flex items-center gap-2">
                                            <input className="w-16 p-2 border rounded-lg text-center font-bold" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({...editInvForm, quantity: e.target.value})} />
                                            <button onClick={() => handleUpdateInventory(item.id)} className="bg-green-100 text-green-700 p-2 rounded-lg"><Save size={18}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-2xl font-bold text-slate-800">{item.quantity}</span>
                                            <button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:underline">Ajustar</button>
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