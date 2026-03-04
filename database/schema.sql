-- ========================================
-- SHOPEEFLOW PRO - ENTERPRISE SCHEMA
-- CRM Empresarial com Inteligência de Produtos
-- ========================================

-- Tabela de Usuários (Multi-tenant Enterprise)
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
    settings JSONB DEFAULT '{}',
    
    -- Configurações de Negócio
    default_tax_rate DECIMAL(5,4) DEFAULT 0.0600, -- 6% padrão
    cost_calculation_method VARCHAR(20) DEFAULT 'fifo', -- fifo, lifo, weighted
    profit_margin_target DECIMAL(5,4) DEFAULT 0.2000 -- 20% alvo
);

-- Tabela de Plataformas (Configurável)
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL, -- 'Shopee', 'Mercado Livre', 'Amazon'
    code VARCHAR(20) UNIQUE NOT NULL, -- 'SHOPEE', 'ML', 'AMZ'
    fee_config JSONB DEFAULT '{}', -- Configuração de taxas padrão
    import_config JSONB DEFAULT '{}', -- Configuração de importação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Produtos (Catálogo Master - SKU como PK)
CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(100) PRIMARY KEY, -- SKU único global
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
    
    -- Métricas de Performance (calculadas)
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    avg_ticket DECIMAL(10,2) DEFAULT 0.00,
    avg_margin_percent DECIMAL(5,4) DEFAULT 0.0000,
    last_order_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (current_cost >= 0),
    CHECK (current_price >= 0),
    CHECK (avg_ticket >= 0),
    CHECK (avg_margin_percent >= -1.0000)
);

-- Histórico de Custos dos Produtos (Essencial para DRE histórico preciso)
CREATE TABLE IF NOT EXISTS product_costs_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    cost DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL, -- Data a partir da qual este custo é válido
    reason TEXT, -- Motivo da mudança de custo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (cost >= 0),
    UNIQUE(sku, effective_date)
);

-- Tabela de Pedidos (Coração do Sistema - Otimizada)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL, -- ID original da plataforma
    platform_id UUID NOT NULL REFERENCES platforms(id),
    
    -- Dados do Pedido
    status VARCHAR(50) NOT NULL, -- Concluído, Cancelado, Devolução/Reembolso, Em processamento
    quantity INTEGER DEFAULT 1,
    
    -- Dados Financeiros (Precisão Contábil)
    sale_price DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Preço acordado
    commission_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de comissão bruta
    service_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de serviço bruta
    transaction_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de transação
    seller_voucher DECIMAL(10,2) DEFAULT 0.00, -- Cupom do vendedor
    shopee_voucher DECIMAL(10,2) DEFAULT 0.00, -- Cupom Shopee (informativo)
    seller_coin_cashback DECIMAL(10,2) DEFAULT 0.00, -- Seller Absorbed Coin Cashback
    reverse_shipping_fee DECIMAL(10,2) DEFAULT 0.00, -- Taxa de Envio Reversa
    
    -- Cálculos Automáticos (Regras Empresariais)
    total_fees DECIMAL(10,2) DEFAULT 0.00, -- Soma de todas as taxas
    cost_at_sale DECIMAL(10,2) DEFAULT 0.00, -- Custo do produto na data da venda
    gross_profit DECIMAL(10,2) DEFAULT 0.00, -- Lucro antes de regras especiais
    net_profit DECIMAL(10,2) DEFAULT 0.00, -- Lucro líquido final (após regras)
    
    -- Dados do Produto
    sku_variation VARCHAR(100) REFERENCES products(sku), -- SKU da variação
    product_name TEXT,
    
    -- Dados Temporais (Precisão para Análise)
    creation_date TIMESTAMP WITH TIME ZONE, -- Data de criação do pedido (corrigido)
    created_at_platform TIMESTAMP WITH TIME ZONE, -- Data de criação do pedido (legado)
    paid_at TIMESTAMP WITH TIME ZONE, -- Hora do pagamento do pedido
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadados para Auditoria
    raw_data JSONB, -- Dados brutos da planilha
    import_batch_id VARCHAR(100), -- ID do lote de importação
    processing_notes TEXT, -- Notas do processamento
    
    -- Constraints
    UNIQUE(user_id, platform_id, order_id),
    CHECK (sale_price >= 0),
    CHECK (commission_fee >= 0),
    CHECK (service_fee >= 0),
    CHECK (transaction_fee >= 0),
    CHECK (seller_voucher >= 0),
    CHECK (seller_coin_cashback >= 0),
    CHECK (reverse_shipping_fee >= 0),
    CHECK (quantity > 0)
);

