import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // --- GET: Buscar Pedidos com Filtro de Data ---
  if (req.method === 'GET') {
    const { startDate, endDate } = req.query;
    
    try {
      let query;
      // Se tiver datas, filtra. Se não, pega os últimos 30 dias por padrão para não pesar.
      if (startDate && endDate) {
        // Ajusta para o final do dia no endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        query = await sql`
          SELECT * FROM closings 
          WHERE created_at >= ${startDate} AND created_at <= ${end.toISOString()}
          ORDER BY created_at DESC
        `;
      } else {
        query = await sql`
          SELECT * FROM closings 
          ORDER BY created_at DESC 
          LIMIT 2000
        `;
      }
      return res.status(200).json(query);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // --- POST: Salvar/Atualizar Pedidos ---
  if (req.method === 'POST') {
    const orders = req.body;
    try {
      for (const order of orders) {
        await sql`
          INSERT INTO closings (
            user_id, order_id, product_name, sku, sale_price, product_cost, shopee_fee, fixed_fee, status,
            paid_at, shipped_at, shipping_provider, city, state, return_status, cancel_reason, quantity
          ) VALUES (
            ${order.user_id}::uuid, ${order.order_id}, ${order.product_name}, ${order.sku}, 
            ${order.sale_price}, ${order.product_cost}, ${order.shopee_fee}, ${order.fixed_fee}, ${order.status},
            ${order.paid_at || null}, ${order.shipped_at || null}, ${order.shipping_provider}, 
            ${order.city}, ${order.state}, ${order.return_status}, ${order.cancel_reason}, ${order.quantity}
          )
          ON CONFLICT (order_id, user_id) 
          DO UPDATE SET 
            status = EXCLUDED.status,
            paid_at = EXCLUDED.paid_at,
            shipped_at = EXCLUDED.shipped_at,
            return_status = EXCLUDED.return_status,
            product_cost = EXCLUDED.product_cost, -- Atualiza custo se mudar
            shopee_fee = EXCLUDED.shopee_fee,
            sale_price = EXCLUDED.sale_price;
        `;
      }
      return res.status(200).json({ message: 'Success' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  
  // --- PUT: Atualizar Custo de um Produto (Novo) ---
  if (req.method === 'PUT') {
    const { user_id, sku, new_cost } = req.body;
    try {
       // Atualiza todos os pedidos com esse SKU para o novo custo
       await sql`
         UPDATE closings 
         SET product_cost = ${new_cost}
         WHERE user_id = ${user_id}::uuid AND sku = ${sku}
       `;
       return res.status(200).json({ message: 'Updated' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
