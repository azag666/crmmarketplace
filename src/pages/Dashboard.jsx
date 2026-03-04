import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useFinancialSummary, useCashFlow } from '../hooks/useOrders';
import { useUserSettings } from '../hooks/useSettings';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, AlertCircle, 
  ShoppingCart, Truck, CheckCircle, XCircle, Calendar,
  ArrowUpRight, ArrowDownRight, Eye, Target
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function Dashboard({ userId }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Queries com TanStack Query
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(userId, { startDate: dateRange.start, endDate: dateRange.end });
  const { data: cashFlow, isLoading: cashFlowLoading } = useCashFlow(userId, { startDate: dateRange.start, endDate: dateRange.end });
  const { data: settings } = useUserSettings(userId);

  // Cores para gráficos
  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  // Dados para gráfico de pizza de status
  const statusData = summary ? [
    { name: 'Concluídos', value: summary.completed_orders || 0, color: '#10b981' },
    { name: 'Cancelados', value: summary.cancelled_orders || 0, color: '#ef4444' },
    { name: 'A Enviar', value: summary.to_ship_orders || 0, color: '#f59e0b' },
    { name: 'Enviados', value: summary.shipped_orders || 0, color: '#3b82f6' },
  ].filter(item => item.value > 0) : [];

  // Formatar valores monetários
  const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Calcular variação percentual
  const getVariation = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  if (summaryLoading || cashFlowLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Executivo</h1>
          <p className="text-gray-600">Visão geral da performance financeira e operacional</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <Calendar className="w-4 h-4 text-gray-500" />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary?.gross_revenue)}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_orders} pedidos no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Líquida</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary?.net_revenue)}</div>
            <p className="text-xs text-muted-foreground">
              Após taxas e descontos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary?.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(summary?.gross_profit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Margem: {summary?.profit_margin?.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary?.avg_ticket)}</div>
            <p className="text-xs text-muted-foreground">
              Valor médio por pedido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status dos Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Feitos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.total_orders}</div>
            <p className="text-xs text-muted-foreground">Total no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pagos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.paid_orders}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_orders > 0 ? ((summary?.paid_orders / summary?.total_orders) * 100).toFixed(1) : 0}% pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Enviados</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary?.shipped_orders}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_orders > 0 ? ((summary?.shipped_orders / summary?.total_orders) * 100).toFixed(1) : 0}% enviados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.completed_orders}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_orders > 0 ? ((summary?.completed_orders / summary?.total_orders) * 100).toFixed(1) : 0}% concluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.cancelled_orders}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_orders > 0 ? ((summary?.cancelled_orders / summary?.total_orders) * 100).toFixed(1) : 0}% cancelados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluxo de Caixa */}
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Caixa</CardTitle>
            <CardDescription>Entradas vs Saídas diárias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlow || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                />
                <YAxis tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  formatter={(value, name) => [
                    formatMoney(value), 
                    name === 'revenue' ? 'Receita' : name === 'profit' ? 'Lucro' : 'Perda'
                  ]}
                  labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" dataKey="profit" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="loss" stackId="2" stroke="#ef4444" fill="#ef4444" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status dos Pedidos - Pizza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status</CardTitle>
            <CardDescription>Proporção dos pedidos por status atual</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} pedidos`, 'Quantidade']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Performance */}
      {(summary?.loss_orders > 0 || summary?.cancelled_orders > 0) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              Alertas de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary?.loss_orders > 0 && (
                <div className="text-red-700">
                  <strong>{summary.loss_orders}</strong> pedidos com prejuízo (total de {formatMoney(summary.total_loss)})
                </div>
              )}
              {summary?.cancelled_orders > 0 && (
                <div className="text-red-700">
                  <strong>{summary.cancelled_orders}</strong> pedidos cancelados ({((summary.cancelled_orders / summary.total_orders) * 100).toFixed(1)}%)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
