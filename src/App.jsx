import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, FileText, Trash2, Calculator, 
  ArrowUpRight, ArrowDownRight, Plus, Upload, X, Package, Check, 
  Settings, Search, Calendar, Filter, Eye, Edit2, Tag, ShoppingBag
} from 'lucide-react';

const PRESET_COSTS = {
  "ESTANTE4PRATBANCO": 36.03, "ESTANTE5PRAT": 40.92
};

export default function App() {
  const [userId, setUserId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filtro de Data (Padrão: Mês atual)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [importedData, setImportedData] = useState([]); 
  const [uniqueProducts, setUniqueProducts] = useState([]);
  const [productDatabase, setProductDatabase] = useState(PRESET_COSTS);
  const fileInputRef = useRef(null);

  // 1. Autenticação
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // 2. Busca Dados
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end }).toString();
      const res = await fetch(`/api/orders?${query}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { if (userId) fetchOrders(); }, [userId, dateRange]);

  const updateProductCost = async (sku, newCost) => {
    if(!confirm(`Atualizar custo do SKU "${sku}"?`)) return;
    try {
      await fetch('/api/orders', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId, sku, new_cost: parseFloat(newCost) })
      });
      setEditingProduct(null);
      fetchOrders();
    } catch (e) { alert("Erro ao atualizar"); }
  };

  // --- CÁLCULOS ---
  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !o.status?.toLowerCase().includes('cancelado'));
    
    const totalGross = validOrders.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = validOrders.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    
    // Taxas Reais (O que saiu do seu bolso)
    const totalFees = validOrders.reduce((acc, o) => 
      acc + (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + 
      (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0) + (Number(o.reverse_shipping_fee)||0), 0);
      
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    // Gráfico Diário (Baseado na Data Real da Planilha)
    const dailyMap = {};
    orders.forEach(o => {
      const dateRaw = o.creation_date || o.created_at;
      if(!dateRaw) return;
      
      // Ajuste de fuso horário simples para exibição
      const dateObj = new Date(dateRaw);
      const day = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); 
      
      if (!dailyMap[day]) dailyMap[day] = { name: day.slice(0,5), fullDate: dateRaw, vendas: 0, lucro: 0, faturamento: 0 };
      
      if (!o.status.toLowerCase().includes('cancelado')) {
         dailyMap[day].vendas += 1;
         dailyMap[day].faturamento += Number(o.sale_price);
         const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0);
         dailyMap[day].lucro += (o.sale_price - o.product_cost - fees);
      }
    });
    
    const dailyChartData = Object.values(dailyMap)
      .sort((a,b) => new Date(a.fullDate) - new Date(b.fullDate));

    // Produtos
    const productStats = {};
    validOrders.forEach(o => {
       const sku = o.sku || 'SEM SKU';
       if(!productStats[sku]) {
         productStats[sku] = { sku: sku, name: o.product_name, qtd: 0, revenue: 0, cost: 0, profit: 0, unitCost: o.product_cost };
       }
       const p = productStats[sku];
       const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + (Number(o.seller_voucher)||0);
       
       p.qtd += 1;
       p.revenue += Number(o.sale_price);
       p.cost += Number(o.product_cost);
       p.profit += (o.sale_price - o.product_cost - fees);
    });
    const productList = Object.values(productStats).sort((a,b) => b.revenue - a.revenue);

    return { totalGross, totalCogs, totalFees, totalProfit, margin, dailyChartData, productList };
  }, [orders]);

  // --- IMPORTAÇÃO INTELIGENTE ---
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
      skuVar: h.findIndex(x => x === 'número de referência sku'),
      skuMain: h.findIndex(x => x === 'nº de referência do sku principal'),
      price: h.findIndex(x => x === 'preço acordado'),
      status: h.findIndex(x => x === 'status do pedido'),
      created: h.findIndex(x => x === 'data de criação do pedido' || x === 'data de criação'), // Data Real
      
      feeCom: h.findIndex(x => x.includes('comissão')),
      feeServ: h.findIndex(x => x.includes('serviço')),
      feeTrans: h.findIndex(x => x.includes('transação')),
      
      sellerVoucher: h.findIndex(x => x === 'cupom do vendedor'),
      shopeeVoucher: h.findIndex(x => x === 'cupom shopee'), // Cupom Shopee (Não desconta)
      coins: h.findIndex(x => x.includes('moedas') || x.includes('coin')),
      reverseFee: h.findIndex(x => x.includes('envio reversa')),
    };

    if(cols.id === -1) return alert("Planilha inválida.");

    let minDate = new Date();
    let maxDate = new Date(0);

    const processed = data.slice(1).map(row => {
      if(!row[cols.id]) return null;
      
      const parseVal = (v) => {
         if(typeof v === 'number') return v;
         if(!v) return 0;
         return parseFloat(v.toString().replace('R$','').replace(/\./g,'').replace(',','.').trim()) || 0;
      };
      
      // Parser de Data Robusto (Excel Serial ou String)
      const parseDate = (v) => {
         if (!v) return null;
         if (typeof v === 'number') {
            // Excel Serial Date
            return new Date(Math.round((v - 25569)*86400*1000)).toISOString();
         }
         // Tenta string YYYY-MM-DD
         let d = new Date(v);
         if (!isNaN(d)) return d.toISOString();
         return null;
      };

      let sku = row[cols.skuVar] || row[cols.skuMain] || row[cols.prod];
      sku = sku ? sku.toString().trim() : 'SEM SKU';
      let cost = productDatabase[sku.replace(/\s/g,'').toUpperCase()] || 0;
      
      let shopeeFees = 0;
      if(cols.feeCom !== -1) shopeeFees += parseVal(row[cols.feeCom]);
      if(cols.feeServ !== -1) shopeeFees += parseVal(row[cols.feeServ]);
      if(cols.feeTrans !== -1) shopeeFees += parseVal(row[cols.feeTrans]);
      
      const sellerVoucher = cols.sellerVoucher !== -1 ? parseVal(row[cols.sellerVoucher]) : 0;
      const shopeeVoucher = cols.shopeeVoucher !== -1 ? parseVal(row[cols.shopeeVoucher]) : 0;
      const coins = cols.coins !== -1 ? parseVal(row[cols.coins]) : 0;
      const reverseFee = cols.reverseFee !== -1 ? parseVal(row[cols.reverseFee]) : 0;
      const sale = parseVal(row[cols.price]);
      const status = row[cols.status] || 'Concluído';
      
      const creationDate = parseDate(row[cols.created]);
      if(creationDate) {
         const d = new Date(creationDate);
         if(d < minDate) minDate = d;
         if(d > maxDate) maxDate = d;
      }

      if(status.toLowerCase().includes('cancelado')) { shopeeFees = 0; } 
      else if(shopeeFees === 0 && sale > 0) { shopeeFees = sale * 0.20; }

      return {
        order_id: row[cols.id], product_name: row[cols.prod], sku, 
        sale_price: sale, product_cost: cost, 
        shopee_fee: Math.abs(shopeeFees), fixed_fee: 0,
        seller_voucher: Math.abs(sellerVoucher),
        shopee_voucher: Math.abs(shopeeVoucher),
        coins_cashback: Math.abs(coins),
        reverse_shipping_fee: Math.abs(reverseFee),
        status, creation_date: creationDate
      };
    }).filter(Boolean);
    
    // Atualiza filtro de data automaticamente
    if (processed.length > 0) {
      setDateRange({
         start: minDate.toISOString().split('T')[0],
         end: maxDate.toISOString().split('T')[0]
      });
    }

    const summary = {};
    processed.forEach(p => {
       if(!summary[p.sku]) summary[p.sku] = { sku: p.sku, count: 0, cost: p.product_cost };
       summary[p.sku].count++;
    });

    setUniqueProducts(Object.values(summary));
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
      alert("Sucesso! Dashboard atualizado.");
    } catch (e) { alert("Erro ao salvar"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-20">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-2 rounded-lg text-white"><TrendingUp size={20}/></div>
          <h1 className="text-xl font-black italic text-slate-800 tracking-tighter">ShopeeFlow <span className="text-orange-500">PRO</span></h1>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
           <div className="px-3 flex items-center gap-2 text-slate-400">
             <Calendar size={16}/> <span className="text-xs font-bold uppercase">Período</span>
           </div>
           <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-white border rounded px-2 py-1 text-xs font-bold"/>
           <span className="text-slate-300">-</span>
           <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-white border rounded px-2 py-1 text-xs font-bold"/>
        </div>

        <button onClick={() => setShowUploadModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-slate-800">
          <Upload size={16}/> IMPORTAR
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="flex gap-4 border-b border-slate-200 mb-8 overflow-x-auto">
           <TabButton active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} icon={<TrendingUp size={18}/>} label="Visão Geral" />
           <TabButton active={activeTab==='products'} onClick={()=>setActiveTab('products')} icon={<Package size={18}/>} label="Produtos (Técnico)" />
           <TabButton active={activeTab==='detective'} onClick={()=>setActiveTab('detective')} icon={<Search size={18}/>} label="Detetive Financeiro" />
        </div>

        {loading ? <div className="text-center py-20 font-bold text-slate-400">Carregando dados...</div> : (
          <>
            {/* === DASHBOARD === */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Faturamento" value={analytics.totalGross} icon={<DollarSign/>} color="bg-slate-800" textColor="text-white"/>
                  <KpiCard title="Custos (CMV)" value={analytics.totalCogs} icon={<Package/>} color="bg-white" textColor="text-red-600" border/>
                  <KpiCard title="Taxas & Descontos" value={analytics.totalFees} icon={<AlertCircle/>} color="bg-white" textColor="text-orange-500" border/>
                  <KpiCard title="Lucro Líquido" value={analytics.totalProfit} icon={<TrendingUp/>} color="bg-emerald-500" textColor="text-white" sub={`Margem: ${analytics.margin.toFixed(1)}%`}/>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Calendar size={18}/> Fluxo Diário (Data Real do Pedido)</h3>
                   <div className="h-[350px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <ComposedChart data={analytics.dailyChartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}}/>
                         <YAxis hide/>
                         <Tooltip/>
                         <Legend iconType="circle"/>
                         <Bar dataKey="faturamento" name="Venda Bruta" fill="#cbd5e1" radius={[4,4,0,0]} barSize={20} />
                         <Line type="monotone" dataKey="lucro" name="Lucro Real" stroke="#10B981" strokeWidth={3} dot={{r: 4}} />
                       </ComposedChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>
            )}

            {/* === ABA PRODUTOS (CORRIGIDA) === */}
            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                       <tr><th className="p-4">SKU</th><th className="p-4 text-center">Qtd</th><th className="p-4 text-right">Margem</th><th className="p-4 text-right">Lucro</th><th className="p-4 text-right">Custo Unit.</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {analytics.productList.map((prod, idx) => (
                         <tr key={idx} className="hover:bg-slate-50">
                             <td className="p-4 font-bold text-slate-700">{prod.sku}</td>
                             <td className="p-4 text-center">{prod.qtd}</td>
                             <td className="p-4 text-right"><span className={`px-2 py-1 rounded font-bold ${prod.profit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{((prod.profit/prod.revenue)*100).toFixed(1)}%</span></td>
                             <td className="p-4 text-right font-bold text-slate-700">R$ {prod.profit.toFixed(2)}</td>
                             <td className="p-4 text-right">
                               {editingProduct === prod.sku ? (
                                 <input autoFocus className="w-16 border p-1 rounded" defaultValue={prod.unitCost} 
                                   onKeyDown={(e) => e.key === 'Enter' && updateProductCost(prod.sku, e.target.value)} 
                                   onBlur={() => setEditingProduct(null)} />
                               ) : (
                                 <button onClick={() => setEditingProduct(prod.sku)} className="hover:text-orange-500 font-bold">R$ {prod.unitCost.toFixed(2)} <Edit2 size={10} className="inline"/></button>
                               )}
                             </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* === DETETIVE FINANCEIRO (COMPLETO) === */}
            {activeTab === 'detective' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-200"><h3 className="font-bold">Pedidos</h3></div>
                    <div className="overflow-y-auto flex-1 p-2">
                       {orders.filter(o => !o.status.includes('Cancel')).map