-- Tabela de Configurações de Taxas (Por usuário/plataforma)
CREATE TABLE IF NOT EXISTS fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    
    -- Configurações de Taxas (Personalizáveis)
    commission_rate DECIMAL(5,4) DEFAULT 0.2000, -- 20%
    service_fee_rate DECIMAL(5,4) DEFAULT 0.0800, -- 8%
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

-- Tabela de Lotes de Importação (Auditoria Enterprise)
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id VARCHAR(100) UNIQUE NOT NULL,
    filename VARCHAR(255),
    platform_id UUID REFERENCES platforms(id),
    total_records INTEGER DEFAULT 0,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    duplicate_skipped INTEGER DEFAULT 0,
    
    -- Metadados da Importação
    header_row INTEGER, -- Linha do cabeçalho encontrado
    date_range_start DATE,
    date_range_end DATE,
    processing_time_ms INTEGER,
    
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
    error_log JSONB DEFAULT '[]',
    processing_summary JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para Performance (Essencial para Big Data)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform_id ON orders(platform_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_platform ON orders(created_at_platform);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_import_batch_id ON orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_sku_variation ON orders(sku_variation);
CREATE INDEX IF NOT EXISTS idx_orders_net_profit ON orders(net_profit);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_total_revenue ON products(total_revenue);
CREATE INDEX IF NOT EXISTS idx_products_avg_margin ON products(avg_margin_percent);

CREATE INDEX IF NOT EXISTS idx_product_costs_sku ON product_costs_history(sku);
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

-- Trigger para cálculo automático de métricas de produtos
CREATE OR REPLACE FUNCTION update_product_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar métricas do produto quando um pedido é inserido/atualizado
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE products 
        SET 
            total_orders = (
                SELECT COUNT(*) 
                FROM orders o 
                WHERE o.sku_variation = NEW.sku_variation 
                  AND o.status NOT IN ('Cancelado', 'Devolução/Reembolso')
            ),
            total_revenue = (
                SELECT COALESCE(SUM(o.sale_price), 0) 
                FROM orders o 
                WHERE o.sku_variation = NEW.sku_variation 
                  AND o.status NOT IN ('Cancelado', 'Devolução/Reembolso')
            ),
            avg_ticket = (
                SELECT COALESCE(AVG(o.sale_price), 0) 
                FROM orders o 
                WHERE o.sku_variation = NEW.sku_variation 
                  AND o.status NOT IN ('Cancelado', 'Devolução/Reembolso')
            ),
            avg_margin_percent = (
                SELECT CASE 
                    WHEN SUM(o.sale_price) > 0 
                    THEN (SUM(o.net_profit) / SUM(o.sale_price)) 
                    ELSE 0 
                END
                FROM orders o 
                WHERE o.sku_variation = NEW.sku_variation 
                  AND o.status NOT IN ('Cancelado', 'Devolução/Reembolso')
            ),
            last_order_date = (
                SELECT MAX(o.created_at_platform) 
                FROM orders o 
                WHERE o.sku_variation = NEW.sku_variation
            )
        WHERE sku = NEW.sku_variation;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_product_metrics 
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_product_metrics();

-- Trigger principal para cálculo de lucro real (regras empresariais)
CREATE OR REPLACE FUNCTION calculate_real_profit()
RETURNS TRIGGER AS $$
DECLARE
    calculated_fees DECIMAL;
    calculated_cost DECIMAL;
    calculated_profit DECIMAL;
BEGIN
    -- Calcular total de taxas (soma precisa)
    calculated_fees = COALESCE(NEW.commission_fee, 0) + 
                     COALESCE(NEW.service_fee, 0) + 
                     COALESCE(NEW.transaction_fee, 0) +
                     COALESCE(NEW.seller_voucher, 0) +
                     COALESCE(NEW.seller_coin_cashback, 0) +
                     COALESCE(NEW.reverse_shipping_fee, 0);
    
    NEW.total_fees = calculated_fees;
    
    -- Buscar custo do produto na data da venda (histórico preciso)
    IF NEW.sku_variation IS NOT NULL THEN
        SELECT cost INTO calculated_cost
        FROM product_costs_history 
        WHERE sku = NEW.sku_variation 
          AND effective_date <= DATE(NEW.created_at_platform)
        ORDER BY effective_date DESC 
        LIMIT 1;
        
        IF calculated_cost IS NULL THEN
            -- Se não encontrar no histórico, usar custo atual
            SELECT current_cost INTO calculated_cost
            FROM products 
            WHERE sku = NEW.sku_variation;
        END IF;
    ELSE
        calculated_cost := 0;
    END IF;
    
    NEW.cost_at_sale = COALESCE(calculated_cost, 0);
    
    -- Calcular lucro bruto (antes das regras especiais)
    calculated_profit := NEW.sale_price - calculated_fees - NEW.cost_at_sale;
    NEW.gross_profit = calculated_profit;
    
    -- APLICAR REGRAS EMPRESARIAIS ESPECÍFICAS
    
    -- REGRA 1: Cancelados
    IF NEW.status = 'Cancelado' THEN
        -- Se cancelado, lucro é 0, EXCETO se houver taxas não estornadas
        IF NEW.reverse_shipping_fee > 0 OR calculated_fees > 0 THEN
            -- Prejuízo igual às taxas não estornadas
            NEW.net_profit := -(NEW.reverse_shipping_fee + calculated_fees);
        ELSE
            NEW.net_profit := 0;
        END IF;
    
    -- REGRA 2: Devolução/Reembolso
    ELSEIF NEW.status = 'Devolução/Reembolso' THEN
        -- Considerar custo do produto + fretes como prejuízo total
        NEW.net_profit := -(NEW.cost_at_sale + NEW.reverse_shipping_fee + calculated_fees);
    
    -- REGRA 3: Pedidos normais
    ELSE
        -- Lucro líquido normal
        NEW.net_profit := calculated_profit;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calculate_real_profit 
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION calculate_real_profit();

-- Views para Consultas Eficientes (Dashboard Empresarial)
CREATE OR REPLACE VIEW monthly_summary_enterprise AS
SELECT 
    o.user_id,
    DATE_TRUNC('month', o.created_at_platform) as month,
    p.name as platform_name,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN o.status = 'Concluído' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.status = 'Cancelado' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.status = 'Devolução/Reembolso' THEN 1 END) as returned_orders,
    
    -- Financeiro
    SUM(o.sale_price) as gross_revenue,
    SUM(o.total_fees) as total_fees,
    SUM(o.cost_at_sale) as total_cost,
    SUM(o.gross_profit) as gross_profit,
    SUM(o.net_profit) as net_profit,
    
    -- Métricas
    AVG(o.sale_price) as avg_ticket,
    CASE 
        WHEN SUM(o.sale_price) > 0 
        THEN (SUM(o.net_profit) / SUM(o.sale_price)) * 100 
        ELSE 0 
    END as profit_margin_percent,
    
    -- Performance
    COUNT(CASE WHEN o.net_profit > 0 THEN 1 END) as profitable_orders,
    COUNT(CASE WHEN o.net_profit < 0 THEN 1 END) as loss_orders,
    
    SUM(CASE WHEN o.net_profit > 0 THEN o.net_profit ELSE 0 END) as total_profit,
    SUM(CASE WHEN o.net_profit < 0 THEN ABS(o.net_profit) ELSE 0 END) as total_loss,
    
    -- Taxas detalhadas
    SUM(o.commission_fee) as total_commission,
    SUM(o.service_fee) as total_service_fee,
    SUM(o.transaction_fee) as total_transaction_fee,
    SUM(o.seller_voucher) as total_seller_voucher,
    SUM(o.seller_coin_cashback) as total_coin_cashback,
    SUM(o.reverse_shipping_fee) as total_reverse_shipping
    
