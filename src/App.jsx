import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx'; // Biblioteca para ler Excel
import { 
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, FileText, Trash2, 
  Calculator, ArrowUpRight, Plus, Upload, Save, X 
} from 'lucide-react';

// --- Configuração Supabase ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Estados para importação de planilha
  const [importedData, setImportedData] = useState([]);
  const [defaultCost, setDefaultCost] = useState(0);
  const fileInputRef = useRef(null);

  // --- 1. Autenticação e Dados ---
  useEffect(() => {
    const init = async () => {
      if (!supabase) return setLoading(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
      else {
        const { data } = await supabase.auth.signInAnonymously();
        if (data?.user) setUser(data.user);
      }
      setLoading(false);
    };
    init();

    if(supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    fetchOrders();
    const channel = supabase.channel('realtime').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'closings' }, fetchOrders
    ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase.from('closings').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  // --- 2. Função de Ler Planilha Shopee ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Array de Arrays

      // Tenta identificar colunas pelo cabeçalho (linha 0)
      const headers = data[0].map(h => h?.toString().toLowerCase().trim());
      
      // Mapeamento de colunas comuns da Shopee (PT-BR)
      const idxId = headers.findIndex(h => h.includes('número do pedido') || h.includes('order id'));
      const idxProd = headers.findIndex(h => h.includes('nome do produto') || h.includes('product name'));
      const idxPrice = headers.findIndex(h => h.includes('preço') || h.includes('valor') || h.includes('price'));
      // Shopee às vezes separa taxas, às vezes dá o líquido. Vamos tentar pegar o preço cheio.

      if (idxId === -1 || idxPrice === -1) {
        alert("Não conseguimos identificar as colunas 'Número do Pedido' ou 'Preço'. Verifique se é a planilha correta.");
        return;
      }

      // Processar linhas
      const preview = data.slice(1).map((row, index) => {
        if (!row[idxId]) return null; // Linha vazia

        const salePrice = parseFloat(row[idxPrice]?.toString().replace('R$', '').replace(',', '.') || 0);
        // Shopee cobra ~14% a 20% padrão + R$3 fixo. Vamos estimar se não vier na planilha.
        const estimatedFee = (salePrice * 0.20); 

        return {
          tempId: index,
          order_id: row[idxId],
          product_name: row[idxProd] || 'Produto Desconhecido',
          sale_price: salePrice,
          product_cost: 0, // A planilha Shopee NÃO tem seu custo. Você define isso.
          shopee_fee: estimatedFee,
          fixed_fee: 3.00
        };
      }).filter(Boolean);

      setImportedData(preview);
    };
    reader.readAsBinaryString(file);
  };

  // --- 3. Salvar Lote Importado ---
  const saveBatch = async () => {
    if (!user || !supabase) return;
    
    // Preparar dados para o Supabase
    const payload = importedData.map(item => ({
      user_id: user.id,
      order_id: item.order_id,
      product_name: item.product_name,
      sale_price: item.sale_price,
      product_cost: item.product_cost || defaultCost, // Usa o custo individual ou o padrão
      shopee_fee: item.shopee_fee,
      fixed_fee: item.fixed_fee
    }));

    const { error } = await supabase.from('closings').insert(payload);
    
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setShowUploadModal(false);
      setImportedData([]);
      alert("Sucesso! " + payload.length + " pedidos importados.");
    }
  };

  // --- 4. Lógica Financeira ---
  const metrics = useMemo(() => {
    const totalGross = orders.reduce((acc, o) => acc + (o.sale_price || 0), 0);
    const totalCogs = orders.reduce((acc, o) => acc + (o.product_cost || 0), 0);
    const totalFees = orders.reduce((acc, o) => acc + (o.shopee_fee || 0) + (o.fixed_fee || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;
    return { totalGross, totalCogs, totalFees, totalProfit, margin };
  }, [orders]);

  // Função Auxiliar para deletar
  const deleteOrder = async (id) => {
    if(confirm('Tem certeza?')) await supabase.from('closings').delete().eq('id', id);
  };

  // --- RENDERIZAÇÃO ---
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-orange-500" /> ShopeeFlow
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Painel de Lucro Real</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <Upload size={20} /> IMPORTAR PLANILHA
            </button>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-[#EE4D2D] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-200"
            >
              <Plus size={20} /> MANUAL
            </button>
          </div>
        </header>

        {/* KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Faturamento" value={metrics.totalGross} color="text-slate-800" icon={<DollarSign/>} />
          <KpiCard title="Custo Mercadoria" value={metrics.totalCogs} color="text-red-500" icon={<Calculator/>} />
          <KpiCard title="Taxas Totais" value={metrics.totalFees} color="text-orange-500" icon={<AlertCircle/>} />
          <KpiCard title="Lucro Líquido" value={metrics.totalProfit} color="text-emerald-600" icon={<TrendingUp/>} highlight sub={`Margem: ${metrics.margin.toFixed(1)}%`} />
        </div>

        {/* GRÁFICOS E TABELA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
             <h3 className="font-black text-slate-800 uppercase flex items-center gap-2 mb-4">
              <FileText size={18} className="text-slate-400" /> Histórico ({orders.length})
            </h3>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="pb-4">Pedido</th>
                    <th className="pb-4 text-right">Venda</th>
                    <th className="pb-4 text-right">Custo</th>
                    <th className="pb-4 text-right">Lucro</th>
                    <th className="pb-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map(o => {
                    const profit = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-4">
                          <div className="font-bold">{o.order_id}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{o.product_name}</div>
                        </td>
                        <td className="py-4 text-right font-bold text-slate-600">R$ {o.sale_price.toFixed(2)}</td>
                        <td className="py-4 text-right text-red-400">R$ {o.product_cost.toFixed(2)}</td>
                        <td className={`py-4 text-right font-black ${profit > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          R$ {profit.toFixed(2)}
                        </td>
                        <td className="py-4 text-center">
                          <button onClick={() => deleteOrder(o.id)}><Trash2 size={16} className="text-slate-300 hover:text-red-500"/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orders.slice(0,10).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                  <XAxis dataKey="order_id" hide />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="sale_price" fill="#EE4D2D" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE IMPORTAÇÃO (DRAG AND DROP) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic flex items-center gap-2"><Upload/> IMPORTAR DA SHOPEE</h3>
              <button onClick={() => {setShowUploadModal(false); setImportedData([]);}}><X/></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {importedData.length === 0 ? (
                <div 
                  className="border-4 border-dashed border-slate-200 rounded-3xl p-12 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => fileInputRef.current.click()}
                >
                  <input type="file" hidden ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  <FileText size={64} className="mx-auto text-slate-300 mb-4" />
                  <h4 className="text-xl font-bold text-slate-700">Clique para selecionar sua Planilha</h4>
                  <p className="text-slate-400 mt-2">Suporta .xlsx da Central do Vendedor Shopee</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-yellow-600" />
                      <div className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> A planilha da Shopee não informa o seu Custo (CMV).
                        <br/>Defina um custo padrão para preencher tudo de uma vez:
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">Custo Padrão: R$</span>
                      <input 
                        type="number" 
                        value={defaultCost} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDefaultCost(val);
                          setImportedData(prev => prev.map(p => ({...p, product_cost: val})));
                        }}
                        className="w-24 p-2 rounded-lg border border-yellow-300 font-bold"
                      />
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 uppercase font-black text-slate-500">
                      <tr>
                        <th className="p-3">Pedido</th>
                        <th className="p-3">Produto</th>
                        <th className="p-3 text-right">Venda</th>
                        <th className="p-3 text-right text-red-500">Custo (Editável)</th>
                        <th className="p-3 text-right">Lucro Previsto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedData.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-50">
                          <td className="p-3 font-mono">{row.order_id}</td>
                          <td className="p-3 truncate max-w-[200px]">{row.product_name}</td>
                          <td className="p-3 text-right font-bold">R$ {row.sale_price.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <input 
                              type="number" 
                              value={row.product_cost}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const newData = [...importedData];
                                newData[idx].product_cost = val;
                                setImportedData(newData);
                              }} 
                              className="w-20 bg-slate-100 p-1 rounded text-right font-bold text-red-500"
                            />
                          </td>
                          <td className="p-3 text-right font-black text-emerald-600">
                            R$ {(row.sale_price - row.product_cost - row.shopee_fee - row.fixed_fee).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {importedData.length > 0 && (
              <div className="p-6 border-t bg-slate-50 flex justify-end">
                <button 
                  onClick={saveBatch}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-xl"
                >
                  <Save size={20} /> CONFIRMAR E SALVAR {importedData.length} PEDIDOS
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MANUAL (Mantido igual) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4"><X/></button>
            <h2 className="text-2xl font-black mb-6">Novo Fechamento Manual</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              await supabase.from('closings').insert([{
                user_id: user.id,
                order_id: fd.get('order_id'),
                product_name: fd.get('product_name'),
                sale_price: fd.get('sale_price'),
                product_cost: fd.get('product_cost'),
                shopee_fee: parseFloat(fd.get('sale_price')) * 0.20, // Est. 20%
                fixed_fee: 3.00
              }]);
              setShowModal(false);
            }} className="space-y-4">
              <input name="order_id" placeholder="ID Pedido" className="w-full p-3 bg-slate-100 rounded-lg" required/>
              <input name="product_name" placeholder="Produto" className="w-full p-3 bg-slate-100 rounded-lg" required/>
              <div className="grid grid-cols-2 gap-4">
                <input name="sale_price" type="number" step="0.01" placeholder="Venda (R$)" className="p-3 bg-slate-100 rounded-lg" required/>
                <input name="product_cost" type="number" step="0.01" placeholder="Custo (R$)" className="p-3 bg-slate-100 rounded-lg" required/>
              </div>
              <button className="w-full bg-[#EE4D2D] text-white py-4 rounded-xl font-bold">SALVAR</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const KpiCard = ({ title, value, icon, color, sub, highlight }) => (
  <div className={`p-6 rounded-3xl border ${highlight ? 'bg-white border-emerald-100 ring-4 ring-emerald-50/50' : 'bg-white border-slate-100'} shadow-sm`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 bg-slate-50 rounded-xl ${color}`}>{icon}</div>
    </div>
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
    <h3 className={`text-2xl font-black ${color}`}>R$ {value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
    {sub && <p className="text-xs font-bold text-slate-400 mt-1">{sub}</p>}
  </div>
);
