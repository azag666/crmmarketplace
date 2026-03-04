import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, DollarSign, AlertCircle, 
  FileText, Trash2, Calculator, ArrowUpRight, 
  Plus, Upload, Save, X, ChevronRight
} from 'lucide-react';

// --- Inicialização do Supabase ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Estados para importação
  const [importedData, setImportedData] = useState([]);
  const [defaultCost, setDefaultCost] = useState(0);
  const fileInputRef = useRef(null);

  // --- 1. Autenticação ---
  useEffect(() => {
    const checkUser = async () => {
      if (!supabase) {
        setErrorMsg("Erro: Chaves do Supabase não configuradas na Vercel.");
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setUser(session.user);
        else {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          if (data?.user) setUser(data.user);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Erro de conexão com banco de dados.");
      } finally {
        setLoading(false);
      }
    };
    checkUser();

    if(supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // --- 2. Dados em Tempo Real ---
  useEffect(() => {
    if (!user || !supabase) return;

    const fetchOrders = async () => {
      const { data } = await supabase.from('closings').select('*').order('created_at', { ascending: false });
      if (data) setOrders(data);
    };
    fetchOrders();

    const channel = supabase.channel('realtime').on('postgres_changes', 
      { event: '*', schema: 'public', table: 'closings' }, fetchOrders
    ).subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // --- 3. Lógica de Importação de Excel (Shopee Format) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (!data || data.length === 0) return;

      // Normaliza cabeçalhos para encontrar as colunas
      const headers = data[0].map(h => h?.toString().toLowerCase().trim());
      
      // Mapeamento exato da Planilha Shopee
      const idxId = headers.findIndex(h => h === 'id do pedido');
      const idxProd = headers.findIndex(h => h === 'nome do produto');
      // "Preço acordado" é o valor real da venda após descontos do vendedor
      const idxPrice = headers.findIndex(h => h === 'preço acordado' || h === 'preço original');
      
      // Colunas de taxas (para somar o custo total da Shopee)
      const idxFeeComissao = headers.findIndex(h => h.includes('taxa de comissão'));
      const idxFeeServico = headers.findIndex(h => h.includes('taxa de serviço'));
      const idxFeeTransacao = headers.findIndex(h => h.includes('taxa de transação'));

      if (idxId === -1 || idxProd === -1) {
        alert("Erro: Não encontramos as colunas 'ID do pedido' ou 'Nome do Produto'. Verifique se é a planilha oficial da Shopee.");
        return;
      }

      const preview = data.slice(1).map((row, index) => {
        if (!row[idxId]) return null;
        
        // Função auxiliar para limpar valores monetários (ex: "R$ 1.200,00" ou 1200.00)
        const parseMoney = (val) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          // Se for string, remove R$ e converte
          let clean = val.toString().replace('R$', '').trim();
          // Se tiver vírgula e ponto, assume formato BR (1.000,00) -> 1000.00
          if (clean.includes(',') && clean.includes('.')) {
             clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (clean.includes(',')) {
             clean = clean.replace(',', '.');
          }
          return parseFloat(clean) || 0;
        };

        const salePrice = parseMoney(row[idxPrice]);
        
        // Soma todas as taxas da Shopee que estiverem disponíveis na linha
        let totalShopeeFees = 0;
        if (idxFeeComissao !== -1) totalShopeeFees += parseMoney(row[idxFeeComissao]);
        if (idxFeeServico !== -1) totalShopeeFees += parseMoney(row[idxFeeServico]);
        if (idxFeeTransacao !== -1) totalShopeeFees += parseMoney(row[idxFeeTransacao]);

        // Se por acaso as taxas vierem zeradas na planilha (ex: pedido novo), estima 20%
        if (totalShopeeFees === 0 && salePrice > 0) {
           totalShopeeFees = salePrice * 0.20; 
        }

        return {
          id: index,
          order_id: row[idxId],
          product_name: row[idxProd],
          sale_price: salePrice,
          product_cost: 0, // Usuário preenche
          shopee_fee: totalShopeeFees, 
          fixed_fee: 0 // Já somamos tudo no shopee_fee para ser exato
        };
      }).filter(Boolean);

      setImportedData(preview);
    };
    reader.readAsBinaryString(file);
  };

  const saveBatch = async () => {
    if (!user || !supabase) return;
    
    const payload = importedData.map(item => ({
      user_id: user.id,
      order_id: item.order_id,
      product_name: item.product_name,
      sale_price: item.sale_price,
      product_cost: item.product_cost || defaultCost,
      shopee_fee: item.shopee_fee,
      fixed_fee: item.fixed_fee
    }));

    const { error } = await supabase.from('closings').insert(payload);
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setShowUploadModal(false);
      setImportedData([]);
      alert(`Sucesso! ${payload.length} pedidos importados.`);
    }
  };

  // --- 4. Métricas e Ações ---
  const metrics = useMemo(() => {
    const totalGross = orders.reduce((acc, o) => acc + (o.sale_price || 0), 0);
    const totalCogs = orders.reduce((acc, o) => acc + (o.product_cost || 0), 0);
    const totalFees = orders.reduce((acc, o) => acc + (o.shopee_fee || 0) + (o.fixed_fee || 0), 0);
    const totalProfit = totalGross - totalCogs - totalFees;
    const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;
    return { totalGross, totalCogs, totalFees, totalProfit, margin };
  }, [orders]);

  const deleteOrder = async (id) => {
    if (confirm("Excluir este registro?")) {
      await supabase.from('closings').delete().eq('id', id);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans p-4 md:p-8">
      {errorMsg && <div className="bg-red-500 text-white p-3 text-center font-bold mb-4 rounded-xl">{errorMsg}</div>}
      
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-orange-500" /> ShopeeFlow
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Painel de Lucro Real</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <Upload size={20} /> IMPORTAR PLANILHA
            </button>
            <button 
              onClick={() => setShowModal(true)}
              className="flex-1 md:flex-none bg-[#EE4D2D] text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#d44326] transition-all shadow-lg shadow-orange-200"
            >
              <Plus size={20} /> MANUAL
            </button>
          </div>
        </header>

        {/* CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Faturamento" value={metrics.totalGross} color="text-slate-800" icon={<DollarSign size={20}/>} />
          <KpiCard title="Custo Mercadoria" value={metrics.totalCogs} color="text-red-500" icon={<Calculator size={20}/>} />
          <KpiCard title="Taxas Shopee" value={metrics.totalFees} color="text-orange-500" icon={<AlertCircle size={20}/>} />
          <KpiCard title="Lucro Líquido" value={metrics.totalProfit} color="text-emerald-600" icon={<TrendingUp size={20}/>} highlight sub={`Margem: ${metrics.margin.toFixed(1)}%`} />
        </div>

        {/* TABELA E GRÁFICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-black text-slate-800 uppercase flex items-center gap-2 text-sm tracking-wide">
                <FileText size={18} className="text-slate-400" /> Histórico ({orders.length})
              </h3>
             </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="pb-4 pl-4">Pedido</th>
                    <th className="pb-4 text-right">Venda</th>
                    <th className="pb-4 text-right">Taxas</th>
                    <th className="pb-4 text-right">Lucro</th>
                    <th className="pb-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map(o => {
                    const profit = o.sale_price - o.product_cost - o.shopee_fee - o.fixed_fee;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 pl-4">
                          <div className="font-bold text-slate-700">{o.order_id}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px] font-bold uppercase">{o.product_name}</div>
                        </td>
                        <td className="py-4 text-right font-bold text-slate-600">R$ {o.sale_price.toFixed(2)}</td>
                        <td className="py-4 text-right text-xs text-orange-500 font-bold">- R$ {(o.shopee_fee + o.fixed_fee).toFixed(2)}</td>
                        <td className={`py-4 text-right font-black ${profit > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          R$ {profit.toFixed(2)}
                        </td>
                        <td className="py-4 text-center">
                          <button onClick={() => deleteOrder(o.id)}><Trash2 size={16} className="text-slate-300 hover:text-red-500 transition-colors"/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm h-[320px]">
              <h3 className="font-black text-slate-800 mb-4 uppercase text-xs tracking-widest">Últimas Vendas</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orders.slice(0,15).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                  <XAxis dataKey="order_id" hide />
                  <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="sale_price" fill="#EE4D2D" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-500 p-2 rounded-xl"><ArrowUpRight size={20} className="text-white" /></div>
                <h4 className="font-black text-sm uppercase tracking-widest">Performance</h4>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-4 font-medium">
                Sua margem ideal deve ser acima de 20%. Ajuste seus custos se necessário.
              </p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.min(metrics.margin * 2, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE UPLOAD */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black italic flex items-center gap-2"><Upload/> IMPORTAR SHOPEE</h3>
                <p className="text-emerald-100 text-xs font-bold mt-1 uppercase tracking-widest">Leitura automática de taxas</p>
              </div>
              <button onClick={() => {setShowUploadModal(false); setImportedData([]);}} className="hover:bg-emerald-500 p-2 rounded-lg transition-colors"><X/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {importedData.length === 0 ? (
                <div 
                  className="border-4 border-dashed border-slate-200 rounded-[2rem] h-64 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white hover:border-emerald-400 transition-all group"
                  onClick={() => fileInputRef.current.click()}
                >
                  <input type="file" hidden ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  <div className="bg-slate-100 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><FileText size={40} className="text-slate-400 group-hover:text-emerald-500" /></div>
                  <h4 className="text-lg font-black text-slate-700">Clique para selecionar</h4>
                  <p className="text-slate-400 text-sm mt-1 font-medium">Use a planilha "Meus Pedidos" da Shopee</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* CONFIGURAÇÃO DE CUSTO */}
                  <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4">
                      <div className="bg-yellow-100 p-3 rounded-xl h-fit"><AlertCircle className="text-yellow-600" /></div>
                      <div>
                        <h4 className="font-black text-yellow-800 text-sm uppercase">Definir Custo do Produto (CMV)</h4>
                        <p className="text-yellow-700 text-xs mt-1">Preencha um custo padrão para aplicar a todos, ou edite linha por linha.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-yellow-200 shadow-sm">
                      <span className="font-bold text-slate-400 text-xs uppercase pl-2">R$</span>
                      <input 
                        type="number" 
                        value={defaultCost} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDefaultCost(val);
                          setImportedData(prev => prev.map(p => ({...p, product_cost: val})));
                        }}
                        className="w-24 p-2 rounded-lg font-black text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  {/* TABELA DE PRÉVIA */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase font-black text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="p-4">Pedido</th>
                          <th className="p-4">Produto</th>
                          <th className="p-4 text-right">Venda</th>
                          <th className="p-4 text-right text-orange-500">Taxas</th>
                          <th className="p-4 text-right text-red-400">Custo</th>
                          <th className="p-4 text-right">Lucro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {importedData.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-4 font-mono font-bold text-slate-600">{row.order_id}</td>
                            <td className="p-4 truncate max-w-[150px] font-medium">{row.product_name}</td>
                            <td className="p-4 text-right font-bold">R$ {row.sale_price.toFixed(2)}</td>
                            <td className="p-4 text-right text-orange-500 font-bold">- R$ {row.shopee_fee.toFixed(2)}</td>
                            <td className="p-4 text-right">
                              <input 
                                type="number" 
                                value={row.product_cost}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newData = [...importedData];
                                  newData[idx].product_cost = val;
                                  setImportedData(newData);
                                }} 
                                className="w-20 bg-slate-50 p-2 rounded-lg text-right font-bold text-red-500 border focus:border-red-300 outline-none"
                              />
                            </td>
                            <td className="p-4 text-right font-black text-emerald-600">
                              R$ {(row.sale_price - row.product_cost - row.shopee_fee).toFixed(2)}
                            </td>
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
                <button onClick={() => setImportedData([])} className="px-6 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                <button 
                  onClick={saveBatch}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-transform active:scale-95"
                >
                  <Save size={20} /> SALVAR {importedData.length} PEDIDOS
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MANUAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={20}/></button>
            <div className="mb-8">
              <h2 className="text-2xl font-black italic text-slate-800">LANÇAMENTO</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Manual</p>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const sale = parseFloat(fd.get('sale_price'));
              const { error } = await supabase.from('closings').insert([{
                user_id: user.id,
                order_id: fd.get('order_id'),
                product_name: fd.get('product_name'),
                sale_price: sale,
                product_cost: parseFloat(fd.get('product_cost')),
                shopee_fee: sale * 0.20, // Estimativa manual
                fixed_fee: 3.00
              }]);
              if(!error) setShowModal(false);
              else alert(error.message);
            }} className="space-y-5">
              
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-400 ml-2">ID Pedido</label>
                <input name="order_id" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200" required/>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-400 ml-2">Produto</label>
                <input name="product_name" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200" required/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-2">Venda (R$)</label>
                  <input name="sale_price" type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-orange-200" required/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 ml-2">Custo (R$)</label>
                  <input name="product_cost" type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-red-500 outline-none focus:ring-2 focus:ring-red-200" required/>
                </div>
              </div>

              <button className="w-full bg-[#EE4D2D] text-white py-5 rounded-2xl font-black hover:bg-[#d44326] transition-all shadow-xl shadow-orange-100 active:scale-95 mt-2">CONFIRMAR LANÇAMENTO</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const KpiCard = ({ title, value, icon, color, sub, highlight }) => (
  <div className={`p-6 rounded-[2rem] border ${highlight ? 'bg-white border-emerald-100 ring-4 ring-emerald-50/50' : 'bg-white border-slate-100'} shadow-sm hover:shadow-md transition-all`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 bg-slate-50 rounded-2xl ${color}`}>{icon}</div>
      <ChevronRight size={16} className="text-slate-200" />
    </div>
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
    <h3 className={`text-2xl font-black ${color} tracking-tight`}>R$ {value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
    {sub && <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{sub}</p>}
  </div>
);
