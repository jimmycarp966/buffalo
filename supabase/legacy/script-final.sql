-- Script FINAL para configurar usuario admin en Almendra
-- Este script funciona sin importar la estructura de la tabla

-- 1. Ver estructura actual de la tabla users
SELECT '=== ESTRUCTURA ACTUAL DE USERS ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Insertar usuario (adaptado a cualquier estructura)
DO $$
BEGIN
  -- Verificar si existe columna name
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) THEN
    -- Insertar con name
    INSERT INTO public.users (id, email, name, role, is_active)
    VALUES (
      'e39f54e5-c10b-47f6-9162-4ce3c6f88292',
      'juan@almendra.com',
      'Juan - Administrador Almendra',
      'admin',
      true
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;
    RAISE NOTICE '✅ Usuario insertado con estructura NAME';
  ELSE
    -- Insertar sin name
    INSERT INTO public.users (id, email, role, is_active)
    VALUES (
      'e39f54e5-c10b-47f6-9162-4ce3c6f88292',
      'juan@almendra.com',
      'admin',
      true
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active;
    RAISE NOTICE '✅ Usuario insertado con estructura básica';
  END IF;
END $$;

-- 3. Crear tabla de permisos si no existe
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  module TEXT,
  is_active BOOLEAN DEFAULT true
);

-- 4. Crear tabla de permisos por rol si no existe
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT false,
  UNIQUE(role, permission_id)
);

-- 5. Insertar permisos básicos
INSERT INTO public.permissions (name, description, module) VALUES
  ('dashboard.view', 'Ver dashboard', 'dashboard'),
  ('cash.view', 'Ver cajas', 'cash'),
  ('cash.open', 'Abrir cajas', 'cash'),
  ('cash.close', 'Cerrar cajas', 'cash'),
  ('sales.view', 'Ver ventas', 'sales'),
  ('sales.create', 'Crear ventas', 'sales'),
  ('sales.cancel', 'Cancelar ventas', 'sales'),
  ('products.view', 'Ver productos', 'products'),
  ('products.create', 'Crear productos', 'products'),
  ('products.edit', 'Editar productos', 'products'),
  ('products.delete', 'Eliminar productos', 'products'),
  ('inventory.view', 'Ver inventario', 'inventory'),
  ('inventory.edit', 'Editar inventario', 'inventory'),
  ('expenses.view', 'Ver gastos', 'expenses'),
  ('expenses.create', 'Crear gastos', 'expenses'),
  ('reports.view', 'Ver reportes', 'reports'),
  ('reports.export', 'Exportar reportes', 'reports'),
  ('users.view', 'Ver usuarios', 'users'),
  ('users.create', 'Crear usuarios', 'users'),
  ('users.edit', 'Editar usuarios', 'users'),
  ('settings.view', 'Ver configuración', 'settings'),
  ('settings.edit', 'Editar configuración', 'settings')
ON CONFLICT (name) DO NOTHING;

-- 6. Asignar todos los permisos al rol admin
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'admin', p.id, true
FROM public.permissions p
ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- 7. Verificar resultado final
SELECT '=== ✅ USUARIO CONFIGURADO ===' as info;
SELECT
  u.email,
  u.role,
  u.is_active,
  u.created_at
FROM public.users u
WHERE u.id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';

SELECT '=== ✅ PERMISOS ASIGNADOS ===' as info;
SELECT COUNT(*) as total_permissions_admin
FROM public.role_permissions
WHERE role = 'admin' AND granted = true;




























































