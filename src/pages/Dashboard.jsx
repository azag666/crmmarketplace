import React, { useState } from 'react';

export default function Dashboard({ userId }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Dados mock para desenvolvimento
  const mockSummary = {
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
    profit_margin: 0
  };

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
              <p className="text-2xl font-bold text-gray-900">{formatMoney(mockSummary.gross_revenue)}</p>
              <p className="text-xs text-gray-500">
                {mockSummary.total_orders} pedidos no período
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
              <p className="text-2xl font-bold text-gray-900">{formatMoney(mockSummary.net_revenue)}</p>
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
              <p className={`text-2xl font-bold ${mockSummary.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(mockSummary.gross_profit)}
              </p>
              <p className="text-xs text-gray-500">
                Margem: {mockSummary.profit_margin?.toFixed(1)}%
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
              <p className="text-2xl font-bold text-gray-900">{formatMoney(mockSummary.avg_ticket)}</p>
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
              <p className="text-2xl font-bold text-blue-600">{mockSummary.total_orders}</p>
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
              <p className="text-2xl font-bold text-green-600">{mockSummary.paid_orders}</p>
              <p className="text-xs text-gray-500">
                {mockSummary.total_orders > 0 ? ((mockSummary.paid_orders / mockSummary.total_orders) * 100).toFixed(1) : 0}% pagos
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
              <p className="text-2xl font-bold text-orange-600">{mockSummary.shipped_orders}</p>
              <p className="text-xs text-gray-500">
                {mockSummary.total_orders > 0 ? ((mockSummary.shipped_orders / mockSummary.total_orders) * 100).toFixed(1) : 0}% enviados
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
              <p className="text-2xl font-bold text-green-600">{mockSummary.completed_orders}</p>
              <p className="text-xs text-gray-500">
                {mockSummary.total_orders > 0 ? ((mockSummary.completed_orders / mockSummary.total_orders) * 100).toFixed(1) : 0}% concluídos
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
              <p className="text-2xl font-bold text-red-600">{mockSummary.cancelled_orders}</p>
              <p className="text-xs text-gray-500">
                {mockSummary.total_orders > 0 ? ((mockSummary.cancelled_orders / mockSummary.total_orders) * 100).toFixed(1) : 0}% cancelados
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

      {/* Mensagem de Desenvolvimento */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800">Modo Desenvolvimento</h3>
        </div>
        <p className="text-yellow-700 mt-2">
          O sistema está funcionando em modo de desenvolvimento. Para usar dados reais, configure a variável de ambiente DATABASE_URL com a URL do seu banco NeonDB.
        </p>
        <p className="text-yellow-600 text-sm mt-1">
          User ID: {userId}
        </p>
      </div>
    </div>
  );
}
