// ========================================
// SHOPEEFLOW PRO - ORDERS API
// Processamento Inteligente de Pedidos
// ========================================

import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

// Configuração do Banco de Dados
const sql = neon(process.env.DATABASE_URL);

/**
 * Processa e salva pedidos da planilha Shopee
 * com precisão cirúrgica nos cálculos financeiros
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, orders: ordersData, importBatchId, platform = 'SHOPEE' } = req.body;

    if (!userId || !ordersData || !Array.isArray(ordersData)) {
      return res.status(400).json({ 
        error: 'Dados inválidos. Forneça userId e array de orders.' 
      });
    }

    console.log(`[API] Processando ${ordersData.length} pedidos para usuário ${userId}`);
    console.log(`[API] Batch ID: ${importBatchId}`);
    console.log(`[API] Platform: ${platform}`);

    // Obter ID da plataforma
    const platformResult = await sql`
      SELECT id FROM platforms WHERE code = ${platform}
    `;
    
    if (platformResult.length === 0) {
      return res.status(400).json({ error: 'Plataforma não encontrada' });
    }
    
    const platformId = platformResult[0].id;

    // Obter configurações de taxas do usuário
    const feeSettingsResult = await sql`
      SELECT * FROM fee_settings 
      WHERE user_id = ${userId} AND platform_id = ${platformId}
    `;
    
    const feeSettings = feeSettingsResult[0] || {
      commission_rate: 0.20,
      service_fee_rate: 0.08,
      fixed_fee: 3.00,
      tax_rate: 0.06
    };

    // Processar cada pedido com validação e cálculos precisos
    const processedOrders = [];
    const errors = [];
    let successfulImports = 0;
    let failedImports = 0;

    for (let i = 0; i < ordersData.length; i++) {
      const orderData = ordersData[i];
      
      try {
        // Validar dados mínimos
        if (!orderData.order_id || !orderData.sale_price) {
          errors.push({
            row: i + 1,
            error: 'order_id e sale_price são obrigatórios',
            data: orderData
          });
          failedImports++;
          continue;
        }

        // Verificar duplicidade
        const existingOrder = await sql`
          SELECT id FROM orders 
          WHERE user_id = ${userId} 
            AND platform_id = ${platformId} 
            AND order_id = ${orderData.order_id}
        `;
        
        if (existingOrder.length > 0) {
          console.log(`[API] Pedido ${orderData.order_id} já existe, ignorando...`);
          continue;
        }

        // Buscar custo do produto no histórico
        let productCost = 0;
        if (orderData.product_sku) {
          const costResult = await sql`
            SELECT cost FROM product_costs_history 
            WHERE user_id = ${userId} 
              AND sku = ${orderData.product_sku}
              AND effective_date <= ${orderData.creation_date?.split('T')[0]}
            ORDER BY effective_date DESC 
            LIMIT 1
          `;
          productCost = costResult[0]?.cost || 0;
        }

        // Calcular taxas totais
        const commissionFee = parseFloat(orderData.commission_fee || 0);
        const serviceFee = parseFloat(orderData.service_fee || 0);
        const transactionFee = parseFloat(orderData.transaction_fee || 0);
        const sellerVoucher = parseFloat(orderData.seller_voucher || 0);
        const shopeeVoucher = parseFloat(orderData.shopee_voucher || 0);
        const coinsCashback = parseFloat(orderData.coins_cashback || 0);
        const reverseShippingFee = parseFloat(orderData.reverse_shipping_fee || 0);
        const shippingCost = parseFloat(orderData.shipping_cost || 0);

        const totalFees = commissionFee + serviceFee + transactionFee + 
                         sellerVoucher + shopeeVoucher + coinsCashback + 
                         reverseShippingFee + shippingCost;

        const salePrice = parseFloat(orderData.sale_price);
        const netPayout = salePrice - totalFees;
        const grossProfit = netPayout - productCost;
        const taxes = grossProfit * feeSettings.tax_rate;
        const netProfit = grossProfit - taxes;

        // Inserir pedido no banco
        const insertResult = await sql`
          INSERT INTO orders (
            id, user_id, order_id, platform_id, status, sale_price, quantity,
            gross_revenue, commission_fee, service_fee, transaction_fee,
            seller_voucher, shopee_voucher, coins_cashback, reverse_shipping_fee,
            shipping_cost, taxes, total_fees, net_payout, product_cost,
            gross_profit, net_profit, product_sku, product_name,
            product_cost_at_time, created_at_platform, imported_at,
            raw_data, import_batch_id
          ) VALUES (
            ${uuidv4()}, ${userId}, ${orderData.order_id}, ${platformId},
            ${orderData.status || 'Concluído'}, ${salePrice}, ${orderData.quantity || 1},
            ${salePrice}, ${commissionFee}, ${serviceFee}, ${transactionFee},
            ${sellerVoucher}, ${shopeeVoucher}, ${coinsCashback}, ${reverseShippingFee},
            ${shippingCost}, ${taxes}, ${totalFees}, ${netPayout}, ${productCost},
            ${grossProfit}, ${netProfit}, ${orderData.product_sku}, ${orderData.product_name},
            ${productCost}, ${orderData.creation_date}, ${new Date().toISOString()},
            ${JSON.stringify(orderData)}, ${importBatchId}
          ) RETURNING id
        `;

        processedOrders.push({
          id: insertResult[0].id,
          order_id: orderData.order_id,
          net_profit: netProfit,
          status: 'success'
        });

        successfulImports++;

      } catch (error) {
        console.error(`[API] Erro processando pedido ${orderData.order_id}:`, error);
        errors.push({
          row: i + 1,
          order_id: orderData.order_id,
          error: error.message,
          data: orderData
        });
        failedImports++;
      }
    }

    // Atualizar status do lote de importação
    if (importBatchId) {
      await sql`
        UPDATE import_batches 
        SET 
          successful_imports = ${successfulImports},
          failed_imports = ${failedImports},
          error_log = ${JSON.stringify(errors)},
          status = 'completed',
          completed_at = ${new Date().toISOString()}
        WHERE batch_id = ${importBatchId}
      `;
    }

    console.log(`[API] Importação concluída: ${successfulImports} sucesso, ${failedImports} falhas`);

    return res.status(200).json({
      success: true,
      message: 'Pedidos processados com sucesso',
      summary: {
        total: ordersData.length,
        successful: successfulImports,
        failed: failedImports,
        errors: errors
      },
      processed_orders: processedOrders
    });

  } catch (error) {
    console.error('[API] Erro geral no processamento:', error);
    
    // Atualizar lote com erro
    if (req.body.importBatchId) {
      await sql`
        UPDATE import_batches 
        SET 
          status = 'failed',
          error_log = ${JSON.stringify([{ error: error.message }])},
          completed_at = ${new Date().toISOString()}
        WHERE batch_id = ${req.body.importBatchId}
      `;
    }
    
    return res.status(500).json({ 
      error: 'Erro interno no servidor',
      details: error.message 
    });
  }
}

/**
 * Criar novo lote de importação
 */
