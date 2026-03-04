import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { Upload, X, Package, Search, TrendingUp, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

// PRESET_COSTS do sistema original
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [importedData, setImportedData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Autenticação simples
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // Processamento de importação (mantido do sistema original)
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
      created: h.findIndex(x => x === 'data de criação do pedido' || x === 'data de criação'),
      
      feeCom: h.findIndex(x => x.includes('comissão')),
      feeServ: h.findIndex(x => x.includes('serviço')),
      feeTrans: h.findIndex(x => x.includes('transação')),
      
      sellerVoucher: h.findIndex(x => x === 'cupom do vendedor'),
      shopeeVoucher: h.findIndex(x => x === 'cupom shopee'),
      coins: h.findIndex(x => x.includes('moedas') || x.includes('coin')),
      reverseFee: h.findIndex(x => x.includes('envio reversa')),
    };

    if(cols.id === -1) return alert("Planilha inválida. Verifique se a coluna 'ID do Pedido' existe.");

    const processed = data.slice(1).map(row => {
      if(!row[cols.id]) return null;
      
      const parseVal = (v) => {
        if(typeof v === 'number') return v;
        if(!v) return 0;
        return parseFloat(v.toString().replace('R$','').replace(/\./g,'').replace(',','.').trim()) || 0;
      };
      
      const parseDate = (v) => {
        if (!v) return null;
        if (typeof v === 'number') {
          return new Date(Math.round((v - 25569)*86400*1000)).toISOString();
        }
        let d = new Date(v);
        if (!isNaN(d)) return d.toISOString();
        return null;
      };

      let sku = row[cols.skuVar] || row[cols.skuMain] || row[cols.prod];
      sku = sku ? sku.toString().trim().toUpperCase().replace(/\s/g, '') : 'SEM SKU';
      
      // Cálculo de custo individual por pedido
      let cost = 0;
      if (PRESET_COSTS[sku]) {
        cost = PRESET_COSTS[sku];
      } else {
        const skuKeys = Object.keys(PRESET_COSTS);
        const foundSku = skuKeys.find(key => 
          key.includes(sku) || sku.includes(key) || 
          key.replace(/\s/g, '').toUpperCase() === sku
        );
        cost = foundSku ? PRESET_COSTS[foundSku] : 0;
      }
      
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
      
      if(status.toLowerCase().includes('cancelado')) { 
        shopeeFees = 0; 
      } else if(shopeeFees === 0 && sale > 0) { 
        shopeeFees = sale * 0.20; 
      }
      
      const totalFees = Math.abs(shopeeFees) + Math.abs(sellerVoucher) + Math.abs(coins) + Math.abs(reverseFee);
      const individualProfit = sale - cost - totalFees;
      
      const creationDate = parseDate(row[cols.created]);

      return {
        order_id: row[cols.id], 
        product_name: row[cols.prod], 
        sku: sku, 
        sale_price: sale, 
        product_cost: cost, 
        shopee_fee: Math.abs(shopeeFees), 
        fixed_fee: 3.00,
        seller_voucher: Math.abs(sellerVoucher),
        shopee_voucher: Math.abs(shopeeVoucher),
        coins_cashback: Math.abs(coins),
        reverse_shipping_fee: Math.abs(reverseFee),
        status: status, 
        creation_date: creationDate,
        quantity: 1,
        shipping_rebate: 0,
        service_fee: 0,
        transaction_fee: 0,
        individual_profit: individualProfit,
        total_fees: totalFees
      };
    }).filter(Boolean);
    
    setProcessedData(processed);
    return processed;
  };

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

  const handleImport = () => {
    if (processedData.length === 0) {
      alert('Nenhum dado para importar. Por favor, selecione uma planilha primeiro.');
      return;
    }
    
    setIsProcessing(true);
    
    // Simular processamento e salvamento
    setTimeout(() => {
      // Salvar no localStorage para persistência
      const existingData = JSON.parse(localStorage.getItem(`shopeeflow_orders_${userId}`) || '[]');
      const newData = [...existingData, ...processedData];
      localStorage.setItem(`shopeeflow_orders_${userId}`, JSON.stringify(newData));
      
      setImportedData([]);
      setProcessedData([]);
      setShowUploadModal(false);
      setIsProcessing(false);
      
      alert('Dados importados com sucesso!');
      
      // Forçar reload do dashboard
      window.location.reload();
    }, 2000);
  };

  const handleClearData = () => {
    if (!userId) return;
    if (!confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
    
    localStorage.removeItem(`shopeeflow_orders_${userId}`);
    alert('Dados limpos com sucesso!');
    window.location.reload();
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando ShopeeFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="bg-orange-500 p-2 rounded-lg text-white mr-3">
                <TrendingUp size={20} />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                ShopeeFlow <span className="text-orange-500">PRO</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Upload size={16} />
                Importar Dados
              </button>
              
              <button 
                onClick={handleClearData}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                Limpar Dados
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <TrendingUp size={16} className="mr-2" />
                Dashboard
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'products'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Package size={16} className="mr-2" />
                Produtos
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('detective')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'detective'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Search size={16} className="mr-2" />
                Detetive
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard userId={userId} />}
        {activeTab === 'products' && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Módulo de Produtos</h3>
            <p className="mt-1 text-sm text-gray-500">Em desenvolvimento...</p>
          </div>
        )}
        {activeTab === 'detective' && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Detetive Financeiro</h3>
            <p className="mt-1 text-sm text-gray-500">Em desenvolvimento...</p>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Importar Planilha de Vendas</h2>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-gray-600 mt-2">
                Selecione a planilha exportada da Shopee para importar os dados de vendas.
              </p>
            </div>
            
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">
                  Arraste a planilha ou clique para selecionar
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload"
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg cursor-pointer inline-block transition-colors"
                >
                  Selecionar Arquivo
                </label>
              </div>
              
              {processedData.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">
                      Pré-visualização ({processedData.length} registros)
                    </h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setProcessedData([]);
                          setImportedData([]);
                        }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        Limpar
                      </button>
                      <button 
                        onClick={handleImport}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? 'Processando...' : 'Importar Dados'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left p-2">Pedido</th>
                          <th className="text-left p-2">Produto</th>
                          <th className="text-right p-2">Valor</th>
                          <th className="text-right p-2">Custo</th>
                          <th className="text-right p-2">Lucro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">{row.order_id}</td>
                            <td className="p-2 truncate max-w-xs">{row.product_name}</td>
                            <td className="p-2 text-right">R$ {row.sale_price.toFixed(2)}</td>
                            <td className="p-2 text-right">R$ {row.product_cost.toFixed(2)}</td>
                            <td className={`p-2 text-right ${row.individual_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              R$ {row.individual_profit.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {processedData.length > 10 && (
                      <p className="text-center text-gray-500 mt-2">
                        ... e mais {processedData.length - 10} registros
                      </p>
                    )}
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
