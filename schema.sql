-- ============================================
-- SHOPEEFLOW CRM - Schema SQL Otimizado
-- ============================================

-- Usuários (Para futuro sistema de autenticação)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    plan_type VARCHAR(50) DEFAULT 'free' -- free, pro, enterprise
);

-- Produtos (Catálogo master)
CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(100) PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category VARCHAR(100),
    current_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_level INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    weight_kg DECIMAL(8,3) DEFAULT 0,
    dimensions_cm VARCHAR(50), -- '20x15x10'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- Histórico de Custos dos Produtos (Para DRE temporal preciso)
CREATE TABLE IF NOT EXISTS product_costs_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) REFERENCES products(sku) ON DELETE CASCADE,
    cost DECIMAL(10,2) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE, -- NULL para custo atual
    reason TEXT, -- 'Aumento de matéria prima', 'Fornecedor novo', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- Pedidos (Tabela principal refinada)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL, -- ID original da Shopee
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sku VARCHAR(100) REFERENCES products(sku),
    
    -- Dados do Pedido
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    sale_price DECIMAL(10,2) NOT NULL,
    product_cost DECIMAL(10,2) NOT NULL, -- Custo na data da venda
    
    -- Status e Datas
    status VARCHAR(50) NOT NULL, -- 'Completed', 'Cancelled', 'To Ship', 'Shipped', etc.
    creation_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Financeiro (Taxas e Descontos)
    shopee_fee DECIMAL(10,2) DEFAULT 0,
    service_fee DECIMAL(10,2) DEFAULT 0,
    transaction_fee DECIMAL(10,2) DEFAULT 0,
    fixed_fee DECIMAL(10,2) DEFAULT 3.00,
    seller_voucher DECIMAL(10,2) DEFAULT 0,
    shopee_voucher DECIMAL(10,2) DEFAULT 0,
    coins_cashback DECIMAL(10,2) DEFAULT 0,
    reverse_shipping_fee DECIMAL(10,2) DEFAULT 0,
    shipping_rebate DECIMAL(10,2) DEFAULT 0, -- Reembolso de frete
    
    -- Métricas Calculadas (Para performance)
    net_revenue DECIMAL(10,2) GENERATED ALWAYS AS (
        sale_price + shipping_rebate + coins_cashback - 
        shopee_fee - service_fee - transaction_fee - fixed_fee - seller_voucher
    ) STORED,
    
    total_fees DECIMAL(10,2) GENERATED ALWAYS AS (
        shopee_fee + service_fee + transaction_fee + fixed_fee + seller_voucher + reverse_shipping_fee
    ) STORED,
    
    gross_profit DECIMAL(10,2) GENERATED ALWAYS AS (
        net_revenue - product_cost
    ) STORED,
    
    -- Metadados
    customer_city VARCHAR(100),
    customer_state VARCHAR(50),
    tracking_code VARCHAR(100),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, order_id)
);

-- Despesas Operacionais (Custos fixos da empresa)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Aluguel', 'Internet', 'Marketing', 'Embalagem', etc.
    expense_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_type VARCHAR(20), -- 'monthly', 'yearly'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurações do Usuário
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_margin DECIMAL(5,2) DEFAULT 20.00, -- Margem desejada
    default_shipping_cost DECIMAL(10,2) DEFAULT 15.00,
    shopee_fee_rate DECIMAL(5,2) DEFAULT 20.00,
    currency VARCHAR(3) DEFAULT 'BRL',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Índices para Performance
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_product_costs_history_sku_valid FROM ON product_costs_history(sku, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date DESC);

-- Views para Consultas Rápidas
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', creation_date) as month,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN status = 'To Ship' THEN 1 END) as to_ship_orders,
    COUNT(CASE WHEN status = 'Shipped' THEN 1 END) as shipped_orders,
    COUNT(CASE WHEN paid_at IS NOT NULL THEN 1 END) as paid_orders,
    SUM(sale_price) as gross_revenue,
    SUM(net_revenue) as net_revenue,
    SUM(product_cost) as total_cost,
    SUM(total_fees) as total_fees,
    SUM(gross_profit) as gross_profit,
    AVG(sale_price) as avg_ticket,
    SUM(gross_profit) / NULLIF(SUM(net_revenue), 0) * 100 as profit_margin
FROM orders
GROUP BY user_id, DATE_TRUNC('month', creation_date);

-- Função para obter custo do produto na data específica
CREATE OR REPLACE FUNCTION get_product_cost_at_date(sku_param VARCHAR, date_param TIMESTAMP WITH TIME ZONE)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN (
        SELECT cost 
        FROM product_costs_history 
        WHERE sku = sku_param 
        AND valid_from <= date_param 
        AND (valid_to IS NULL OR valid_to > date_param)
        ORDER BY valid_from DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
