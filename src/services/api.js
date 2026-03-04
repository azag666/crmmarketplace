import { neon } from '@neondatabase/serverless';

// Configuração do banco de dados
const sql = neon(process.env.NEXT_PUBLIC_DATABASE_URL);

// Serviço de API com tratamento de erros robusto
export class ShopeeFlowAPI {
  constructor() {
    this.baseURL = '/api';
  }

  // Tratamento de erros padrão
  handleError(error, context = '') {
    console.error(`[ShopeeFlow API Error] ${context}:`, error);
    throw new Error(`Falha na operação: ${context}. ${error.message || 'Tente novamente.'}`);
  }

  // ===== PEDIDOS =====
  
  // Buscar pedidos com filtros avançados
  async getOrders(userId, filters = {}) {
    try {
      const { startDate, endDate, status, sku } = filters;
      
      let query = `
        SELECT 
          o.*,
          p.name as product_name,
          p.image_url,
          p.category,
          CASE 
            WHEN o.status = 'Completed' THEN 'Concluído'
            WHEN o.status = 'Cancelled' THEN 'Cancelado'
            WHEN o.status = 'To Ship' THEN 'A Enviar'
            WHEN o.status = 'Shipped' THEN 'Enviado'
            WHEN o.status = 'Ready to Ship' THEN 'Pronto para Enviar'
            ELSE o.status
          END as status_display
        FROM orders o
        LEFT JOIN products p ON o.sku = p.sku
        WHERE o.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;
      
      if (startDate && endDate) {
        query += ` AND o.creation_date >= $${paramIndex} AND o.creation_date <= $${paramIndex + 1}`;
        params.push(startDate, endDate);
        paramIndex += 2;
      }
      
      if (status) {
        query += ` AND o.status = $${paramIndex}`;
        params.push(status);
        paramIndex += 1;
      }
      
      if (sku) {
        query += ` AND o.sku ILIKE $${paramIndex}`;
        params.push(`%${sku}%`);
        paramIndex += 1;
      }
      
      query += ` ORDER BY o.creation_date DESC`;
      
      const orders = await sql(query, ...params);
      return orders;
    } catch (error) {
      this.handleError(error, 'buscar pedidos');
    }
  }

  // ===== PRODUTOS =====
  
  // Buscar produtos
  async getProducts(userId) {
    try {
      const products = await sql`
        SELECT 
          p.*,
          -- Último custo
          (SELECT cost FROM product_costs_history 
           WHERE sku = p.sku AND valid_to IS NULL 
           ORDER BY valid_from DESC LIMIT 1) as current_cost,
          -- Estatísticas de vendas
          (SELECT COUNT(*) FROM orders o 
           WHERE o.sku = p.sku AND o.user_id = p.user_id) as total_orders,
          (SELECT SUM(o.quantity) FROM orders o 
           WHERE o.sku = p.sku AND o.user_id = p.user_id) as total_sold,
          (SELECT SUM(o.gross_profit) FROM orders o 
           WHERE o.sku = p.sku AND o.user_id = p.user_id) as total_profit
        FROM products p
        WHERE p.user_id = $1
        ORDER BY p.name
      `;
      
      return products;
    } catch (error) {
      this.handleError(error, 'buscar produtos');
    }
  }

  // ===== ANÁLISE FINANCEIRA =====
  
  // Obter resumo financeiro
  async getFinancialSummary(userId, filters = {}) {
    try {
      const { startDate, endDate } = filters;
      
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND creation_date >= '${startDate}' AND creation_date <= '${endDate}'`;
      }
      
      const summary = await sql(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN status = 'To Ship' THEN 1 END) as to_ship_orders,
          COUNT(CASE WHEN status = 'Shipped' THEN 1 END) as shipped_orders,
          COUNT(CASE WHEN paid_at IS NOT NULL THEN 1 END) as paid_orders,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as delivered_orders,
          
          SUM(sale_price) as gross_revenue,
          SUM(net_revenue) as net_revenue,
          SUM(product_cost) as total_cost,
          SUM(total_fees) as total_fees,
          SUM(gross_profit) as gross_profit,
          
          AVG(sale_price) as avg_ticket,
          SUM(gross_profit) / NULLIF(SUM(net_revenue), 0) * 100 as profit_margin,
          
          SUM(CASE WHEN gross_profit < 0 THEN gross_profit ELSE 0 END) as total_loss,
          SUM(CASE WHEN gross_profit >= 0 THEN gross_profit ELSE 0 END) as total_profit,
          
          COUNT(CASE WHEN gross_profit < 0 THEN 1 END) as loss_orders,
          COUNT(CASE WHEN gross_profit >= 0 THEN 1 END) as profit_orders
          
        FROM orders 
        WHERE user_id = $1 ${dateFilter}
      `, userId);
      
      return summary[0] || {};
    } catch (error) {
      this.handleError(error, 'buscar resumo financeiro');
    }
  }

  // Detetive Financeiro - Análise de perdas
  async getLossAnalysis(userId, filters = {}) {
    try {
      const { startDate, endDate } = filters;
      
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND creation_date >= '${startDate}' AND creation_date <= '${endDate}'`;
      }
      
