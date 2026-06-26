-- ============================================================================
-- BUFFALO COFFEE & FOOD - SETUP COMPLETO (ONE SHOT, IDEMPOTENTE)
-- ============================================================================
-- Proposito:
--   Script unico para dejar una Supabase NUEVA 100% funcional para el POS
--   (Next.js + Supabase/Postgres) de "Buffalo Coffee & Food".
--   Crea schema, funciones/RPCs, RLS en TODAS las tablas, permisos y datos
--   semilla (catalogo de cafeteria de ejemplo). Es idempotente: se puede
--   ejecutar mas de una vez sin error.
--
-- Como aplicarlo:
--   1) Abrir el SQL Editor del proyecto Supabase nuevo.
--   2) Pegar este archivo completo y ejecutar (Run).
--   3) Crear el usuario administrador (ver bloque "ADMIN" mas abajo).
--
-- Como crear el admin (recomendado):
--   A) Authentication > Users > Add user: email + password, "Auto Confirm".
--   B) Copiar el UUID del usuario creado y ejecutar:
--        INSERT INTO public.users (id, email, name, full_name, role, is_active)
--        VALUES ('<UUID_DE_AUTH>', 'admin@buffalo.com', 'Administrador',
--                'Administrador', 'admin', TRUE)
--        ON CONFLICT (id) DO UPDATE
--          SET role = 'admin', is_active = TRUE,
--              email = EXCLUDED.email, updated_at = NOW();
--   El script tambien intenta crear el admin automaticamente al final si la
--   instancia permite escribir en auth.users (ver bloque ADMIN).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SET search_path = public;

-- Pre-create helper objects required by base schema ordering.
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Base schema references is_admin() before the functions section is loaded.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(role) = 'admin' AND is_active = TRUE
  );
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

-- ===================== ESQUEMA =====================

-- ===================== ENUMS =====================
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'waiter', 'kitchen', 'delivery', 'customer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sale_type AS ENUM ('shop', 'bar', 'delivery', 'online'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sale_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE expense_category AS ENUM ('supplies', 'utilities', 'salaries', 'maintenance', 'rent', 'taxes', 'marketing', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'completed', 'overdue'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'error'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE cash_register_type AS ENUM ('shop', 'bar'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE cash_register_session_status AS ENUM ('open', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'night'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===================== TABLAS BASE =====================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'waiter',
  phone TEXT, address TEXT, 
  pin TEXT, is_active BOOLEAN DEFAULT true, dni TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibility column used by app/admin bootstrap.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT, parent_id UUID REFERENCES categories(id),
  display_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true,
  cocina_only BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT, code TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price DECIMAL(10,2) DEFAULT 0, cost DECIMAL(10,2) DEFAULT 0,
  stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'unit', image_url TEXT,
  is_active BOOLEAN DEFAULT true, unlimited_stock BOOLEAN DEFAULT false,
  is_weighable BOOLEAN DEFAULT false, requires_kitchen BOOLEAN DEFAULT false,
  discount_percentage DECIMAL(5,2) DEFAULT 0, is_offer BOOLEAN DEFAULT false,
  venta_mayor_habilitada BOOLEAN DEFAULT false, requiere_pesaje BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT,
  cuit TEXT, tax_condition TEXT, zone UUID, route TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0, current_balance DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bar Layout
CREATE TABLE IF NOT EXISTS bar_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE,
  position_x DECIMAL NOT NULL,
  position_y DECIMAL NOT NULL,
  width DECIMAL DEFAULT 1,
  height DECIMAL DEFAULT 1,
  shape VARCHAR DEFAULT 'square', -- 'square', 'circle', 'rectangle'
  label TEXT,
  area VARCHAR DEFAULT 'salon', -- 'salon', 'vereda'
  zone VARCHAR DEFAULT 'principal', -- 'principal', 'exterior'
  size_variant VARCHAR DEFAULT 'normal', -- 'small', 'normal', 'large'
  custom_name TEXT,
  custom_color TEXT,
  order_index INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT, delivery_fee DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, address TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, position TEXT, salary DECIMAL(10,2) DEFAULT 0,
  hire_date DATE, phone TEXT, address TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== TABLAS POS/BAR =====================

-- Cash Registers
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  type cash_register_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cash Register Sessions
CREATE TABLE IF NOT EXISTS cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  area VARCHAR(10) NOT NULL CHECK (area IN ('shop', 'bar')),
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10,2), expected_amount DECIMAL(10,2), difference DECIMAL(10,2),
  status cash_register_session_status NOT NULL DEFAULT 'open',
  shift shift_type NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ,
  opening_notes TEXT, closing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store Settings
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT DEFAULT 'Buffalo Coffee & Food',
  daily_menu_content TEXT, daily_menu_active BOOLEAN DEFAULT false,
  estimated_delivery_time INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== VENTAS =====================

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT,
  cash_register_session_id UUID REFERENCES cash_register_sessions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id),
  employee_id UUID REFERENCES employees(id),
  user_id UUID REFERENCES users(id),
  waiter_id UUID REFERENCES users(id),
  type TEXT, table_number INTEGER,
  subtotal DECIMAL(10,2), tax DECIMAL(10,2), discount DECIMAL(10,2),
  total DECIMAL(10,2), total_amount DECIMAL(10,2),
  payment_method TEXT, payment_status TEXT DEFAULT 'pending', status TEXT DEFAULT 'pending',
  notes TEXT, source TEXT,
  account_printed_at TIMESTAMPTZ,
  grouped_tables INTEGER[],
  is_table_group BOOLEAN DEFAULT FALSE,
  route_id UUID, route_name TEXT, trip_id UUID, trip_name TEXT,
  is_historical BOOLEAN DEFAULT false, historical_date TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER, unit_price DECIMAL(10,2), total_price DECIMAL(10,2),
  price DECIMAL(10,2), subtotal DECIMAL(10,2), customization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Payments
CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table Payments (pagos parciales de mesas)
CREATE TABLE IF NOT EXISTS table_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Sale Item Payments
CREATE TABLE IF NOT EXISTS sale_item_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  table_payment_id UUID REFERENCES table_payments(id) ON DELETE SET NULL,
  quantity_paid INTEGER NOT NULL CHECK (quantity_paid > 0),
  amount_paid DECIMAL(12,2) NOT NULL CHECK (amount_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Table Changes
CREATE TABLE IF NOT EXISTS table_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  old_table_number INTEGER, new_table_number INTEGER,
  changed_by UUID NOT NULL REFERENCES users(id), reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table Splits
CREATE TABLE IF NOT EXISTS table_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  split_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  split_number INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method_id UUID REFERENCES payment_methods(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== CAJA =====================

-- Cash Incomes
CREATE TABLE IF NOT EXISTS cash_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_session_id UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Cash
CREATE TABLE IF NOT EXISTS daily_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL, user_id UUID REFERENCES users(id), status TEXT DEFAULT 'open',
  opening_amount DECIMAL(10,2) DEFAULT 0, closing_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Movements
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_cash_id UUID REFERENCES daily_cash(id) ON DELETE CASCADE,
  type TEXT NOT NULL, amount DECIMAL(10,2) NOT NULL,
  description TEXT, payment_method TEXT, reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL, amount DECIMAL(10,2) NOT NULL,
  category TEXT, payment_method TEXT, user_id UUID REFERENCES users(id),
  cash_register_session_id UUID REFERENCES cash_register_sessions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Shifts
CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  cash_register_session_id UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(), check_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== COMPRAS E INVENTARIO =====================

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_number TEXT UNIQUE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT, user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return', 'production')),
  quantity INTEGER NOT NULL, reference_id UUID, notes TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL, quantity INTEGER NOT NULL,
  reference_type TEXT, reference_id UUID, notes TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== BAR LAYOUT =====================

CREATE TABLE IF NOT EXISTS bar_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL,
  x DECIMAL(10,2) NOT NULL DEFAULT 0, y DECIMAL(10,2) NOT NULL DEFAULT 0,
  width DECIMAL(10,2) NOT NULL DEFAULT 80, height DECIMAL(10,2) NOT NULL DEFAULT 80,
  shape VARCHAR(20) NOT NULL DEFAULT 'rectangle',
  label TEXT, area VARCHAR(20) NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== PERMISOS =====================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, description TEXT,
  module TEXT NOT NULL DEFAULT '', action TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- ===================== RRHH (modulo legacy 'employees', referenciado por sales.employee_id) =====================

CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL, check_in TIMESTAMPTZ, check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_attendance_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  period_type TEXT DEFAULT 'vacation', status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, payment_date DATE NOT NULL,
  payment_type TEXT DEFAULT 'salary', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, date DATE NOT NULL,
  description TEXT, status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== RUTAS Y VIAJES =====================

CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, 
  zone_id UUID REFERENCES zones(id), 
  driver_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  date DATE NOT NULL, status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id), quantity INTEGER DEFAULT 0,
  loaded_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id), total DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT, status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_sale_id UUID REFERENCES route_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id), quantity INTEGER,
  unit_price DECIMAL(10,2), total_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, date DATE NOT NULL,
  driver_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  vehicle TEXT, status TEXT DEFAULT 'planning', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id), zone_name TEXT, delivery_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER DEFAULT 0, loaded_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id), total DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT, status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_sale_id UUID REFERENCES trip_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER, unit_price DECIMAL(10,2), total_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_zone_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_zone_id UUID REFERENCES trip_zones(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id), total DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT, status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_zone_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_zone_sale_id UUID REFERENCES trip_zone_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER, unit_price DECIMAL(10,2), total_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repartidor_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id), customer_name TEXT,
  zone_id UUID REFERENCES zones(id), zone_name TEXT,
  total DECIMAL(10,2) DEFAULT 0, payment_method TEXT,
  status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== CRÉDITOS Y PAGOS =====================

