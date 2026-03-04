import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // --- GET: Buscar Pedidos ---
  if (req.method === 'GET') {
    const { startDate, endDate } = req.query;
    try {
      let query;
      if (startDate && endDate) {
        // Filtra pela DATA DA PLANILHA (creation_date) se existir, senão created_at
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        query = await sql`
          SELECT * FROM closings 
          WHERE (creation_date >= ${startDate} AND creation_date <= ${end.toISOString()})
             OR (creation_date IS NULL AND created_at >= ${startDate} AND created_at <= ${end.toISOString()})
          ORDER BY creation_date DESC, created_at DESC
        `;
      } else {
        query = await sql`SELECT * FROM closings ORDER BY creation_date DESC LIMIT 2000`;
      }
      return res.status(200).json(query);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // --- POST: Salvar Pedidos ---
  if (req.method === 'POST') {
    const orders = req.body;
    try {
      for (const order of orders) {
        await sql`
          INSERT INTO closings (
            user_id, order_id, product_name, sku, sale_price, product_cost, shopee_fee, fixed_fee, status,
            creation_date, paid_at, seller_voucher, coins_cashback, reverse_shipping_fee
          ) VALUES (
            ${order.user_id}::uuid, ${order.order_id}, ${order.product_name}, ${order.sku}, 
            ${order.sale_price}, ${order.product_cost}, ${order.shopee_fee}, ${order.fixed_fee}, ${order.status},
            ${order.creation_date || null}, ${order.paid_at || null}, 
            ${order.seller_voucher || 0}, ${order.coins_cashback || 0}, ${order.reverse_shipping_fee || 0}
          )
          ON CONFLICT (order_id, user_id) 
          DO UPDATE SET 
            status = EXCLUDED.status,
            creation_date = EXCLUDED.creation_date,
            seller_voucher = EXCLUDED.seller_voucher,
            coins_cashback = EXCLUDED.coins_cashback,
            reverse_shipping_fee = EXCLUDED.reverse_shipping_fee,
            product_cost = EXCLUDED.product_cost,
            shopee_fee = EXCLUDED.shopee_fee,
            sale_price = EXCLUDED.sale_price;
        `;
      }
      return res.status(200).json({ message: 'Success' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  
  // --- PUT: Atualizar Custo ---
  if (req.method === 'PUT') {
    const { user_id, sku, new_cost } = req.body;
    try {
       await sql`UPDATE closings SET product_cost = ${new_cost} WHERE user_id = ${user_id}::uuid AND sku = ${sku}`;
       return res.status(200).json({ message: 'Updated' });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }
}
