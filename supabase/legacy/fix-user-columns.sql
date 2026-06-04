-- Script para corregir la estructura de la tabla users
-- Agrega columna full_name y sincroniza datos

-- 1. Ver estructura actual
SELECT '=== ESTRUCTURA ACTUAL DE USERS ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Agregar columna full_name si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN full_name TEXT;
    RAISE NOTICE '✅ Columna full_name agregada';
  END IF;
END $$;

-- 3. Copiar datos de name a full_name si ambas columnas existen
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) AND EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    UPDATE public.users SET full_name = name WHERE full_name IS NULL;
    RAISE NOTICE '✅ Datos copiados de name a full_name';
  END IF;
END $$;

-- 4. Ver estructura después de cambios
SELECT '=== ESTRUCTURA DESPUÉS DE CORRECCIONES ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 5. Ver datos del usuario admin
SELECT '=== USUARIO ADMINISTRADOR ===' as info;
SELECT
  id,
  email,
  name,
  full_name,
  role,
  is_active
FROM public.users
WHERE id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';
