-- Script RÁPIDO para arreglar la tabla users
-- Ejecutar este script primero para verificar y corregir la estructura
-- Nota: El usuario admin ya existe con ID e39f54e5-c10b-47f6-9162-4ce3c6f88292 y email juan@almendra.com

-- 1. Ver estructura actual
SELECT '=== ESTRUCTURA ACTUAL DE USERS ===' as info;
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Agregar columnas faltantes
DO $$
BEGIN
  -- Agregar full_name si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN full_name TEXT;
    RAISE NOTICE '✅ Columna full_name agregada';
  END IF;

  -- Agregar role si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role TEXT CHECK (role IN ('admin', 'supervisor', 'cashier')) DEFAULT 'cashier';
    RAISE NOTICE '✅ Columna role agregada';
  END IF;

  -- Agregar is_active si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ Columna is_active agregada';
  END IF;

  -- Agregar created_at si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna created_at agregada';
  END IF;

  -- Agregar updated_at si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna updated_at agregada';
  END IF;
END $$;

-- 3. Ver estructura después de cambios
SELECT '=== ESTRUCTURA DESPUÉS DE CORRECCIONES ===' as info;
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
