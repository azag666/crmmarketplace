import React, { useState, useEffect } from 'react';

export default function MonthlySummary({ userId }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchMonthlySummary();
  }, [userId, selectedMonth]);

  const fetchMonthlySummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/monthly-summary?userId=${userId}&month=${selectedMonth}`);
      const data = await response.json();
      
      if (response.ok) {
        setSummary(data.summary || []);
      }
    } catch (error) {
      console.error('Erro ao buscar resumo mensal:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Calcular totais
  const totals = summary.reduce((acc, month) => ({
    gross_revenue: acc.gross_revenue + (month.gross_revenue || 0),
    net_payout: acc.net_payout + (month.net_payout || 0),
    net_profit: acc.net_profit + (month.net_profit || 0),
    total_orders: acc.total_orders + (month.total_orders || 0),
    completed_orders: acc.completed_orders + (month.completed_orders || 0),
    cancelled_orders: acc.cancelled_orders + (month.cancelled_orders || 0)
  }), {
    gross_revenue: 0,
    net_payout: 0,
    net_profit: 0,
    total_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0
  });

  const avgProfitMargin = totals.gross_revenue > 0 ? (totals.net_profit / totals.gross_revenue) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Resumo Mensal</h2>
            <p className="text-gray-600">Análise comparativa de performance</p>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 mb-2">Faturamento Bruto</p>
            <p className="text-3xl font-bold text-blue-600">{formatMoney(totals.gross_revenue)}</p>
            <p className="text-xs text-gray-500 mt-1">{totals.total_orders} pedidos</p>
          </div>
          
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 mb-2">Receita Líquida</p>
            <p className="text-3xl font-bold text-green-600">{formatMoney(totals.net_payout)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Após {formatMoney(totals.gross_revenue - totals.net_payout)} em taxas
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 mb-2">Lucro Real</p>
            <p className={`text-3xl font-bold ${totals.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(totals.net_profit)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Margem: {formatPercent(avgProfitMargin)}
            </p>
          </div>
        </div>

        {/* Tabela Detalhada */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-900">Mês</th>
                <th className="text-right p-3 font-medium text-gray-900">Pedidos</th>
                <th className="text-right p-3 font-medium text-gray-900">Concluídos</th>
                <th className="text-right p-3 font-medium text-gray-900">Cancelados</th>
                <th className="text-right p-3 font-medium text-gray-900">Faturamento</th>
                <th className="text-right p-3 font-medium text-gray-900">Líquido</th>
                <th className="text-right p-3 font-medium text-gray-900">Lucro</th>
                <th className="text-right p-3 font-medium text-gray-900">Margem</th>
                <th className="text-right p-3 font-medium text-gray-900">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summary.map((month, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3">
                    {new Date(month.month).toLocaleDateString('pt-BR', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </td>
                  <td className="p-3 text-right">{month.total_orders || 0}</td>
                  <td className="p-3 text-right text-green-600">{month.completed_orders || 0}</td>
                  <td className="p-3 text-right text-red-600">{month.cancelled_orders || 0}</td>
                  <td className="p-3 text-right font-medium">{formatMoney(month.gross_revenue)}</td>
                  <td className="p-3 text-right">{formatMoney(month.net_payout)}</td>
                  <td className={`p-3 text-right font-medium ${
                    month.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatMoney(month.net_profit)}
                  </td>
                  <td className="p-3 text-right">{formatPercent(month.profit_margin_percent)}</td>
                  <td className="p-3 text-right">{formatMoney(month.avg_ticket)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="p-3">Total</td>
                <td className="p-3 text-right">{totals.total_orders}</td>
                <td className="p-3 text-right text-green-600">{totals.completed_orders}</td>
                <td className="p-3 text-right text-red-600">{totals.cancelled_orders}</td>
                <td className="p-3 text-right">{formatMoney(totals.gross_revenue)}</td>
                <td className="p-3 text-right">{formatMoney(totals.net_payout)}</td>
                <td className={`p-3 text-right ${
                  totals.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatMoney(totals.net_profit)}
                </td>
                <td className="p-3 text-right">{formatPercent(avgProfitMargin)}</td>
                <td className="p-3 text-right">
                  {formatMoney(totals.total_orders > 0 ? totals.gross_revenue / totals.total_orders : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Gráfico Visual */}
        {summary.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
            <div className="space-y-4">
              {summary.map((month, idx) => {
                const revenueWidth = totals.gross_revenue > 0 ? (month.gross_revenue / totals.gross_revenue) * 100 : 0;
                const profitWidth = totals.net_profit > 0 ? (Math.abs(month.net_profit) / Math.abs(totals.net_profit)) * 100 : 0;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {new Date(month.month).toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="text-gray-600">
                        {formatMoney(month.gross_revenue)} → {formatMoney(month.net_profit)}
                      </span>
                    </div>
                    <div className="flex gap-1 h-6">
                      <div 
                        className="bg-blue-500 rounded-l"
                        style={{ width: `${revenueWidth}%` }}
                        title={`Faturamento: ${formatMoney(month.gross_revenue)}`}
                      ></div>
                      <div 
                        className={`rounded-r ${
                          month.net_profit >= 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${profitWidth}%` }}
                        title={`Lucro: ${formatMoney(month.net_profit)}`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
