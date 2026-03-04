// Serviço de API com fallback para desenvolvimento
export class ShopeeFlowAPI {
  constructor() {
    this.baseURL = '/api';
    this.isDevelopment = !process.env.DATABASE_URL;
  }

  // Tratamento de erros padrão
  handleError(error, context = '') {
    console.error(`[ShopeeFlow API Error] ${context}:`, error);
    throw new Error(`Falha na operação: ${context}. ${error.message || 'Tente novamente.'}`);
  }

  // Dados mock para desenvolvimento
  getMockData(type, filters = {}) {
    const mockData = {
      orders: [],
      products: [],
      summary: {
        total_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        to_ship_orders: 0,
        shipped_orders: 0,
        paid_orders: 0,
        delivered_orders: 0,
        gross_revenue: 0,
        net_revenue: 0,
        total_cost: 0,
        total_fees: 0,
        gross_profit: 0,
        avg_ticket: 0,
        profit_margin: 0,
        total_loss: 0,
        total_profit: 0,
        loss_orders: 0,
        profit_orders: 0
      },
      cashFlow: [],
      lossAnalysis: [],
      settings: {
        target_margin: 20.00,
        default_shipping_cost: 15.00,
        shopee_fee_rate: 20.00,
        currency: 'BRL',
        timezone: 'America/Sao_Paulo'
      }
    };

    console.log(`[Mock Mode] ${type}: Retornando dados mock`);
    return mockData[type] || [];
  }

  // ===== PEDIDOS =====
  
  // Buscar pedidos com filtros avançados
  async getOrders(userId, filters = {}) {
    if (this.isDevelopment) {
      return this.getMockData('orders');
    }

    try {
      const response = await fetch(`${this.baseURL}/orders?userId=${userId}&${new URLSearchParams(filters)}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'buscar pedidos');
    }
  }

  // Importar pedidos em lote
  async importOrders(userId, orders) {
    if (this.isDevelopment) {
      console.log('[Mock Mode] Importando pedidos:', orders.length);
      return { success: true, imported: orders.length };
    }

    try {
      const response = await fetch(`${this.baseURL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, orders })
      });
      if (!response.ok) throw new Error('Failed to import orders');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'importar pedidos');
    }
  }

  // ===== PRODUTOS =====
  
  // Buscar produtos
  async getProducts(userId) {
    if (this.isDevelopment) {
      return this.getMockData('products');
    }

    try {
      const response = await fetch(`${this.baseURL}/products?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'buscar produtos');
    }
  }

  // ===== ANÁLISE FINANCEIRA =====
  
  // Obter resumo financeiro
  async getFinancialSummary(userId, filters = {}) {
    if (this.isDevelopment) {
      return this.getMockData('summary');
    }

    try {
      const response = await fetch(`${this.baseURL}/summary?userId=${userId}&${new URLSearchParams(filters)}`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      return data[0] || this.getMockData('summary');
    } catch (error) {
      this.handleError(error, 'buscar resumo financeiro');
    }
  }

  // Detetive Financeiro - Análise de perdas
  async getLossAnalysis(userId, filters = {}) {
    if (this.isDevelopment) {
      return this.getMockData('lossAnalysis');
    }

    try {
      const response = await fetch(`${this.baseURL}/loss-analysis?userId=${userId}&${new URLSearchParams(filters)}`);
      if (!response.ok) throw new Error('Failed to fetch loss analysis');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'análise de perdas');
    }
  }

  // ===== DASHBOARD EXECUTIVO =====
  
  // Dados para o fluxo de caixa
  async getCashFlowData(userId, filters = {}) {
    if (this.isDevelopment) {
      return this.getMockData('cashFlow');
    }

    try {
      const response = await fetch(`${this.baseURL}/cash-flow?userId=${userId}&${new URLSearchParams(filters)}`);
      if (!response.ok) throw new Error('Failed to fetch cash flow');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'dados de fluxo de caixa');
    }
  }

  // ===== CONFIGURAÇÕES =====
  
  // Obter configurações do usuário
  async getUserSettings(userId) {
    if (this.isDevelopment) {
      return this.getMockData('settings');
    }

    try {
      const response = await fetch(`${this.baseURL}/settings?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      return data[0] || this.getMockData('settings');
    } catch (error) {
      this.handleError(error, 'buscar configurações');
    }
  }

  // ===== UTILIDADES =====
  
  // Limpar dados do usuário
  async clearUserData(userId) {
    if (this.isDevelopment) {
      console.log('[Mock Mode] Limpando dados do usuário:', userId);
      return true;
    }

    try {
      const response = await fetch(`${this.baseURL}/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) throw new Error('Failed to clear data');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'limpar dados');
    }
  }
}

// Instância global do serviço
export const api = new ShopeeFlowAPI();
