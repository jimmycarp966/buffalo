-- Índices para optimizar getOpenTables y consultas de ventas
-- Estos índices ayudarán a evitar el error 57014 (statement timeout)

-- 1. Índice compuesto para filtrado por estado y tipo (usado en getOpenTables)
CREATE INDEX IF NOT EXISTS idx_sales_status_type_created
ON public.sales (status, sale_type, created_at DESC);

-- 2. Índice para búsquedas por sesión de caja
CREATE INDEX IF NOT EXISTS idx_sales_session_id
ON public.sales (cash_register_session_id);

-- 3. Índices para claves foráneas en tablas relacionadas (si no existen)
-- sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
ON public.sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id
ON public.sale_items (product_id);

-- sale_payments
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id
ON public.sale_payments (sale_id);

-- sale_item_payments
CREATE INDEX IF NOT EXISTS idx_sale_item_payments_sale_item_id
ON public.sale_item_payments (sale_item_id);

-- 4. Índice para permisos (optimiza getUserNavigationPermissions)
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_granted
ON public.role_permissions (role, granted);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_granted
ON public.user_permissions (user_id, granted);

-- Comentario: Ejecuta este script en el Editor SQL de Supabase para aplicar las mejoras.
