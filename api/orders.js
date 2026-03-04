// ========================================
// SHOPEEFLOW PRO - ENTERPRISE ORDERS API
// Processamento com Lógica Empresarial Precisa
// ========================================

import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

// Configuração do Banco de Dados
const sql = neon(process.env.DATABASE_URL);

/**
 * Processa e salva pedidos com lógica empresarial de lucro real
 * Regras específicas para cancelamentos e devoluções
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

    console.log(`[ENTERPRISE API] Processando ${ordersData.length} pedidos para usuário ${userId}`);
    console.log(`[ENTERPRISE API] Batch ID: ${importBatchId}`);
    console.log(`[ENTERPRISE API] Platform: ${platform}`);

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

    // Processar cada pedido com UPSERT e lógica empresarial
    const processedOrders = [];
    const errors = [];
    let successfulImports = 0;
    let failedImports = 0;
    let duplicateSkipped = 0;

    for (let i = 0; i < ordersData.length; i++) {
      const orderData = ordersData[i];
      
      try {
        // Validação crítica
        if (!orderData.order_id || !orderData.sale_price) {
          errors.push({
            row: i + 1,
            error: 'order_id e sale_price são obrigatórios',
            data: orderData
          });
          failedImports++;
          continue;
        }

        // Verificar duplicidade (UPSERT logic)
        const existingOrder = await sql`
          SELECT id, status FROM orders 
          WHERE user_id = ${userId} 
            AND platform_id = ${platformId} 
            AND order_id = ${orderData.order_id}
        `;
        
        if (existingOrder.length > 0) {
          console.log(`[ENTERPRISE API] Pedido ${orderData.order_id} já existe, verificando atualização...`);
          
          // Se o pedido já existe, podemos atualizar se o status mudou
          if (existingOrder[0].status !== orderData.status) {
            // Atualizar apenas o status e recalcular lucro
            await updateOrderStatus(existingOrder[0].id, orderData.status, orderData);
            successfulImports++;
          } else {
            duplicateSkipped++;
          }
          continue;
        }

        // Buscar custo do produto no histórico (precisão temporal)
        let productCost = 0;
        if (orderData.sku_variation) {
          const costResult = await sql`
            SELECT cost FROM product_costs_history 
            WHERE sku = ${orderData.sku_variation}
              AND effective_date <= ${orderData.created_at_platform?.split('T')[0]}
            ORDER BY effective_date DESC 
            LIMIT 1
          `;
          productCost = costResult[0]?.cost || 0;
          
          // Se não encontrar no histórico, buscar custo atual
          if (productCost === 0) {
            const currentCostResult = await sql`
              SELECT current_cost FROM products WHERE sku = ${orderData.sku_variation}
            `;
            productCost = currentCostResult[0]?.current_cost || 0;
          }
        }

        // Calcular taxas totais (soma precisa)
        const commissionFee = parseFloat(orderData.commission_fee || 0);
        const serviceFee = parseFloat(orderData.service_fee || 0);
        const transactionFee = parseFloat(orderData.transaction_fee || 0);
        const sellerVoucher = parseFloat(orderData.seller_voucher || 0);
        const sellerCoinCashback = parseFloat(orderData.seller_coin_cashback || 0);
        const reverseShippingFee = parseFloat(orderData.reverse_shipping_fee || 0);

        const totalFees = commissionFee + serviceFee + transactionFee + 
                         sellerVoucher + sellerCoinCashback + reverseShippingFee;

        const salePrice = parseFloat(orderData.sale_price);
        
        // Calcular lucro bruto (antes das regras especiais)
        const grossProfit = salePrice - totalFees - productCost;
        
        // APLICAR REGRAS EMPRESARIAIS ESPECÍFICAS
        let netProfit = grossProfit;
        let processingNotes = '';

        // REGRA 1: Cancelados
        if (orderData.status === 'Cancelado') {
          if (reverseShippingFee > 0 || totalFees > 0) {
            // Prejuízo igual às taxas não estornadas
            netProfit = -(reverseShippingFee + totalFees);
            processingNotes = 'Cancelado com custos não estornados';
          } else {
            netProfit = 0;
            processingNotes = 'Cancelado sem custos';
          }
        }
        // REGRA 2: Devolução/Reembolso
        else if (orderData.status === 'Devolução/Reembolso') {
          // Considerar custo do produto + fretes como prejuízo total
          netProfit = -(productCost + reverseShippingFee + totalFees);
          processingNotes = 'Devolução/Reembolso - prejuízo total';
        }
        // REGRA 3: Pedidos normais
        else {
          netProfit = grossProfit;
          processingNotes = 'Venda normal';
        }

        // Inserir pedido com UPSERT
        const insertResult = await sql`
          INSERT INTO orders (
            id, user_id, order_id, platform_id, status, quantity, sale_price,
            commission_fee, service_fee, transaction_fee, seller_voucher, 
            seller_coin_cashback, reverse_shipping_fee, total_fees, cost_at_sale,
            gross_profit, net_profit, sku_variation, product_name,
            created_at_platform, paid_at, imported_at, raw_data, 
            import_batch_id, processing_notes
          ) VALUES (
            ${uuidv4()}, ${userId}, ${orderData.order_id}, ${platformId},
            ${orderData.status || 'Concluído'}, ${orderData.quantity || 1}, ${salePrice},
            ${commissionFee}, ${serviceFee}, ${transactionFee}, ${sellerVoucher},
            ${sellerCoinCashback}, ${reverseShippingFee}, ${totalFees}, ${productCost},
            ${grossProfit}, ${netProfit}, ${orderData.sku_variation}, ${orderData.product_name},
            ${orderData.created_at_platform}, ${orderData.paid_at}, ${new Date().toISOString()},
            ${JSON.stringify(orderData)}, ${importBatchId}, ${processingNotes}
          ) RETURNING id, net_profit, processing_notes
        `;

        processedOrders.push({
          id: insertResult[0].id,
          order_id: orderData.order_id,
          net_profit: insertResult[0].net_profit,
          processing_notes: insertResult[0].processing_notes,
          status: 'success'
        });

        successfulImports++;

      } catch (error) {
        console.error(`[ENTERPRISE API] Erro processando pedido ${orderData.order_id}:`, error);
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
          duplicate_skipped = ${duplicateSkipped},
          error_log = ${JSON.stringify(errors)},
          status = 'completed',
          completed_at = ${new Date().toISOString()},
          processing_summary = ${JSON.stringify({
            total_processed: ordersData.length,
            success_rate: ordersData.length > 0 ? (successfulImports / ordersData.length) * 100 : 0,
            total_profit: processedOrders.reduce((sum, o) => sum + (o.net_profit || 0), 0),
            total_revenue: ordersData.reduce((sum, o) => sum + (o.sale_price || 0), 0)
          })}
        WHERE batch_id = ${importBatchId}
      `;
    }

    console.log(`[ENTERPRISE API] Importação concluída: ${successfulImports} sucesso, ${failedImports} falhas, ${duplicateSkipped} duplicados`);

    return res.status(200).json({
      success: true,
      message: 'Pedidos processados com lógica empresarial',
      summary: {
        total: ordersData.length,
        successful: successfulImports,
        failed: failedImports,
        duplicates: duplicateSkipped,
        errors: errors
      },
      processed_orders: processedOrders
    });

  } catch (error) {
    console.error('[ENTERPRISE API] Erro geral no processamento:', error);
    
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
 * Atualiza status de pedido existente com recálculo de lucro
 */