FROM orders o
JOIN platforms p ON o.platform_id = p.id
GROUP BY o.user_id, DATE_TRUNC('month', o.created_at_platform), p.name
ORDER BY month DESC;

-- View para Detetive Financeiro (DRE por Pedido)
CREATE OR REPLACE VIEW order_financial_waterfall AS
SELECT 
    o.id,
    o.user_id,
    o.order_id,
    p.name as platform_name,
    o.status,
    o.created_at_platform,
    o.paid_at,
    o.product_name,
    o.sku_variation,
    
    -- Waterfall Financeiro Completo
    o.sale_price as gross_revenue,
    o.commission_fee,
    o.service_fee,
    o.transaction_fee,
    o.seller_voucher,
    o.seller_coin_cashback,
    o.reverse_shipping_fee,
    o.total_fees,
    o.cost_at_sale,
    o.gross_profit,
    o.net_profit,
    
    -- Indicadores e Análise
    CASE 
        WHEN o.net_profit > 0 THEN 'Lucro'
        WHEN o.net_profit < 0 THEN 'Prejuízo'
        ELSE 'Neutro'
    END as profit_status,
    
    -- Percentuais para Análise
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.total_fees / o.sale_price) * 100 
        ELSE 0 
    END as fees_percent,
    
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.cost_at_sale / o.sale_price) * 100 
        ELSE 0 
    END as cost_percent,
    
    CASE 
        WHEN o.sale_price > 0 
        THEN (o.net_profit / o.sale_price) * 100 
        ELSE 0 
    END as profit_margin_percent,
    
    -- Métricas de Performance
    CASE 
        WHEN o.total_fees > 0 
        THEN (o.commission_fee / o.total_fees) * 100 
        ELSE 0 
    END as commission_weight,
    
    -- Flags para Análise
    CASE 
        WHEN o.status = 'Cancelado' AND (o.reverse_shipping_fee > 0 OR o.total_fees > 0) 
        THEN true 
        ELSE false 
    END as has_cancellation_costs,
    
    CASE 
        WHEN o.status = 'Devolução/Reembolso' 
        THEN true 
        ELSE false 
    END as is_returned
    
