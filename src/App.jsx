import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, 
  FileText, Trash2, Calculator, ArrowUpRight, 
  Plus, Upload, X, ChevronRight, Package, Check, Settings, Search
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const [importedData, setImportedData] = useState([]); 
  const [uniqueProducts, setUniqueProducts] = useState([]);
  const [productDatabase, setProductDatabase] = useState(PRESET_COSTS);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef(null);

  // 1. Gerenciar "Sessão" (Simples UUID local para MVP)
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // 2. Buscar Pedidos via API
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Erro ao buscar API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchOrders();
  }, [userId]);

  // 3. Processar Arquivo (Prioridade SKU Variação)
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
      
      const idxId = headers.findIndex(h => h === 'id do pedido');
      const idxProd = headers.findIndex(h => h === 'nome do produto');
      const idxSkuVariation = headers.findIndex(h => h === 'número de referência sku');
      const idxSkuMain = headers.findIndex(h => h === 'nº de referência do sku principal');
      const idxPrice = headers.findIndex(h => h === 'preço acordado'); 
      const idxStatus = headers.findIndex(h => h === 'status do pedido');
      
      const idxFeeCom = headers.findIndex(h => h.includes('comissão'));
      const idxFeeServ = headers.findIndex(h => h.includes('serviço'));
      const idxFeeTrans = headers.findIndex(h => h.includes('transação'));

      if (idxId === -1 || idxProd === -1) {
        alert("Colunas obrigatórias não encontradas.");
        return;
      }

      const rawItems = data.slice(1).map((row, index) => {
        if (!row[idxId]) return null;
        
        const parseMoney = (val) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          let clean = val.toString().replace('R$', '').trim();
          if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
          else if (clean.includes(',')) clean = clean.replace(',', '.');
          return parseFloat(clean) || 0;
        };

        const salePrice = parseMoney(row[idxPrice]);
        let fees = 0;
        if (idxFeeCom !== -1) fees += parseMoney(row[idxFeeCom]);
        if (idxFeeServ !== -1) fees += parseMoney(row[idxFeeServ]);
        if (idxFeeTrans !== -1) fees += parseMoney(row[idxFeeTrans]);
        
        let status = 'Concluído';
        if (idxStatus !== -1 && row[idxStatus]) status = row[idxStatus].toString().trim();

        if (status.toLowerCase().includes('cancelado')) fees = 0;
        else if (fees === 0 && salePrice > 0) fees = salePrice * 0.20;

        let skuKey = '';
        if (idxSkuVariation !== -1 && row[idxSkuVariation]) skuKey = row[idxSkuVariation].toString().trim();
        if (!skuKey && idxSkuMain !== -1 && row[idxSkuMain]) skuKey = row[idxSkuMain].toString().trim();
        if (!skuKey) skuKey = row[idxProd].toString().trim();
        
        const cleanSku = skuKey.replace(/\s/g, '').toUpperCase();
        let cost = 0;
        const dbKey = Object.keys(productDatabase).find(k => k.replace(/\s/g, '').toUpperCase() === cleanSku);
        if (dbKey) cost = productDatabase[dbKey];

        return {
          order_id: row[idxId],
          product_name: row[idxProd],
          sku: skuKey,
          sale_price: salePrice,
          product_cost: cost, 
          shopee_fee: Math.abs(fees), 
          fixed_fee: 0,
          status: status
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

  // 4. Salvar via API
  const saveBatch = async () => {
    if (!userId) return;
    try {
      const payload = importedData.map((item) => ({
        user_id: userId,
        order_id: item.order_id,
        product_name: item.product_name,
        sku: item.sku,
        sale_price: item.sale_price,
        product_cost: item.product_cost,
        shopee_fee: item.shopee_fee,
        fixed_fee: 3.00,
        status: item.status
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
      alert("Sucesso! Dashboard atualizado.");
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  // --- Métricas ---
  const metrics = useMemo(() => {
    const validOrders = orders.filter(o => 
      !o.status?.toLowerCase().includes('cancelado') && 
      !o.status?.toLowerCase().includes('reembolso')
    );

    const totalGross = validOrders.reduce((acc, o) => acc + (Number(o.sale_price) || 0), 0);
    const totalCogs = validOrders.reduce((acc, o) => acc + (Number(o.product_cost) || 0), 0);
    const totalFees = validOrders.reduce((acc, o) => acc + (Number(o.shopee_fee) || 0) + (Number(o.fixed_fee) || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

    const statusCount = orders.reduce((acc, o) => {
      const st = o.status || 'Concluído';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});

    return { totalGross, totalCogs, totalFees, totalProfit, margin, statusCount };
  }, [orders]);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-orange-500" /> ShopeeFlow
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Painel de Lucro Real</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
              <TrendingUp size={16} /> DASHBOARD
            </button>
            <button onClick={() => setActiveTab('costs')} className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 ${activeTab === 'costs' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
              <Package size={16} /> CUSTOS
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowUploadModal(true)} className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg hover:bg-emerald-700"><Upload size={20} /></button>
            <button onClick={() => setShowModal(true)} className="bg-[#EE4D2D] text-white p-3 rounded-xl shadow-lg hover:bg-[#d44326]"><Plus size={20} /></button>
          </div>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Faturamento Líquido" value={metrics.totalGross} color="text-slate-800" icon={<DollarSign size={20}/>} />
              <KpiCard title="Custo Mercadoria" value={metrics.totalCogs} color="text-red-500" icon={<Calculator size={20}/>} />
              <KpiCard title="Taxas Totais" value={metrics.totalFees} color="text-orange-500" icon={<AlertCircle size={20}/>} />
              <KpiCard title="Lucro Líquido" value={metrics.totalProfit} color="text-emerald-600" icon={<TrendingUp size={20}/>} highlight sub={`Margem: ${metrics.margin.toFixed(1)}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                 <h3 className="font-black text-slate-800 uppercase text-sm mb-4">Status</h3>
                 <div className="space-y-3">
                   {Object.entries(metrics.statusCount).map(([status, count]) => (
                     <div key={status} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <span className="font-bold text-sm text-slate-600 flex items-center gap-2">
                           <div className={`w-3 h-3 rounded-full`} style={{backgroundColor: STATUS_COLORS[status] || '#94A3B8'}}></div>
                           {status}
                        </span>
                        <span className="font-black text-slate-800">{count}</span>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-500 p-2 rounded-xl"><ArrowUpRight size={20} className="text-white" /></div>
                  <h4 className="font-black text-sm uppercase tracking-widest">Performance (Válidos)</h4>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orders.filter(o => !o.status?.includes('Cancelado')).slice(0,15).reverse()}>
                      <Bar dataKey="sale_price" fill="#EE4D2D" radius={[4,4,4,4]} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{background: '#1e293b', border: 'none', color: '#fff'}}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* TABELA DE PEDIDOS */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6">
              <h3 className="font-black text-slate-800 uppercase flex items-center gap-2 text-sm mb-6">
                <FileText size={18} className="text-slate-400" /> Detalhe dos Pedidos
              </h3>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      <th className="pb-4 pl-4">Pedido</th>
                      <th className="pb-4 text-center">Status</th>
                      <th className="pb-4 text-right">Venda</th>
                      <th className="pb-4 text-right text-red-400">Custo</th>
                      <th className="pb-4 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orders.map(o => {
                      const profit = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee;
                      const isCancelled = o.status?.toLowerCase().includes('cancelado');
                      return (
                        <tr key={o.order_id} className={isCancelled ? 'opacity-50 grayscale' : ''}>
                          <td className="py-4 pl-4">
                            <div className="font-bold text-slate-700">{o.order_id}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px] font-bold uppercase">{o.product_name}</div>
                          </td>
                          <td className="py-4 text-center">
                              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase text-white" 
                                    style={{backgroundColor: STATUS_COLORS[o.status] || '#94A3B8'}}>
                                {o.status}
                              </span>
                          </td>
                          <td className="py-4 text-right font-bold text-slate-600">R$ {Number(o.sale_price).toFixed(2)}</td>
                          <td className="py-4 text-right text-red-400 font-medium">R$ {Number(o.product_cost).toFixed(2)}</td>
                          <td className={`py-4 text-right font-black ${profit > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            R$ {profit.toFixed(2)}
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

        {/* ABA CUSTOS */}
        {activeTab === 'costs' && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-black text-slate-800 uppercase">Custos por SKU</h2>
               <div className="bg-slate-50 p-2 rounded-xl flex items-center border border-slate-100">
                  <Search size={18} className="text-slate-400 ml-2" />
                  <input placeholder="Buscar SKU..." className="bg-transparent outline-none font-bold text-slate-700 text-sm ml-2"
                    onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} />
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(productDatabase)
                .filter(([sku]) => sku.toLowerCase().includes(searchTerm))
                .map(([sku, cost]) => (
                <div key={sku} className="p-4 rounded-2xl border border-slate-100 hover:border-orange-200 transition-all bg-white">
                  <p className="font-bold text-slate-700 text-sm truncate" title={sku}>{sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-slate-400">Custo:</span>
                    <span className="text-emerald-600 font-black">R$ {cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL UPLOAD */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic flex items-center gap-2"><Upload/> IMPORTAR</h3>
              <button onClick={() => {setShowUploadModal(false); setImportedData([]);}}><X/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {importedData.length === 0 ? (
                <div className="border-4 border-dashed border-slate-200 rounded-[2rem] h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-all"
                  onClick={() => fileInputRef.current.click()}>
                  <input type="file" hidden ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  <FileText size={48} className="text-slate-300 mb-4"/>
                  <h4 className="text-lg font-black text-slate-700">Clique para selecionar Planilha Shopee</h4>
                </div>
              ) : (
                <div className="space-y-6">
                   {/* RESUMO */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                          <div className="text-xs font-bold text-slate-400 uppercase">Total</div>
                          <div className="text-2xl font-black text-slate-800">{importedData.length}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                          <div className="text-xs font-bold text-slate-400 uppercase">Faturamento</div>
                          <div className="text-2xl font-black text-emerald-600">
                            R$ {importedData.reduce((acc, i) => acc + (i.status.includes('Cancel') ? 0 : i.sale_price), 0).toFixed(0)}
                          </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                          <div className="text-xs font-bold text-slate-400 uppercase">Produtos Únicos</div>
                          <div className="text-2xl font-black text-orange-500">{uniqueProducts.length}</div>
                      </div>
                   </div>

                   {/* TABELA REVISÃO */}
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
                                <input type="number" value={prod.cost}
                                  onChange={(e) => handleImportCostChange(prod.sku, parseFloat(e.target.value) || 0)} 
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
            {importedData.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button onClick={() => setImportedData([])} className="px-6 py-4 font-bold text-slate-400">Cancelar</button>
                <button onClick={saveBatch} className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-black shadow-xl">CONFIRMAR E SALVAR</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