async function updateOrderStatus(orderId, newStatus, orderData) {
  try {
    // Buscar dados atuais do pedido
    const currentOrder = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;
    
    if (currentOrder.length === 0) {
      throw new Error('Pedido não encontrado');
    }

    const order = currentOrder[0];
    
    // Recalcular lucro com base no novo status
    let netProfit = order.gross_profit;
    let processingNotes = 'Status atualizado: ';

    if (newStatus === 'Cancelado') {
      if (order.reverse_shipping_fee > 0 || order.total_fees > 0) {
        netProfit = -(order.reverse_shipping_fee + order.total_fees);
        processingNotes += 'Cancelado com custos não estornados';
      } else {
        netProfit = 0;
        processingNotes += 'Cancelado sem custos';
      }
    } else if (newStatus === 'Devolução/Reembolso') {
      netProfit = -(order.cost_at_sale + order.reverse_shipping_fee + order.total_fees);
      processingNotes += 'Devolução/Reembolso - prejuízo total';
    } else {
      netProfit = order.gross_profit;
      processingNotes += 'Venda normal';
    }

    // Atualizar pedido
    await sql`
      UPDATE orders 
      SET 
        status = ${newStatus},
        net_profit = ${netProfit},
        processing_notes = ${processingNotes},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${orderId}
    `;

    console.log(`[ENTERPRISE API] Pedido ${orderId} atualizado: ${newStatus} -> Lucro: ${netProfit}`);
    
  } catch (error) {
    console.error('[ENTERPRISE API] Erro atualizando status:', error);
    throw error;
  }
}