FROM orders o
JOIN platforms p ON o.platform_id = p.id;

-- View para Análise de Produtos (CRM Empresarial)
CREATE OR REPLACE VIEW product_performance_analysis AS
SELECT 
    p.sku,
    p.name,
    p.category,
    p.current_cost,
    p.current_price,
    p.total_orders,
    p.total_revenue,
    p.avg_ticket,
    p.avg_margin_percent,
    p.last_order_date,
    
    -- Análise de Rentabilidade
    COUNT(o.id) as order_count,
    SUM(o.sale_price) as total_sales,
    SUM(o.net_profit) as total_profit,
    SUM(CASE WHEN o.net_profit > 0 THEN o.net_profit ELSE 0 END) as profit_orders_total,
    SUM(CASE WHEN o.net_profit < 0 THEN ABS(o.net_profit) ELSE 0 END) as loss_orders_total,
    
    -- Métricas Avançadas
    COUNT(CASE WHEN o.net_profit > 0 THEN 1 END) as profitable_orders,
    COUNT(CASE WHEN o.net_profit < 0 THEN 1 END) as loss_orders,
    
    CASE 
        WHEN COUNT(o.id) > 0 
        THEN (COUNT(CASE WHEN o.net_profit > 0 THEN 1 END) / COUNT(o.id)) * 100 
        ELSE 0 
    END as success_rate_percent,
    
    -- Análise de Custos
    AVG(o.cost_at_sale) as avg_cost_per_order,
    CASE 
        WHEN SUM(o.sale_price) > 0 
        THEN (SUM(o.cost_at_sale) / SUM(o.sale_price)) * 100 
        ELSE 0 
    END as cost_of_goods_percent,
    
    -- Últimas métricas
    MAX(o.created_at_platform) as last_sale_date,
    MIN(o.created_at_platform) as first_sale_date
    
