import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, FileText, Trash2, Calculator, 
  ArrowUpRight, ArrowDownRight, Plus, Upload, X, Package, Check, 
  Settings, Search, Truck, MapPin, Calendar, Activity
} from 'lucide-react';

// --- CUSTOS PADRÃO ---
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

const STATUS_COLORS = {
  'Concluído': '#10B981', 'A Enviar': '#3B82F6', 'Cancelado': '#EF4444', 
  'Reembolso': '#F59E0B', 'Devolvido': '#F59E0B'
};

export default function App() {
  const [userId, setUserId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | analysis | costs
  
  // Modais
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Dados de Importação
  const [importedData, setImportedData] = useState([]); 
  const [uniqueProducts, setUniqueProducts] = useState([]);
  const [productDatabase, setProductDatabase] = useState(PRESET_COSTS);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef(null);

  // --- 1. Autenticação Simplificada ---
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // --- 2. Busca Dados ---
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { if (userId) fetchOrders(); }, [userId]);

  // --- 3. Processamento de Planilha Shopee (Completo) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (!data?.length) return;
      const headers = data[0].map(h => h?.toString().toLowerCase().trim());
      
      // Mapeamento de Colunas
      const cols = {
        id: headers.findIndex(h => h === 'id do pedido'),
        prod: headers.findIndex(h => h === 'nome do produto'),
        skuVar: headers.findIndex(h => h === 'número de referência sku'),
        skuMain: headers.findIndex(h => h === 'nº de referência do sku principal'),
        price: headers.findIndex(h => h === 'preço acordado'),
        status: headers.findIndex(h => h === 'status do pedido'),
        created: headers.findIndex(h => h === 'data de criação do pedido'),
        paid: headers.findIndex(h => h === 'hora do pagamento do pedido'),
        shipped: headers.findIndex(h => h === 'tempo de envio'),
        provider: headers.findIndex(h => h === 'opção de envio'),
        city: headers.findIndex(h => h === 'cidade'),
        state: headers.findIndex(h => h === 'uf' || h === 'estado'),
        qty: headers.findIndex(h => h === 'quantidade'),
        returnStatus: headers.findIndex(h => h.includes('status da devolução')),
        cancelReason: headers.findIndex(h => h.includes('motivo') && h.includes('cancelar')),
        feeCom: headers.findIndex(h => h.includes('comissão')),
        feeServ: headers.findIndex(h => h.includes('serviço')),
        feeTrans: headers.findIndex(h => h.includes('transação')),
      };

      if (cols.id === -1 || cols.prod === -1) {
        alert("Planilha inválida. Use a planilha 'Meus Pedidos' da Shopee.");
        return;
      }

      const rawItems = data.slice(1).map((row, index) => {
        if (!row[cols.id]) return null;
        
        const parseMoney = (val) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          let clean = val.toString().replace('R$', '').trim();
          if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
          else if (clean.includes(',')) clean = clean.replace(',', '.');
          return parseFloat(clean) || 0;
        };

        // Formatação de Datas (Shopee vem como string "YYYY-MM-DD HH:MM")
        const parseDate = (val) => val ? new Date(val).toISOString() : null;

        const salePrice = parseMoney(row[cols.price]);
        let fees = 0;
        if (cols.feeCom !== -1) fees += parseMoney(row[cols.feeCom]);
        if (cols.feeServ !== -1) fees += parseMoney(row[cols.feeServ]);
        if (cols.feeTrans !== -1) fees += parseMoney(row[cols.feeTrans]);
        
        let status = 'Concluído';
        if (cols.status !== -1 && row[cols.status]) status = row[cols.status].toString().trim();

        if (status.toLowerCase().includes('cancelado')) fees = 0;
        else if (fees === 0 && salePrice > 0) fees = salePrice * 0.20;

        // SKU Lógica
        let skuKey = '';
        if (cols.skuVar !== -1 && row[cols.skuVar]) skuKey = row[cols.skuVar].toString().trim();
        if (!skuKey && cols.skuMain !== -1 && row[cols.skuMain]) skuKey = row[cols.skuMain].toString().trim();
        if (!skuKey) skuKey = row[cols.prod].toString().trim();
        
        // Custo
        const cleanSku = skuKey.replace(/\s/g, '').toUpperCase();
        let cost = 0;
        const dbKey = Object.keys(productDatabase).find(k => k.replace(/\s/g, '').toUpperCase() === cleanSku);
        if (dbKey) cost = productDatabase[dbKey];

        return {
          order_id: row[cols.id],
          product_name: row[cols.prod],
          sku: skuKey,
          sale_price: salePrice,
          product_cost: cost, 
          shopee_fee: Math.abs(fees), 
          fixed_fee: 0,
          status: status,
          quantity: row[cols.qty] ? parseInt(row[cols.qty]) : 1,
          paid_at: parseDate(row[cols.paid]),
          shipped_at: parseDate(row[cols.shipped]),
          shipping_provider: row[cols.provider],
          city: row[cols.city],
          state: row[cols.state],
          return_status: row[cols.returnStatus],
          cancel_reason: row[cols.cancelReason]
        };
      }).filter(Boolean);

      const summaryMap = {};
      rawItems.forEach(item => {
        if (!summaryMap[item.sku]) {
          summaryMap[item.sku] = { sku: item.sku, count: 0, cost: item.product_cost };
        }
        summaryMap[item.sku].count += 1;
      });

      setUniqueProducts(Object.values(summaryMap));
      setImportedData(rawItems);
    };
    reader.readAsBinaryString(file);
  };

  const handleImportCostChange = (sku, newCost) => {
    setUniqueProducts(prev => prev.map(p => p.sku === sku ? { ...p, cost: newCost } : p));
    setImportedData(prev => prev.map(o => o.sku === sku ? { ...o, product_cost: newCost } : o));
    setProductDatabase(prev => ({...prev, [sku]: newCost}));
  };

  const saveBatch = async () => {
    if (!userId) return;
    try {
      const payload = importedData.map((item) => ({
        user_id: userId,
        ...item,
        fixed_fee: 3.00
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());

      await fetchOrders();
      setShowUploadModal(false);
      setImportedData([]);
      alert("Inteligência atualizada com sucesso!");
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handleUpdateDatabase = (sku, val) => {
    setProductDatabase(prev => ({ ...prev, [sku]: parseFloat(val) || 0 }));
  };

  // --- ANÁLISE E MÉTRICAS AVANÇADAS ---
  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !o.status?.toLowerCase().includes('cancelado'));
    
    // 1. Financeiro Geral
    const totalGross = validOrders.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = validOrders.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    const totalFees = validOrders.reduce((acc, o) => acc + (Number(o.shopee_fee) || 0) + (Number(o.fixed_fee) || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    // 2. Gráfico Diário (Vendas x Pagas x Enviadas)
    const dailyMap = {};
    orders.forEach(o => {
      const day = new Date(o.created_at || Date.now()).toLocaleDateString('pt-BR');
      if (!dailyMap[day]) dailyMap[day] = { name: day, vendas: 0, pagos: 0, enviados: 0, lucro: 0 };
      
      dailyMap[day].vendas += 1;
      if (o.paid_at) dailyMap[day].pagos += 1;
      if (o.shipped_at) dailyMap[day].enviados += 1;
      
      if (!o.status.includes('Cancelado')) {
         const p = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee;
         dailyMap[day].lucro += p;
      }
    });
    // Ordena por data e pega os últimos 14 dias
    const dailyChartData = Object.values(dailyMap)
      .sort((a,b) => new Date(a.name.split('/').reverse().join('-')) - new Date(b.name.split('/').reverse().join('-')))
      .slice(-14);

    // 3. Gargalos (Lucro por Produto)
    const skuAnalysis = {};
    validOrders.forEach(o => {
      if (!skuAnalysis[o.sku]) skuAnalysis[o.sku] = { sku: o.sku, qtd: 0, lucro: 0, faturamento: 0 };
      const profit = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee;
      skuAnalysis[o.sku].qtd += 1;
      skuAnalysis[o.sku].lucro += profit;
      skuAnalysis[o.sku].faturamento += o.sale_price;
    });
    
    const sortedSkus = Object.values(skuAnalysis).sort((a, b) => b.lucro - a.lucro);
    const topWinners = sortedSkus.slice(0, 5);
    const topLosers = sortedSkus.filter(i => i.lucro < 0).sort((a, b) => a.lucro - b.lucro).slice(0, 5);

    // 4. Mapa de Estados
    const stateMap = {};
    validOrders.forEach(o => {
      if(o.state) {
        const uf = o.state.toUpperCase().trim();
        stateMap[uf] = (stateMap[uf] || 0) + 1;
      }
    });
    const stateData = Object.entries(stateMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { totalGross, totalCogs, totalFees, totalProfit, margin, dailyChartData, topWinners, topLosers, stateData };
  }, [orders]);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando CRM...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-orange-500" /> ShopeeFlow <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg not-italic">PRO</span>
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Inteligência Comercial</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={16}/>} label="VISÃO GERAL" />
            <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<Activity size={16}/>} label="GARGALOS & LUCROS" />
            <NavButton active={activeTab === 'costs'} onClick={() => setActiveTab('costs')} icon={<Settings size={16}/>} label="CUSTOS" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowUploadModal(true)} className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all"><Upload size={20} /></button>
          </div>
        </header>

        {/* --- ABA: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Faturamento Líquido" value={analytics.totalGross} color="text-slate-800" icon={<DollarSign size={20}/>} />
              <KpiCard title="Custo Mercadoria" value={analytics.totalCogs} color="text-red-500" icon={<Calculator size={20}/>} />
              <KpiCard title="Taxas Totais" value={analytics.totalFees} color="text-orange-500" icon={<AlertCircle size={20}/>} />
              <KpiCard title="Lucro Líquido" value={analytics.totalProfit} color="text-emerald-600" icon={<TrendingUp size={20}/>} highlight sub={`Margem: ${analytics.margin.toFixed(1)}%`} />
            </div>

            {/* GRÁFICO DIÁRIO */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="font-black text-slate-800 uppercase text-sm">Fluxo Diário de Pedidos</h3>
                   <p className="text-xs text-slate-400">Criados vs. Pagos vs. Enviados (Últimos 14 dias)</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10}/>
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'}}/>
                    <Legend />
                    <Line type="monotone" dataKey="vendas" stroke="#94a3b8" strokeWidth={2} dot={false} name="Criados" />
                    <Line type="monotone" dataKey="pagos" stroke="#10B981" strokeWidth={3} activeDot={{r: 8}} name="Pagos" />
                    <Line type="monotone" dataKey="enviados" stroke="#3B82F6" strokeWidth={2} dot={false} name="Enviados" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* MAPA E LISTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-slate-800 uppercase text-sm mb-4 flex items-center gap-2"><MapPin size={18} className="text-orange-500"/> Top Estados</h3>
                  <div className="space-y-3">
                    {analytics.stateData.map((st, i) => (
                      <div key={st.name} className="flex items-center gap-3">
                        <span className="w-6 font-bold text-slate-400 text-xs">#{i+1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>{st.name}</span>
                            <span>{st.value} vendas</span>
                          </div>
                          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                             <div className="h-full bg-orange-400 rounded-full" style={{width: `${(st.value / analytics.stateData[0].value) * 100}%`}}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl flex flex-col justify-center">
                  <h3 className="font-black text-lg mb-2">Resumo da Operação</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Sua operação tem uma margem média de <span className="text-white font-bold">{analytics.margin.toFixed(1)}%</span>.
                    <br/>
                    Identificamos {analytics.topLosers.length} produtos dando prejuízo direto.
                  </p>
                  <button onClick={() => setActiveTab('analysis')} className="bg-orange-500 text-white font-bold py-3 px-6 rounded-xl w-fit hover:bg-orange-600 transition-all flex items-center gap-2">
                    VER GARGALOS <ArrowUpRight size={18}/>
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* --- ABA: ANÁLISE (GARGALOS) --- */}
        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* PREJUÍZO */}
                <div className="bg-white p-8 rounded-[2rem] border border-red-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowDownRight size={100} className="text-red-500"/></div>
                   <h3 className="font-black text-red-600 uppercase text-xl mb-6 flex items-center gap-2">
                     <AlertCircle/> Gargalos de Prejuízo
                   </h3>
                   <div className="space-y-4">
                     {analytics.topLosers.length === 0 ? <p className="text-slate-400">Nenhum produto com prejuízo encontrado!</p> :
                     analytics.topLosers.map(item => (
                       <div key={item.sku} className="p-4 bg-red-50 rounded-xl border border-red-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{item.sku}</span>
                            <span className="bg-red-200 text-red-800 text-[10px] font-black px-2 py-1 rounded">
                              {item.qtd} vendas
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                             <span className="text-slate-500">Prejuízo Total:</span>
                             <span className="font-black text-red-600">R$ {item.lucro.toFixed(2)}</span>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>

                {/* LUCRO */}
                <div className="bg-white p-8 rounded-[2rem] border border-emerald-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowUpRight size={100} className="text-emerald-500"/></div>
                   <h3 className="font-black text-emerald-600 uppercase text-xl mb-6 flex items-center gap-2">
                     <TrendingUp/> Top Lucrativos
                   </h3>
                   <div className="space-y-4">
                     {analytics.topWinners.map(item => (
                       <div key={item.sku} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{item.sku}</span>
                            <span className="bg-emerald-200 text-emerald-800 text-[10px] font-black px-2 py-1 rounded">
                              {item.qtd} vendas
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                             <span className="text-slate-500">Lucro Total:</span>
                             <span className="font-black text-emerald-600">R$ {item.lucro.toFixed(2)}</span>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>

             {/* GRÁFICO DE LUCRO ACUMULADO */}
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-sm mb-4">Evolução do Lucro (14 Dias)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.dailyChartData}>
                      <defs>
                        <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}}/>
                      <Tooltip/>
                      <Area type="monotone" dataKey="lucro" stroke="#10B981" fillOpacity={1} fill="url(#colorLucro)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </div>
        )}

        {/* --- ABA: CUSTOS (Simples) --- */}
        {activeTab === 'costs' && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-black text-slate-800 uppercase">Custos por SKU</h2>
               <div className="bg-slate-50 p-2 rounded-xl flex items-center border border-slate-100">
                  <Search size={18} className="text-slate-400 ml-2" />
                  <input placeholder="Buscar..." className="bg-transparent outline-none font-bold text-slate-700 text-sm ml-2"
                    onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} />
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(productDatabase)
                .filter(([sku]) => sku.toLowerCase().includes(searchTerm))
                .map(([sku, cost]) => (
                <div key={sku} className="p-4 rounded-2xl border border-slate-100 hover:border-orange-200 bg-white flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-sm truncate max-w-[150px]" title={sku}>{sku}</span>
                  <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-lg">
                    <span className="text-xs font-bold text-slate-400">R$</span>
                    <input type="number" defaultValue={cost} onBlur={(e) => handleUpdateDatabase(sku, e.target.value)}
                      className="w-16 bg-transparent text-right font-black text-emerald-600 outline-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL UPLOAD (Mantido Completo) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic flex items-center gap-2"><Upload/> IMPORTAR SHOPEE</h3>
              <button onClick={() => {setShowUploadModal(false); setImportedData([]);}}><X/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {importedData.length === 0 ? (
                <div className="border-4 border-dashed border-slate-200 rounded-[2rem] h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-all"
                  onClick={() => fileInputRef.current.click()}>
                  <input type="file" hidden ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  <FileText size={48} className="text-slate-300 mb-4"/>
                  <h4 className="text-lg font-black text-slate-700">Clique para selecionar Planilha</h4>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                          <div className="text-xs font-bold text-slate-400 uppercase">Total Pedidos</div>
                          <div className="text-2xl font-black text-slate-800">{importedData.length}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                          <div className="text-xs font-bold text-slate-400 uppercase">Produtos Únicos</div>
                          <div className="text-2xl font-black text-orange-500">{uniqueProducts.length}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                          <div className="text-xs font-bold text-slate-400 uppercase">Ação</div>
                          <button onClick={saveBatch} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm w-full hover:bg-emerald-700">SALVAR</button>
                      </div>
                   </div>
                   <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 uppercase font-black text-slate-400">
                          <tr><th className="p-4">SKU</th><th className="p-4 text-center">Qtd</th><th className="p-4 text-right">Custo</th><th className="p-4 text-center">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {uniqueProducts.map((prod, idx) => (
                            <tr key={idx} className={prod.cost === 0 ? 'bg-red-50/50' : ''}>
                              <td className="p-4 font-bold text-slate-700">{prod.sku}</td>
                              <td className="p-4 text-center font-mono">{prod.count}</td>
                              <td className="p-4 text-right">
                                <input type="number" value={prod.cost} onChange={(e) => handleImportCostChange(prod.sku, parseFloat(e.target.value) || 0)} 
                                  className={`w-24 border p-2 rounded-lg text-right font-bold outline-none ${prod.cost === 0 ? 'border-red-300 text-red-500' : 'border-slate-200 text-emerald-600'}`} />
                              </td>
                              <td className="p-4 text-center">{prod.cost > 0 ? <Check size={16} className="text-emerald-500 inline"/> : 'PENDENTE'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componentes Auxiliares
const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} {label}
  </button>
);

const KpiCard = ({ title, value, icon, color, sub, highlight }) => (
  <div className={`p-6 rounded-[2rem] border ${highlight ? 'bg-white border-emerald-100 ring-4 ring-emerald-50/50' : 'bg-white border-slate-100'} shadow-sm`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 bg-slate-50 rounded-2xl ${color}`}>{icon}</div>
    </div>
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
    <h3 className={`text-2xl font-black ${color} tracking-tight`}>R$ {value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
    {sub && <p className="text-[11px] font-bold text-slate-400 mt-2">{sub}</p>}
  </div>
);