/**
 * Criar novo lote de importação enterprise
 */
export async function createImportBatch(userId, filename, platform = 'SHOPEE', headerRow = null) {
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
        id, user_id, batch_id, filename, platform_id, header_row, status
      ) VALUES (
        ${uuidv4()}, ${userId}, ${batchId}, ${filename}, ${platformResult[0].id}, ${headerRow}, 'processing'
      )
    `;
    
    return batchId;
  } catch (error) {
    console.error('[ENTERPRISE API] Erro criando lote de importação:', error);
    throw error;
  }
}

/**
 * Buscar resumo mensal enterprise
 */
export async function getMonthlySummary(userId, startDate, endDate) {
  try {
    const result = await sql`
      SELECT * FROM monthly_summary_enterprise 
      WHERE user_id = ${userId}
        AND month >= ${startDate}
        AND month <= ${endDate}
      ORDER BY month DESC
    `;
    
    return result;
  } catch (error) {
    console.error('[ENTERPRISE API] Erro buscando resumo mensal:', error);
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
    console.error('[ENTERPRISE API] Erro buscando detalhes do pedido:', error);
    throw error;
  }
}

/**
 * Buscar análise de performance de produtos
 */
export async function getProductPerformance(userId) {
  try {
    const result = await sql`
      SELECT * FROM product_performance_analysis 
      WHERE order_count > 0
      ORDER BY total_sales DESC
      LIMIT 100
    `;
    
    return result;
  } catch (error) {
    console.error('[ENTERPRISE API] Erro buscando performance de produtos:', error);
    throw error;
  }
}

/**
 * Atualizar custo de produto (enterprise)
 */
export async function updateProductCost(sku, newCost, effectiveDate, reason) {
  try {
    // Inserir novo custo no histórico
    await sql`
      INSERT INTO product_costs_history (
        id, sku, cost, effective_date, reason
      ) VALUES (
        ${uuidv4()}, ${sku}, ${newCost}, ${effectiveDate}, ${reason}
      )
      ON CONFLICT (sku, effective_date) 
      DO UPDATE SET cost = EXCLUDED.cost, reason = EXCLUDED.reason
    `;
    
    // Atualizar custo atual na tabela de produtos
    await sql`
      UPDATE products 
      SET current_cost = ${newCost}, updated_at = ${new Date().toISOString()}
      WHERE sku = ${sku}
    `;
    
    // Recalcular métricas de todos os pedidos afetados
    await sql`
      UPDATE orders 
      SET 
        cost_at_sale = ${newCost},
        gross_profit = sale_price - total_fees - ${newCost},
        net_profit = CASE 
          WHEN status = 'Cancelado' AND (reverse_shipping_fee > 0 OR total_fees > 0) 
          THEN -(reverse_shipping_fee + total_fees)
          WHEN status = 'Devolução/Reembolso' 
          THEN -(${newCost} + reverse_shipping_fee + total_fees)
          ELSE sale_price - total_fees - ${newCost}
        END,
        updated_at = ${new Date().toISOString()}
      WHERE sku_variation = ${sku}
    `;
    
    return { success: true, message: 'Custo atualizado e pedidos recalculados' };
  } catch (error) {
    console.error('[ENTERPRISE API] Erro atualizando custo do produto:', error);
    throw error;
  }
}