CREATE TABLE IF NOT EXISTS customer_credit_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL, amount DECIMAL(10,2) NOT NULL,
  description TEXT, reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_contrafactura_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, description TEXT, reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deferred_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id), 
  sale_id UUID REFERENCES sales(id),
  user_id UUID REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL, paid_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending', due_date DATE, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deferred_payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deferred_payment_id UUID REFERENCES deferred_payments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, payment_method TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id), 
  amount DECIMAL(10,2) NOT NULL,
  bank TEXT, check_number TEXT, due_date DATE,
  status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comodatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER DEFAULT 1, status TEXT DEFAULT 'active',
  delivery_date DATE, return_date DATE, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================== OTROS =====================

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  product_ids UUID[] DEFAULT '{}', category_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id), 
  action TEXT NOT NULL,
  entity_type TEXT, entity_id UUID,
  old_data JSONB, new_data JSONB, metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- [FIX orden] invoices y price_history se crean aca (antes de la RLS e indices que las referencian)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL DEFAULT 'C',
  invoice_number TEXT NOT NULL,
  point_of_sale INTEGER NOT NULL,
  cae TEXT NOT NULL,
  cae_expiration TIMESTAMPTZ NOT NULL,
  thermal_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sale_id)
);

CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT price_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- ===================== ÍNDICES =====================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cash_register_session_id ON sales(cash_register_session_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_table_number ON sales(table_number);
CREATE INDEX IF NOT EXISTS idx_sales_waiter_id ON sales(waiter_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_payment_method_id ON sale_payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_table_payments_sale_id ON table_payments(sale_id);
-- [FIX orden] sale_type debe existir antes de este indice parcial (el patch de columnas vive mas abajo)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_type TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_pending_table_unique ON sales(table_number) WHERE table_number IS NOT NULL AND sale_type = 'table' AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_item_payments_payment_item ON sale_item_payments(table_payment_id, sale_item_id);
CREATE INDEX IF NOT EXISTS idx_table_changes_sale_id ON table_changes(sale_id);
CREATE INDEX IF NOT EXISTS idx_table_splits_sale_id ON table_splits(sale_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_type ON cash_registers(type);
CREATE INDEX IF NOT EXISTS idx_crs_cash_register_id ON cash_register_sessions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_crs_status ON cash_register_sessions(status);
CREATE INDEX IF NOT EXISTS idx_crs_opened_at ON cash_register_sessions(opened_at);
CREATE INDEX IF NOT EXISTS idx_cash_incomes_session_id ON cash_incomes(cash_register_session_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts_user_id ON work_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_work_shifts_session_id ON work_shifts(cash_register_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_bar_layout_table_number ON bar_layout(table_number);
CREATE INDEX IF NOT EXISTS idx_bar_layout_area ON bar_layout(area);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_zone ON customers(zone);

-- RLS por tabla
-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_view_own" ON public.users;
DROP POLICY IF EXISTS "admin_view_all" ON public.users;
DROP POLICY IF EXISTS "admin_full_control" ON public.users;
CREATE POLICY "user_view_own" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin_view_all" ON public.users FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "admin_full_control" ON public.users FOR ALL TO authenticated USING (is_admin());

-- Politicas explicitas para las tablas operativas y publicas
CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND is_active = TRUE
  );
END;
$$;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "staff_manage_app_settings" ON public.app_settings;
CREATE POLICY "staff_manage_app_settings" ON public.app_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_cash_registers" ON public.cash_registers;
DROP POLICY IF EXISTS "staff_manage_cash_registers" ON public.cash_registers;
CREATE POLICY "staff_manage_cash_registers" ON public.cash_registers FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "staff_manage_payment_methods" ON public.payment_methods;
CREATE POLICY "staff_manage_payment_methods" ON public.payment_methods FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
DROP POLICY IF EXISTS "authenticated_full_access_categories" ON public.categories;
DROP POLICY IF EXISTS "staff_manage_categories" ON public.categories;
CREATE POLICY "public_read_categories" ON public.categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "staff_manage_categories" ON public.categories FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_products" ON public.products;
DROP POLICY IF EXISTS "authenticated_full_access_products" ON public.products;
DROP POLICY IF EXISTS "staff_manage_products" ON public.products;
CREATE POLICY "public_read_products" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "staff_manage_products" ON public.products FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "authenticated_full_access_store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "staff_manage_store_settings" ON public.store_settings;
CREATE POLICY "public_read_store_settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_manage_store_settings" ON public.store_settings FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.bar_layout ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_bar_layout" ON public.bar_layout;
DROP POLICY IF EXISTS "staff_manage_bar_layout" ON public.bar_layout;
CREATE POLICY "staff_manage_bar_layout" ON public.bar_layout FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_whatsapp_sales" ON public.sales;
DROP POLICY IF EXISTS "authenticated_full_access_sales" ON public.sales;
DROP POLICY IF EXISTS "staff_manage_sales" ON public.sales;
CREATE POLICY "staff_manage_sales" ON public.sales FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "staff_manage_sale_items" ON public.sale_items;
CREATE POLICY "staff_manage_sale_items" ON public.sale_items FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_sale_payments" ON public.sale_payments;
DROP POLICY IF EXISTS "staff_manage_sale_payments" ON public.sale_payments;
CREATE POLICY "staff_manage_sale_payments" ON public.sale_payments FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.table_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_table_payments" ON public.table_payments;
DROP POLICY IF EXISTS "staff_manage_table_payments" ON public.table_payments;
CREATE POLICY "staff_manage_table_payments" ON public.table_payments FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.sale_item_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_sale_item_payments" ON public.sale_item_payments;
DROP POLICY IF EXISTS "staff_manage_sale_item_payments" ON public.sale_item_payments;
CREATE POLICY "staff_manage_sale_item_payments" ON public.sale_item_payments FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.table_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_table_changes" ON public.table_changes;
DROP POLICY IF EXISTS "staff_manage_table_changes" ON public.table_changes;
CREATE POLICY "staff_manage_table_changes" ON public.table_changes FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.table_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_table_splits" ON public.table_splits;
DROP POLICY IF EXISTS "staff_manage_table_splits" ON public.table_splits;
CREATE POLICY "staff_manage_table_splits" ON public.table_splits FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_open_cash_register_sessions" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "authenticated_full_access_cash_register_sessions" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "staff_manage_cash_register_sessions" ON public.cash_register_sessions;
CREATE POLICY "public_read_open_cash_register_sessions" ON public.cash_register_sessions FOR SELECT TO anon, authenticated USING (status = 'open');
CREATE POLICY "staff_manage_cash_register_sessions" ON public.cash_register_sessions FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.cash_incomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_cash_incomes" ON public.cash_incomes;
DROP POLICY IF EXISTS "staff_manage_cash_incomes" ON public.cash_incomes;
CREATE POLICY "staff_manage_cash_incomes" ON public.cash_incomes FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.daily_cash ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_daily_cash" ON public.daily_cash;
DROP POLICY IF EXISTS "staff_manage_daily_cash" ON public.daily_cash;
CREATE POLICY "staff_manage_daily_cash" ON public.daily_cash FOR ALL TO authenticated USING (is_active_staff()) WITH CHECK (is_active_staff());

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_permissions" ON public.permissions;
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.permissions;
CREATE POLICY "admin_manage_permissions" ON public.permissions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "admin_manage_role_permissions" ON public.role_permissions;
CREATE POLICY "admin_manage_role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access_user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "admin_manage_user_permissions" ON public.user_permissions;
CREATE POLICY "admin_manage_user_permissions" ON public.user_permissions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ===================== RLS: TABLAS RESTANTES (seguridad por defecto) =====================
-- Toda tabla operativa sin RLS previa queda restringida a staff activo (is_active_staff()).
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_suppliers ON public.suppliers;
CREATE POLICY staff_manage_suppliers ON public.suppliers FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_customers ON public.customers;
CREATE POLICY staff_manage_customers ON public.customers FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_zones ON public.zones;
CREATE POLICY staff_manage_zones ON public.zones FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_warehouses ON public.warehouses;
CREATE POLICY staff_manage_warehouses ON public.warehouses FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_employees ON public.employees;
CREATE POLICY staff_manage_employees ON public.employees FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_cash_movements ON public.cash_movements;
CREATE POLICY staff_manage_cash_movements ON public.cash_movements FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_expenses ON public.expenses;
CREATE POLICY staff_manage_expenses ON public.expenses FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_work_shifts ON public.work_shifts;
CREATE POLICY staff_manage_work_shifts ON public.work_shifts FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_purchases ON public.purchases;
CREATE POLICY staff_manage_purchases ON public.purchases FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_purchase_items ON public.purchase_items;
CREATE POLICY staff_manage_purchase_items ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_inventory_movements ON public.inventory_movements;
CREATE POLICY staff_manage_inventory_movements ON public.inventory_movements FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_stock_movements ON public.stock_movements;
CREATE POLICY staff_manage_stock_movements ON public.stock_movements FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_employee_attendance ON public.employee_attendance;
CREATE POLICY staff_manage_employee_attendance ON public.employee_attendance FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.employee_attendance_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_employee_attendance_periods ON public.employee_attendance_periods;
CREATE POLICY staff_manage_employee_attendance_periods ON public.employee_attendance_periods FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.employee_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_employee_payments ON public.employee_payments;
CREATE POLICY staff_manage_employee_payments ON public.employee_payments FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_employee_advances ON public.employee_advances;
CREATE POLICY staff_manage_employee_advances ON public.employee_advances FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.daily_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_daily_routes ON public.daily_routes;
CREATE POLICY staff_manage_daily_routes ON public.daily_routes FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.route_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_route_products ON public.route_products;
CREATE POLICY staff_manage_route_products ON public.route_products FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.route_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_route_sales ON public.route_sales;
CREATE POLICY staff_manage_route_sales ON public.route_sales FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.route_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_route_sale_items ON public.route_sale_items;
CREATE POLICY staff_manage_route_sale_items ON public.route_sale_items FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trips ON public.trips;
CREATE POLICY staff_manage_trips ON public.trips FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_zones ON public.trip_zones;
CREATE POLICY staff_manage_trip_zones ON public.trip_zones FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_products ON public.trip_products;
CREATE POLICY staff_manage_trip_products ON public.trip_products FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_sales ON public.trip_sales;
CREATE POLICY staff_manage_trip_sales ON public.trip_sales FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_sale_items ON public.trip_sale_items;
CREATE POLICY staff_manage_trip_sale_items ON public.trip_sale_items FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_zone_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_zone_sales ON public.trip_zone_sales;
CREATE POLICY staff_manage_trip_zone_sales ON public.trip_zone_sales FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.trip_zone_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_trip_zone_sale_items ON public.trip_zone_sale_items;
CREATE POLICY staff_manage_trip_zone_sale_items ON public.trip_zone_sale_items FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.repartidor_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_repartidor_sales ON public.repartidor_sales;
CREATE POLICY staff_manage_repartidor_sales ON public.repartidor_sales FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.customer_credit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_customer_credit_movements ON public.customer_credit_movements;
CREATE POLICY staff_manage_customer_credit_movements ON public.customer_credit_movements FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.customer_contrafactura_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_customer_contrafactura_movements ON public.customer_contrafactura_movements;
CREATE POLICY staff_manage_customer_contrafactura_movements ON public.customer_contrafactura_movements FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.customer_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_customer_prices ON public.customer_prices;
CREATE POLICY staff_manage_customer_prices ON public.customer_prices FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.deferred_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_deferred_payments ON public.deferred_payments;
CREATE POLICY staff_manage_deferred_payments ON public.deferred_payments FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.deferred_payment_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_deferred_payment_installments ON public.deferred_payment_installments;
CREATE POLICY staff_manage_deferred_payment_installments ON public.deferred_payment_installments FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_checks ON public.checks;
CREATE POLICY staff_manage_checks ON public.checks FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.comodatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_comodatos ON public.comodatos;
CREATE POLICY staff_manage_comodatos ON public.comodatos FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_promotions ON public.promotions;
CREATE POLICY staff_manage_promotions ON public.promotions FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_invoices ON public.invoices;
CREATE POLICY staff_manage_invoices ON public.invoices FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_price_history ON public.price_history;
CREATE POLICY staff_manage_price_history ON public.price_history FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

-- audit_logs: solo administradores (no legible ni borrable por staff comun)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_manage_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS admin_manage_audit_logs ON public.audit_logs;
CREATE POLICY admin_manage_audit_logs ON public.audit_logs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ===================== CONSTRAINT FACTURACION (idempotencia AFIP) =====================
-- Garantiza una sola factura por venta (soporta el upsert idempotente de AFIP).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'invoices'
      AND c.conname = 'invoices_sale_id_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_sale_id_unique UNIQUE (sale_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- ===================== DATOS INICIALES =====================
INSERT INTO cash_registers (name, type, is_active) VALUES ('CAJA BAR', 'bar', true) ON CONFLICT (name) DO NOTHING;
INSERT INTO payment_methods (id, name, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Efectivo', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'Transferencia', true),
  ('550e8400-e29b-41d4-a716-446655440004', 'QR', true),
  ('550e8400-e29b-41d4-a716-446655440005', 'Cuenta Corriente', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO store_settings (store_name, estimated_delivery_time)
  SELECT 'Buffalo Coffee & Food', 30 WHERE NOT EXISTS (SELECT 1 FROM store_settings);
INSERT INTO app_settings (key, value) VALUES
  ('bar_config', '{"tables_count": 20, "areas": ["main", "terraza"], "default_area": "main"}'::jsonb),
  ('general', '{"store_name": "Buffalo Coffee & Food", "currency": "ARS", "timezone": "America/Argentina/Buenos_Aires"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Permisos base del sistema
INSERT INTO permissions (name, description, module, action) VALUES
  ('dashboard.view','Ver dashboard','dashboard','view'),('users.view','Ver usuarios','users','view'),
  ('users.create','Crear usuarios','users','create'),('users.edit','Editar usuarios','users','edit'),
  ('users.delete','Eliminar usuarios','users','delete'),('cash.open','Abrir caja','cash','open'),
  ('cash.close','Cerrar caja','cash','close'),('cash.view','Ver caja','cash','view'),
  ('cash.deposit','Depósitos','cash','deposit'),('cash.withdraw','Retiros','cash','withdraw'),
  ('sales.create','Crear ventas','sales','create'),('sales.view_own','Ver ventas propias','sales','view_own'),
  ('sales.view_all','Ver todas las ventas','sales','view_all'),('sales.edit','Editar ventas','sales','edit'),
  ('sales.delete','Eliminar ventas','sales','delete'),('tables.view_own','Ver mesas asignadas','tables','view_own'),
  ('tables.view_all','Ver todas las mesas','tables','view_all'),('tables.open','Abrir mesas','tables','open'),
  ('tables.close','Cerrar mesas','tables','close'),('tables.move','Mover mesas','tables','move'),
  ('tables.edit','Editar mesas','tables','edit'),('products.view','Ver productos','products','view'),
  ('products.create','Crear productos','products','create'),('products.edit','Editar productos','products','edit'),
  ('products.delete','Eliminar productos','products','delete'),('inventory.view','Ver inventario','inventory','view'),
  ('inventory.adjust','Ajustar inventario','inventory','adjust'),('inventory.transfer','Transferir','inventory','transfer'),
  ('kitchen.view_orders','Ver pedidos cocina','kitchen','view_orders'),
  ('kitchen.mark_ready','Marcar listos','kitchen','mark_ready'),('kitchen.manage','Gestionar cocina','kitchen','manage'),
  ('reports.view','Ver reportes','reports','view'),('reports.export','Exportar reportes','reports','export'),
  ('settings.view','Ver config','settings','view'),('settings.edit','Editar config','settings','edit'),
  ('suppliers.view','Ver proveedores','suppliers','view'),('suppliers.create','Crear proveedores','suppliers','create'),
  ('suppliers.edit','Editar proveedores','suppliers','edit'),('purchases.view','Ver compras','purchases','view'),
  ('purchases.create','Crear compras','purchases','create'),('purchases.approve','Aprobar compras','purchases','approve'),
  ('expenses.view','Ver gastos','expenses','view'),('expenses.create','Crear gastos','expenses','create'),
  ('expenses.edit','Editar gastos','expenses','edit'),('expenses.delete','Eliminar gastos','expenses','delete'),
  ('config.view','Ver configuracion','config','view')
ON CONFLICT (name) DO NOTHING;

-- Permisos ADMIN (todos)
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'admin', p.id, true FROM permissions p ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- Permisos WAITER
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'waiter', p.id, true FROM permissions p WHERE p.name IN (
  'dashboard.view','cash.open','cash.close','cash.view','cash.deposit','cash.withdraw',
  'sales.create','sales.view_own','sales.view_all','sales.edit','sales.delete',
  'tables.view_own','tables.view_all','tables.open','tables.close','tables.move',
  'inventory.view','kitchen.view_orders','kitchen.mark_ready','kitchen.manage',
  'expenses.view','expenses.create','reports.view'
) ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- ===================== FUNCIONES Y TRIGGERS =====================

-- ===================== TRIGGERS updated_at =====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
    AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
    EXCEPTION WHEN duplicate_object THEN null;
    END;
  END LOOP;
END $$;

-- ===================== TRIGGER: Validar unicidad de sesión =====================
CREATE OR REPLACE FUNCTION validate_shift_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    IF EXISTS (
      SELECT 1 FROM cash_register_sessions
      WHERE cash_register_id = NEW.cash_register_id AND area = NEW.area
        AND shift = NEW.shift AND status = 'open'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
      RAISE EXCEPTION 'Ya existe una sesión abierta para esta caja, área y turno';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_shift_uniqueness ON cash_register_sessions;
CREATE TRIGGER trigger_validate_shift_uniqueness
  BEFORE INSERT OR UPDATE ON cash_register_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_shift_uniqueness();

-- ===================== FUNCIONES DE CAJA DIARIA =====================
CREATE OR REPLACE FUNCTION open_daily_cash(p_user_id UUID, p_opening_amount DECIMAL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_date DATE;
BEGIN
  v_date := CURRENT_DATE;
  IF EXISTS (SELECT 1 FROM daily_cash WHERE date = v_date AND status = 'open') THEN
    RAISE EXCEPTION 'Ya existe una caja abierta para hoy';
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO daily_cash (id, date, user_id, status, opening_amount) VALUES (v_id, v_date, p_user_id, 'open', p_opening_amount);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION close_daily_cash(p_cash_id UUID, p_closing_amount DECIMAL, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE daily_cash SET status = 'closed', closing_amount = p_closing_amount, notes = p_notes, updated_at = NOW()
  WHERE id = p_cash_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Caja no encontrada o ya cerrada'; END IF;
END;
$$;

-- ===================== FUNCIONES DE VENTAS =====================
CREATE OR REPLACE FUNCTION public.create_sale(p_sale_data JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_unlimited BOOLEAN;
  v_product_name TEXT;
  v_requested_qty INTEGER;
  v_sale_status TEXT;
  v_sale_type TEXT;
  v_table_number INTEGER;
BEGIN
  IF NOT (p_sale_data ? 'user_id') THEN RAISE EXCEPTION 'Falta user_id'; END IF;
  v_sale_status := COALESCE(p_sale_data->>'status', 'completed');
  v_sale_type := COALESCE(p_sale_data->>'sale_type', 'table');
  v_table_number := NULLIF(p_sale_data->>'table_number', '')::INTEGER;

  IF v_sale_status = 'pending' AND v_sale_type = 'table' THEN
    IF v_table_number IS NULL THEN
      RAISE EXCEPTION 'Falta table_number para la venta de mesa';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.bar_layout
      WHERE table_number = v_table_number
        AND COALESCE(is_active, TRUE) = TRUE
    ) THEN
      RAISE EXCEPTION 'La mesa % no existe o está deshabilitada', v_table_number;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.sales
      WHERE table_number = v_table_number
        AND sale_type = 'table'
        AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'La mesa % ya está ocupada', v_table_number;
    END IF;
  END IF;

  v_sale_id := gen_random_uuid();
  INSERT INTO public.sales (id, sale_number, cash_register_session_id, user_id, waiter_id,
    total, total_amount, status, sale_type, table_number, customer_name, customer_phone,
    delivery_address, delivery_notes, created_at, updated_at)
  VALUES (v_sale_id, p_sale_data->>'sale_number', (p_sale_data->>'cash_register_session_id')::UUID,
    (p_sale_data->>'user_id')::UUID, (p_sale_data->>'waiter_id')::UUID,
    (p_sale_data->>'total_amount')::DECIMAL, (p_sale_data->>'total_amount')::DECIMAL,
    v_sale_status, v_sale_type, v_table_number, p_sale_data->>'customer_name',
    p_sale_data->>'customer_phone', p_sale_data->>'delivery_address', p_sale_data->>'delivery_notes',
    NOW(), NOW());

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale_data->'items') LOOP
    v_requested_qty := (v_item->>'quantity')::INTEGER;
    SELECT name, unlimited_stock
    INTO v_product_name, v_unlimited
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'product_id';
    END IF;

    IF NOT COALESCE(v_unlimited, FALSE) THEN
      UPDATE products
      SET stock = stock - v_requested_qty
      WHERE id = (v_item->>'product_id')::UUID
        AND stock >= v_requested_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para "%"', v_product_name;
      END IF;
    END IF;
    INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total_price, subtotal, price, customization)
    VALUES (gen_random_uuid(), v_sale_id, (v_item->>'product_id')::UUID, v_requested_qty,
      (v_item->>'unit_price')::DECIMAL, (v_item->>'subtotal')::DECIMAL,
      (v_item->>'subtotal')::DECIMAL, (v_item->>'unit_price')::DECIMAL, v_item->>'customization');
  END LOOP;

  IF p_sale_data ? 'payments' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_sale_data->'payments') LOOP
      INSERT INTO sale_payments (sale_id, payment_method_id, amount)
      VALUES (v_sale_id, (v_payment->>'payment_method_id')::UUID, (v_payment->>'amount')::DECIMAL);
    END LOOP;
  END IF;
  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_pending_sale(p_sale_data JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale_id UUID; v_payment JSONB;
BEGIN
  v_sale_id := (p_sale_data->>'sale_id')::UUID;
  UPDATE sales SET status = 'completed', payment_method = COALESCE(p_sale_data->>'payment_method','mixed'), updated_at = NOW()
  WHERE id = v_sale_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta % no encontrada o no pendiente', v_sale_id; END IF;
  IF p_sale_data ? 'payments' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_sale_data->'payments') LOOP
      INSERT INTO sale_payments (sale_id, payment_method_id, amount)
      VALUES (v_sale_id, (v_payment->>'payment_method_id')::UUID, (v_payment->>'amount')::DECIMAL);
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_sale(p_sale_data JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale_id UUID; v_item RECORD; v_unlimited BOOLEAN;
BEGIN
  v_sale_id := (p_sale_data->>'sale_id')::UUID;
  FOR v_item IN SELECT product_id, quantity FROM sale_items WHERE sale_id = v_sale_id LOOP
    SELECT unlimited_stock INTO v_unlimited FROM products WHERE id = v_item.product_id;
    IF NOT COALESCE(v_unlimited, FALSE) THEN
      UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END LOOP;
  UPDATE sales SET status = 'cancelled', updated_at = NOW() WHERE id = v_sale_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta % no encontrada o no pendiente', v_sale_id; END IF;
END;
$$;

-- ===================== FUNCIONES DE PERMISOS =====================
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_is_active BOOLEAN;
  v_has_direct BOOLEAN;
  v_has_role BOOLEAN;
BEGIN
  -- Validar parámetros
  IF p_user_id IS NULL OR p_permission_name IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Obtener el rol del usuario y su estado activo
  SELECT LOWER(TRIM(role)), is_active INTO v_user_role, v_is_active
  FROM public.users
  WHERE id = p_user_id;

  -- Si el usuario no existe o no está activo, denegar
  IF v_user_role IS NULL OR v_is_active = FALSE THEN
    RETURN FALSE;
  END IF;

  -- Si es admin, tiene todos los permisos automáticamente
  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Buscar permiso directo asignado al usuario
  SELECT EXISTS (
    SELECT 1 
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id 
      AND p.name = p_permission_name 
      AND up.granted = TRUE
  ) INTO v_has_direct;

  IF v_has_direct THEN
    RETURN TRUE;
  END IF;

  -- Buscar permiso otorgado al rol (usando lower para mayor seguridad)
  SELECT EXISTS (
    SELECT 1 
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE LOWER(TRIM(rp.role)) = v_user_role 
      AND p.name = p_permission_name 
      AND rp.granted = TRUE
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$;

-- Sobrecarga para mantener compatibilidad si se llama con TEXT
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id TEXT,
  p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    RETURN has_permission(p_user_id::UUID, p_permission_name);
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
END;
$$;

-- Función para verificar si el usuario es administrador (evita recursión RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND is_active = TRUE
  );
END;
$$;

-- ===================== FUNCIONES AUXILIARES =====================
CREATE OR REPLACE FUNCTION increment_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE products SET stock = COALESCE(stock, 0) + p_quantity WHERE id = p_product_id; END;
$$;

CREATE OR REPLACE FUNCTION get_table_remaining_balance(p_sale_id UUID)
RETURNS DECIMAL LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total DECIMAL; v_paid DECIMAL;
BEGIN
  SELECT COALESCE(total, total_amount, 0) INTO v_total FROM sales WHERE id = p_sale_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM table_payments WHERE sale_id = p_sale_id;
  RETURN GREATEST(v_total - v_paid, 0);
END;
$$;

-- ===================== FUNCIONES DE REPORTES =====================
CREATE OR REPLACE FUNCTION get_top_selling_products(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (product_id UUID, product_name TEXT, total_quantity BIGINT, total_revenue DECIMAL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT si.product_id, p.name, SUM(si.quantity)::BIGINT,
    SUM(COALESCE(si.total_price, si.subtotal, si.unit_price * si.quantity))::DECIMAL
  FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id
  WHERE s.created_at BETWEEN p_start_date AND p_end_date AND s.status = 'completed'
  GROUP BY si.product_id, p.name ORDER BY SUM(si.quantity) DESC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_sales_by_payment_method(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS TABLE (payment_method_name TEXT, total_sales BIGINT, total_amount DECIMAL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT pm.name, COUNT(DISTINCT sp.sale_id)::BIGINT, SUM(sp.amount)::DECIMAL
  FROM sale_payments sp JOIN payment_methods pm ON sp.payment_method_id = pm.id
  JOIN sales s ON sp.sale_id = s.id
  WHERE s.created_at BETWEEN p_start_date AND p_end_date AND s.status = 'completed'
  GROUP BY pm.name ORDER BY SUM(sp.amount) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_audit_logs(p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (action TEXT, details JSONB, created_at TIMESTAMPTZ, user_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN; END;
$$;

-- --------------------------------------------------------------------------
-- COMPATIBILITY + EXTRA TABLES (usadas por el codigo de la app)
-- --------------------------------------------------------------------------

-- Missing tables used by app code.
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL DEFAULT 'C',
  invoice_number TEXT NOT NULL,
  point_of_sale INTEGER NOT NULL,
  cae TEXT NOT NULL,
  cae_expiration TIMESTAMPTZ NOT NULL,
  thermal_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sale_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_movements_user_id_fkey'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      RENAME CONSTRAINT inventory_movements_user_id_fkey TO inventory_movements_user_fk;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movements_user_id_fkey
    FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Columns required by current app code.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS use_auto_price BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS menu_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS menu_image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS menu_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cocina_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_type TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS kitchen_started_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS kitchen_completed_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS kitchen_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS transaction_code TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS account_printed_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS grouped_tables INTEGER[];
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_table_group BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS surcharge DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.table_splits ADD COLUMN IF NOT EXISTS split_name TEXT;
ALTER TABLE public.table_splits ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.table_splits ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.table_splits ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS movement_type TEXT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.inventory_movements ALTER COLUMN type SET DEFAULT 'purchase';

ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS position_x NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS position_y NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS x NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS y NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS size_variant TEXT DEFAULT 'normal';
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS custom_name TEXT;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS custom_color TEXT;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS order_index INTEGER;
ALTER TABLE public.bar_layout ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'promotions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%discount_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_discount_type_check
  CHECK (discount_type IN ('percentage', 'fixed', '2x1'));

ALTER TABLE public.purchases ALTER COLUMN purchase_number DROP NOT NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id);
ALTER TABLE public.purchases ALTER COLUMN purchase_number SET DEFAULT (
  'PUR-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text, 1, 8)
);

UPDATE public.products
SET
  sale_price = CASE WHEN COALESCE(sale_price, 0) = 0 AND COALESCE(price, 0) > 0 THEN price ELSE COALESCE(sale_price, 0) END,
  cost_price = CASE WHEN COALESCE(cost_price, 0) = 0 AND COALESCE(cost, 0) > 0 THEN cost ELSE COALESCE(cost_price, 0) END,
  price = CASE WHEN COALESCE(price, 0) = 0 AND COALESCE(sale_price, 0) > 0 THEN sale_price ELSE COALESCE(price, 0) END,
  cost = CASE WHEN COALESCE(cost, 0) = 0 AND COALESCE(cost_price, 0) > 0 THEN cost_price ELSE COALESCE(cost, 0) END,
  active = COALESCE(active, is_active, TRUE),
  is_active = COALESCE(is_active, active, TRUE),
  updated_at = NOW();

UPDATE public.sales
SET
  sale_type = COALESCE(NULLIF(sale_type, ''), NULLIF(type, ''), 'table'),
  type = COALESCE(NULLIF(type, ''), NULLIF(sale_type, ''), 'table'),
  payment_status = COALESCE(NULLIF(payment_status, ''), 'pending'),
  session_id = COALESCE(session_id, cash_register_session_id),
  updated_at = NOW();

UPDATE public.expenses
SET session_id = COALESCE(session_id, cash_register_session_id),
    updated_at = NOW();

UPDATE public.inventory_movements
SET
  movement_type = COALESCE(movement_type, type, 'purchase'),
  type = COALESCE(type, movement_type, 'purchase');

UPDATE public.table_splits
SET
  total_amount = COALESCE(total_amount, amount, 0),
  remaining_amount = COALESCE(remaining_amount, amount, total_amount, 0),
  split_name = COALESCE(NULLIF(split_name, ''), 'DIV-' || COALESCE(split_number::TEXT, '1')),
  items = COALESCE(items, '[]'::jsonb),
  updated_at = NOW();

UPDATE public.bar_layout
SET
  position_x = COALESCE(position_x, x, 0),
  position_y = COALESCE(position_y, y, 0),
  x = COALESCE(x, position_x, 0),
  y = COALESCE(y, position_y, 0),
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_invoices_sale_id ON public.invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON public.price_history(product_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_show_in_menu ON public.products(show_in_menu);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON public.sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON public.sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_session_id ON public.sales(session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_session_id ON public.expenses(session_id);

CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START 1;
DO $$
DECLARE v_max BIGINT := 0;
DECLARE v_current BIGINT := 1;
BEGIN
  SELECT COALESCE(MAX(sale_number::BIGINT), 0)
  INTO v_max
  FROM public.sales
  WHERE sale_number ~ '^[0-9]+$';

  SELECT last_value INTO v_current FROM public.ticket_number_seq;
  PERFORM setval('public.ticket_number_seq', GREATEST(v_max + 1, v_current), FALSE);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- --------------------------------------------------------------------------
-- RPC FIXES / MISSING RPCS
-- --------------------------------------------------------------------------

-- Avoid PostgREST ambiguity when resolving has_permission RPC.
DROP FUNCTION IF EXISTS public.has_permission(TEXT, TEXT);

-- Drop legacy JSONB overloads of close/cancel pending sale so only the
-- (UUID, JSONB, UUID) signatures used by the app remain (evita ambiguedad PostgREST).
DROP FUNCTION IF EXISTS public.close_pending_sale(JSONB);
DROP FUNCTION IF EXISTS public.cancel_pending_sale(JSONB);

DO $$
DECLARE
  target_name TEXT;
  fn RECORD;
  target_names TEXT[] := ARRAY[
    'get_sales_by_payment_method',
    'get_top_selling_products',
    'increment_product_stock'
  ];
BEGIN
  FOREACH target_name IN ARRAY target_names LOOP
    FOR fn IN
      SELECT n.nspname AS schema_name,
             p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS identity_args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = target_name
    LOOP
      EXECUTE format(
        'DROP FUNCTION IF EXISTS %I.%I(%s);',
        fn.schema_name,
        fn.function_name,
        fn.identity_args
      );
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_next_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.ticket_number_seq');
  RETURN lpad(v_next::TEXT, 10, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock = COALESCE(stock, 0) + COALESCE(p_quantity, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_pending_sale(
  p_sale_id UUID,
  p_payments JSONB DEFAULT '[]'::jsonb,
  p_closed_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment JSONB;
BEGIN
  UPDATE public.sales
  SET status = 'completed',
      payment_method = CASE
        WHEN COALESCE(jsonb_array_length(COALESCE(p_payments, '[]'::jsonb)), 0) > 1 THEN 'mixed'
        WHEN COALESCE(jsonb_array_length(COALESCE(p_payments, '[]'::jsonb)), 0) = 1 THEN 'single'
        ELSE payment_method
      END,
      updated_at = NOW()
  WHERE id = p_sale_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale % not found or not pending', p_sale_id;
  END IF;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb)) LOOP
    IF NULLIF(v_payment->>'payment_method_id', '') IS NOT NULL THEN
      INSERT INTO public.sale_payments (sale_id, payment_method_id, amount)
      VALUES (
        p_sale_id,
        (v_payment->>'payment_method_id')::UUID,
        COALESCE(NULLIF(v_payment->>'amount', '')::NUMERIC, 0)
      );
    END IF;
  END LOOP;

  IF p_closed_by IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (p_closed_by, 'sale.closed', 'sales', p_sale_id, jsonb_build_object('source', 'close_pending_sale'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_sale(
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_cancelled_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_unlimited BOOLEAN;
BEGIN
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.sale_items
    WHERE sale_id = p_sale_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT unlimited_stock INTO v_unlimited FROM public.products WHERE id = v_item.product_id;
      IF COALESCE(v_unlimited, FALSE) = FALSE THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) + COALESCE(v_item.quantity, 0),
            updated_at = NOW()
        WHERE id = v_item.product_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.sales
  SET status = 'cancelled',
      notes = CASE
        WHEN p_reason IS NULL OR p_reason = '' THEN notes
        WHEN notes IS NULL OR notes = '' THEN p_reason
        ELSE notes || E'\n' || p_reason
      END,
      updated_at = NOW()
  WHERE id = p_sale_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale % not found or not pending', p_sale_id;
  END IF;

  IF p_cancelled_by IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (p_cancelled_by, 'sale.cancelled', 'sales', p_sale_id, jsonb_build_object('reason', p_reason));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_selling_products(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (product_id UUID, product_name TEXT, total_quantity BIGINT, total_revenue DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT si.product_id,
         p.name,
         SUM(si.quantity)::BIGINT,
         SUM(COALESCE(si.total_price, si.subtotal, si.unit_price * si.quantity))::DECIMAL
  FROM public.sale_items si
  JOIN public.sales s ON si.sale_id = s.id
  JOIN public.products p ON si.product_id = p.id
  WHERE s.created_at BETWEEN p_start_date AND p_end_date
    AND s.status = 'completed'
  GROUP BY si.product_id, p.name
  ORDER BY SUM(si.quantity) DESC
  LIMIT COALESCE(p_limit, 10);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_payment_method(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (payment_method TEXT, total_amount DECIMAL, transaction_count BIGINT, percentage DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(sp.amount), 0)
  INTO v_total
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  WHERE s.created_at BETWEEN p_start_date AND p_end_date
    AND s.status = 'completed';

  RETURN QUERY
  SELECT COALESCE(pm.name, 'Desconocido')::TEXT AS payment_method,
         COALESCE(SUM(sp.amount), 0)::DECIMAL AS total_amount,
         COUNT(DISTINCT sp.sale_id)::BIGINT AS transaction_count,
         CASE WHEN COALESCE(v_total, 0) = 0 THEN 0::DECIMAL
              ELSE (COALESCE(SUM(sp.amount), 0) / v_total) * 100
         END AS percentage
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  LEFT JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
  WHERE s.created_at BETWEEN p_start_date AND p_end_date
    AND s.status = 'completed'
  GROUP BY pm.name
  ORDER BY total_amount DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_cash_register(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (cash_register TEXT, total_sales DECIMAL, transaction_count BIGINT, avg_ticket DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT UPPER(COALESCE(crs.area, 'bar'))::TEXT AS cash_register,
         COALESCE(SUM(s.total_amount), 0)::DECIMAL AS total_sales,
         COUNT(*)::BIGINT AS transaction_count,
         CASE WHEN COUNT(*) = 0 THEN 0::DECIMAL
              ELSE (COALESCE(SUM(s.total_amount), 0) / COUNT(*))::DECIMAL
         END AS avg_ticket
  FROM public.sales s
  LEFT JOIN public.cash_register_sessions crs
    ON crs.id = COALESCE(s.cash_register_session_id, s.session_id)
  WHERE s.status = 'completed'
    AND s.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY UPPER(COALESCE(crs.area, 'bar'))
  ORDER BY total_sales DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_shift(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (shift TEXT, area TEXT, total_sales DECIMAL, transaction_count BIGINT, avg_ticket DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(crs.shift::TEXT, 'morning') AS shift,
         COALESCE(crs.area, 'bar') AS area,
         COALESCE(SUM(s.total_amount), 0)::DECIMAL AS total_sales,
         COUNT(*)::BIGINT AS transaction_count,
         CASE WHEN COUNT(*) = 0 THEN 0::DECIMAL
              ELSE (COALESCE(SUM(s.total_amount), 0) / COUNT(*))::DECIMAL
         END AS avg_ticket
  FROM public.sales s
  LEFT JOIN public.cash_register_sessions crs
    ON crs.id = COALESCE(s.cash_register_session_id, s.session_id)
  WHERE s.status = 'completed'
    AND s.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY COALESCE(crs.shift::TEXT, 'morning'), COALESCE(crs.area, 'bar')
  ORDER BY total_sales DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_item_from_table(
  p_sale_item_id UUID,
  p_sale_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_sale_status TEXT;
  v_old_total NUMERIC(10,2);
  v_item_subtotal NUMERIC(10,2);
  v_new_total NUMERIC(10,2);
  v_product_id UUID;
  v_item_quantity INTEGER;
  v_unlimited BOOLEAN;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL OR lower(v_role) <> 'admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Only admin can remove sale items');
  END IF;

  SELECT status, COALESCE(total_amount, 0)
  INTO v_sale_status, v_old_total
  FROM public.sales
  WHERE id = p_sale_id;

  IF v_sale_status IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Sale not found');
  END IF;

  IF v_sale_status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Only pending sales can be edited');
  END IF;

  SELECT product_id, quantity, COALESCE(subtotal, 0)
  INTO v_product_id, v_item_quantity, v_item_subtotal
  FROM public.sale_items
  WHERE id = p_sale_item_id AND sale_id = p_sale_id;

  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Sale item not found');
  END IF;

  DELETE FROM public.sale_items
  WHERE id = p_sale_item_id AND sale_id = p_sale_id;

  SELECT unlimited_stock INTO v_unlimited
  FROM public.products
  WHERE id = v_product_id;

  IF NOT COALESCE(v_unlimited, FALSE) THEN
    UPDATE public.products
    SET stock = stock + COALESCE(v_item_quantity, 0)
    WHERE id = v_product_id;
  END IF;

  v_new_total := GREATEST(COALESCE(v_old_total, 0) - COALESCE(v_item_subtotal, 0), 0);

  UPDATE public.sales
  SET total_amount = v_new_total,
      total = v_new_total,
      subtotal = v_new_total,
      updated_at = NOW()
  WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'old_total', v_old_total,
    'item_subtotal', v_item_subtotal,
    'new_total', v_new_total
  );
END;
$$;

-- --------------------------------------------------------------------------
-- ADMIN: bootstrap del usuario administrador
-- --------------------------------------------------------------------------
-- Intenta crear/vincular el admin automaticamente SI la instancia permite
-- escribir en auth.users (genera un UUID nuevo, sin datos reales hardcodeados).
-- Credenciales por defecto: admin@buffalo.com / 123456
-- IMPORTANTE: cambiar esta password luego del primer login.
-- Si tu instancia no permite escribir en auth.users, crealo manualmente
-- (ver el encabezado de este archivo, seccion "Como crear el admin").
DO $$
DECLARE
  v_admin_email TEXT := 'admin@buffalo.com';
  v_admin_password TEXT := '123456';
  v_admin_password_hash TEXT;
  v_admin_name TEXT := 'Administrador';
  v_admin_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'auth.users not found; skipping auth bootstrap.';
    RETURN;
  END IF;

  -- Supabase can expose pgcrypto in different schemas depending on project setup.
  BEGIN
    EXECUTE 'SELECT extensions.crypt($1, extensions.gen_salt(''bf''))'
      INTO v_admin_password_hash
      USING v_admin_password;
  EXCEPTION
    WHEN undefined_function THEN
      BEGIN
        EXECUTE 'SELECT crypt($1, gen_salt(''bf''))'
          INTO v_admin_password_hash
          USING v_admin_password;
      EXCEPTION
        WHEN undefined_function THEN
          RAISE EXCEPTION 'pgcrypto crypt/gen_salt not available. Enable extension pgcrypto and re-run bootstrap.';
      END;
  END;

  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = v_admin_email
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        v_admin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_admin_email,
        v_admin_password_hash,
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', to_jsonb(ARRAY['email'])),
        jsonb_build_object('name', v_admin_name),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );
    EXCEPTION
      WHEN undefined_column THEN
        INSERT INTO auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        )
        VALUES (
          v_admin_id,
          '00000000-0000-0000-0000-000000000000',
          'authenticated',
          'authenticated',
          v_admin_email,
          v_admin_password_hash,
          NOW(),
          jsonb_build_object('provider', 'email', 'providers', to_jsonb(ARRAY['email'])),
          jsonb_build_object('name', v_admin_name),
          NOW(),
          NOW()
        );
    END;
  ELSE
    UPDATE auth.users
    SET encrypted_password = v_admin_password_hash,
        instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW(),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', 'email', 'providers', to_jsonb(ARRAY['email'])),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', v_admin_name)
    WHERE id = v_admin_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'identities'
  ) THEN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::TEXT, 'email', v_admin_email),
      'email',
      v_admin_email,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.users (
    id, email, name, full_name, role, is_active, created_at, updated_at
  ) VALUES (
    v_admin_id, v_admin_email, v_admin_name, v_admin_name, 'admin', TRUE, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    is_active = TRUE,
    updated_at = NOW();

  UPDATE public.users
  SET role = 'admin',
      is_active = TRUE,
      name = COALESCE(NULLIF(name, ''), v_admin_name),
      full_name = COALESCE(NULLIF(full_name, ''), v_admin_name),
      updated_at = NOW()
  WHERE email = v_admin_email;
END $$;

-- Seed core config and permission rows if missing.
INSERT INTO public.cash_registers (name, type, is_active)
VALUES ('CAJA BAR', 'bar', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.payment_methods (id, name, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Efectivo', TRUE),
  ('550e8400-e29b-41d4-a716-446655440001', 'Transferencia', TRUE),
  ('550e8400-e29b-41d4-a716-446655440002', 'Debito', TRUE),
  ('550e8400-e29b-41d4-a716-446655440003', 'Credito', TRUE),
  ('550e8400-e29b-41d4-a716-446655440004', 'QR', TRUE),
  ('550e8400-e29b-41d4-a716-446655440005', 'Cuenta Corriente', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_settings (store_name, estimated_delivery_time)
SELECT 'Buffalo Coffee & Food', 30
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

INSERT INTO public.app_settings (key, value) VALUES
  ('bar_config', '{"tables_count": 20, "areas": ["salon", "vereda"], "default_area": "salon"}'::jsonb),
  ('general', '{"store_name":"Buffalo Coffee & Food","currency":"ARS","timezone":"America/Argentina/Buenos_Aires"}'::jsonb),
  ('bar_zone_division_percentage', '{"value": 50}'::jsonb),
  ('afip_environment', '"homologacion"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.permissions (name, description, module, action) VALUES
  ('dashboard.view','View dashboard','dashboard','view'),
  ('users.view','View users','users','view'),
  ('users.create','Create users','users','create'),
  ('users.edit','Edit users','users','edit'),
  ('users.delete','Delete users','users','delete'),
  ('cash.open','Open cash register','cash','open'),
  ('cash.close','Close cash register','cash','close'),
  ('cash.view','View cash register','cash','view'),
  ('cash.deposit','Create cash income','cash','deposit'),
  ('cash.withdraw','Create cash withdrawal','cash','withdraw'),
  ('sales.create','Create sales','sales','create'),
  ('sales.view_own','View own sales','sales','view_own'),
  ('sales.view_all','View all sales','sales','view_all'),
  ('sales.edit','Edit sales','sales','edit'),
  ('sales.delete','Delete sales','sales','delete'),
  ('tables.view_own','View own tables','tables','view_own'),
  ('tables.view_all','View all tables','tables','view_all'),
  ('tables.open','Open table','tables','open'),
  ('tables.close','Close table','tables','close'),
  ('tables.move','Move table','tables','move'),
  ('tables.edit','Edit table layout','tables','edit'),
  ('products.view','View products','products','view'),
  ('products.create','Create products','products','create'),
  ('products.edit','Edit products','products','edit'),
  ('products.delete','Delete products','products','delete'),
  ('inventory.view','View inventory','inventory','view'),
  ('inventory.adjust','Adjust inventory','inventory','adjust'),
  ('inventory.transfer','Transfer inventory','inventory','transfer'),
  ('kitchen.view_orders','View kitchen orders','kitchen','view_orders'),
  ('kitchen.mark_ready','Mark kitchen order ready','kitchen','mark_ready'),
  ('kitchen.manage','Manage kitchen','kitchen','manage'),
  ('reports.view','View reports','reports','view'),
  ('reports.export','Export reports','reports','export'),
  ('settings.view','View settings','settings','view'),
  ('settings.edit','Edit settings','settings','edit'),
  ('suppliers.view','View suppliers','suppliers','view'),
  ('suppliers.create','Create suppliers','suppliers','create'),
  ('suppliers.edit','Edit suppliers','suppliers','edit'),
  ('purchases.view','View purchases','purchases','view'),
  ('purchases.create','Create purchases','purchases','create'),
  ('purchases.approve','Approve purchases','purchases','approve'),
  ('expenses.view','View expenses','expenses','view'),
  ('expenses.create','Create expenses','expenses','create'),
  ('expenses.edit','Edit expenses','expenses','edit'),
  ('expenses.delete','Delete expenses','expenses','delete'),
  ('config.view','View configuration','config','view')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'admin', p.id, TRUE
FROM public.permissions p
ON CONFLICT (role, permission_id) DO UPDATE SET granted = TRUE;

INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'waiter', p.id, TRUE
FROM public.permissions p
WHERE p.name IN (
  'dashboard.view',
  'cash.open','cash.close','cash.view','cash.deposit','cash.withdraw',
  'sales.create','sales.view_own','sales.view_all','sales.edit',
  'tables.view_own','tables.view_all','tables.open','tables.close','tables.move',
  'inventory.view',
  'kitchen.view_orders','kitchen.mark_ready',
  'expenses.view','expenses.create',
  'reports.view'
)
ON CONFLICT (role, permission_id) DO UPDATE SET granted = TRUE;

-- Permisos CASHIER: caja, mesas, ventas (cobrar/imprimir), cocina y gastos.
-- NO ve Ventas (historial) ni Productos ni Reportes/"Más", y NO cambia precios
-- (override de precio en caja queda bloqueado para este rol; ver useCanEditPrices).
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'cashier', p.id, TRUE
FROM public.permissions p
WHERE p.name IN (
  'dashboard.view',
  'cash.open','cash.close','cash.view','cash.deposit','cash.withdraw',
  'sales.create','sales.edit',
  'tables.view_own','tables.view_all','tables.open','tables.close','tables.move','tables.edit',
  'kitchen.view_orders','kitchen.mark_ready',
  'expenses.view','expenses.create'
)
ON CONFLICT (role, permission_id) DO UPDATE SET granted = TRUE;

-- Idempotente: garantizar que el cajero NUNCA conserve permisos que exponen
-- Ventas/Productos/Reportes/Inventario ni edición de precios, aun si se
-- re-aplica este script sobre una base que los tenía.
DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND rp.role = 'cashier'
  AND p.name IN ('sales.view_own','sales.view_all','products.view','products.edit','reports.view','inventory.view');

-- Permisos KITCHEN (cocina)
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'kitchen', p.id, TRUE
FROM public.permissions p
WHERE p.name IN (
  'dashboard.view',
  'kitchen.view_orders','kitchen.mark_ready','kitchen.manage'
)
ON CONFLICT (role, permission_id) DO UPDATE SET granted = TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('private-files', 'private-files', FALSE)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      public = EXCLUDED.public;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Start with no RLS as requested.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    GRANT USAGE ON SCHEMA public TO anon;
    GRANT SELECT ON TABLE public.products, public.categories, public.store_settings, public.cash_register_sessions TO anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    -- audit_logs queda restringida por RLS a administradores; el GRANT no la expone a staff comun.
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;

-- ===================== SEED BUFFALO: CATALOGO DE CAFETERIA (ejemplo) =====================
-- Catalogo de ejemplo (no son ventas). Idempotente via ON CONFLICT (id) DO NOTHING.
INSERT INTO public.categories (id, name, display_order, is_active, cocina_only) VALUES
  ('01f35b86-0b58-5e75-ac06-46a210376edd', 'Café', 1, TRUE, FALSE),
  ('983fd9c4-4049-5811-8377-318892649c9e', 'Café de especialidad', 2, TRUE, FALSE),
  ('b4d7583e-9651-52f2-a498-60054c5c0256', 'Pastelería', 3, TRUE, FALSE),
  ('b90b138e-af47-52b5-9697-a0a46337d96f', 'Sándwiches', 4, TRUE, TRUE),
  ('d9c40c73-78a4-5142-b7b0-eece643bcb27', 'Bebidas frías', 5, TRUE, FALSE),
  ('c18b9b20-8157-531c-b86a-060d6473f816', 'Café en grano', 6, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products
  (id, name, category_id, price, cost, sale_price, cost_price, stock, unit,
   is_active, active, unlimited_stock, requires_kitchen, cocina_only) VALUES
  ('45072672-6576-5202-b07e-7a4258a0b481', 'Espresso', '01f35b86-0b58-5e75-ac06-46a210376edd', 1500, 400, 1500, 400, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('f3fedeb0-d4b5-54c2-9428-52e803ce0208', 'Cortado', '01f35b86-0b58-5e75-ac06-46a210376edd', 1700, 450, 1700, 450, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('0e1d7648-79f9-5932-aa9c-9e97be264bcd', 'Café con leche', '01f35b86-0b58-5e75-ac06-46a210376edd', 2200, 600, 2200, 600, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('88f20815-1e33-5cde-ae3f-056977f222e7', 'Capuccino', '01f35b86-0b58-5e75-ac06-46a210376edd', 2600, 700, 2600, 700, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('b9ae3119-67d4-5a7c-89b4-46ba62d563df', 'Latte', '01f35b86-0b58-5e75-ac06-46a210376edd', 2700, 720, 2700, 720, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('4f313791-c2a2-539a-a61c-9fb8144711b4', 'Flat White', '01f35b86-0b58-5e75-ac06-46a210376edd', 2600, 700, 2600, 700, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('02f08612-1d32-5935-b998-f40c60c022c4', 'Americano', '01f35b86-0b58-5e75-ac06-46a210376edd', 2000, 500, 2000, 500, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('1315dea9-4a8f-5d59-96d9-76b8b6ec2bb7', 'Mocaccino', '01f35b86-0b58-5e75-ac06-46a210376edd', 2900, 800, 2900, 800, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('42421ee9-d5b4-57f3-a8e8-4f6dc6ed6cd1', 'Submarino', '01f35b86-0b58-5e75-ac06-46a210376edd', 2800, 900, 2800, 900, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('0e9f1dc7-483c-5b6a-9985-28ca0b58c306', 'Macchiato', '983fd9c4-4049-5811-8377-318892649c9e', 2400, 650, 2400, 650, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('59b68007-6d5c-5ed8-bae8-ec74665f6ff2', 'Cold Brew', '983fd9c4-4049-5811-8377-318892649c9e', 3200, 900, 3200, 900, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('c7910224-5fac-53f7-8bf3-c2b8e0d06f3d', 'Café filtrado V60', '983fd9c4-4049-5811-8377-318892649c9e', 3400, 950, 3400, 950, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('3e5cd767-4c58-575f-8c1f-4477a749254d', 'Café Chemex', '983fd9c4-4049-5811-8377-318892649c9e', 3600, 1000, 3600, 1000, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('7165fce6-80c7-5f5a-bcdd-ff114d01032a', 'Aeropress', '983fd9c4-4049-5811-8377-318892649c9e', 3300, 950, 3300, 950, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('0c54b618-bd30-51d5-b0e2-6671195125ab', 'Medialuna', 'b4d7583e-9651-52f2-a498-60054c5c0256', 1200, 350, 1200, 350, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('745a1da3-d722-563a-ac1e-dd7d9e64411b', 'Medialuna con jamón y queso', 'b4d7583e-9651-52f2-a498-60054c5c0256', 2400, 800, 2400, 800, 0, 'unit', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('58549be2-2486-53b0-bbf1-bc2f2310b1f0', 'Tostado de jamón y queso', 'b90b138e-af47-52b5-9697-a0a46337d96f', 4500, 1500, 4500, 1500, 0, 'unit', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('5658dd94-39b9-5661-9140-8f988d7f0383', 'Sándwich de miga (x3)', 'b90b138e-af47-52b5-9697-a0a46337d96f', 3800, 1200, 3800, 1200, 0, 'unit', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('86b7578b-634b-50f3-bf91-80d49eea4a31', 'Avocado toast', 'b90b138e-af47-52b5-9697-a0a46337d96f', 5200, 1900, 5200, 1900, 0, 'unit', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('933c2c7a-a962-5e0e-acff-46862d4a9e53', 'Croissant de manteca', 'b4d7583e-9651-52f2-a498-60054c5c0256', 2600, 850, 2600, 850, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('e9ffccf7-e9bf-51b4-bcab-4deb55721144', 'Budín de limón', 'b4d7583e-9651-52f2-a498-60054c5c0256', 2200, 700, 2200, 700, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('387f2ddf-978b-50fe-9c27-5d855b87d80b', 'Cheesecake', 'b4d7583e-9651-52f2-a498-60054c5c0256', 4200, 1500, 4200, 1500, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('dc0a341a-b5bc-5cef-88a6-b71eaa4c0cff', 'Brownie', 'b4d7583e-9651-52f2-a498-60054c5c0256', 2800, 900, 2800, 900, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('30eaacd7-9329-5f3c-9293-df63f67bf344', 'Alfajor de maicena', 'b4d7583e-9651-52f2-a498-60054c5c0256', 1500, 450, 1500, 450, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('f9fe2cbe-c19d-50b3-87b6-51fffa1712c6', 'Limonada con menta y jengibre', 'd9c40c73-78a4-5142-b7b0-eece643bcb27', 3000, 800, 3000, 800, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('0ae37f28-2cc7-5dc0-8316-d2fef757147e', 'Agua saborizada', 'd9c40c73-78a4-5142-b7b0-eece643bcb27', 1800, 500, 1800, 500, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('32bb7e58-7f94-56ca-adb8-97b0874ddd9a', 'Jugo de naranja exprimido', 'd9c40c73-78a4-5142-b7b0-eece643bcb27', 3200, 1100, 3200, 1100, 0, 'unit', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('11475a38-cf8c-53ec-9a61-c4a012fc96d4', 'Iced Latte', 'd9c40c73-78a4-5142-b7b0-eece643bcb27', 3100, 850, 3100, 850, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('a523290b-119a-561e-ada8-864eabda93a7', 'Bolsa de café en grano 250g', 'c18b9b20-8157-531c-b86a-060d6473f816', 9500, 4500, 9500, 4500, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('39e7fdf4-c1ae-5e5d-99cc-35795e141318', 'Bolsa de café en grano 1kg', 'c18b9b20-8157-531c-b86a-060d6473f816', 32000, 16000, 32000, 16000, 0, 'unit', TRUE, TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Verification queries.
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'app_settings','audit_logs','bar_layout','cash_incomes',
    'cash_register_sessions','cash_registers','categories',
    'expenses','inventory_movements',
    'invoices','payment_methods','permissions','price_history',
    'products','promotions','purchase_items','purchases','role_permissions',
    'sale_item_payments','sale_items','sale_payments','sales','store_settings',
    'suppliers','table_changes','table_payments','table_splits','user_permissions',
    'users','work_shifts'
  ]) AS table_name
)
SELECT rt.table_name AS missing_table
FROM required_tables rt
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = rt.table_name
WHERE t.table_name IS NULL
ORDER BY rt.table_name;

WITH required_functions AS (
  SELECT unnest(ARRAY[
    'cancel_pending_sale',
    'close_pending_sale',
    'create_sale',
    'get_next_ticket_number',
    'get_sales_by_cash_register',
    'get_sales_by_payment_method',
    'get_sales_by_shift',
    'get_table_remaining_balance',
    'get_top_selling_products',
    'has_permission',
    'increment_product_stock',
    'remove_item_from_table'
  ]) AS function_name
)
SELECT rf.function_name AS missing_function
FROM required_functions rf
LEFT JOIN information_schema.routines r
  ON r.routine_schema = 'public' AND r.routine_name = rf.function_name
WHERE r.routine_name IS NULL
ORDER BY rf.function_name;

SELECT id, email, name, role, is_active
FROM public.users
WHERE role = 'admin'
ORDER BY created_at ASC;

COMMIT;