FROM products p
LEFT JOIN orders o ON p.sku = o.sku_variation
GROUP BY p.sku, p.name, p.category, p.current_cost, p.current_price, 
         p.total_orders, p.total_revenue, p.avg_ticket, p.avg_margin_percent, p.last_order_date
ORDER BY total_sales DESC;

-- Inserir plataformas padrão com configurações específicas
INSERT INTO platforms (name, code, fee_config, import_config) VALUES 
('Shopee', 'SHOPEE', 
 '{"commission_rate": 0.20, "service_fee_rate": 0.08, "fixed_fee": 3.00}',
 '{"header_patterns": ["ID do pedido"], "date_formats": ["YYYY-MM-DD", "DD/MM/YYYY"], "skip_rows": 11}'
),
('Mercado Livre', 'ML', 
 '{"commission_rate": 0.16, "fixed_fee": 5.00}',
 '{"header_patterns": ["ID de pedido"], "date_formats": ["YYYY-MM-DD"], "skip_rows": 0}'
),
('Amazon', 'AMZ', 
 '{"commission_rate": 0.15, "fixed_fee": 0.00}',
 '{"header_patterns": ["Order ID"], "date_formats": ["YYYY-MM-DD"], "skip_rows": 0}'
)
ON CONFLICT (code) DO NOTHING;

-- Comentários de Documentação Enterprise
COMMENT ON TABLE users IS 'Usuários do sistema (Multi-tenant Enterprise)';
COMMENT ON TABLE platforms IS 'Plataformas de e-commerce suportadas com configurações específicas';
COMMENT ON TABLE products IS 'Catálogo master de produtos (SKU global como PK)';
COMMENT ON TABLE product_costs_history IS 'Histórico de custos para DRE temporal preciso (essencial para contabilidade)';
COMMENT ON TABLE orders IS 'Pedidos com regras empresariais de lucro real (coração do CRM)';
COMMENT ON TABLE fee_settings IS 'Configurações personalizadas de taxas por usuário/plataforma';
COMMENT ON TABLE import_batches IS 'Controle enterprise de lotes com auditoria completa';

COMMENT ON COLUMN orders.net_profit IS 'Lucro líquido final após regras empresariais (cancelamentos, devoluções)';
COMMENT ON COLUMN orders.cost_at_sale IS 'Custo do produto na data da venda (essencial para precisão histórica)';
COMMENT ON COLUMN orders.seller_coin_cashback IS 'Seller Absorbed Coin Cashback (moedas Shopee)';
COMMENT ON COLUMN orders.processing_notes IS 'Notas do processamento para auditoria e debug';

COMMENT ON VIEW monthly_summary_enterprise IS 'Dashboard empresarial com métricas financeiras completas';
COMMENT ON VIEW order_financial_waterfall IS 'DRE individual por pedido com waterfall financeiro completo';
COMMENT ON VIEW product_performance_analysis IS 'Análise de performance de produtos para decisões estratégicas';
