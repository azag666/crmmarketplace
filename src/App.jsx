import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, FileText, Trash2, Calculator, 
  ArrowUpRight, ArrowDownRight, Plus, Upload, X, Package, Check, 
  Settings, Search, Calendar, Filter, Eye, Edit2, Tag
} from 'lucide-react';

// --- CONFIGURAÇÕES INICIAIS ---
const PRESET_COSTS = {
  "ESTANTE4PRATBANCO": 36.03, "ESTANTE5PRAT": 40.92
};

const STATUS_COLORS = {
  'Concluído': '#10B981', 'A Enviar': '#3B82F6', 'Cancelado': '#EF4444', 
  'Reembolso': '#F59E0B', 'Devolvido': '#F59E0B', 'A Receber': '#3B82F6'
};

export default function App() {
  const [userId, setUserId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | products | detective
  
  // Filtros de Data (Padrão: Últimos 60 dias para garantir que pegue dados)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 60)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Modais
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Dados Importação
  const [importedData, setImportedData] = useState([]); 
  const [uniqueProducts, setUniqueProducts] = useState([]); // Correção para resumo de importação
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

  useEffect(() => { if (userId) fetchOrders(); }, [userId, dateRange]);

  // 3. Atualizar Custo
  const updateProductCost = async (sku, newCost) => {
    if(!confirm(`Atualizar custo do SKU "${sku}" para R$ ${newCost}?`)) return;
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

  // --- CÁLCULOS E INTELIGÊNCIA ---
  const analytics = useMemo(() => {
    // Filtra cancelados para não sujar as métricas financeiras
    const validOrders = orders.filter(o => 
      !o.status?.toLowerCase().includes('cancelado') && 
      !o.status?.toLowerCase().includes('reembolso')
    );
    
    // KPI Gerais
    const totalGross = validOrders.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = validOrders.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    
    // Taxas Totais = Shopee Fees + Taxa Fixa + Cupons Vendedor + Moedas + Frete Reverso
    const totalFees = validOrders.reduce((acc, o) => 
      acc + (Number(o.shopee_fee) || 0) + (Number(o.fixed_fee) || 0) + 
      (Number(o.seller_voucher) || 0) + (Number(o.coins_cashback) || 0) + (Number(o.reverse_shipping_fee) || 0), 0);
      
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    // Gráfico Diário (Baseado na creation_date da Planilha)
    const dailyMap = {};
    orders.forEach(o => {
      // Usa a data da planilha (creation_date) se existir, senão created_at
      const dateRaw = o.creation_date || o.created_at;
      const day = new Date(dateRaw).toLocaleDateString('pt-BR'); 
      
      if (!dailyMap[day]) dailyMap[day] = { name: day.slice(0,5), fullDate: dateRaw, vendas: 0, lucro: 0, faturamento: 0 };
      
      if (!o.status.toLowerCase().includes('cancelado')) {
         dailyMap[day].vendas += 1;
         dailyMap[day].faturamento += Number(o.sale_price);
         // Lucro Individual
         const fees = (Number(o.shopee_fee)||0) + (Number(o.fixed_fee)||0) + (Number(o.seller_voucher)||0) + (Number(o.coins_cashback)||0);
         dailyMap[day].lucro += (o.sale_price - o.product_cost - fees);
      }
    });
    
    const dailyChartData = Object.values(dailyMap)
      .sort((a,b) => new Date(a.fullDate) - new Date(b.fullDate));

    // Análise Técnica de Produtos
    const productStats = {};
    validOrders.forEach(o => {
       const sku = o.sku || 'DESCONHECIDO';
       if(!productStats[sku]) {
         productStats[sku] = { 
           sku: sku, name: o.product_name, qtd: 0, revenue: 0, cost: 0, profit: 0, unitCost: o.product_cost 
         };
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

  // --- IMPORTAÇÃO AVANÇADA ---
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
    
    // Mapeamento Exato da Shopee
    const cols = {
      id: h.findIndex(x => x === 'id do pedido'),
      prod: h.findIndex(x => x === 'nome do produto'),
      skuVar: h.findIndex(x => x === 'número de referência sku'),
      skuMain: h.findIndex(x => x === 'nº de referência do sku principal'),
      price: h.findIndex(x => x === 'preço acordado'),
      status: h.findIndex(x => x === 'status do pedido'),
      created: h.findIndex(x => x === 'data de criação do pedido'),
      paid: h.findIndex(x => x === 'hora do pagamento do pedido'),
      // Taxas e Descontos
      feeCom: h.findIndex(x => x === 'taxa de comissão' || x === 'taxa de comissão bruta'),
      feeServ: h.findIndex(x => x === 'taxa de serviço' || x === 'taxa de serviço bruta'),
      feeTrans: h.findIndex(x => x === 'taxa de transação'),
      sellerVoucher: h.findIndex(x => x === 'cupom do vendedor'),
      coins: h.findIndex(x => x === 'compensar moedas shopee' || x === 'seller absorbed coin cashback'),
      reverseFee: h.findIndex(x => x === 'taxa de envio reversa'),
    };

    if(cols.id === -1) return alert("Planilha inválida ou colunas não encontradas.");

    const processed = data.slice(1).map(row => {
      if(!row[cols.id]) return null;
      
      const parseVal = (v) => {
         if(typeof v === 'number') return v;
         if(!v) return 0;
         return parseFloat(v.toString().replace('R$','').replace(/\./g,'').replace(',','.').trim()) || 0;
      };
      
      const parseDate = (v) => v ? new Date(v).toISOString() : null;

      let sku = row[cols.skuVar] || row[cols.skuMain] || row[cols.prod];
      sku = sku ? sku.toString().trim() : 'SEM SKU';
      
      let cost = productDatabase[sku.replace(/\s/g,'').toUpperCase()] || 0;
      
      // Cálculo de Taxas
      let shopeeFees = 0;
      if(cols.feeCom !== -1) shopeeFees += parseVal(row[cols.feeCom]);
      if(cols.feeServ !== -1) shopeeFees += parseVal(row[cols.feeServ]);
      if(cols.feeTrans !== -1) shopeeFees += parseVal(row[cols.feeTrans]);
      
      // Descontos do Vendedor (Prejuízo)
      const sellerVoucher = cols.sellerVoucher !== -1 ? parseVal(row[cols.sellerVoucher]) : 0;
      const coins = cols.coins !== -1 ? parseVal(row[cols.coins]) : 0;
      const reverseFee = cols.reverseFee !== -1 ? parseVal(row[cols.reverseFee]) : 0;

      const sale = parseVal(row[cols.price]);
      const status = row[cols.status] || 'Concluído';

      // Se cancelado, zera taxas mas mantem registro
      if(status.toLowerCase().includes('cancelado')) {
         shopeeFees = 0;
      } else if(shopeeFees === 0 && sale > 0) {
         // Estimativa de segurança (20%) se a planilha for "Nova" e não tiver taxas ainda
         shopeeFees = sale * 0.20;
      }

      return {
        order_id: row[cols.id], product_name: row[cols.prod], sku, 
        sale_price: sale, product_cost: cost, 
        shopee_fee: Math.abs(shopeeFees), 
        fixed_fee: 0, // Será aplicado 3.00 no salvamento
        seller_voucher: Math.abs(sellerVoucher),
        coins_cashback: Math.abs(coins),
        reverse_shipping_fee: Math.abs(reverseFee),
        status, 
        creation_date: parseDate(row[cols.created]),
        paid_at: parseDate(row[cols.paid])
      };
    }).filter(Boolean);
    
    // Agrupamento para revisão
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
      setUniqueProducts([]);
      alert("Sucesso! Dashboard atualizado com datas da planilha.");
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

        {/* FILTRO DATA */}
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

      {/* TABS */}
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
                   <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Calendar size={18}/> Fluxo Diário (Pela Data da Planilha)</h3>
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

            {/* === PRODUTOS TÉCNICO (Agora Corrigido) === */}
            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-200">
                       <tr>
                         <th className="p-4">SKU</th>
                         <th className="p-4 text-center">Vendas</th>
                         <th className="p-4 text-right">Ticket Médio</th>
                         <th className="p-4 text-right">Margem</th>
                         <th className="p-4 text-right">Lucro Total</th>
                         <th className="p-4 text-right">Custo Unit.</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {analytics.productList.map((prod, idx) => {
                         const ticket = prod.revenue / prod.qtd;
                         const margin = (prod.profit / prod.revenue) * 100;
                         return (
                           <tr key={idx} className="hover:bg-slate-50">
                             <td className="p-4 font-bold text-slate-700">{prod.sku}<div className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">{prod.name}</div></td>
                             <td className="p-4 text-center">{prod.qtd}</td>
                             <td className="p-4 text-right">R$ {ticket.toFixed(2)}</td>
                             <td className="p-4 text-right"><span className={`px-2 py-1 rounded font-bold ${margin > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{margin.toFixed(1)}%</span></td>
                             <td className={`p-4 text-right font-bold ${prod.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {prod.profit.toFixed(2)}</td>
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
                         )
                       })}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* === DETETIVE FINANCEIRO === */}
            {activeTab === 'detective' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-200"><h3 className="font-bold">Lista de Pedidos</h3></div>
                    <div className="overflow-y-auto flex-1 p-2">
                       {orders.filter(o => !o.status.includes('Cancel')).map(o => {
                         const profit = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee - o.seller_voucher - o.coins_cashback;
                         return (
                           <div key={o.order_id} onClick={() => setSelectedOrder(o)} className={`p-3 rounded-lg border mb-2 cursor-pointer hover:bg-slate-50 ${profit < 0 ? 'border-red-100 bg-red-50/30' : 'border-slate-100'}`}>
                              <div className="flex justify-between font-bold text-xs">
                                <span>{o.order_id}</span>
                                <span className={profit < 0 ? 'text-red-500' : 'text-emerald-600'}>R$ {profit.toFixed(2)}</span>
                              </div>
                           </div>
                         )
                       })}
                    </div>
                 </div>

                 <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center">
                    {!selectedOrder ? <div className="text-slate-300 font-bold">Selecione um pedido</div> : (
                      <div className="w-full max-w-md">
                         <h3 className="text-center font-black text-lg mb-6">RAIO-X DO PEDIDO</h3>
                         <div className="space-y-3">
                            <ReciboItem label="Venda Bruta" value={selectedOrder.sale_price} color="text-slate-800" icon={<DollarSign size={14}/>} />
                            <ReciboItem label="Custo Produto" value={-selectedOrder.product_cost} color="text-red-500" icon={<Package size={14}/>} />
                            
                            <div className="my-2 border-t border-dashed border-slate-200"></div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Deduções Shopee</p>
                            <ReciboItem label="Comissão + Serviço" value={-selectedOrder.shopee_fee} color="text-orange-500" icon={<AlertCircle size={14}/>} />
                            <ReciboItem label="Taxa Fixa" value={-selectedOrder.fixed_fee} color="text-orange-500" icon={<Tag size={14}/>} />
                            
                            {(selectedOrder.seller_voucher > 0 || selectedOrder.coins_cashback > 0) && (
                              <>
                                <ReciboItem label="Cupom Vendedor" value={-selectedOrder.seller_voucher} color="text-purple-500" icon={<Tag size={14}/>} />
                                <ReciboItem label="Cashback Moedas" value={-selectedOrder.coins_cashback} color="text-purple-500" icon={<Tag size={14}/>} />
                              </>
                            )}

                            <div className="pt-4 border-t-2 border-slate-100 mt-4 flex justify-between items-center">
                               <span className="font-black uppercase">Lucro Final</span>
                               <span className="text-2xl font-black text-emerald-600">
                                 R$ {(selectedOrder.sale_price - selectedOrder.product_cost - selectedOrder.shopee_fee - selectedOrder.fixed_fee - selectedOrder.seller_voucher - selectedOrder.coins_cashback).toFixed(2)}
                               </span>
                            </div>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL UPLOAD (Mantido Simples) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
           <div className="bg-white p-8 rounded-2xl w-full max-w-lg">
              <h3 className="font-bold mb-4">Importar Planilha Shopee</h3>
              <p className="text-xs text-slate-400 mb-4">Lê todas as taxas (Cupons, Moedas, Frete) e a Data da Planilha.</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="w-full mb-6"/>
              
              {importedData.length > 0 && (
                <div className="mb-6 bg-slate-50 p-4 rounded-xl text-center">
                   <div className="text-2xl font-black text-emerald-600">{importedData.length}</div>
                   <div className="text-xs font-bold uppercase text-slate-400">Pedidos Prontos</div>
                   <div className="mt-2 text-xs text-orange-500 font-bold">{uniqueProducts.length} Produtos Novos Identificados</div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                 <button onClick={()=>{setShowUploadModal(false); setImportedData([])}} className="px-4 py-2 text-slate-400 font-bold text-xs">Cancelar</button>
                 {importedData.length > 0 && (
                   <button onClick={saveBatch} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-xs hover:bg-slate-800">CONFIRMAR IMPORTAÇÃO</button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// COMPONENTES UI
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${active ? 'text-orange-500 border-orange-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
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
