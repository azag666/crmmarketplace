import React, { useState, useEffect } from 'react';
import { Package, Edit2, TrendingUp, TrendingDown, DollarSign, Percent, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function ProductAnalytics({ userId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newCost, setNewCost] = useState('');
  const [costReason, setCostReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('revenue'); // revenue, profit, margin, orders

  useEffect(() => {
    fetchProducts();
  }, [userId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Em produção, buscar da API
      const storedOrders = JSON.parse(localStorage.getItem(`shopeeflow_orders_${userId}`) || '[]');
      
      // Agrupar por SKU
      const productMap = new Map();
      
      storedOrders.forEach(order => {
        const sku = order.sku_variation || 'SEM SKU';
        
        if (!productMap.has(sku)) {
          productMap.set(sku, {
            sku: sku,
            name: order.product_name || 'Produto não identificado',
            orders: [],
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            avgTicket: 0,
            avgMargin: 0
          });
        }
        
        const product = productMap.get(sku);
        product.orders.push(order);
        
        const orderRevenue = order.sale_price || 0;
        const orderCost = order.product_cost || 0;
        const orderProfit = order.individual_profit || 0;
        
        product.totalRevenue += orderRevenue;
        product.totalCost += orderCost;
        product.totalProfit += orderProfit;
      });
      
      // Calcular métricas
      const productsArray = Array.from(productMap.values()).map(product => {
        const orderCount = product.orders.length;
        product.avgTicket = orderCount > 0 ? product.totalRevenue / orderCount : 0;
        product.avgMargin = product.totalRevenue > 0 ? (product.totalProfit / product.totalRevenue) * 100 : 0;
        product.orderCount = orderCount;
        
        // Status baseado na performance
        if (product.avgMargin > 20) {
          product.status = 'excelente';
        } else if (product.avgMargin > 10) {
          product.status = 'bom';
        } else if (product.avgMargin > 0) {
          product.status = 'regular';
        } else {
          product.status = 'prejuizo';
        }
        
        return product;
      });
      
      setProducts(productsArray);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCost = async (sku) => {
    if (!newCost || !costReason) {
      alert('Por favor, informe o novo custo e o motivo.');
      return;
    }

    try {
      const cost = parseFloat(newCost);
      if (cost < 0) {
        alert('O custo não pode ser negativo.');
        return;
      }

      // Em produção, chamar API
      console.log('Atualizando custo:', { sku, cost, reason: costReason });
      
      // Atualizar localmente (simulação)
      setProducts(prev => prev.map(product => 
        product.sku === sku 
          ? { ...product, currentCost: cost }
          : product
      ));

      // Resetar formulário
      setEditingProduct(null);
      setNewCost('');
      setCostReason('');
      
      alert('Custo atualizado com sucesso!');
      fetchProducts(); // Recarregar dados
      
    } catch (error) {
      console.error('Erro ao atualizar custo:', error);
      alert('Erro ao atualizar custo. Tente novamente.');
    }
  };

  const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Filtrar e ordenar produtos
  const filteredProducts = products
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'profit':
          return b.totalProfit - a.totalProfit;
        case 'margin':
          return b.avgMargin - a.avgMargin;
        case 'orders':
          return b.orderCount - a.orderCount;
        default:
          return 0;
      }
    });

  // Estatísticas gerais
  const stats = products.reduce((acc, product) => {
    acc.totalProducts++;
    acc.totalRevenue += product.totalRevenue;
    acc.totalProfit += product.totalProfit;
    acc.totalOrders += product.orderCount;
    
    if (product.avgMargin > 0) {
      acc.profitableProducts++;
    } else {
      acc.unprofitableProducts++;
    }
    
    return acc;
  }, {
    totalProducts: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    profitableProducts: 0,
    unprofitableProducts: 0
  });

  const avgMargin = products.length > 0 ? 
    products.reduce((sum, p) => sum + p.avgMargin, 0) / products.length : 0;

  // Dados para gráficos
  const topProducts = filteredProducts.slice(0, 10);
  const marginDistribution = [
    { name: 'Excelente (>20%)', value: products.filter(p => p.avgMargin > 20).length, color: '#10b981' },
    { name: 'Bom (10-20%)', value: products.filter(p => p.avgMargin > 10 && p.avgMargin <= 20).length, color: '#3b82f6' },
    { name: 'Regular (0-10%)', value: products.filter(p => p.avgMargin > 0 && p.avgMargin <= 10).length, color: '#f59e0b' },
    { name: 'Prejuízo (<0%)', value: products.filter(p => p.avgMargin <= 0).length, color: '#ef4444' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Análise de Produtos</h1>
        <p className="text-gray-600">Visão detalhada da performance por SKU com métricas de rentabilidade</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-xs text-gray-500">
                {stats.profitableProducts} lucrativos, {stats.unprofitableProducts} com prejuízo
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Faturamento Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(stats.totalRevenue)}</p>
              <p className="text-xs text-gray-500">
                {stats.totalOrders} pedidos
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lucro Total</p>
              <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(stats.totalProfit)}
              </p>
              <p className="text-xs text-gray-500">
                Margem média: {formatPercent(avgMargin)}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatMoney(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
              </p>
              <p className="text-xs text-gray-500">
                Por produto
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Percent className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Produtos por Faturamento */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Produtos - Faturamento</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Bar dataKey="totalRevenue" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição de Margem */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Margem</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={marginDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {marginDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por produto ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="revenue">Faturamento</option>
              <option value="profit">Lucro</option>
              <option value="margin">Margem</option>
              <option value="orders">Pedidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-900">SKU</th>
                <th className="text-left p-3 font-medium text-gray-900">Produto</th>
                <th className="text-right p-3 font-medium text-gray-900">Pedidos</th>
                <th className="text-right p-3 font-medium text-gray-900">Faturamento</th>
                <th className="text-right p-3 font-medium text-gray-900">Custo Médio</th>
                <th className="text-right p-3 font-medium text-gray-900">Ticket Médio</th>
                <th className="text-right p-3 font-medium text-gray-900">Margem</th>
                <th className="text-right p-3 font-medium text-gray-900">Lucro Total</th>
                <th className="text-center p-3 font-medium text-gray-900">Status</th>
                <th className="text-center p-3 font-medium text-gray-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center p-8 text-gray-500">
                    Nenhum produto encontrado com os filtros selecionados
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, idx) => {
                  const avgCost = product.orderCount > 0 ? product.totalCost / product.orderCount : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{product.sku}</td>
                      <td className="p-3">
                        <div className="truncate max-w-xs" title={product.name}>
                          {product.name}
                        </div>
                      </td>
                      <td className="p-3 text-right">{product.orderCount}</td>
                      <td className="p-3 text-right font-medium">{formatMoney(product.totalRevenue)}</td>
                      <td className="p-3 text-right">{formatMoney(avgCost)}</td>
                      <td className="p-3 text-right">{formatMoney(product.avgTicket)}</td>
                      <td className={`p-3 text-right font-medium ${
                        product.avgMargin >= 20 ? 'text-green-600' :
                        product.avgMargin >= 10 ? 'text-blue-600' :
                        product.avgMargin >= 0 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {formatPercent(product.avgMargin)}
                      </td>
                      <td className={`p-3 text-right font-medium ${
                        product.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMoney(product.totalProfit)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          product.status === 'excelente' ? 'bg-green-100 text-green-800' :
                          product.status === 'bom' ? 'bg-blue-100 text-blue-800' :
                          product.status === 'regular' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.status === 'excelente' ? 'Excelente' :
                           product.status === 'bom' ? 'Bom' :
                           product.status === 'regular' ? 'Regular' :
                           'Prejuízo'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="text-orange-600 hover:text-orange-800 transition-colors"
                          title="Editar custo"
                        >
                          <Edit2 className="w-4 h-4" />
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

      {/* Modal de Edição de Custo */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Editar Custo do Produto</h3>
              <p className="text-gray-600 text-sm mt-1">{editingProduct.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={editingProduct.sku}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Alteração
                </label>
                <textarea
                  value={costReason}
                  onChange={(e) => setCostReason(e.target.value)}
                  placeholder="Ex: Aumento de fornecedor, nova negociação, etc."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p className="text-gray-600">
                  <strong>Custo atual:</strong> {formatMoney(editingProduct.orderCount > 0 ? editingProduct.totalCost / editingProduct.orderCount : 0)}<br/>
                  <strong>Margem atual:</strong> {formatPercent(editingProduct.avgMargin || 0)}
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setNewCost('');
                  setCostReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateCost(editingProduct.sku)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Atualizar Custo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
