import React, { useState, useEffect } from 'react';

export default function Dashboard({ userId }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    total_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    to_ship_orders: 0,
    shipped_orders: 0,
    paid_orders: 0,
    gross_revenue: 0,
    net_revenue: 0,
    gross_profit: 0,
    avg_ticket: 0,
    profit_margin: 0,
    total_loss: 0,
    total_profit: 0,
    loss_orders: 0,
    profit_orders: 0
  });

  // Carregar dados do localStorage
  useEffect(() => {
    const loadData = () => {
      try {
        const storedOrders = JSON.parse(localStorage.getItem(`shopeeflow_orders_${userId}`) || '[]');
        
        // Filtrar por data se necessário
        let filteredOrders = storedOrders;
        if (dateRange.start && dateRange.end) {
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          filteredOrders = storedOrders.filter(order => {
            const orderDate = new Date(order.creation_date);
            return orderDate >= startDate && orderDate <= endDate;
          });
        }
        
        setOrders(filteredOrders);
        
        // Calcular resumo financeiro
        if (filteredOrders.length > 0) {
          const totalOrders = filteredOrders.length;
          const completedOrders = filteredOrders.filter(o => o.status.toLowerCase().includes('concluído') || o.status.toLowerCase().includes('completed')).length;
          const cancelledOrders = filteredOrders.filter(o => o.status.toLowerCase().includes('cancelado') || o.status.toLowerCase().includes('cancelled')).length;
          const toShipOrders = filteredOrders.filter(o => o.status.toLowerCase().includes('enviar') || o.status.toLowerCase().includes('to ship')).length;
          const shippedOrders = filteredOrders.filter(o => o.status.toLowerCase().includes('enviado') || o.status.toLowerCase().includes('shipped')).length;
          const paidOrders = filteredOrders.filter(o => o.sale_price > 0).length;
          
          const grossRevenue = filteredOrders.reduce((sum, o) => sum + (o.sale_price || 0), 0);
          const totalCost = filteredOrders.reduce((sum, o) => sum + (o.product_cost || 0), 0);
          const totalFees = filteredOrders.reduce((sum, o) => sum + (o.total_fees || 0), 0);
          const netRevenue = grossRevenue - totalFees;
          const grossProfit = netRevenue - totalCost;
          
          const profitOrders = filteredOrders.filter(o => (o.individual_profit || 0) > 0).length;
          const lossOrders = filteredOrders.filter(o => (o.individual_profit || 0) < 0).length;
          const totalProfit = filteredOrders.filter(o => (o.individual_profit || 0) > 0).reduce((sum, o) => sum + (o.individual_profit || 0), 0);
          const totalLoss = Math.abs(filteredOrders.filter(o => (o.individual_profit || 0) < 0).reduce((sum, o) => sum + (o.individual_profit || 0), 0));
          
          const avgTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0;
          const profitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
          
          setSummary({
            total_orders: totalOrders,
            completed_orders: completedOrders,
            cancelled_orders: cancelledOrders,
            to_ship_orders: toShipOrders,
            shipped_orders: shippedOrders,
            paid_orders: paidOrders,
            gross_revenue: grossRevenue,
            net_revenue: netRevenue,
            gross_profit: grossProfit,
            avg_ticket: avgTicket,
            profit_margin: profitMargin,
            total_loss: totalLoss,
            total_profit: totalProfit,
            loss_orders: lossOrders,
            profit_orders: profitOrders
          });
        } else {
          setSummary({
            total_orders: 0,
            completed_orders: 0,
            cancelled_orders: 0,
            to_ship_orders: 0,
            shipped_orders: 0,
            paid_orders: 0,
            gross_revenue: 0,
            net_revenue: 0,
            gross_profit: 0,
            avg_ticket: 0,
            profit_margin: 0,
            total_loss: 0,
            total_profit: 0,
            loss_orders: 0,
            profit_orders: 0
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };

    loadData();
    
    // Recarregar dados quando o intervalo de datas mudar
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [userId, dateRange]);

  // Formatar valores monetários
  const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-gray-600">Visão geral da performance financeira e operacional</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border-0 text-sm focus:ring-0"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border-0 text-sm focus:ring-0"
          />
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Faturamento Bruto</p>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.gross_revenue)}</p>
              <p className="text-xs text-gray-500">
                {summary.total_orders} pedidos no período
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Receita Líquida</p>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.net_revenue)}</p>
              <p className="text-xs text-gray-500">
                Após taxas e descontos
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lucro Líquido</p>
              <p className={`text-2xl font-bold ${summary.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(summary.gross_profit)}
              </p>
              <p className="text-xs text-gray-500">
                Margem: {summary.profit_margin?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.avg_ticket)}</p>
              <p className="text-xs text-gray-500">
                Valor médio por pedido
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status dos Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Feitos</p>
              <p className="text-2xl font-bold text-blue-600">{summary.total_orders}</p>
              <p className="text-xs text-gray-500">Total no período</p>
            </div>
            <div className="bg-blue-100 p-2 rounded">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Pagos</p>
              <p className="text-2xl font-bold text-green-600">{summary.paid_orders}</p>
              <p className="text-xs text-gray-500">
                {summary.total_orders > 0 ? ((summary.paid_orders / summary.total_orders) * 100).toFixed(1) : 0}% pagos
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Enviados</p>
              <p className="text-2xl font-bold text-orange-600">{summary.shipped_orders}</p>
              <p className="text-xs text-gray-500">
                {summary.total_orders > 0 ? ((summary.shipped_orders / summary.total_orders) * 100).toFixed(1) : 0}% enviados
              </p>
            </div>
            <div className="bg-orange-100 p-2 rounded">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Concluídos</p>
              <p className="text-2xl font-bold text-green-600">{summary.completed_orders}</p>
              <p className="text-xs text-gray-500">
                {summary.total_orders > 0 ? ((summary.completed_orders / summary.total_orders) * 100).toFixed(1) : 0}% concluídos
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Cancelados</p>
              <p className="text-2xl font-bold text-red-600">{summary.cancelled_orders}</p>
              <p className="text-xs text-gray-500">
                {summary.total_orders > 0 ? ((summary.cancelled_orders / summary.total_orders) * 100).toFixed(1) : 0}% cancelados
              </p>
            </div>
            <div className="bg-red-100 p-2 rounded">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Análise de Lucro/Prejuízo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos com Lucro</p>
              <p className="text-2xl font-bold text-green-600">{summary.profit_orders}</p>
              <p className="text-xs text-gray-500">
                Total: {formatMoney(summary.total_profit)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos com Prejuízo</p>
              <p className="text-2xl font-bold text-red-600">{summary.loss_orders}</p>
              <p className="text-xs text-gray-500">
                Total: {formatMoney(summary.total_loss)}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-blue-600">
                {summary.total_orders > 0 ? ((summary.profit_orders / summary.total_orders) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-gray-500">
                Pedidos lucrativos
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Performance */}
      {(summary.loss_orders > 0 || summary.cancelled_orders > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-red-800">Alertas de Performance</h3>
          </div>
          <div className="mt-4 space-y-2">
            {summary.loss_orders > 0 && (
              <div className="text-red-700">
                <strong>{summary.loss_orders}</strong> pedidos com prejuízo (total de {formatMoney(summary.total_loss)})
              </div>
            )}
            {summary.cancelled_orders > 0 && (
              <div className="text-red-700">
                <strong>{summary.cancelled_orders}</strong> pedidos cancelados ({((summary.cancelled_orders / summary.total_orders) * 100).toFixed(1)}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensagem de Desenvolvimento */}
      {orders.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-yellow-800">Nenhum Dado Importado</h3>
          </div>
          <p className="text-yellow-700 mt-2">
            Importe sua planilha de vendas da Shopee para visualizar os dados financeiros e operacionais.
          </p>
          <p className="text-yellow-600 text-sm mt-1">
            User ID: {userId}
          </p>
        </div>
      )}
    </div>
  );
}
