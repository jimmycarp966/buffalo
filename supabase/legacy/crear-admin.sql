-- Script COMPLETO para configurar usuario administrador en Almendra
-- Ejecutar en orden: 1. Verificar estructura → 2. Actualizar tablas → 3. Insertar usuario → 4. Configurar permisos

-- ==============================================
-- 0. VERIFICAR ESTRUCTURA ACTUAL DE LA BASE DE DATOS
-- ==============================================
SELECT '=== ESTRUCTURA ACTUAL DE LA TABLA USERS ===' as info;
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

SELECT '=== TABLAS EXISTENTES EN EL ESQUEMA PUBLIC ===' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- ==============================================
-- 1. VERIFICAR Y ACTUALIZAR TABLA USERS
-- ==============================================
-- Verificar si la tabla existe y qué columnas tiene
DO $$
BEGIN
  -- Verificar si la tabla users existe
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    -- Crear tabla si no existe
    CREATE TABLE public.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT CHECK (role IN ('admin', 'supervisor', 'cashier')) DEFAULT 'cashier',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE 'Tabla users creada exitosamente';
  ELSE
    -- Verificar y agregar columnas faltantes
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
      ALTER TABLE public.users ADD COLUMN full_name TEXT;
      RAISE NOTICE 'Columna full_name agregada';
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    ) THEN
      ALTER TABLE public.users ADD COLUMN role TEXT CHECK (role IN ('admin', 'supervisor', 'cashier')) DEFAULT 'cashier';
      RAISE NOTICE 'Columna role agregada';
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
      RAISE NOTICE 'Columna is_active agregada';
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
      RAISE NOTICE 'Columna created_at agregada';
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
      RAISE NOTICE 'Columna updated_at agregada';
    END IF;

    RAISE NOTICE 'Tabla users verificada y actualizada';
  END IF;
END $$;

-- ==============================================
-- 2. CREAR TABLA DE PERMISOS (si no existe)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  module TEXT,
  is_active BOOLEAN DEFAULT true
);

-- ==============================================
-- 3. CREAR TABLA DE PERMISOS POR ROL (si no existe)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT CHECK (role IN ('admin', 'supervisor', 'cashier')) NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT false,
  UNIQUE(role, permission_id)
);

-- ==============================================
-- 4. INSERTAR PERMISOS BÁSICOS (si no existen)
-- ==============================================
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

-- ==============================================
-- 4. INSERTAR USUARIO ADMINISTRADOR
-- ==============================================
-- Verificar si el usuario ya existe
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    -- Insertar usuario - usando la estructura con "name" (que parece ser la que tienes)
    -- Basado en el error que recibiste, tu tabla usa "name" en lugar de "full_name"

    INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
    VALUES (
      'e39f54e5-c10b-47f6-9162-4ce3c6f88292',
      'juan@almendra.com',
      'Juan - Administrador Almendra',
      'admin',
      true,
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();

    RAISE NOTICE '✅ Usuario administrador (juan@almendra.com) insertado/actualizado exitosamente';
  ELSE
    RAISE NOTICE 'ERROR: La columna full_name no existe en la tabla users. Ejecuta primero la verificación de la tabla.';
  END IF;
END $$;

-- ==============================================
-- 6. OTORGAR TODOS LOS PERMISOS AL ROL ADMIN
-- ==============================================
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'admin', p.id, true
FROM public.permissions p
ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- ==============================================
-- 6. VERIFICAR CONFIGURACIÓN FINAL
-- ==============================================
SELECT
  '=== RESULTADO FINAL ===' as info,
  'Usuario administrador (juan@almendra.com) configurado exitosamente' as status;

SELECT
  'Usuario creado:' as info,
  u.email,
  u.name,
  u.role,
  u.is_active,
  COUNT(rp.permission_id) as total_permissions,
  u.created_at
FROM public.users u
LEFT JOIN public.role_permissions rp ON u.role = rp.role AND rp.granted = true
WHERE u.id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292'
GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.created_at;

-- Mostrar todos los permisos del admin
SELECT
  '=== PERMISOS DEL ADMINISTRADOR ===' as info,
  COUNT(*) as total_permissions_assigned
FROM public.role_permissions
WHERE role = 'admin' AND granted = true;

-- ==============================================
-- 7. INSTRUCCIONES PARA EL USUARIO
-- ==============================================
/*
PASOS PARA COMPLETAR LA CONFIGURACIÓN:

1. Ejecuta este script completo en Supabase SQL Editor
2. Ve a Authentication → Users en Supabase Dashboard
3. Crea un nuevo usuario con:
   - Email: juan@almendra.com
   - Password: (elige una contraseña segura)
   - UUID: e39f54e5-c10b-47f6-9162-4ce3c6f88292
4. Reinicia la aplicación y haz login con:
   - Email: juan@almendra.com
   - Password: (la que elegiste)

El usuario tendrá permisos de administrador completos.
*/
