import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import FinancialDetective from './components/FinancialDetective';
import ProductAnalytics from './components/ProductAnalytics';
import { Upload, X, Package, Search, TrendingUp, AlertCircle, CheckCircle, Calendar, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

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
  const [headerRowFound, setHeaderRowFound] = useState(null);

  // Autenticação simples
  useEffect(() => {
    let storedId = localStorage.getItem('shopeeflow_user_id');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('shopeeflow_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  // Detecção dinâmica do cabeçalho "ID do pedido"
  const findHeaderRow = (worksheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const maxRow = Math.min(range.e.r, 20); // Limitar às primeiras 20 linhas para performance
    
    console.log('[DETECÇÃO] Procurando cabeçalho "ID do pedido" nas primeiras 20 linhas...');
    
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cellValue = worksheet[cellAddress]?.v;
        
        if (cellValue && typeof cellValue === 'string') {
          const cleanValue = cellValue.toString().trim().toLowerCase();
          
          // Verificar padrões exatos e flexíveis
          if (cleanValue === 'id do pedido' || 
              cleanValue.includes('id do pedido') ||
              cleanValue === 'id pedido' ||
              cleanValue.includes('order id') ||
              cleanValue.includes('pedido')) {
            
            console.log(`[DETECÇÃO] Cabeçalho encontrado na linha ${row + 1}: "${cellValue}"`);
            setHeaderRowFound(row + 1);
            return row;
          }
        }
      }
    }
    
    // Se não encontrar, usar linha 11 (padrão Shopee Relatórios Financeiros)
    console.log('[DETECÇÃO] Cabeçalho não encontrado, usando linha 12 (padrão Shopee)');
    setHeaderRowFound(12);
    return 11;
  };

  // Sanitização de nomes de colunas
  const sanitizeColumnName = (name) => {
    if (!name) return '';
    return name.toString()
      .trim()
      .replace(/[^\w\s\u00C0-\u017F]/g, '') // Remove caracteres especiais, mantendo acentos
      .replace(/\s+/g, ' ') // Normaliza espaços
      .toLowerCase();
  };

  // Mapeamento preciso de colunas da planilha Shopee (baseado no orders.csv)
  const mapShopeeColumns = (headers) => {
    const normalizedHeaders = headers.map(h => sanitizeColumnName(h));
    
    console.log('[MAPEAMENTO] Colunas normalizadas:', normalizedHeaders);
    
    const mapping = {
      // Identificação
      order_id: normalizedHeaders.findIndex(h => 
        h === 'id do pedido' || h.includes('id do pedido') || h === 'order id'
      ),
      
      // Produto
      product_name: normalizedHeaders.findIndex(h => 
        h === 'nome do produto' || h.includes('produto') || h === 'product name'
      ),
      sku_variation: normalizedHeaders.findIndex(h => 
        h === 'número de referência sku' || h.includes('sku') || h === 'sku'
      ),
      
      // Financeiro - Venda
      sale_price: normalizedHeaders.findIndex(h => 
        h === 'preço acordado' || h.includes('preço') || h.includes('valor')
      ),
      
      // Financeiro - Taxas Shopee
      commission_fee: normalizedHeaders.findIndex(h => 
        h === 'taxa de comissão bruta' || h.includes('comissão') || h.includes('commission')
      ),
      service_fee: normalizedHeaders.findIndex(h => 
        h === 'taxa de serviço bruta' || h.includes('serviço') || h.includes('service')
      ),
      transaction_fee: normalizedHeaders.findIndex(h => 
        h === 'taxa de transação' || h.includes('transação') || h.includes('transaction')
      ),
      
      // Financeiro - Marketing Vendedor
      seller_voucher: normalizedHeaders.findIndex(h => 
        h === 'cupom do vendedor' || h.includes('cupom do vendedor') || h.includes('seller voucher')
      ),
      seller_coin_cashback: normalizedHeaders.findIndex(h => 
        h === 'seller absorbed coin cashback' || 
        h === 'compensar moedas shopee' || 
        h.includes('coin') || h.includes('moedas')
      ),
      
      // Financeiro - Logística
      reverse_shipping_fee: normalizedHeaders.findIndex(h => 
        h === 'taxa de envio reversa' || h.includes('envio reversa') || h.includes('reverse')
      ),
      
      // Datas
      created_at_platform: normalizedHeaders.findIndex(h => 
        h === 'data de criação do pedido' || h.includes('criação') || h.includes('created')
      ),
      paid_at: normalizedHeaders.findIndex(h => 
        h === 'hora do pagamento do pedido' || h.includes('pagamento') || h.includes('paid')
      ),
      
      // Status
      status: normalizedHeaders.findIndex(h => 
        h === 'status do pedido' || h.includes('status') || h === 'order status'
      )
    };

    console.log('[MAPEAMENTO] Índices das colunas:', mapping);
    
    // Validação crítica
    if (mapping.order_id === -1) {
      throw new Error('Coluna "ID do pedido" não encontrada. Verifique se esta é uma planilha exportada da Shopee.');
    }
    
    if (mapping.sale_price === -1) {
      throw new Error('Coluna "Preço acordado" não encontrada. Verifique se esta é uma planilha completa da Shopee.');
    }

    return mapping;
  };

  // Tratamento robusto de datas
  const parseDate = (value) => {
    if (!value) return null;
    
    try {
      // 1. Excel Serial Date (números)
      if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return isNaN(date) ? null : date.toISOString();
      }
      
      // 2. String formatos conhecidos
      const dateStr = value.toString().trim();
      
      // YYYY-MM-DD
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(dateStr).toISOString();
      }
      
      // DD/MM/YYYY ou DD/MM/YY
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{2,4}$/)) {
        const parts = dateStr.split('/');
        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[0]);
        const date = new Date(year, month, day);
        return isNaN(date) ? null : date.toISOString();
      }
      
      // DD-MM-YYYY ou DD-MM-YY
      if (dateStr.match(/^\d{2}-\d{2}-\d{2,4}$/)) {
        const parts = dateStr.split('-');
        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[0]);
        const date = new Date(year, month, day);
        return isNaN(date) ? null : date.toISOString();
      }
      
      // Tentar parse genérico
      const date = new Date(dateStr);
      return isNaN(date) ? null : date.toISOString();
      
    } catch (error) {
      console.warn('[DATA] Erro ao parsear data:', value, error);
      return null;
    }
  };

  // Processamento de importação com precisão empresarial
  const processImportData = (data, headerRow) => {
    if (!data?.length || data.length < 2) {
      setImportStatus('error');
      setImportMessage('Planilha vazia ou formato inválido. Verifique se a planilha contém dados.');
      return;
    }

    // Usar apenas os dados a partir da linha do cabeçalho
    const relevantData = data.slice(headerRow);
    const headers = relevantData[0];
    const columns = mapShopeeColumns(headers);

    console.log('[PROCESSAMENTO] Iniciando processamento com', relevantData.length - 1, 'linhas de dados');

    const processed = relevantData.slice(1).map((row, index) => {
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

        // Extrair dados financeiros com precisão
        const salePrice = parseMoney(row[columns.sale_price]);
        const commissionFee = parseMoney(row[columns.commission_fee]);
        const serviceFee = parseMoney(row[columns.service_fee]);
        const transactionFee = parseMoney(row[columns.transaction_fee]);
        const sellerVoucher = parseMoney(row[columns.seller_voucher]);
        const sellerCoinCashback = parseMoney(row[columns.seller_coin_cashback]);
        const reverseShippingFee = parseMoney(row[columns.reverse_shipping_fee]);

        // Validação de valor mínimo
        if (salePrice <= 0) {
          console.warn(`[PROCESSAMENTO] Ignorando pedido ${row[columns.order_id]} com valor zero ou negativo`);
          return null;
        }

        // SKU do produto
        let sku = row[columns.sku_variation] || 'SEM SKU';
        sku = sku.toString().trim().toUpperCase().replace(/\s/g, '');

        return {
          order_id: row[columns.order_id],
          product_name: row[columns.product_name] || 'Produto não identificado',
          sku_variation: sku,
          sale_price: salePrice,
          status: row[columns.status] || 'Concluído',
          created_at_platform: parseDate(row[columns.created_at_platform]),
          paid_at: parseDate(row[columns.paid_at]),
          
          // Taxas Shopee (precisão contábil)
          commission_fee: commissionFee,
          service_fee: serviceFee,
          transaction_fee: transactionFee,
          
          // Marketing Vendedor
          seller_voucher: sellerVoucher,
          seller_coin_cashback: sellerCoinCashback,
          
          // Logística Reversa
          reverse_shipping_fee: reverseShippingFee,
          
          quantity: 1,
          raw_data: row // Manter dados brutos para auditoria
        };
      } catch (error) {
        console.error(`[PROCESSAMENTO] Erro processando linha ${headerRow + index + 2}:`, error);
        return null;
      }
    }).filter(Boolean);

    console.log(`[PROCESSAMENTO] Processados ${processed.length} pedidos válidos de ${relevantData.length - 1} linhas`);

    if (processed.length === 0) {
      setImportStatus('error');
      setImportMessage('Nenhum pedido válido encontrado na planilha. Verifique o formato dos dados.');
      return;
    }

    setProcessedData(processed);
    setImportStatus('success');
    setImportMessage(`✅ ${processed.length} pedidos processados com sucesso! (Cabeçalho: Linha ${headerRow + 1})`);
    
    // Estatísticas detalhadas
    const totalRevenue = processed.reduce((sum, o) => sum + o.sale_price, 0);
    const totalFees = processed.reduce((sum, o) => sum + 
      (o.commission_fee || 0) + (o.service_fee || 0) + (o.transaction_fee || 0) +
      (o.seller_voucher || 0) + (o.seller_coin_cashback || 0) + (o.reverse_shipping_fee || 0), 0);
    
    setImportSummary({
      total_orders: processed.length,
      header_row: headerRow + 1,
      gross_revenue: totalRevenue,
      total_fees: totalFees,
      net_payout: totalRevenue - totalFees,
      avg_ticket: totalRevenue / processed.length,
      date_range: {
        start: processed.reduce((min, o) => o.created_at_platform && o.created_at_platform < min ? o.created_at_platform : min, processed[0]?.created_at_platform),
        end: processed.reduce((max, o) => o.created_at_platform && o.created_at_platform > max ? o.created_at_platform : max, processed[0]?.created_at_platform)
      },
      status_breakdown: processed.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {})
    });
  };

  // Upload de arquivo com detecção blindada
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
    setImportMessage('Analisando estrutura da planilha...');
    setHeaderRowFound(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        
        setImportMessage('Detectando cabeçalho...');
        
        // Detecção dinâmica do cabeçalho
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const headerRow = findHeaderRow(worksheet);
        
        setImportMessage('Processando dados...');
        
        // Converter para JSON começando da linha do cabeçalho
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          range: headerRow,
          header: 1,
          defval: ''
        });
        
        processImportData(jsonData, 0); // headerRow já aplicado no range
        
      } catch (error) {
        console.error('[UPLOAD] Erro processando arquivo:', error);
        setImportStatus('error');
        setImportMessage('Erro ao processar o arquivo: ' + error.message);
      }
    };
    reader.onerror = () => {
      setImportStatus('error');
      setImportMessage('Erro ao ler o arquivo. Tente novamente.');
    };
    reader.readAsBinaryString(file);
  };

  // Importação para o backend (versão local para desenvolvimento)
  const handleImport = async () => {
    if (processedData.length === 0) {
      alert('Nenhum dado para importar. Por favor, selecione uma planilha primeiro.');
      return;
    }

    setIsProcessing(true);
    setImportStatus('processing');
    setImportMessage('Salvando dados no sistema...');

    try {
      // Simular processamento da API localmente
      const batchId = crypto.randomUUID();
      
      // Aplicar lógica empresarial local
      const processedOrders = processedData.map(order => {
        // Calcular taxas totais
        const totalFees = (order.commission_fee || 0) + (order.service_fee || 0) + 
                         (order.transaction_fee || 0) + (order.seller_voucher || 0) +
                         (order.seller_coin_cashback || 0) + (order.reverse_shipping_fee || 0);
        
        // Calcular lucro bruto
        const grossProfit = order.sale_price - totalFees - (order.product_cost || 0);
        
        // Aplicar regras empresariais
        let netProfit = grossProfit;
        let processingNotes = 'Venda normal';
        
        if (order.status === 'Cancelado') {
          if (order.reverse_shipping_fee > 0 || totalFees > 0) {
            netProfit = -(order.reverse_shipping_fee + totalFees);
            processingNotes = 'Cancelado com custos não estornados';
          } else {
            netProfit = 0;
            processingNotes = 'Cancelado sem custos';
          }
        } else if (order.status === 'Devolução/Reembolso') {
          netProfit = -((order.product_cost || 0) + order.reverse_shipping_fee + totalFees);
          processingNotes = 'Devolução/Reembolso - prejuízo total';
        }
        
        return {
          ...order,
          total_fees: totalFees,
          gross_profit: grossProfit,
          net_profit: netProfit,
          processing_notes: processingNotes,
          id: crypto.randomUUID(),
          imported_at: new Date().toISOString()
        };
      });

      // Salvar no localStorage
      const existingData = JSON.parse(localStorage.getItem(`shopeeflow_orders_${userId}`) || '[]');
      
      // Verificar duplicatas
      const newOrders = processedOrders.filter(newOrder => 
        !existingData.some(existing => existing.order_id === newOrder.order_id)
      );
      
      const duplicateCount = processedOrders.length - newOrders.length;
      const allData = [...existingData, ...newOrders];
      
      localStorage.setItem(`shopeeflow_orders_${userId}`, JSON.stringify(allData));
      
      // Simular resposta da API
      const result = {
        success: true,
        summary: {
          total: processedData.length,
          successful: newOrders.length,
          failed: 0,
          duplicates: duplicateCount,
          errors: []
        },
        processed_orders: newOrders
      };

      setImportStatus('success');
      setImportMessage(`✅ ${result.summary.successful} pedidos importados com sucesso!`);
      
      if (result.summary.duplicates > 0) {
        setImportMessage(prev => prev + ` ℹ️ ${result.summary.duplicates} pedidos duplicados ignorados.`);
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
          <p className="mt-4 text-gray-600">Carregando ShopeeFlow Enterprise...</p>
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
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  ShopeeFlow <span className="text-orange-500">Enterprise</span>
                </h1>
                <p className="text-xs text-gray-500">CRM Empresarial com Inteligência de Produtos</p>
              </div>
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
        {activeTab === 'products' && <ProductAnalytics userId={userId} />}
        {activeTab === 'detective' && <FinancialDetective userId={userId} />}
      </main>

      {/* Import Modal - Enterprise */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Importação Enterprise Shopee</h2>
                  <p className="text-gray-600 mt-1">
                    Detecção automática de estrutura com precisão contábil
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
                  Planilha Shopee (Order.all...xlsx)
                </h3>
                <p className="text-gray-600 mb-4">
                  Arraste a planilha ou clique para selecionar (.xlsx ou .xls)
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• Detecção automática: "Order.all" (Linha 0) ou "Relatórios Financeiros" (Linha 12)</p>
                  <p>• Mapeamento preciso: Preço acordado, Taxas, Cupons, Envio Reverso</p>
                  <p>• Tratamento de datas: Excel Serial, YYYY-MM-DD, DD/MM/YYYY</p>
                </div>
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
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg cursor-pointer inline-block transition-colors mt-4"
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
                  <div>
                    <span className="font-medium">{importMessage}</span>
                    {headerRowFound && (
                      <p className="text-sm mt-1">Cabeçalho detectado na linha {headerRowFound}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Import Summary Enterprise */}
              {importSummary && (
                <div className="mt-6 bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Resumo da Importação</h4>
                  
                  {/* KPIs Principais */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Pedidos</p>
                      <p className="text-lg font-bold">{importSummary.total_orders}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Faturamento</p>
                      <p className="text-lg font-bold">R$ {importSummary.gross_revenue?.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Taxas</p>
                      <p className="text-lg font-bold text-red-600">R$ {importSummary.total_fees?.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Líquido</p>
                      <p className="text-lg font-bold text-green-600">R$ {importSummary.net_payout?.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Ticket Médio</p>
                      <p className="text-lg font-bold">R$ {importSummary.avg_ticket?.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Gráfico de Status */}
                  {importSummary.status_breakdown && (
                    <div className="mb-6">
                      <h5 className="font-medium text-gray-900 mb-3">Distribuição por Status</h5>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={Object.entries(importSummary.status_breakdown).map(([status, count]) => ({
                          status,
                          count
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="status" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#f97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Informações Adicionais */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Linha do Cabeçalho:</span>
                      <span className="ml-2 font-medium">{importSummary.header_row}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Período:</span>
                      <span className="ml-2 font-medium">
                        {importSummary.date_range?.start ? 
                          new Date(importSummary.date_range.start).toLocaleDateString('pt-BR') : 
                          'N/A'
                        } a {
                          importSummary.date_range?.end ? 
                          new Date(importSummary.date_range.end).toLocaleDateString('pt-BR') : 
                          'N/A'
                        }
                      </span>
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
                          setHeaderRowFound(null);
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
                          <th className="text-left p-2">SKU</th>
                          <th className="text-right p-2">Valor</th>
                          <th className="text-right p-2">Taxas</th>
                          <th className="text-right p-2">Líquido</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.slice(0, 20).map((row, idx) => {
                          const totalFees = (row.commission_fee || 0) + (row.service_fee || 0) + 
                                           (row.transaction_fee || 0) + (row.seller_voucher || 0) + 
                                           (row.seller_coin_cashback || 0) + (row.reverse_shipping_fee || 0);
                          const netPayout = row.sale_price - totalFees;
                          
                          return (
                            <tr key={idx} className="border-b hover:bg-white">
                              <td className="p-2 font-mono text-xs">{row.order_id}</td>
                              <td className="p-2 truncate max-w-xs" title={row.product_name}>
                                {row.product_name}
                              </td>
                              <td className="p-2 font-mono text-xs">{row.sku_variation}</td>
                              <td className="p-2 text-right font-medium">R$ {row.sale_price.toFixed(2)}</td>
                              <td className="p-2 text-right text-red-600">-R$ {totalFees.toFixed(2)}</td>
                              <td className="p-2 text-right font-medium text-green-600">R$ {netPayout.toFixed(2)}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  row.status.includes('Concluído') ? 'bg-green-100 text-green-800' :
                                  row.status.includes('Cancelado') ? 'bg-red-100 text-red-800' :
                                  row.status.includes('Devolução') ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="p-2 text-xs">
                                {row.created_at_platform ? 
                                  new Date(row.created_at_platform).toLocaleDateString('pt-BR') : 
                                  'N/A'
                                }
                              </td>
                            </tr>
                          );
                        })}
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
