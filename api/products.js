// ========================================
// SHOPEEFLOW PRO - PRODUCTS API
// Gestão de Catálogo e Custos
// ========================================

import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

const sql = neon(process.env.DATABASE_URL);

/**
 * Buscar todos os produtos do usuário
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getProducts(req, res);
  } else if (req.method === 'POST') {
    return createProduct(req, res);
  } else if (req.method === 'PUT') {
    return updateProduct(req, res);
  } else if (req.method === 'DELETE') {
    return deleteProduct(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getProducts(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const products = await sql`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM orders o WHERE o.product_sku = p.sku AND o.user_id = p.user_id) as order_count,
        (SELECT AVG(o.net_profit) FROM orders o WHERE o.product_sku = p.sku AND o.user_id = p.user_id) as avg_profit
      FROM products p
      WHERE p.user_id = ${userId}
      ORDER BY p.name
    `;

    return res.status(200).json({ products });
  } catch (error) {
    console.error('[API] Erro buscando produtos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createProduct(req, res) {
  try {
    const { userId, sku, name, current_cost, current_price, category, description } = req.body;

    if (!userId || !sku || !name) {
      return res.status(400).json({ error: 'userId, sku e name são obrigatórios' });
    }

    // Verificar duplicidade de SKU
    const existing = await sql`
      SELECT id FROM products WHERE user_id = ${userId} AND sku = ${sku}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'SKU já existe para este usuário' });
    }

    // Inserir produto
    const result = await sql`
      INSERT INTO products (
        id, user_id, sku, name, current_cost, current_price, category, description
      ) VALUES (
        ${uuidv4()}, ${userId}, ${sku}, ${name}, ${current_cost || 0}, ${current_price || 0}, 
        ${category || null}, ${description || null}
      ) RETURNING *
    `;

    // Inserir custo no histórico se informado
    if (current_cost && current_cost > 0) {
      await sql`
        INSERT INTO product_costs_history (
          id, user_id, sku, cost, effective_date, reason
        ) VALUES (
          ${uuidv4()}, ${userId}, ${sku}, ${current_cost}, ${new Date().toISOString().split('T')[0]}, 
          'Custo inicial'
        )
      `;
    }

    return res.status(201).json({ product: result[0] });
  } catch (error) {
    console.error('[API] Erro criando produto:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updateProduct(req, res) {
  try {
    const { userId, sku, current_cost, reason } = req.body;

    if (!userId || !sku) {
      return res.status(400).json({ error: 'userId e sku são obrigatórios' });
    }

    if (current_cost !== undefined) {
      // Inserir novo custo no histórico
      await sql`
        INSERT INTO product_costs_history (
          id, user_id, sku, cost, effective_date, reason
        ) VALUES (
          ${uuidv4()}, ${userId}, ${sku}, ${current_cost}, ${new Date().toISOString().split('T')[0]}, 
          ${reason || 'Atualização de custo'}
        )
      `;

      // Atualizar custo atual
      await sql`
        UPDATE products 
        SET current_cost = ${current_cost}, updated_at = ${new Date().toISOString()}
        WHERE user_id = ${userId} AND sku = ${sku}
      `;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[API] Erro atualizando produto:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deleteProduct(req, res) {
  try {
    const { userId, sku } = req.query;

    if (!userId || !sku) {
      return res.status(400).json({ error: 'userId e sku são obrigatórios' });
    }

    await sql`
      DELETE FROM products WHERE user_id = ${userId} AND sku = ${sku}
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[API] Erro deletando produto:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
