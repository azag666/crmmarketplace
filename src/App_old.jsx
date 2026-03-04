// ShopeeFlow PRO - Dashboard de Análise de Vendas
// Versão: 2.0 - Com análise ABC e detetive financeiro

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
  "ESTANTE4PRATBANCO": 36.03, "ESTANTE5PRAT": 40.92, "DECK40X40CM3UN": 27.18, 
  "ESTANTESANITA4PRAT": 16.18, "ESTANTE3PRAT65X302UN": 39.00, "3UNIPALLET50X50CM": 37.20,
  "ESTANTE3CRUA": 18.85, "DECK30X30": 5.59, "DECK40X40CM4UN": 36.24, "ESTANTE65CM2UN": 49.42,
  "ESTANTE2PRAT": 16.27, "GABINETEBANHEIRO": 22.96, "ESTANTE3PRAT2UN": 37.70,
  "ESTRADO25X25CM": 3.55, "CAPABOTIJÃO": 59.79, "PALLET": 12.40, "ESTANTE4PRAT": 34.88,
  "SAPATEIROBANCO": 40.93, "2UNIESTANTE65X50CM": 49.42, "PALLET40X40CM": 10.10,
  "2UNIESTANTE3CRUA": 37.70, "10UNIDECK30X30CM": 55.90, "DECK30X30CM": 5.59,
  "02UNIESTANTE65X50": 49.42, "SUPPLANTA": 2.74, "ESTANTE5PRAT100X50X30": 40.92,
  "SUPPLANTA5UNI": 13.10, "DECK30X30CM3UN": 16.77, "PALLET50X50CM": 12.40,
  "DECK30X30CM2UN": 11.18, "PRATELEIRAVASOS70X50CM": 38.94, "ESTANTE3CRUAFECHADA": 25.62,
  "ESTANTE65X30X30": 19.50, "CAVALETE70CM2UNI": 21.84, "02UNIPALLET50X50": 24.80,
  "25UNIRIPA40CM": 19.75, "ARARAINFANTIL": 21.93, "ESTANTE3PRAT": 18.85,
  "SUPPLANTA4UNI": 10.96, "4UNIDECK30X30CM": 22.36, "ESTRADO25X25CM4UNI": 14.20,
  "02UNICAVALETE70CM": 21.84, "CAVALETE70CM": 10.92, "SUPPLANTA2UNI": 5.48,
  "ARARAINFATIL": 21.93, "SUPPLANTA2UN": 5.48, "ESTANTE65CM": 24.71,
  "BARALHOCOPAGKITGABINETE+ESTANTESANITARI1PRAT": 39.14, "SUPPLANTA3UNI": 8.22,
  "DECK40X40CM2UN": 18.12, "100litros006": 20.00, "ESTANTE65X50CM": 24.71,
  "ESTANTE3PRAT65X30": 19.50, "TABUA20X60CM": 0.00, "ESTANTE65X50X30": 24.71,
  "02UNICAVALETE80CM": 21.84, "DECK40X40CM": 9.06, "SUPARANDELA": 1.76,
  "DECK30X30CM4UN": 22.36, "ESTANTESANITA1PRAT": 16.78, "03UNICAVALETE70CM": 32.76
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

  // Filtros de produtos
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [profitFilter, setProfitFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);

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

  const clearAllData = async () => {
    if (!confirm('Tem certeza que deseja apagar TODOS os dados de vendas? Esta ação não pode ser desfeita e afetará todo o seu histórico.')) return;
    if (!confirm('Confirmação final: Todos os pedidos, análises e relatórios serão permanentemente excluídos.')) return;
    
    try {
      const response = await fetch('/api/orders', {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId })
      });
      
      if (response.ok) {
        alert('Todos os dados foram apagados com sucesso!');
        setOrders([]);
        fetchOrders();
      } else {
        throw new Error('Erro ao limpar dados');
      }
    } catch (e) { 
      alert("Erro ao limpar dados. Tente novamente."); 
    }
  };

  // --- CÁLCULOS AVANÇADOS - LÓGICA INDIVIDUAL POR PEDIDO ---
  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !o.status?.toLowerCase().includes('cancelado'));
    
    // Cálculos individuais por pedido (sem agrupamento)
    const orderAnalysis = validOrders.map(o => {
      const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + 
                  (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0) + 
                  (Number(o.reverse_shipping_fee)||0);
      const orderProfit = (Number(o.sale_price)||0) - (Number(o.product_cost)||0) - fees;
      const orderMargin = Number(o.sale_price) > 0 ? (orderProfit / Number(o.sale_price)) * 100 : 0;
      
      return {
        ...o,
        totalFees: fees,
        orderProfit: orderProfit,
        orderMargin: orderMargin,
        isLoss: orderProfit < 0
      };
    });
    
    // Totais gerais (baseado em pedidos individuais)
    const totalGross = orderAnalysis.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = orderAnalysis.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    const totalFees = orderAnalysis.reduce((acc, o) => acc + o.totalFees, 0);
    const totalProfit = orderAnalysis.reduce((acc, o) => acc + o.orderProfit, 0);
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    // Gráfico Diário (Baseado na Data Real da Planilha)
    const dailyMap = {};
    orderAnalysis.forEach(o => {
      const dateRaw = o.creation_date || o.created_at;
      if(!dateRaw) return;
      
      const dateObj = new Date(dateRaw);
      const day = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); 
      
      if (!dailyMap[day]) {
        dailyMap[day] = { 
          name: day.slice(0,5), 
          fullDate: dateRaw, 
          vendas: 0, 
          lucro: 0, 
          faturamento: 0,
          totalOrders: 0,
          lossOrders: 0
        };
      }
      
      dailyMap[day].totalOrders += 1;
      dailyMap[day].vendas += 1;
      dailyMap[day].faturamento += Number(o.sale_price);
      dailyMap[day].lucro += o.orderProfit;
      if (o.isLoss) {
        dailyMap[day].lossOrders += 1;
      }
    });
    
    const dailyChartData = Object.values(dailyMap)
      .sort((a,b) => new Date(a.fullDate) - new Date(b.fullDate));

    // Análise por SKU (agrupamento APENAS para visualização)
    const productStats = {};
    orderAnalysis.forEach(o => {
       const sku = o.sku || 'SEM SKU';
       if(!productStats[sku]) {
         productStats[sku] = { 
           sku: sku, 
           name: o.product_name, 
           qtd: 0, 
           revenue: 0, 
           cost: 0, 
           profit: 0, 
           unitCost: o.product_cost,
           orders: [],
           lossOrders: [],
           fees: 0,
           avgTicket: 0,
           margin: 0,
           lossRate: 0,
           avgFees: 0
         };
       }
       const p = productStats[sku];
       
       // Acumula valores individuais
       p.qtd += 1;
       p.revenue += Number(o.sale_price);
       p.cost += Number(o.product_cost);
       p.profit += o.orderProfit;
       p.fees += o.totalFees;
       p.orders.push(o);
       
       if (o.isLoss) {
         p.lossOrders.push(o);
       }
    });
    
    // Cálculo das médias e taxas por produto
    Object.values(productStats).forEach(p => {
      p.avgTicket = p.qtd > 0 ? p.revenue / p.qtd : 0;
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
      p.lossRate = p.qtd > 0 ? (p.lossOrders.length / p.qtd) * 100 : 0;
      p.avgFees = p.qtd > 0 ? p.fees / p.qtd : 0;
    });
    
    // Análise ABC baseada no faturamento individual
    const sortedByRevenue = Object.values(productStats).sort((a,b) => b.revenue - a.revenue);
    const totalRevenue = sortedByRevenue.reduce((acc, p) => acc + p.revenue, 0);
    
    let accumulatedRevenue = 0;
    const productListWithABC = sortedByRevenue.map(p => {
      accumulatedRevenue += p.revenue;
      const percentage = (accumulatedRevenue / totalRevenue) * 100;
      
      let category = 'D';
      if (percentage <= 80) category = 'A';
      else if (percentage <= 90) category = 'B';
      else if (percentage <= 95) category = 'C';
      
      return { ...p, category };
    });

    // Insights avançados baseados em pedidos individuais
    const insights = {
      topProfitable: productListWithABC.filter(p => p.profit > 0).sort((a,b) => b.profit - a.profit).slice(0,5),
      topLoss: productListWithABC.filter(p => p.profit < 0).sort((a,b) => a.profit - b.profit).slice(0,5),
      highLossRate: productListWithABC.filter(p => p.lossRate > 20).sort((a,b) => b.lossRate - a.lossRate),
      lowMargin: productListWithABC.filter(p => p.margin < 10 && p.profit > 0).sort((a,b) => a.margin - b.margin),
      highFees: productListWithABC.filter(p => p.avgFees > (p.avgTicket * 0.25)).sort((a,b) => b.avgFees - a.avgFees),
      totalLossOrders: orderAnalysis.filter(o => o.isLoss).length,
      totalProfitOrders: orderAnalysis.filter(o => !o.isLoss).length,
      avgOrderValue: orderAnalysis.length > 0 ? totalGross / orderAnalysis.length : 0
    };

    return { 
      totalGross, 
      totalCogs, 
      totalFees, 
      totalProfit, 
      margin, 
      dailyChartData, 
      productList: productListWithABC, 
      insights,
      orderAnalysis,
      totalOrders: orderAnalysis.length
    };
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
      sku = sku ? sku.toString().trim().toUpperCase().replace(/\s/g, '') : 'SEM SKU';
      
      // Cálculo de custo individual por pedido
      let cost = 0;
      if (productDatabase[sku]) {
        cost = productDatabase[sku];
      } else {
        // Tentar encontrar SKU similar
        const skuKeys = Object.keys(productDatabase);
        const foundSku = skuKeys.find(key => 
          key.includes(sku) || sku.includes(key) || 
          key.replace(/\s/g, '').toUpperCase() === sku
        );
        cost = foundSku ? productDatabase[foundSku] : 0;
      }
      
      // Cálculo de taxas individuais por pedido
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
      
      // Validação de lógica: se não houver taxas definidas, usar padrão de 20%
      if(status.toLowerCase().includes('cancelado')) { 
        shopeeFees = 0; 
      } else if(shopeeFees === 0 && sale > 0) { 
        shopeeFees = sale * 0.20; 
      }
      
      // Cálculo do lucro individual deste pedido
      const totalFees = Math.abs(shopeeFees) + Math.abs(sellerVoucher) + Math.abs(coins) + Math.abs(reverseFee);
      const individualProfit = sale - cost - totalFees;
      
      const creationDate = parseDate(row[cols.created]);
      if(creationDate) {
         const d = new Date(creationDate);
         if(d < minDate) minDate = d;
         if(d > maxDate) maxDate = d;
      }

      return {
        order_id: row[cols.id], 
        product_name: row[cols.prod], 
        sku: sku, 
        sale_price: sale, 
        product_cost: cost, 
        shopee_fee: Math.abs(shopeeFees), 
        fixed_fee: 3.00, // Taxa fixa padrão
        seller_voucher: Math.abs(sellerVoucher),
        shopee_voucher: Math.abs(shopeeVoucher),
        coins_cashback: Math.abs(coins),
        reverse_shipping_fee: Math.abs(reverseFee),
        status: status, 
        creation_date: creationDate,
        // Campos adicionais para validação
        original_sku: row[cols.skuVar] || row[cols.skuMain] || row[cols.prod],
        calculated_profit: individualProfit,
        calculated_fees: totalFees
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
           <TabButton active={activeTab==='catalog'} onClick={()=>setActiveTab('catalog')} icon={<ShoppingBag size={18}/>} label="Catálogo" />
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

            {/* === ABA PRODUTOS TÉCNICOS COM ANÁLISE ABC === */}
            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in">
                {/* Insights e Recomendações */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp size={20}/> Insights de Vendas - Análise ABC
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                      <div className="text-2xl font-bold">{analytics.productList.filter(p => p.category === 'A').length}</div>
                      <div className="text-sm opacity-90">Produtos Categoria A</div>
                      <div className="text-xs opacity-75 mt-1">Representam ~80% do faturamento</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                      <div className="text-2xl font-bold">{analytics.productList.filter(p => p.category === 'B').length}</div>
                      <div className="text-sm opacity-90">Produtos Categoria B</div>
                      <div className="text-xs opacity-75 mt-1">Representam ~10% do faturamento</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                      <div className="text-2xl font-bold">{analytics.productList.filter(p => p.category === 'C').length}</div>
                      <div className="text-sm opacity-90">Produtos Categoria C</div>
                      <div className="text-xs opacity-75 mt-1">Representam ~5% do faturamento</div>
                    </div>
                  </div>
                </div>

                {/* Recomendações Estratégicas */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h4 className="font-bold text-slate-700 mb-4">Recomendações Estratégicas</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="bg-green-500 text-white rounded-full p-1 mt-1">
                        <Check size={12}/>
                      </div>
                      <div>
                        <div className="font-bold text-green-800">Foque nos Produtos Categoria A</div>
                        <div className="text-sm text-green-600">Aumente o estoque e invista em marketing para esses produtos que geram 80% do seu faturamento.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <div className="bg-yellow-500 text-white rounded-full p-1 mt-1">
                        <AlertCircle size={12}/>
                      </div>
                      <div>
                        <div className="font-bold text-yellow-800">Analise os Produtos Categoria B</div>
                        <div className="text-sm text-yellow-600">Considere estratégias para mover esses produtos para a categoria A através de otimização de preços ou marketing.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <div className="bg-red-500 text-white rounded-full p-1 mt-1">
                        <X size={12}/>
                      </div>
                      <div>
                        <div className="font-bold text-red-800">Reavalie Produtos Categoria C e D</div>
                        <div className="text-sm text-red-600">Considere descontinuar produtos com baixo desempenho ou baixar os custos para melhorar a margem.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela Detalhada de Produtos */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="p-4 bg-slate-50 border-b border-slate-200">
                     <h3 className="font-bold text-slate-700">Análise Técnica de Produtos</h3>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                         <tr>
                           <th className="p-4">SKU</th>
                           <th className="p-4 text-center">Cat.</th>
                           <th className="p-4 text-center">Qtd</th>
                           <th className="p-4 text-right">Faturamento</th>
                           <th className="p-4 text-right">Ticket Médio</th>
                           <th className="p-4 text-right">Margem</th>
                           <th className="p-4 text-right">Lucro Total</th>
                           <th className="p-4 text-right">Custo Unit.</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {analytics.productList.map((prod, idx) => (
                           <tr key={idx} className="hover:bg-slate-50">
                               <td className="p-4 font-bold text-slate-700">
                                 <div>{prod.sku}</div>
                                 <div className="text-xs text-slate-500 truncate max-w-xs" title={prod.name}>{prod.name}</div>
                               </td>
                               <td className="p-4 text-center">
                                 <span className={`px-2 py-1 rounded font-bold text-xs ${
                                   prod.category === 'A' ? 'bg-green-100 text-green-700' :
                                   prod.category === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                   prod.category === 'C' ? 'bg-orange-100 text-orange-700' :
                                   'bg-red-100 text-red-700'
                                 }`}>
                                   {prod.category}
                                 </span>
                               </td>
                               <td className="p-4 text-center font-bold">{prod.qtd}</td>
                               <td className="p-4 text-right font-bold">R$ {prod.revenue.toFixed(2)}</td>
                               <td className="p-4 text-right">R$ {prod.avgTicket.toFixed(2)}</td>
                               <td className="p-4 text-right">
                                 <span className={`px-2 py-1 rounded font-bold ${
                                   prod.margin > 20 ? 'bg-green-100 text-green-700' :
                                   prod.margin > 10 ? 'bg-yellow-100 text-yellow-700' :
                                   'bg-red-100 text-red-700'
                                 }`}>
                                   {prod.margin.toFixed(1)}%
                                 </span>
                               </td>
                               <td className="p-4 text-right font-bold">
                                 <span className={prod.profit > 0 ? 'text-green-600' : 'text-red-600'}>
                                   R$ {prod.profit.toFixed(2)}
                                 </span>
                               </td>
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
              </div>
            )}

            {/* === CATÁLOGO DE PRODUTOS COM FILTROS === */}
            {activeTab === 'catalog' && (
              <div className="space-y-6 animate-in fade-in">
                {/* Insights Estratégicos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <TrendingUp size={20}/> Top Lucrativos
                    </h3>
                    <div className="space-y-2">
                      {analytics.insights.topProfitable.map((product, idx) => (
                        <div key={idx} className="bg-white/20 backdrop-blur rounded-lg p-3">
                          <div className="font-bold">{product.sku}</div>
                          <div className="text-sm opacity-90">Lucro: R$ {product.profit.toFixed(2)}</div>
                          <div className="text-xs opacity-75">Margem: {product.margin.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <AlertCircle size={20}/> Maiores Prejuízos
                    </h3>
                    <div className="space-y-2">
                      {analytics.insights.topLoss.map((product, idx) => (
                        <div key={idx} className="bg-white/20 backdrop-blur rounded-lg p-3">
                          <div className="font-bold">{product.sku}</div>
                          <div className="text-sm opacity-90">Prejuízo: R$ {Math.abs(product.profit).toFixed(2)}</div>
                          <div className="text-xs opacity-75">Taxa de Perda: {product.lossRate.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-500 to-yellow-600 text-white p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Search size={20}/> Gargalos Identificados
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                        <div className="font-bold">Alta Taxa de Perda</div>
                        <div className="text-xs opacity-90">{analytics.insights.highLossRate.length} produtos com mais de 20% de perda</div>
                      </div>
                      <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                        <div className="font-bold">Margens Baixas</div>
                        <div className="text-xs opacity-90">{analytics.insights.lowMargin.length} produtos com menos de 10% margem</div>
                      </div>
                      <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                        <div className="font-bold">Taxas Elevadas</div>
                        <div className="text-xs opacity-90">{analytics.insights.highFees.length} produtos com taxas acima de 25%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtros Avançados */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-700 mb-4">Filtros Avançados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Buscar SKU</label>
                      <input
                        type="text"
                        value={productFilter}
                        onChange={(e) => setProductFilter(e.target.value)}
                        placeholder="Digite o SKU..."
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Categoria ABC</label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="all">Todas</option>
                        <option value="A">Categoria A</option>
                        <option value="B">Categoria B</option>
                        <option value="C">Categoria C</option>
                        <option value="D">Categoria D</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Status de Lucro</label>
                      <select
                        value={profitFilter}
                        onChange={(e) => setProfitFilter(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="all">Todos</option>
                        <option value="profit">Lucrativos</option>
                        <option value="loss">Prejuízo</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setProductFilter('');
                          setCategoryFilter('all');
                          setProfitFilter('all');
                        }}
                        className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-300"
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Produtos com Filtros */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700">Catálogo de Produtos</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="p-4">SKU</th>
                          <th className="p-4 text-center">Cat.</th>
                          <th className="p-4 text-center">Qtd</th>
                          <th className="p-4 text-right">Faturamento</th>
                          <th className="p-4 text-right">Custo Total</th>
                          <th className="p-4 text-right">Taxas Médias</th>
                          <th className="p-4 text-right">Lucro Total</th>
                          <th className="p-4 text-right">Margem</th>
                          <th className="p-4 text-center">% Perda</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.productList
                          .filter(prod => {
                            if (productFilter && !prod.sku.toLowerCase().includes(productFilter.toLowerCase())) return false;
                            if (categoryFilter !== 'all' && prod.category !== categoryFilter) return false;
                            if (profitFilter === 'profit' && prod.profit <= 0) return false;
                            if (profitFilter === 'loss' && prod.profit >= 0) return false;
                            return true;
                          })
                          .map((prod, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-bold text-slate-700">
                                <div>{prod.sku}</div>
                                <div className="text-xs text-slate-500 truncate max-w-xs" title={prod.name}>{prod.name}</div>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded font-bold text-xs ${
                                  prod.category === 'A' ? 'bg-green-100 text-green-700' :
                                  prod.category === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                  prod.category === 'C' ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {prod.category}
                                </span>
                              </td>
                              <td className="p-4 text-center font-bold">{prod.qtd}</td>
                              <td className="p-4 text-right font-bold">R$ {prod.revenue.toFixed(2)}</td>
                              <td className="p-4 text-right text-red-600">R$ {prod.cost.toFixed(2)}</td>
                              <td className="p-4 text-right text-orange-500">R$ {prod.avgFees.toFixed(2)}</td>
                              <td className="p-4 text-right font-bold">
                                <span className={prod.profit > 0 ? 'text-green-600' : 'text-red-600'}>
                                  R$ {prod.profit.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className={`px-2 py-1 rounded font-bold ${
                                  prod.margin > 20 ? 'bg-green-100 text-green-700' :
                                  prod.margin > 10 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {prod.margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded font-bold text-xs ${
                                  prod.lossRate > 20 ? 'bg-red-100 text-red-700' :
                                  prod.lossRate > 10 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {prod.lossRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button 
                                  onClick={() => setSelectedProduct(prod)}
                                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 mr-1"
                                >
                                  Vendas
                                </button>
                                <button 
                                  onClick={() => setEditingProduct(prod.sku)}
                                  className="bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600"
                                >
                                  Editar
                                </button>
                              </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* === DETETIVE FINANCEIRO (COMPLETO) === */}
            {activeTab === 'detective' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Search size={18}/> Pedidos com Prejuízo
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="p-4">Pedido</th>
                          <th className="p-4">Produto</th>
                          <th className="p-4 text-right">Venda</th>
                          <th className="p-4 text-right">Custo</th>
                          <th className="p-4 text-right">Taxas</th>
                          <th className="p-4 text-right">Lucro</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.filter(o => {
                          if (o.status?.toLowerCase().includes('cancelado')) return false;
                          const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + 
                                      (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0);
                          const profit = (Number(o.sale_price)||0) - (Number(o.product_cost)||0) - fees;
                          return profit < 0;
                        }).map((order, idx) => {
                          const fees = (Number(order.shopee_fee)||0) + (Number(order.fixed_fee)||0) + 
                                      (Number(order.seller_voucher)||0) + (Number(order.coins_cashback)||0);
                          const profit = (Number(order.sale_price)||0) - (Number(order.product_cost)||0) - fees;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-bold text-slate-700">{order.order_id}</td>
                              <td className="p-4">
                                <div className="max-w-xs truncate" title={order.product_name}>
                                  {order.product_name}
                                </div>
                              </td>
                              <td className="p-4 text-right font-bold">R$ {Number(order.sale_price).toFixed(2)}</td>
                              <td className="p-4 text-right text-red-600">R$ {Number(order.product_cost).toFixed(2)}</td>
                              <td className="p-4 text-right text-orange-500">R$ {fees.toFixed(2)}</td>
                              <td className="p-4 text-right">
                                <span className="px-2 py-1 rounded font-bold bg-red-100 text-red-700">
                                  R$ {profit.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button 
                                  onClick={() => setSelectedOrder(order)}
                                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                                >
                                  Detalhes
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* === MODAL VENDAS DO PRODUTO === */}
            {selectedProduct && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg text-slate-700">Vendas do Produto</h3>
                      <p className="text-sm text-slate-500">{selectedProduct.sku} - {selectedProduct.name}</p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={20}/>
                    </button>
                  </div>
                  
                  {/* Resumo do Produto */}
                  <div className="p-6 bg-slate-50 border-b">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-800">{selectedProduct.qtd}</div>
                        <div className="text-xs text-slate-500">Vendas Totais</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">R$ {selectedProduct.profit.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">Lucro Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{selectedProduct.margin.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Margem Média</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{selectedProduct.lossRate.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Taxa de Perda</div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Vendas */}
                  <div className="p-6">
                    <h4 className="font-bold text-slate-700 mb-4">Histórico de Vendas (Cálculos Individuais)</h4>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <strong>Lógica de Cálculo:</strong> Cada pedido é calculado individualmente. 
                        Lucro = Valor Venda - Custo Produto - Taxas Totais
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b">
                          <tr>
                            <th className="p-3">Pedido</th>
                            <th className="p-3">Data</th>
                            <th className="p-3 text-right">Venda</th>
                            <th className="p-3 text-right">Custo</th>
                            <th className="p-3 text-right">Taxas</th>
                            <th className="p-3 text-right">Lucro</th>
                            <th className="p-3 text-right">Margem</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedProduct.orders.map((order, idx) => {
                            // Recalcular para garantir precisão
                            const fees = (Number(order.shopee_fee)||0) + (Number(order.fixed_fee)||0) + 
                                        (Number(order.seller_voucher)||0) + (Number(order.coins_cashback)||0) +
                                        (Number(order.reverse_shipping_fee)||0);
                            const profit = (Number(order.sale_price)||0) - (Number(order.product_cost)||0) - fees;
                            const margin = Number(order.sale_price) > 0 ? (profit / Number(order.sale_price)) * 100 : 0;
                            
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-700">{order.order_id}</td>
                                <td className="p-3">{new Date(order.creation_date || order.created_at).toLocaleDateString('pt-BR')}</td>
                                <td className="p-3 text-right font-bold">R$ {Number(order.sale_price).toFixed(2)}</td>
                                <td className="p-3 text-right text-red-600">R$ {Number(order.product_cost).toFixed(2)}</td>
                                <td className="p-3 text-right text-orange-500">R$ {fees.toFixed(2)}</td>
                                <td className="p-3 text-right font-bold">
                                  <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    R$ {profit.toFixed(2)}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    margin > 20 ? 'bg-green-100 text-green-700' :
                                    margin > 10 ? 'bg-yellow-100 text-yellow-700' :
                                    margin > 0 ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {margin.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {profit >= 0 ? 'Lucro' : 'Prejuízo'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Resumo de Cálculos */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-sm text-slate-600">Total de Vendas</div>
                        <div className="text-xl font-bold text-slate-800">
                          R$ {selectedProduct.orders.reduce((acc, o) => acc + Number(o.sale_price), 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-sm text-red-600">Total de Custos</div>
                        <div className="text-xl font-bold text-red-800">
                          R$ {selectedProduct.orders.reduce((acc, o) => acc + Number(o.product_cost), 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-sm text-orange-600">Total de Taxas</div>
                        <div className="text-xl font-bold text-orange-800">
                          R$ {selectedProduct.orders.reduce((acc, o) => {
                            const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + 
                                        (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0) +
                                        (Number(o.reverse_shipping_fee)||0);
                            return acc + fees;
                          }, 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === MODAL DETALHES DO PEDIDO === */}
            {selectedOrder && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-700">Detalhes do Pedido</h3>
                    <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={20}/>
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 uppercase">ID do Pedido</label>
                        <p className="font-bold">{selectedOrder.order_id}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase">Status</label>
                        <p className="font-bold">{selectedOrder.status}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase">Data do Pedido</label>
                        <p className="font-bold">{new Date(selectedOrder.creation_date || selectedOrder.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase">SKU</label>
                        <p className="font-bold">{selectedOrder.sku}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-slate-500 uppercase">Produto</label>
                      <p className="font-bold">{selectedOrder.product_name}</p>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-bold mb-3">Análise Financeira</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Valor da Venda:</span>
                          <span className="font-bold">R$ {Number(selectedOrder.sale_price).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Custo do Produto:</span>
                          <span className="font-bold text-red-600">-R$ {Number(selectedOrder.product_cost).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxa Shopee:</span>
                          <span className="font-bold text-orange-500">-R$ {Number(selectedOrder.shopee_fee || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxa Fixa:</span>
                          <span className="font-bold text-orange-500">-R$ {Number(selectedOrder.fixed_fee || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cupom do Vendedor:</span>
                          <span className="font-bold text-orange-500">-R$ {Number(selectedOrder.seller_voucher || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Moedas Cashback:</span>
                          <span className="font-bold text-orange-500">-R$ {Number(selectedOrder.coins_cashback || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxa Envio Reverso:</span>
                          <span className="font-bold text-orange-500">-R$ {Number(selectedOrder.reverse_shipping_fee || 0).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-bold">Lucro/Prejuízo:</span>
                          <span className={`font-bold text-lg ${
                            ((Number(selectedOrder.sale_price)||0) - 
                             (Number(selectedOrder.product_cost)||0) - 
                             (Number(selectedOrder.shopee_fee)||0) - 
                             (Number(selectedOrder.fixed_fee)||0) - 
                             (Number(selectedOrder.seller_voucher)||0) - 
                             (Number(selectedOrder.coins_cashback)||0) - 
                             (Number(selectedOrder.reverse_shipping_fee)||0)) >= 0 
                            ? 'text-green-600' : 'text-red-600'
                          }`}>
                            R$ {((Number(selectedOrder.sale_price)||0) - 
                             (Number(selectedOrder.product_cost)||0) - 
                             (Number(selectedOrder.shopee_fee)||0) - 
                             (Number(selectedOrder.fixed_fee)||0) - 
                             (Number(selectedOrder.seller_voucher)||0) - 
                             (Number(selectedOrder.coins_cashback)||0) - 
                             (Number(selectedOrder.reverse_shipping_fee)||0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* === MODAL IMPORTAÇÃO === */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-700">Importar Planilha de Vendas</h3>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20}/>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <Upload size={48} className="mx-auto text-slate-400 mb-4"/>
                  <p className="text-slate-600 mb-4">Arraste a planilha ou clique para selecionar</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600"
                  >
                    Selecionar Arquivo
                  </button>
                </div>
                
                {importedData.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold">Pré-visualização ({importedData.length} registros)</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImportedData([])}
                          className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-300"
                        >
                          Limpar
                        </button>
                        <button
                          onClick={saveBatch}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-600"
                        >
                          Importar Dados
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left p-2">Pedido</th>
                            <th className="text-left p-2">Produto</th>
                            <th className="text-right p-2">Valor</th>
                            <th className="text-right p-2">Custo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2">{row.order_id}</td>
                              <td className="p-2 truncate max-w-xs">{row.product_name}</td>
                              <td className="p-2 text-right">R$ {row.sale_price.toFixed(2)}</td>
                              <td className="p-2 text-right">R$ {row.product_cost.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importedData.length > 10 && (
                        <p className="text-center text-slate-500 mt-2">... e mais {importedData.length - 10} registros</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === BOTÃO LIMPAR DADOS === */}
        <div className="fixed bottom-4 right-4">
          <button
            onClick={clearAllData}
            className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 flex items-center gap-2 shadow-lg"
          >
            <Trash2 size={16}/> Limpar Dados
          </button>
        </div>
      </div>
    </div>
  );
}

// Componentes Auxiliares
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-xs transition-colors ${
        active 
          ? 'bg-white text-slate-900 border-b-2 border-orange-500' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function KpiCard({ title, value, icon, color, textColor, border, sub }) {
  return (
    <div className={`${color} ${border ? 'border border-slate-200' : ''} p-4 rounded-2xl shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${textColor} text-xs font-bold uppercase opacity-70`}>{title}</span>
        <div className={`${textColor} opacity-70`}>{icon}</div>
      </div>
      <div className={`${textColor} text-2xl font-black`}>R$ {value.toFixed(2)}</div>
      {sub && <div className={`${textColor} text-xs opacity-70 mt-1`}>{sub}</div>}
    </div>
  );
}
