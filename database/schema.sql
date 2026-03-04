-- ========================================
-- SHOPEEFLOW PRO - DATABASE SCHEMA
-- CRM SaaS para Vendedores de Alta Performance
-- ========================================

-- Tabela de Usuários (Multi-tenant)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    subscription_plan VARCHAR(50) DEFAULT 'starter', -- starter, pro, enterprise
    settings JSONB DEFAULT '{}'
);

-- Tabela de Plataformas (Configurável)
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL, -- 'Shopee', 'Mercado Livre', 'Amazon'
    code VARCHAR(20) UNIQUE NOT NULL, -- 'SHOPEE', 'ML', 'AMZ'
    fee_config JSONB DEFAULT '{}', -- Configuração de taxas padrão
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Produtos (Catálogo Master)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL, -- SKU único por usuário
    name TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    current_cost DECIMAL(10,2) DEFAULT 0.00,
    current_price DECIMAL(10,2) DEFAULT 0.00,
    weight DECIMAL(8,3), -- kg
    dimensions JSONB, -- {length, width, height} cm
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, discontinued
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, sku),
    CHECK (current_cost >= 0),
    CHECK (current_price >= 0)
);

-- Histórico de Custos dos Produtos (Essencial para cálculo histórico preciso)
CREATE TABLE IF NOT EXISTS product_costs_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL, -- Data a partir da qual este custo é válido
    reason TEXT, -- Motivo da mudança de custo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    FOREIGN KEY (user_id, sku) REFERENCES products(user_id, sku) ON DELETE CASCADE,
    CHECK (cost >= 0),
    UNIQUE(user_id, sku, effective_date)
);

-- Tabela de Pedidos (Coração do Sistema)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL, -- ID original da plataforma
    platform_id UUID NOT NULL REFERENCES platforms(id),
    
    -- Dados do Pedido
    status VARCHAR(50) NOT NULL, -- Concluído, Cancelado, Em processamento, Devolução, Reembolso
    sale_price DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Valor Total (Venda Bruta)
    quantity INTEGER DEFAULT 1,
    
    -- Dados Financeiros (Precisão Cirúrgica)
    gross_revenue DECIMAL(10,2) DEFAULT 0.00, -- Venda Bruta
    commission_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de comissão
    service_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de serviço
    transaction_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de transação
    seller_voucher DECIMAL(10,2) DEFAULT 0.00, -- Cupom do vendedor
    shopee_voucher DECIMAL(10,2) DEFAULT 0.00, -- Cupom Shopee
    coins_cashback DECIMAL(10,2) DEFAULT 0.00, -- Compensar Moedas Shopee
    reverse_shipping_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de Envio Reversa
    shipping_cost DECIMAL(10,2) DEFAULT 0.00, -- Frete pago pelo vendedor
    taxes DECIMAL(10,2) DEFAULT 0.00, -- Impostos
    
    -- Cálculos Automáticos
    total_fees DECIMAL(10,2) DEFAULT 0.00, -- Soma de todas as taxas
    net_payout DECIMAL(10,2) DEFAULT 0.00, -- VALOR RECEBER SHOPEE
    product_cost DECIMAL(10,2) DEFAULT 0.00, -- CMV (buscado do histórico)
    gross_profit DECIMAL(10,2) DEFAULT 0.00, -- Lucro antes dos impostos
    net_profit DECIMAL(10,2) DEFAULT 0.00, -- Lucro líquido final
    
    -- Dados do Produto
    product_sku VARCHAR(100),
    product_name TEXT,
    product_cost_at_time DECIMAL(10,2) DEFAULT 0.00, -- Custo no momento da venda
    
    -- Dados Temporais
    created_at_platform TIMESTAMP WITH TIME ZONE, -- Data real da venda na plataforma
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadados
    raw_data JSONB, -- Dados brutos da planilha para auditoria
    import_batch_id VARCHAR(100), -- ID do lote de importação
    
    -- Constraints
    UNIQUE(user_id, platform_id, order_id),
    CHECK (sale_price >= 0),
    CHECK (commission_fee >= 0),
    CHECK (service_fee >= 0),
    CHECK (transaction_fee >= 0),
    CHECK (seller_voucher >= 0),
    CHECK (shopee_voucher >= 0),
    CHECK (coins_cashback >= 0),
    CHECK (reverse_shipping_fee >= 0),
    CHECK (shipping_cost >= 0),
    CHECK (taxes >= 0),
    CHECK (quantity > 0)
);

