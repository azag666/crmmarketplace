import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // A Vercel injeta a variável DATABASE_URL automaticamente se você conectou o Neon no painel da Vercel
  // Se não conectou via integração, adicione a variável DATABASE_URL nas configurações da Vercel
  const sql = neon(process.env.DATABASE_URL);

  // GET: Buscar pedidos
  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT * FROM closings ORDER BY created_at DESC LIMIT 1000`;
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Salvar pedidos
  if (req.method === 'POST') {
    const orders = req.body;
    try {
      for (const order of orders) {
        // Usa UPSERT: Se o pedido já existe (order_id + user_id), atualiza. Se não, cria.
        await sql`
          INSERT INTO closings (
            user_id, order_id, product_name, sku, sale_price, product_cost, shopee_fee, fixed_fee, status
          ) VALUES (
            ${order.user_id}::uuid, ${order.order_id}, ${order.product_name}, ${order.sku}, 
            ${order.sale_price}, ${order.product_cost}, ${order.shopee_fee}, ${order.fixed_fee}, ${order.status}
          )
          ON CONFLICT (order_id, user_id) 
          DO UPDATE SET 
            status = EXCLUDED.status,
            product_cost = EXCLUDED.product_cost,
            shopee_fee = EXCLUDED.shopee_fee,
            sale_price = EXCLUDED.sale_price,
            sku = EXCLUDED.sku;
        `;
      }
      return res.status(200).json({ message: 'Success' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
