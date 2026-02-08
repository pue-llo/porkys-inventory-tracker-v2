-- ============================================
-- INVENTORY TRACKER V2 — COMPLETE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- STAFF PROFILES
CREATE TABLE staff_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'foh' CHECK (role IN ('foh', 'boh', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_staff_pin ON staff_profiles(pin_hash) WHERE is_active = true;

-- CATEGORIES
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO categories (id, name, color, sort_order) VALUES
  ('liquor', 'Liquor', 'purple', 1),
  ('beer', 'Beer', 'amber', 2),
  ('fountain', 'Fountain Drinks', 'cyan', 3);

-- PRODUCTS
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  image_url TEXT,
  bottle_size TEXT,
  num_boxes INTEGER DEFAULT 1,
  per_box INTEGER DEFAULT 1,
  price_per_unit BIGINT DEFAULT 0,
  cost_per_unit BIGINT DEFAULT 0,
  par_level INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id) WHERE is_active = true;

-- INVENTORY DAILY SNAPSHOTS
CREATE TABLE inventory_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_stock INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  wasted INTEGER DEFAULT 0,
  restocked INTEGER DEFAULT 0,
  closing_stock INTEGER GENERATED ALWAYS AS (opening_stock - sold - wasted + restocked) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, date)
);
CREATE INDEX idx_inventory_daily_date ON inventory_daily(date, product_id);

-- TABLES
CREATE TABLE tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number INTEGER NOT NULL,
  name TEXT DEFAULT '',
  guest_count INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opened_by UUID REFERENCES staff_profiles(id),
  closed_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE(table_number, date)
);
CREATE INDEX idx_tables_active ON tables(date, is_active) WHERE is_active = true;

-- ORDERS
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  price_per_unit BIGINT DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  total BIGINT DEFAULT 0,
  staff_id UUID REFERENCES staff_profiles(id),
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_table ON orders(table_id);

-- BOH DISBURSEMENTS
CREATE TABLE boh_disbursements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  boh_staff_id UUID REFERENCES staff_profiles(id),
  boh_staff_name TEXT,
  foh_staff_id UUID REFERENCES staff_profiles(id),
  foh_staff_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WASTE LOG (Phase 2, but table created now)
CREATE TABLE waste_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  reason TEXT NOT NULL CHECK (reason IN ('broken', 'spill', 'comp', 'spoiled', 'other')),
  notes TEXT DEFAULT '',
  staff_id UUID REFERENCES staff_profiles(id),
  staff_name TEXT,
  value_lost BIGINT DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EOD REPORTS (Phase 2)
CREATE TABLE eod_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_sales BIGINT DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_tables INTEGER DEFAULT 0,
  total_waste_value BIGINT DEFAULT 0,
  cash_in_drawer BIGINT DEFAULT 0,
  expected_cash BIGINT DEFAULT 0,
  variance BIGINT DEFAULT 0,
  notes TEXT DEFAULT '',
  closed_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- STAFF MESSAGES (Phase 2)
CREATE TABLE staff_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id),
  staff_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ACTIVITY LOG
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  staff_id UUID REFERENCES staff_profiles(id),
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_log_date ON activity_log(created_at DESC);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

CREATE OR REPLACE VIEW v_restock_alerts AS
SELECT p.id, p.name, p.category_id, p.par_level, p.num_boxes, p.per_box,
  COALESCE(i.closing_stock, p.num_boxes * p.per_box) as current_stock
FROM products p
LEFT JOIN inventory_daily i ON p.id = i.product_id AND i.date = CURRENT_DATE
WHERE p.is_active = true AND p.par_level > 0
  AND COALESCE(i.closing_stock, p.num_boxes * p.per_box) <= p.par_level;

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE boh_disbursements;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE waste_log;

-- ============================================
-- ROW LEVEL SECURITY (permissive for MVP)
-- ============================================

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE boh_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (MVP — tighten later with proper auth)
CREATE POLICY "Allow all for anon" ON staff_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON inventory_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON boh_disbursements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON waste_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON eod_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON staff_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON activity_log FOR ALL USING (true) WITH CHECK (true);