-- Tabela de Configurações de Taxas (Por usuário/plataforma)
CREATE TABLE IF NOT EXISTS fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    
    -- Configurações de Taxas
    commission_rate DECIMAL(5,4) DEFAULT 0.2000, -- 20%
    service_fee_rate DECIMAL(5,4) DEFAULT 0.0000,
    transaction_fee_rate DECIMAL(5,4) DEFAULT 0.0000,
    fixed_fee DECIMAL(10,2) DEFAULT 0.00,
    
    -- Configurações de Impostos
    tax_rate DECIMAL(5,4) DEFAULT 0.0600, -- 6%
    tax_type VARCHAR(50) DEFAULT 'percent', -- percent, fixed
    
    -- Configurações de Frete
    default_shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    free_shipping_threshold DECIMAL(10,2) DEFAULT 0.00,
    
    -- Configurações de Marketing
    default_voucher_rate DECIMAL(5,4) DEFAULT 0.0000,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, platform_id)
);

-- Tabela de Lotes de Importação (Auditoria)
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id VARCHAR(100) UNIQUE NOT NULL,
    filename VARCHAR(255),
    platform_id UUID REFERENCES platforms(id),
    total_records INTEGER DEFAULT 0,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    start_date DATE, -- Data inicial dos dados
    end_date DATE, -- Data final dos dados
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
    error_log JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para Performance (Essencial para Big Data)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform_id ON orders(platform_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_platform ON orders(created_at_platform);
CREATE INDEX IF NOT EXISTS idx_orders_import_batch_id ON orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_sku ON orders(product_sku);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE INDEX IF NOT EXISTS idx_product_costs_user_sku ON product_costs_history(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_product_costs_effective_date ON product_costs_history(effective_date);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_id ON import_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status);

-- Triggers para atualização automática de timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_settings_updated_at BEFORE UPDATE ON fee_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para cálculo automático de valores financeiros nos pedidos
CREATE OR REPLACE FUNCTION calculate_order_financials()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular total de taxas
    NEW.total_fees = COALESCE(NEW.commission_fee, 0) + 
                     COALESCE(NEW.service_fee, 0) + 
                     COALESCE(NEW.transaction_fee, 0) +
                     COALESCE(NEW.seller_voucher, 0) +
                     COALESCE(NEW.shopee_voucher, 0) +
                     COALESCE(NEW.coins_cashback, 0) +
                     COALESCE(NEW.reverse_shipping_fee, 0) +
                     COALESCE(NEW.shipping_cost, 0);
    
    -- Calcular repasse líquido (VALOR RECEBER SHOPEE)
    NEW.net_payout = NEW.sale_price - NEW.total_fees;
    
    -- Buscar custo do produto no histórico (se não informado)
    IF NEW.product_cost_at_time = 0 AND NEW.product_sku IS NOT NULL THEN
        SELECT cost INTO NEW.product_cost_at_time
        FROM product_costs_history 
        WHERE user_id = NEW.user_id 
          AND sku = NEW.product_sku 
          AND effective_date <= DATE(NEW.created_at_platform)
        ORDER BY effective_date DESC 
        LIMIT 1;
    END IF;
    
    NEW.product_cost = COALESCE(NEW.product_cost_at_time, 0);
    
    -- Calcular lucro bruto
    NEW.gross_profit = NEW.net_payout - NEW.product_cost;
    
    -- Calcular lucro líquido (após impostos)
    NEW.net_profit = NEW.gross_profit - COALESCE(NEW.taxes, 0);
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calculate_order_financials 
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION calculate_order_financials();

-- Views para Consultas Eficientes (Dashboard)
CREATE OR REPLACE VIEW monthly_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at_platform) as month,
    platform_id,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN status = 'Cancelado' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN status LIKE '%Devolu%' OR status LIKE '%Reembolso%' THEN 1 END) as returned_orders,
    
    SUM(sale_price) as gross_revenue,
    SUM(net_payout) as net_payout,
    SUM(total_fees) as total_fees,
    SUM(product_cost) as total_cost,
    SUM(gross_profit) as gross_profit,
    SUM(net_profit) as net_profit,
    
    AVG(sale_price) as avg_ticket,
    CASE 
        WHEN SUM(sale_price) > 0 
        THEN (SUM(net_profit) / SUM(sale_price)) * 100 
        ELSE 0 
    END as profit_margin_percent,
    
    COUNT(CASE WHEN net_profit > 0 THEN 1 END) as profitable_orders,
    COUNT(CASE WHEN net_profit < 0 THEN 1 END) as loss_orders,
    
    SUM(CASE WHEN net_profit > 0 THEN net_profit ELSE 0 END) as total_profit,
    SUM(CASE WHEN net_profit < 0 THEN ABS(net_profit) ELSE 0 END) as total_loss
    
