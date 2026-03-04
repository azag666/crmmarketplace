import React, { useState, useEffect } from 'react';
import { Search, Eye, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

export default function FinancialDetective({ userId }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Buscar pedidos do localStorage ou API
      const storedOrders = JSON.parse(localStorage.getItem(`shopeeflow_orders_${userId}`) || '[]');
      setOrders(storedOrders);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      // Em produção, buscar da API
      const order = orders.find(o => o.id === orderId || o.order_id === orderId);
      setSelectedOrder(order);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    }
  };

  const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value, total) => {
    if (!total || total === 0) return '0.0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Filtrar pedidos
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'profit' && order.individual_profit > 0) ||
      (filterStatus === 'loss' && order.individual_profit < 0) ||
      (filterStatus === 'break-even' && order.individual_profit === 0);
    
    return matchesSearch && matchesStatus;
  });

  // Calcular estatísticas
  const stats = filteredOrders.reduce((acc, order) => {
    const profit = order.individual_profit || 0;
    if (profit > 0) {
      acc.profitOrders++;
      acc.totalProfit += profit;
    } else if (profit < 0) {
      acc.lossOrders++;
      acc.totalLoss += Math.abs(profit);
    } else {
      acc.breakEvenOrders++;
    }
    acc.totalOrders++;
    acc.totalRevenue += order.sale_price || 0;
    return acc;
  }, {
    totalOrders: 0,
    profitOrders: 0,
    lossOrders: 0,
    breakEvenOrders: 0,
    totalProfit: 0,
    totalLoss: 0,
    totalRevenue: 0
  });

  const avgProfitMargin = stats.totalRevenue > 0 ? 
    ((stats.totalProfit - stats.totalLoss) / stats.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Detetive Financeiro</h1>
        <p className="text-gray-600">Análise detalhada do lucro por pedido (DRE individual)</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Analisados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500">
                {stats.profitOrders} lucro, {stats.lossOrders} prejuízo
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lucro Total</p>
              <p className="text-2xl font-bold text-green-600">{formatMoney(stats.totalProfit)}</p>
              <p className="text-xs text-gray-500">
                {stats.profitOrders} pedidos
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Prejuízo Total</p>
              <p className="text-2xl font-bold text-red-600">{formatMoney(stats.totalLoss)}</p>
              <p className="text-xs text-gray-500">
                {stats.lossOrders} pedidos
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Margem Média</p>
              <p className={`text-2xl font-bold ${avgProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgProfitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                Sobre faturamento
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <AlertCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por pedido, produto ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'all' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todos ({stats.totalOrders})
            </button>
            <button
              onClick={() => setFilterStatus('profit')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'profit' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Lucro ({stats.profitOrders})
            </button>
            <button
              onClick={() => setFilterStatus('loss')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'loss' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Prejuízo ({stats.lossOrders})
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-900">Pedido</th>
                <th className="text-left p-3 font-medium text-gray-900">Produto</th>
                <th className="text-right p-3 font-medium text-gray-900">Valor</th>
                <th className="text-right p-3 font-medium text-gray-900">Taxas</th>
                <th className="text-right p-3 font-medium text-gray-900">Custo</th>
                <th className="text-right p-3 font-medium text-gray-900">Lucro</th>
                <th className="text-right p-3 font-medium text-gray-900">Margem</th>
                <th className="text-center p-3 font-medium text-gray-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando pedidos...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-gray-500">
                    Nenhum pedido encontrado com os filtros selecionados
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const totalFees = (order.shopee_fee || 0) + (order.seller_voucher || 0) + 
                                   (order.shopee_voucher || 0) + (order.coins_cashback || 0) +
                                   (order.reverse_shipping_fee || 0) + (order.fixed_fee || 0);
                  const profit = order.individual_profit || 0;
                  const margin = order.sale_price > 0 ? (profit / order.sale_price) * 100 : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{order.order_id}</td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium truncate max-w-xs" title={order.product_name}>
                            {order.product_name}
                          </div>
                          <div className="text-xs text-gray-500">{order.sku}</div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium">{formatMoney(order.sale_price)}</td>
                      <td className="p-3 text-right text-red-600">{formatMoney(totalFees)}</td>
                      <td className="p-3 text-right text-orange-600">{formatMoney(order.product_cost || 0)}</td>
                      <td className={`p-3 text-right font-medium ${
                        profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMoney(profit)}
                      </td>
                      <td className={`p-3 text-right ${
                        margin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {margin.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => fetchOrderDetails(order.id || order.order_id)}
                          className="text-orange-600 hover:text-orange-800 transition-colors"
                          title="Ver DRE detalhado"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal DRE Detalhado */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">DRE - Pedido {selectedOrder.order_id}</h2>
                  <p className="text-gray-600">{selectedOrder.product_name}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Waterfall Financeiro */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Cascata Financeira</h3>
                
                {/* Venda Bruta */}
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium text-blue-900">Venda Bruta</span>
                  <span className="font-bold text-blue-900">{formatMoney(selectedOrder.sale_price)}</span>
                </div>
                
                {/* Taxas */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Taxa de Comissão</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.shopee_fee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Taxa de Serviço</span>
                    <span className="text-red-600">{formatMoney(0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Taxa de Transação</span>
                    <span className="text-red-600">{formatMoney(0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Cupom do Vendedor</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.seller_voucher || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Cupom Shopee</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.shopee_voucher || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Moedas Shopee</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.coins_cashback || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Envio Reverso</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.reverse_shipping_fee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">(-) Taxa Fixa</span>
                    <span className="text-red-600">{formatMoney(selectedOrder.fixed_fee || 0)}</span>
                  </div>
                </div>
                
                {/* Repasse Líquido */}
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-900">Repasse Líquido (Payout)</span>
                  <span className="font-bold text-green-900">
                    {formatMoney(selectedOrder.sale_price - (
                      (selectedOrder.shopee_fee || 0) + 
                      (selectedOrder.seller_voucher || 0) + 
                      (selectedOrder.shopee_voucher || 0) + 
                      (selectedOrder.coins_cashback || 0) + 
                      (selectedOrder.reverse_shipping_fee || 0) + 
                      (selectedOrder.fixed_fee || 0)
                    ))}
                  </span>
                </div>
                
                {/* Custo do Produto */}
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="font-medium text-orange-900">(-) Custo do Produto (CMV)</span>
                  <span className="font-bold text-orange-900">{formatMoney(selectedOrder.product_cost || 0)}</span>
                </div>
                
                {/* Lucro Bruto */}
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium text-purple-900">Lucro Bruto</span>
                  <span className="font-bold text-purple-900">
                    {formatMoney(selectedOrder.individual_profit || 0)}
                  </span>
                </div>
                
                {/* Informações Adicionais */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold text-gray-900 mb-3">Informações do Pedido</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">SKU:</span>
                      <span className="ml-2 font-medium">{selectedOrder.sku}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium">{selectedOrder.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Data:</span>
                      <span className="ml-2 font-medium">
                        {selectedOrder.creation_date ? 
                          new Date(selectedOrder.creation_date).toLocaleDateString('pt-BR') : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Margem:</span>
                      <span className={`ml-2 font-medium ${
                        (selectedOrder.individual_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedOrder.sale_price > 0 ? 
                          (((selectedOrder.individual_profit || 0) / selectedOrder.sale_price) * 100).toFixed(1) : 
                          0
                        }%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
