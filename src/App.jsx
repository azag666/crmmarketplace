import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, FileText, Trash2, Calculator, 
  ArrowUpRight, ArrowDownRight, Plus, Upload, X, Package, Check, 
  Settings, Search, Calendar, Filter, Eye, Edit2
} from 'lucide-react';

// --- CONFIGURAÇÕES INICIAIS ---
const PRESET_COSTS = {
  // ... (Mantenha sua lista de custos padrão aqui se quiser, ou deixe vazia pois vamos focar no banco)
  "ESTANTE4PRATBANCO": 36.03, "ESTANTE5PRAT": 40.92, "DECK40X40CM3UN": 27.18
};

const STATUS_COLORS = {
  'Concluído': '#10B981', 'A Enviar': '#3B82F6', 'Cancelado': '#EF4444', 
  'Reembolso': '#F59E0B', 'Devolvido': '#F59E0B'
};

export default function App() {
  const [userId, setUserId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | products | detective
  
  // --- FILTROS DE DATA ---
  // Padrão: Início do mês atual até hoje
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Modais
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null); // Para o Detetive
  const [editingProduct, setEditingProduct] = useState(null); // Para editar custo
  
  // Dados Importação
  const [importedData, setImportedData] = useState([]); 
  const [uniqueProductsMap, setUniqueProductsMap] = useState([]);
  const [productDatabase, setProductDatabase] = useState(PRESET_COSTS);
  const fileInputRef = useRef(null);

  // 1. Autenticação Local
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // 2. Buscar Dados com Filtro
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ 
        startDate: dateRange.start, 
        endDate: dateRange.end 
      }).toString();
      
      const res = await fetch(`/api/orders?${query}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // Recarrega quando muda a data ou usuário
  useEffect(() => { if (userId) fetchOrders(); }, [userId, dateRange]);

  // 3. Atualizar Custo Manualmente
  const updateProductCost = async (sku, newCost) => {
    if(!confirm(`Isso vai recalcular o lucro de TODOS os pedidos com SKU "${sku}" no período selecionado. Continuar?`)) return;
    
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId, sku, new_cost: parseFloat(newCost) })
      });
      if(res.ok) {
        setEditingProduct(null);
        fetchOrders(); // Recarrega dados
      }
    } catch (e) { alert("Erro ao atualizar"); }
  };

  // --- CÁLCULOS E INTELIGÊNCIA ---
  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !o.status?.toLowerCase().includes('cancelado'));
    
    // KPI Gerais
    const totalGross = validOrders.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = validOrders.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    const totalFees = validOrders.reduce((acc, o) => acc + (Number(o.shopee_fee) || 0) + (Number(o.fixed_fee) || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    // Gráfico Diário
    const dailyMap = {};
    orders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('pt-BR'); // Dia/Mês/Ano
      if (!dailyMap[day]) dailyMap[day] = { name: day.slice(0,5), vendas: 0, lucro: 0, faturamento: 0 };
      
      if (!o.status.includes('Cancelado')) {
         dailyMap[day].vendas += 1;
         dailyMap[day].faturamento += Number(o.sale_price);
         dailyMap[day].lucro += (o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee);
      }
    });
    // Ordena Cronologicamente
    const dailyChartData = Object.entries(dailyMap)
      .sort((a,b) => {
         const [d1,m1] = a[0].split('/'); const [d2,m2] = b[0].split('/');
         return new Date(2025, m1-1, d1) - new Date(2025, m2-1, d2);
      })
      .map(([k,v]) => v);

    // Análise Técnica de Produtos (Agrupamento SKU)
    const productStats = {};
    validOrders.forEach(o => {
       if(!productStats[o.sku]) {
         productStats[o.sku] = { 
           sku: o.sku, name: o.product_name, qtd: 0, revenue: 0, cost: 0, profit: 0, unitCost: o.product_cost 
         };
       }
       const p = productStats[o.sku];
       p.qtd += 1;
       p.revenue += Number(o.sale_price);
       p.cost += Number(o.product_cost);
       p.profit += (o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee);
    });
    const productList = Object.values(productStats).sort((a,b) => b.revenue - a.revenue);

    return { totalGross, totalCogs, totalFees, totalProfit, margin, dailyChartData, productList };
  }, [orders]);

  // --- FUNÇÕES DE IMPORTAÇÃO (Simplificadas para brevidade, mantendo lógica anterior) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      processImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const processImportData = (data) => {
    if (!data?.length) return;
    const h = data[0].map(x => x?.toString().toLowerCase().trim());
    const cols = {
      id: h.findIndex(x => x === 'id do pedido'),
      prod: h.findIndex(x => x === 'nome do produto'),
      sku: h.findIndex(x => x === 'número de referência sku'),
      skuMain: h.findIndex(x => x === 'nº de referência do sku principal'),
      price: h.findIndex(x => x === 'preço acordado'),
      status: h.findIndex(x => x === 'status do pedido'),
      paid: h.findIndex(x => x === 'hora do pagamento do pedido'),
      feeCom: h.findIndex(x => x.includes('comissão')),
      feeServ: h.findIndex(x => x.includes('serviço')),
      feeTrans: h.findIndex(x => x.includes('transação'))
    };

    if(cols.id === -1) return alert("Planilha inválida");

    const processed = data.slice(1).map(row => {
      if(!row[cols.id]) return null;
      const parseVal = (v) => {
         if(typeof v === 'number') return v;
         if(!v) return 0;
         return parseFloat(v.toString().replace('R$','').replace(/\./g,'').replace(',','.').trim()) || 0;
      };
      
      let sku = row[cols.sku] || row[cols.skuMain] || row[cols.prod];
      sku = sku.toString().trim();
      let cost = productDatabase[sku.replace(/\s/g,'').toUpperCase()] || 0;
      let fees = 0;
      if(cols.feeCom !== -1) fees += parseVal(row[cols.feeCom]);
      if(cols.feeServ !== -1) fees += parseVal(row[cols.feeServ]);
      if(cols.feeTrans !== -1) fees += parseVal(row[cols.feeTrans]);
      const sale = parseVal(row[cols.price]);
      
      let status = row[cols.status] || 'Concluído';
      if(status.includes('Cancelado')) fees = 0;
      else if(fees === 0 && sale > 0) fees = sale * 0.20;

      return {
        order_id: row[cols.id], product_name: row[cols.prod], sku, 
        sale_price: sale, product_cost: cost, shopee_fee: Math.abs(fees), fixed_fee: 0,
        status, paid_at: row[cols.paid] ? new Date(row[cols.paid]).toISOString() : null
      };
    }).filter(Boolean);
    
    setImportedData(processed);
  };

  const saveBatch = async () => {
    if (!userId) return;
    try {
      const payload = importedData.map(i => ({ user_id: userId, ...i, fixed_fee: 3.00 }));
      await fetch('/api/orders', { method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type':'application/json'} });
      await fetchOrders();
      setShowUploadModal(false);
      setImportedData([]);
      alert("Dados atualizados!");
    } catch (e) { alert("Erro ao salvar"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-20">
      
      {/* BARRA DE NAVEGAÇÃO SUPERIOR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-2 rounded-lg text-white"><TrendingUp size={20}/></div>
          <div>
            <h1 className="text-xl font-black italic text-slate-800 tracking-tighter">ShopeeFlow <span className="text-orange-500">CRM</span></h1>
          </div>
        </div>

        {/* FILTRO DE DATA GLOBAL */}
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
           <div className="px-3 flex items-center gap-2 text-slate-400">
             <Calendar size={16}/> <span className="text-xs font-bold uppercase">Período</span>
           </div>
           <input 
             type="date" 
             value={dateRange.start} 
             onChange={e => setDateRange({...dateRange, start: e.target.value})}
             className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
           />
           <span className="text-slate-300">-</span>
           <input 
             type="date" 
             value={dateRange.end} 
             onChange={e => setDateRange({...dateRange, end: e.target.value})}
             className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
           />
        </div>

        <button onClick={() => setShowUploadModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-slate-800">
          <Upload size={16}/> IMPORTAR
        </button>
      </nav>

      {/* MENU DE ABAS */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="flex gap-4 border-b border-slate-200 mb-8 overflow-x-auto">
           <TabButton active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} icon={<TrendingUp size={18}/>} label="Dashboard Geral" />
           <TabButton active={activeTab==='products'} onClick={()=>setActiveTab('products')} icon={<Package size={18}/>} label="Produtos (Técnico)" />
           <TabButton active={activeTab==='detective'} onClick={()=>setActiveTab('detective')} icon={<Search size={18}/>} label="Detetive Financeiro" />
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-bold animate-pulse">Carregando dados...</div>
        ) : (
          <>
            {/* === ABA 1: DASHBOARD GERAL === */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* KPIS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Faturamento" value={analytics.totalGross} icon={<DollarSign/>} color="bg-slate-800" textColor="text-white"/>
                  <KpiCard title="Custos (CMV)" value={analytics.totalCogs} icon={<Package/>} color="bg-white" textColor="text-red-600" border/>
                  <KpiCard title="Taxas Shopee" value={analytics.totalFees} icon={<AlertCircle/>} color="bg-white" textColor="text-orange-500" border/>
                  <KpiCard title="Lucro Líquido" value={analytics.totalProfit} icon={<TrendingUp/>} color="bg-emerald-500" textColor="text-white" sub={`Margem: ${analytics.margin.toFixed(1)}%`}/>
                </div>

                {/* GRÁFICO PRINCIPAL */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={18}/> Evolução Diária</h3>
                   <div className="h-[350px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <ComposedChart data={analytics.dailyChartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10}/>
                         <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={v => `R$${v}`}/>
                         <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                         <Legend iconType="circle"/>
                         <Bar dataKey="faturamento" name="Faturamento" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20} />
                         <Line type="monotone" dataKey="lucro" name="Lucro Real" stroke="#10B981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                       </ComposedChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>
            )}

            {/* === ABA 2: PRODUTOS TÉCNICO === */}
            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700">Performance por SKU</h3>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">{analytics.productList.length} Produtos</span>
                   </div>
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                       <tr>
                         <th className="p-4">SKU / Produto</th>
                         <th className="p-4 text-center">Vendas</th>
                         <th className="p-4 text-right">Ticket Médio</th>
                         <th className="p-4 text-right">Margem</th>
                         <th className="p-4 text-right">Lucro Total</th>
                         <th className="p-4 text-right w-40">Custo Unit. (Editável)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {analytics.productList.map((prod, idx) => {
                         const ticket = prod.revenue / prod.qtd;
                         const margin = (prod.profit / prod.revenue) * 100;
                         return (
                           <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                             <td className="p-4 font-bold text-slate-700 truncate max-w-[250px]" title={prod.name}>
                               {prod.sku}
                               <div className="text-[10px] text-slate-400 font-normal truncate">{prod.name}</div>
                             </td>
                             <td className="p-4 text-center font-mono">{prod.qtd}</td>
                             <td className="p-4 text-right">R$ {ticket.toFixed(2)}</td>
                             <td className="p-4 text-right">
                               <span className={`px-2 py-1 rounded font-bold ${margin > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                 {margin.toFixed(1)}%
                               </span>
                             </td>
                             <td className={`p-4 text-right font-bold ${prod.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                               R$ {prod.profit.toFixed(2)}
                             </td>
                             <td className="p-4 text-right relative">
                               {editingProduct === prod.sku ? (
                                 <div className="flex items-center gap-1 absolute right-2 top-2 bg-white shadow-lg p-1 rounded border border-orange-200 z-10">
                                   <input 
                                     autoFocus
                                     className="w-20 p-1 border border-slate-300 rounded text-right outline-none" 
                                     defaultValue={prod.unitCost}
                                     onKeyDown={(e) => {
                                       if(e.key === 'Enter') updateProductCost(prod.sku, e.target.value);
                                       if(e.key === 'Escape') setEditingProduct(null);
                                     }}
                                   />
                                   <button onClick={()=>setEditingProduct(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => setEditingProduct(prod.sku)}
                                   className="flex items-center justify-end gap-2 w-full text-slate-500 hover:text-orange-500 font-bold"
                                 >
                                   R$ {prod.unitCost.toFixed(2)} <Edit2 size={12} className="opacity-0 group-hover:opacity-100"/>
                                 </button>
                               )}
                             </td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* === ABA 3: DETETIVE FINANCEIRO === */}
            {activeTab === 'detective' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Lista de Gargalos (Prejuízos) */}
                    <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
                       <div className="p-4 bg-red-50 border-b border-red-100">
                          <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertCircle size={18}/> Pedidos com Prejuízo</h3>
                       </div>
                       <div className="overflow-y-auto flex-1 p-2 space-y-2">
                          {orders.filter(o => !o.status.includes('Cancel') && (o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee) < 0)
                            .map(order => (
                              <div key={order.id} onClick={() => setSelectedOrder(order)} 
                                className="p-3 rounded-xl border border-red-100 bg-white hover:bg-red-50 cursor-pointer transition-colors group">
                                 <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-slate-700">{order.order_id}</span>
                                    <span className="text-xs font-black text-red-500">
                                      R$ {(order.sale_price - order.product_cost - order.shopee_fee - order.fixed_fee).toFixed(2)}
                                    </span>
                                 </div>
                                 <div className="text-[10px] text-slate-400 truncate mt-1">{order.product_name}</div>
                              </div>
                            ))}
                       </div>
                    </div>

                    {/* Detalhamento do Pedido (Recibo) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col justify-center items-center relative">
                       {!selectedOrder ? (
                         <div className="text-center text-slate-300">
                            <Search size={64} className="mx-auto mb-4 opacity-20"/>
                            <p className="font-bold">Selecione um pedido ao lado para investigar</p>
                         </div>
                       ) : (
                         <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
                            <h3 className="text-center font-black text-slate-800 text-lg mb-1">RAIO-X DO PEDIDO</h3>
                            <p className="text-center text-xs text-slate-400 font-mono mb-8">{selectedOrder.order_id}</p>
                            
                            <div className="space-y-4 relative">
                               {/* Linha que conecta */}
                               <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-100"></div>

                               <ReciboItem label="Venda Bruta" value={selectedOrder.sale_price} color="text-slate-800" icon={<DollarSign size={14}/>} />
                               <ReciboItem label="Custo Produto" value={-selectedOrder.product_cost} color="text-red-500" icon={<Package size={14}/>} />
                               <ReciboItem label="Taxas Shopee" value={-selectedOrder.shopee_fee} color="text-orange-500" icon={<AlertCircle size={14}/>} />
                               <ReciboItem label="Taxa Fixa" value={-selectedOrder.fixed_fee} color="text-orange-500" icon={<AlertCircle size={14}/>} />
                               
                               <div className="pt-4 border-t border-dashed border-slate-300 mt-4">
                                  <div className="flex justify-between items-center px-4">
                                     <span className="font-black text-slate-800 uppercase">Resultado Final</span>
                                     <span className={`text-2xl font-black ${(selectedOrder.sale_price - selectedOrder.product_cost - selectedOrder.shopee_fee - selectedOrder.fixed_fee) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        R$ {(selectedOrder.sale_price - selectedOrder.product_cost - selectedOrder.shopee_fee - selectedOrder.fixed_fee).toFixed(2)}
                                     </span>
                                  </div>
                               </div>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL UPLOAD (Oculto para brevidade, usar o mesmo de antes) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
           <div className="bg-white p-8 rounded-2xl max-w-md w-full">
              <h3 className="font-bold mb-4">Importar Planilha</h3>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="mb-4 w-full"/>
              <div className="flex justify-end gap-2">
                 <button onClick={()=>setShowUploadModal(false)} className="px-4 py-2 text-slate-400">Cancelar</button>
                 <button onClick={saveBatch} className="bg-slate-900 text-white px-4 py-2 rounded">Salvar</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

// COMPONENTES UI
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-all border-b-2 ${active ? 'text-orange-500 border-orange-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
    {icon} {label}
  </button>
);

const KpiCard = ({ title, value, icon, color, textColor, sub, border }) => (
  <div className={`p-6 rounded-2xl shadow-sm flex flex-col justify-between h-32 ${color} ${border ? 'border border-slate-200' : ''}`}>
    <div className="flex justify-between items-start">
       <span className={`${textColor} opacity-80 text-xs font-bold uppercase tracking-widest`}>{title}</span>
       <div className={`p-2 rounded-lg bg-white/20 text-${textColor === 'text-white' ? 'white' : 'slate-400'}`}>{icon}</div>
    </div>
    <div>
       <h3 className={`text-2xl font-black ${textColor}`}>R$ {value?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
       {sub && <p className="text-white/60 text-xs font-bold mt-1">{sub}</p>}
    </div>
  </div>
);

const ReciboItem = ({ label, value, color, icon }) => (
  <div className="flex justify-between items-center relative z-10 bg-white p-2 rounded-lg border border-slate-50 shadow-sm">
     <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">{icon}</div>
        <span className="font-bold text-sm text-slate-600">{label}</span>
     </div>
     <span className={`font-mono font-bold ${color}`}>R$ {Number(value).toFixed(2)}</span>
  </div>
);
