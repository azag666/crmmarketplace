import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import FinancialDetective from './components/FinancialDetective';
import { Upload, X, Package, Search, TrendingUp, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function App() {
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [importedData, setImportedData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('idle'); // idle, processing, success, error
  const [importMessage, setImportMessage] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  // Autenticação simples
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // Processamento inteligente da planilha Shopee com offset
  const processShopeeSheet = (workbook) => {
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Encontrar linha do cabeçalho "ID do pedido"
    let headerRow = -1;
    for (let row = 0; row <= range.s.r; row += 11) { // Verificar a cada 10 linhas (performance)
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cellValue = worksheet[cellAddress]?.v;
      if (cellValue && cellValue.toString().toLowerCase().includes('id do pedido')) {
        headerRow = row;
        break;
      }
    }
    
    // Se não encontrar, usar linha 11 (padrão Shopee)
    if (headerRow === -1) {
      headerRow = 11; // Linha 12 (index 11)
    }
    
    console.log(`[SHOPEE] Cabeçalho encontrado na linha ${headerRow + 1}`);
    
    // Converter para JSON começando da linha do cabeçalho
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      range: headerRow,
      header: 1,
      defval: ''
    });
    
    return jsonData;
  };

  // Mapeamento preciso de colunas da planilha Shopee
  const mapShopeeColumns = (headers) => {
    const normalizedHeaders = headers.map(h => h?.toString().toLowerCase().trim());
    
    return {
      order_id: normalizedHeaders.findIndex(h => h === 'id do pedido'),
      product_name: normalizedHeaders.findIndex(h => h === 'nome do produto'),
      sku: normalizedHeaders.findIndex(h => h === 'número de referência sku'),
      sku_main: normalizedHeaders.findIndex(h => h === 'nº de referência do sku principal'),
      sale_price: normalizedHeaders.findIndex(h => h === 'valor total'),
      status: normalizedHeaders.findIndex(h => h === 'status do pedido'),
      creation_date: normalizedHeaders.findIndex(h => h === 'data de criação do pedido'),
      
      // Taxas Shopee (precisão cirúrgica)
      commission_fee: normalizedHeaders.findIndex(h => h.includes('comissão')),
      service_fee: normalizedHeaders.findIndex(h => h.includes('serviço')),
      transaction_fee: normalizedHeaders.findIndex(h => h.includes('transação')),
      
      // Marketing Vendedor
      seller_voucher: normalizedHeaders.findIndex(h => h === 'cupom do vendedor'),
      shopee_voucher: normalizedHeaders.findIndex(h => h === 'cupom shopee'),
      coins_cashback: normalizedHeaders.findIndex(h => h.includes('moedas') || h.includes('coin')),
      
      // Custos de Envio
      reverse_shipping_fee: normalizedHeaders.findIndex(h => h.includes('envio reversa')),
      shipping_cost: normalizedHeaders.findIndex(h => h.includes('frete')),
      
      // Valor Líquido (para conciliação)
      net_payout: normalizedHeaders.findIndex(h => h.includes('valor receber') || h.includes('repasse'))
    };
  };

  // Processamento de importação com precisão cirúrgica
  const processImportData = (data) => {
    if (!data?.length || data.length < 2) {
      setImportStatus('error');
      setImportMessage('Planilha vazia ou formato inválido. Verifique se a planilha contém dados.');
      return;
    }

    const headers = data[0];
    const columns = mapShopeeColumns(headers);
    
    // Validação crítica
    if (columns.order_id === -1) {
      setImportStatus('error');
      setImportMessage('Coluna "ID do pedido" não encontrada. Verifique se esta é uma planilha exportada da Shopee.');
      return;
    }

    if (columns.sale_price === -1) {
      setImportStatus('error');
      setImportMessage('Coluna "Valor total" não encontrada. Verifique se esta é uma planilha completa da Shopee.');
      return;
    }

    console.log('[SHOPEE] Mapeamento de colunas:', columns);

    const processed = data.slice(1).map((row, index) => {
      if (!row[columns.order_id]) return null;

      try {
        // Funções de parsing robustas
        const parseMoney = (value) => {
          if (typeof value === 'number') return value;
          if (!value) return 0;
          const cleanValue = value.toString()
            .replace('R$', '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim();
          return parseFloat(cleanValue) || 0;
        };

        const parseDate = (value) => {
          if (!value) return null;
          if (typeof value === 'number') {
            return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString();
          }
          const date = new Date(value);
          return isNaN(date) ? null : date.toISOString();
        };

        // Extrair dados financeiros com precisão
        const salePrice = parseMoney(row[columns.sale_price]);
        const commissionFee = parseMoney(row[columns.commission_fee]);
        const serviceFee = parseMoney(row[columns.service_fee]);
        const transactionFee = parseMoney(row[columns.transaction_fee]);
        const sellerVoucher = parseMoney(row[columns.seller_voucher]);
        const shopeeVoucher = parseMoney(row[columns.shopee_voucher]);
        const coinsCashback = parseMoney(row[columns.coins_cashback]);
        const reverseShippingFee = parseMoney(row[columns.reverse_shipping_fee]);
        const shippingCost = parseMoney(row[columns.shipping_cost]);
        const netPayout = parseMoney(row[columns.net_payout]);

        // Calcular total de taxas
        const totalFees = commissionFee + serviceFee + transactionFee + 
                         sellerVoucher + shopeeVoucher + coinsCashback + 
                         reverseShippingFee + shippingCost;

        // Validar valor líquido
        const calculatedNetPayout = salePrice - totalFees;
        if (netPayout > 0 && Math.abs(netPayout - calculatedNetPayout) > 0.01) {
          console.warn(`[SHOPEE] Divergência no pedido ${row[columns.order_id]}: Net Payout informado=${netPayout}, calculado=${calculatedNetPayout}`);
        }

        // SKU do produto
        let sku = row[columns.sku] || row[columns.sku_main] || 'SEM SKU';
        sku = sku.toString().trim().toUpperCase().replace(/\s/g, '');

        return {
          order_id: row[columns.order_id],
          product_name: row[columns.product_name] || 'Produto não identificado',
          sku: sku,
          sale_price: salePrice,
          status: row[columns.status] || 'Concluído',
          creation_date: parseDate(row[columns.creation_date]),
          
          // Dados financeiros precisos
          commission_fee: commissionFee,
          service_fee: serviceFee,
          transaction_fee: transactionFee,
          seller_voucher: sellerVoucher,
          shopee_voucher: shopeeVoucher,
          coins_cashback: coinsCashback,
          reverse_shipping_fee: reverseShippingFee,
          shipping_cost: shippingCost,
          net_payout: netPayout || calculatedNetPayout,
          total_fees: totalFees,
          
          quantity: 1,
          raw_data: row // Manter dados brutos para auditoria
        };
      } catch (error) {
        console.error(`[SHOPEE] Erro processando linha ${index + 2}:`, error);
        return null;
      }
    }).filter(Boolean);

    console.log(`[SHOPEE] Processados ${processed.length} pedidos válidos de ${data.length - 1} linhas`);

    if (processed.length === 0) {
      setImportStatus('error');
      setImportMessage('Nenhum pedido válido encontrado na planilha. Verifique o formato dos dados.');
      return;
    }

    setProcessedData(processed);
    setImportStatus('success');
    setImportMessage(`${processed.length} pedidos processados com sucesso!`);
    
    // Estatísticas
    const totalRevenue = processed.reduce((sum, o) => sum + o.sale_price, 0);
    const totalFees = processed.reduce((sum, o) => sum + o.total_fees, 0);
    const totalNet = processed.reduce((sum, o) => sum + o.net_payout, 0);
    
    setImportSummary({
      total_orders: processed.length,
      gross_revenue: totalRevenue,
      total_fees: totalFees,
      net_payout: totalNet,
      avg_ticket: totalRevenue / processed.length,
      date_range: {
        start: processed.reduce((min, o) => o.creation_date && o.creation_date < min ? o.creation_date : min, processed[0]?.creation_date),
        end: processed.reduce((max, o) => o.creation_date && o.creation_date > max ? o.creation_date : max, processed[0]?.creation_date)
      }
    });
  };

  // Upload de arquivo com processamento inteligente
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validação de arquivo
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setImportStatus('error');
      setImportMessage('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setImportStatus('processing');
    setImportMessage('Processando planilha...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        
        // Processar planilha Shopee com offset inteligente
        const jsonData = processShopeeSheet(workbook);
        processImportData(jsonData);
      } catch (error) {
        console.error('[UPLOAD] Erro processando arquivo:', error);
        setImportStatus('error');
        setImportMessage('Erro ao processar o arquivo. Verifique se não está corrompido.');
      }
    };
    reader.onerror = () => {
      setImportStatus('error');
      setImportMessage('Erro ao ler o arquivo. Tente novamente.');
    };
    reader.readAsBinaryString(file);
  };

  // Importação para o backend
  const handleImport = async () => {
    if (processedData.length === 0) {
      alert('Nenhum dado para importar. Por favor, selecione uma planilha primeiro.');
      return;
    }

    setIsProcessing(true);
    setImportStatus('processing');
    setImportMessage('Salvando dados no sistema...');

    try {
      const batchId = crypto.randomUUID();
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          orders: processedData,
          importBatchId: batchId,
          platform: 'SHOPEE'
        })
      });

      const result = await response.json();

      if (response.ok) {
        setImportStatus('success');
        setImportMessage(`✅ ${result.summary.successful} pedidos importados com sucesso!`);
        
        if (result.summary.failed > 0) {
          setImportMessage(prev => prev + ` ⚠️ ${result.summary.failed} pedidos com erros.`);
        }

        setImportSummary(result.summary);
        
        // Limpar dados e fechar modal após sucesso
        setTimeout(() => {
          setImportedData([]);
          setProcessedData([]);
          setShowUploadModal(false);
          setIsProcessing(false);
          
          // Recarregar dashboard
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(result.error || 'Erro na importação');
      }
    } catch (error) {
      console.error('[IMPORT] Erro:', error);
      setImportStatus('error');
      setImportMessage(`❌ Erro na importação: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Limpar dados locais
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
        {activeTab === 'detective' && <FinancialDetective userId={userId} />}
      </main>

      {/* Import Modal - Profissional */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Importação Inteligente Shopee</h2>
                  <p className="text-gray-600 mt-1">
                    Processamento automático com detecção de cabeçalho e cálculos precisos
                  </p>
                </div>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Planilha da Shopee
                </h3>
                <p className="text-gray-600 mb-4">
                  Arraste a planilha ou clique para selecionar (.xlsx ou .xls)
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  O sistema detectará automaticamente o cabeçalho "ID do pedido"
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={isProcessing}
                />
                <label 
                  htmlFor="file-upload"
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg cursor-pointer inline-block transition-colors"
                >
                  Selecionar Planilha
                </label>
              </div>

              {/* Status Messages */}
              {importStatus !== 'idle' && (
                <div className={`mt-6 p-4 rounded-lg flex items-center ${
                  importStatus === 'success' ? 'bg-green-50 text-green-800' :
                  importStatus === 'error' ? 'bg-red-50 text-red-800' :
                  'bg-blue-50 text-blue-800'
                }`}>
                  {importStatus === 'success' && <CheckCircle className="mr-2" size={20} />}
                  {importStatus === 'error' && <AlertCircle className="mr-2" size={20} />}
                  {importStatus === 'processing' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                  )}
                  <span className="font-medium">{importMessage}</span>
                </div>
              )}

              {/* Import Summary */}
              {importSummary && (
                <div className="mt-6 bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Resumo da Importação</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Pedidos</p>
                      <p className="text-lg font-bold">{importSummary.total_orders}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Faturamento</p>
                      <p className="text-lg font-bold">R$ {importSummary.gross_revenue?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Taxas</p>
                      <p className="text-lg font-bold">R$ {importSummary.total_fees?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Líquido</p>
                      <p className="text-lg font-bold">R$ {importSummary.net_payout?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {processedData.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-900">
                      Pré-visualização ({processedData.length} pedidos)
                    </h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setProcessedData([]);
                          setImportStatus('idle');
                          setImportMessage('');
                          setImportSummary(null);
                        }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                        disabled={isProcessing}
                      >
                        Limpar
                      </button>
                      <button 
                        onClick={handleImport}
                        disabled={isProcessing || importStatus === 'error'}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                      >
                        {isProcessing && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        {isProcessing ? 'Processando...' : 'Importar Dados'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Pedido</th>
                          <th className="text-left p-2">Produto</th>
                          <th className="text-right p-2">Valor</th>
                          <th className="text-right p-2">Taxas</th>
                          <th className="text-right p-2">Líquido</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-white">
                            <td className="p-2 font-mono text-xs">{row.order_id}</td>
                            <td className="p-2 truncate max-w-xs" title={row.product_name}>
                              {row.product_name}
                            </td>
                            <td className="p-2 text-right font-medium">R$ {row.sale_price.toFixed(2)}</td>
                            <td className="p-2 text-right text-red-600">-R$ {row.total_fees.toFixed(2)}</td>
                            <td className="p-2 text-right font-medium text-green-600">R$ {row.net_payout.toFixed(2)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                row.status.includes('Concluído') ? 'bg-green-100 text-green-800' :
                                row.status.includes('Cancelado') ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {processedData.length > 20 && (
                      <p className="text-center text-gray-500 mt-2 text-sm">
                        ... e mais {processedData.length - 20} pedidos
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