FROM orders
GROUP BY user_id, DATE_TRUNC('month', created_at_platform), platform_id;

-- View para Detetive Financeiro (DRE por Pedido)
CREATE OR REPLACE VIEW order_financial_waterfall AS
SELECT 
    o.id,
    o.user_id,
    o.order_id,
    p.name as platform_name,
    o.status,
    o.created_at_platform,
    o.product_name,
    o.product_sku,
    
    -- Waterfall Financeiro
    o.sale_price as gross_revenue,
    o.commission_fee,
    o.service_fee,
    o.transaction_fee,
    o.seller_voucher,
    o.shopee_voucher,
    o.coins_cashback,
    o.reverse_shipping_fee,
    o.shipping_cost,
    o.net_payout,
    o.product_cost,
    o.taxes,
    o.net_profit,
    
    -- Indicadores
    CASE 
        WHEN o.net_profit > 0 THEN 'Lucro'
        WHEN o.net_profit < 0 THEN 'Prejuízo'
        ELSE 'Neutro'
    END as profit_status,
    
    -- Percentuais
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.total_fees / o.sale_price) * 100 
        ELSE 0 
    END as fees_percent,
    
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.product_cost / o.sale_price) * 100 
        ELSE 0 
    END as cost_percent,
    
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.net_profit / o.sale_price) * 100 
        ELSE 0 
    END as profit_margin_percent
    
FROM orders o
JOIN platforms p ON o.platform_id = p.id;

-- Inserir plataformas padrão
INSERT INTO platforms (name, code, fee_config) VALUES 
('Shopee', 'SHOPEE', '{"commission_rate": 0.20, "service_fee_rate": 0.08, "fixed_fee": 3.00}'),
('Mercado Livre', 'ML', '{"commission_rate": 0.16, "fixed_fee": 5.00}'),
('Amazon', 'AMZ', '{"commission_rate": 0.15, "fixed_fee": 0.00}')
ON CONFLICT (code) DO NOTHING;

-- Comentários de Documentação
COMMENT ON TABLE users IS 'Usuários do sistema (Multi-tenant)';
COMMENT ON TABLE platforms IS 'Plataformas de e-commerce suportadas';
COMMENT ON TABLE products IS 'Catálogo de produtos por usuário';
COMMENT ON TABLE product_costs_history IS 'Histórico de custos para cálculo preciso de lucro temporal';
COMMENT ON TABLE orders IS 'Pedidos importados das plataformas (coração do sistema)';
COMMENT ON TABLE fee_settings IS 'Configurações personalizadas de taxas por usuário/plataforma';
COMMENT ON TABLE import_batches IS 'Controle de lotes de importação para auditoria';

COMMENT ON COLUMN orders.order_id IS 'ID original do pedido na plataforma';
COMMENT ON COLUMN orders.net_payout IS 'VALOR RECEBER SHOPEE (repasse líquido)';
COMMENT ON COLUMN orders.product_cost_at_time IS 'Custo do produto no momento da venda (essencial para precisão histórica)';
COMMENT ON COLUMN orders.raw_data IS 'Dados brutos da planilha para auditoria e reconciliação';