      const analysis = await sql(`
        SELECT 
          o.order_id,
          o.sku,
          o.product_name,
          o.sale_price,
          o.product_cost,
          o.total_fees,
          o.gross_profit,
          o.seller_voucher,
          o.shopee_fee,
          o.coins_cashback,
          o.creation_date,
          p.category,
          CASE 
            WHEN o.gross_profit < 0 THEN 'Prejuízo'
            WHEN o.gross_profit = 0 THEN 'Zerado'
            ELSE 'Lucro'
          END as profit_status
        FROM orders o
        LEFT JOIN products p ON o.sku = p.sku
        WHERE o.user_id = $1 
          AND o.gross_profit < 0 
          ${dateFilter}
        ORDER BY o.gross_profit ASC
        LIMIT 100
      `, userId);
      
      return analysis;
    } catch (error) {
      this.handleError(error, 'análise de perdas');
    }
  }

  // ===== DASHBOARD EXECUTIVO =====
  
  // Dados para o fluxo de caixa
  async getCashFlowData(userId, filters = {}) {
    try {
      const { startDate, endDate } = filters;
      
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND creation_date >= '${startDate}' AND creation_date <= '${endDate}'`;
      }
      
      const cashFlow = await sql(`
        SELECT 
          DATE_TRUNC('day', creation_date) as date,
          SUM(CASE WHEN gross_profit >= 0 THEN gross_profit ELSE 0 END) as profit,
          SUM(CASE WHEN gross_profit < 0 THEN ABS(gross_profit) ELSE 0 END) as loss,
          SUM(net_revenue) as revenue,
          SUM(total_fees) as fees,
          COUNT(*) as orders
        FROM orders 
        WHERE user_id = $1 ${dateFilter}
        GROUP BY DATE_TRUNC('day', creation_date)
        ORDER BY date ASC
      `, userId);
      
      return cashFlow;
    } catch (error) {
      this.handleError(error, 'dados de fluxo de caixa');
    }
  }

  // ===== CONFIGURAÇÕES =====
  
  // Obter configurações do usuário
  async getUserSettings(userId) {
    try {
      const userSettings = await sql(`
        SELECT * FROM user_settings WHERE user_id = $1
      `, userId);
      
      return userSettings[0] || {
        target_margin: 20.00,
        default_shipping_cost: 15.00,
        shopee_fee_rate: 20.00,
        currency: 'BRL',
        timezone: 'America/Sao_Paulo'
      };
    } catch (error) {
      this.handleError(error, 'buscar configurações');
    }
  }

  // ===== UTILIDADES =====
  
  // Limpar dados do usuário
  async clearUserData(userId) {
    try {
      await sql(`DELETE FROM orders WHERE user_id = $1`, userId);
      await sql(`DELETE FROM products WHERE user_id = $1`, userId);
      await sql(`DELETE FROM expenses WHERE user_id = $1`, userId);
      await sql(`DELETE FROM product_costs_history WHERE user_id = $1`, userId);
      
      return true;
    } catch (error) {
      this.handleError(error, 'limpar dados');
    }
  }
}

// Instância global do serviço
export const api = new ShopeeFlowAPI();