export async function createImportBatch(userId, filename, platform = 'SHOPEE') {
  const batchId = uuidv4();
  
  try {
    const platformResult = await sql`
      SELECT id FROM platforms WHERE code = ${platform}
    `;
    
    if (platformResult.length === 0) {
      throw new Error('Plataforma não encontrada');
    }
    
    await sql`
      INSERT INTO import_batches (
        id, user_id, batch_id, filename, platform_id, status
      ) VALUES (
        ${uuidv4()}, ${userId}, ${batchId}, ${filename}, ${platformResult[0].id}, 'processing'
      )
    `;
    
    return batchId;
  } catch (error) {
    console.error('[API] Erro criando lote de importação:', error);
    throw error;
  }
}

/**
 * Buscar resumo mensal para dashboard
 */
export async function getMonthlySummary(userId, startDate, endDate) {
  try {
    const result = await sql`
      SELECT * FROM monthly_summary 
      WHERE user_id = ${userId}
        AND month >= ${startDate}
        AND month <= ${endDate}
      ORDER BY month DESC
    `;
    
    return result;
  } catch (error) {
    console.error('[API] Erro buscando resumo mensal:', error);
    throw error;
  }
}

/**
 * Buscar detalhes do pedido para Detetive Financeiro
 */
export async function getOrderDetails(userId, orderId) {
  try {
    const result = await sql`
      SELECT * FROM order_financial_waterfall 
      WHERE user_id = ${userId} AND id = ${orderId}
    `;
    
    return result[0] || null;
  } catch (error) {
    console.error('[API] Erro buscando detalhes do pedido:', error);
    throw error;
  }
}

/**
 * Atualizar custo de produto
 */
export async function updateProductCost(userId, sku, newCost, effectiveDate, reason) {
  try {
    // Inserir novo custo no histórico
    await sql`
      INSERT INTO product_costs_history (
        id, user_id, sku, cost, effective_date, reason
      ) VALUES (
        ${uuidv4()}, ${userId}, ${sku}, ${newCost}, ${effectiveDate}, ${reason}
      )
    `;
    
    // Atualizar custo atual na tabela de produtos
    await sql`
      UPDATE products 
      SET current_cost = ${newCost}, updated_at = ${new Date().toISOString()}
      WHERE user_id = ${userId} AND sku = ${sku}
    `;
    
    return { success: true };
  } catch (error) {
    console.error('[API] Erro atualizando custo do produto:', error);
    throw error;
  }
}
