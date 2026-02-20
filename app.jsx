import React, { useState, useEffect, useMemo } from 'react';
// Para o Canvas funcionar, usamos o link do esm.sh. 
// No seu projeto local (Vercel/Vite), você pode mudar de volta para: import { createClient } from '@supabase/supabase-js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, Plus, TrendingUp, DollarSign, AlertCircle, 
  FileText, Trash2, Calculator, ArrowUpRight, LogOut, ChevronRight
} from 'lucide-react';

// --- Inicialização do Supabase ---
// No seu projeto local com Vite, descomente as linhas com "import.meta.env":
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Para evitar erros aqui no Canvas, deixamos strings vazias (ou você pode colar suas chaves aqui para testar):
const supabaseUrl = ""; 
const supabaseKey = ""; 

// Só inicializa o cliente se as chaves existirem, para não quebrar a tela
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- Ciclo de Vida & Autenticação ---
  useEffect(() => {
    const checkUser = async () => {
      if (!supabase) {
        setErrorMsg("Supabase não configurado. Adicione suas chaves supabaseUrl e supabaseKey no código para conectar ao banco.");
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
        } else {
          // Para o MVP, login anônimo para facilitar o teste
          const { data } = await supabase.auth.signInAnonymously();
          if (data.user) setUser(data.user);
        }
      } catch (err) {
        console.error("Erro na autenticação:", err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // --- Busca de Dados ---
  useEffect(() => {
    if (!user || !supabase) return;

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('closings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) setOrders(data);
    };

    fetchOrders();

    // Inscrição em tempo real para atualizações automáticas
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'closings' }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- Lógica Financeira ---
  const metrics = useMemo(() => {
    const totalGross = orders.reduce((acc, o) => acc + Number(o.sale_price || 0), 0);
    const totalCogs = orders.reduce((acc, o) => acc + Number(o.product_cost || 0), 0);
    const totalFees = orders.reduce((acc, o) => acc + Number(o.shopee_fee || 0) + Number(o.fixed_fee || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    return { totalGross, totalCogs, totalFees, totalProfit, margin };
  }, [orders]);

  const handleAddClosing = async (e) => {
    e.preventDefault();
    if (!user || !supabase) {
      alert("Conecte o Supabase primeiro.");
      return;
    }

    const fd = new FormData(e.target);
    const salePrice = parseFloat(fd.get('salePrice'));
    const commissionRate = parseFloat(fd.get('commission')) / 100;
    
    const { error } = await supabase
      .from('closings')
      .insert([{
        user_id: user.id,
        order_id: fd.get('orderId'),
        product_name: fd.get('productName'),
        sale_price: salePrice,
        product_cost: parseFloat(fd.get('productCost')),
        shopee_fee: salePrice * commissionRate,
        fixed_fee: parseFloat(fd.get('fixedFee') || 0),
      }]);

    if (!error) {
      setShowModal(false);
    } else {
      console.error(error);
      alert("Erro ao salvar no banco.");
    }
  };

  const deleteOrder = async (id) => {
    if (!supabase) return;
    await supabase.from('closings').delete().eq('id', id);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-400 font-medium animate-pulse">Sincronizando com Supabase...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans selection:bg-orange-100">
      {errorMsg && (
        <div className="bg-red-500 text-white text-center p-3 text-sm font-medium">
          {errorMsg}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        
        {/* Header Profissional */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 p-1.5 rounded-lg text-white">
                <TrendingUp size={18} />
              </div>
              <h1 className="text-2xl font-black tracking-tight uppercase italic text-slate-800">ShopeeFlow</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Painel de Lucro Real</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowModal(true)}
              className="bg-[#EE4D2D] hover:bg-[#D44326] text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-orange-200 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
              disabled={!supabase}
            >
              <Plus size={20} strokeWidth={3} />
              NOVO FECHAMENTO
            </button>
          </div>
        </header>

        {/* Dash de Indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KpiCard title="Faturamento" value={metrics.totalGross} color="text-slate-800" icon={<DollarSign size={20}/>} />
          <KpiCard title="Custo Mercadoria" value={metrics.totalCogs} color="text-red-500" icon={<Calculator size={20}/>} />
          <KpiCard title="Taxas Shopee" value={metrics.totalFees} color="text-orange-500" icon={<AlertCircle size={20}/>} />
          <KpiCard 
            title="Lucro Líquido" 
            value={metrics.totalProfit} 
            color="text-emerald-600" 
            icon={<TrendingUp size={20}/>} 
            highlight={true}
            sub={`Margem: ${metrics.margin.toFixed(1)}%`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Tabela de Lançamentos */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <FileText size={20} className="text-slate-300" />
                Histórico de Operações
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
                {orders.length} Pedidos
              </span>
            </div>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <th className="px-8 py-6">ID Pedido / Produto</th>
                      <th className="px-8 py-6 text-right">Preço Venda</th>
                      <th className="px-8 py-6 text-right">Resultado</th>
                      <th className="px-8 py-6 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orders.map(order => {
                      const profit = order.sale_price - order.product_cost - order.shopee_fee - order.fixed_fee;
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-all group">
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-800 text-sm">{order.order_id}</div>
                            <div className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-[200px] mt-0.5">{order.product_name}</div>
                          </td>
                          <td className="px-8 py-6 text-right font-bold text-slate-700">R$ {Number(order.sale_price).toFixed(2)}</td>
                          <td className={`px-8 py-6 text-right font-black ${profit > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            R$ {profit.toFixed(2)}
                          </td>
                          <td className="px-8 py-6 text-center">
                            <button onClick={() => deleteOrder(order.id)} className="text-slate-200 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-24 text-center">
                          <div className="flex flex-col items-center opacity-20">
                            <FileText size={48} className="mb-4" />
                            <p className="font-bold uppercase tracking-widest text-sm">Sem dados registrados</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Lateral de Analytics */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-8 uppercase tracking-tight text-sm">Volume de Faturamento</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orders.slice(0, 10).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="order_id" hide />
                    <Tooltip 
                      cursor={{fill: '#F8FAFC'}}
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="sale_price" name="Venda" fill="#EE4D2D" radius={[8, 8, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-500 p-2 rounded-xl">
                  <ArrowUpRight size={20} className="text-white" />
                </div>
                <h4 className="font-black text-sm uppercase tracking-widest">Saúde Operacional</h4>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-6 font-medium">
                Sua margem atual de <span className="text-white font-bold">{metrics.margin.toFixed(1)}%</span> está baseada nos últimos {orders.length} pedidos. Mantenha os custos abaixo de 60% para escalar.
              </p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(metrics.margin * 2, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Moderno */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden scale-in-center">
            <div className="bg-[#EE4D2D] p-10 text-white flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-black italic tracking-tighter">FECHAMENTO</h3>
                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Lançamento de pedido individual</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <Calculator size={24} />
              </div>
            </div>
            
            <form onSubmit={handleAddClosing} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID do Pedido</label>
                  <input name="orderId" placeholder="ex: 240315..." className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comissão (%)</label>
                  <input name="commission" type="number" defaultValue="18" className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Produto / SKU</label>
                <input name="productName" placeholder="ex: Xiaomi Redmi Note 13" className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-bold text-slate-700" required />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Venda</label>
                  <input name="salePrice" type="number" step="0.01" className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-black text-slate-800" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo (CMV)</label>
                  <input name="productCost" type="number" step="0.01" className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-black text-red-500" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Taxa Fixa</label>
                  <input name="fixedFee" type="number" step="0.01" defaultValue="3.00" className="w-full p-5 bg-slate-50 border-none rounded-[1.25rem] focus:ring-2 focus:ring-orange-500 outline-none font-black text-slate-800" />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancelar</button>
                <button type="submit" className="flex-2 px-12 py-5 bg-[#EE4D2D] text-white font-black rounded-2xl hover:bg-[#D44326] shadow-xl shadow-orange-100 transition-all active:scale-95 uppercase tracking-widest text-xs">
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const KpiCard = ({ title, value, icon, color, sub, highlight }) => (
  <div className={`p-8 rounded-[2.5rem] border ${highlight ? 'bg-white border-emerald-100 ring-4 ring-emerald-50/50' : 'bg-white border-slate-100'} shadow-sm transition-all hover:shadow-md group`}>
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 bg-slate-50 rounded-2xl ${color} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <ChevronRight size={16} className="text-slate-200" />
    </div>
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
    <h3 className={`text-2xl font-black ${color} tracking-tighter`}>
      R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </h3>
    {sub && <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{sub}</p>}
  </div>
);
