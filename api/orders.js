import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Conecta ao banco usando a variável de ambiente da Vercel
  const sql = neon(process.env.DATABASE_URL);

  // --- GET: Buscar Pedidos ---
  if (req.method === 'GET') {
    try {
      // Busca os últimos 1000 pedidos (ajuste conforme necessário)
      const result = await sql`
        SELECT * FROM closings 
        ORDER BY created_at DESC 
        LIMIT 1000
      `;
      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao buscar:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
  }

  // --- POST: Salvar/Atualizar Pedidos ---
  if (req.method === 'POST') {
    const orders = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    try {
      // Loop para salvar cada pedido (Upsert: Cria ou Atualiza)
      for (const order of orders) {
        await sql`
          INSERT INTO closings (
            user_id, 
            order_id, 
            product_name, 
            sku, 
            sale_price, 
            product_cost, 
            shopee_fee, 
            fixed_fee, 
            status
          ) VALUES (
            ${order.user_id}::uuid, 
            ${order.order_id}, 
            ${order.product_name}, 
            ${order.sku}, 
            ${order.sale_price}, 
            ${order.product_cost}, 
            ${order.shopee_fee}, 
            ${order.fixed_fee}, 
            ${order.status}
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

      return res.status(200).json({ message: 'Sucesso' });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
