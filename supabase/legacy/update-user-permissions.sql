-- Script para actualizar permisos del usuario existente
-- Este script actualiza el usuario existente con permisos de admin

-- 1. Verificar usuario actual
SELECT '=== USUARIO ACTUAL ===' as info;
SELECT * FROM public.users WHERE id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';

-- 2. Verificar estructura de la tabla
SELECT '=== ESTRUCTURA DE LA TABLA USERS ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Actualizar usuario existente con permisos de admin
DO $$
BEGIN
  -- Verificar si el usuario existe
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292') THEN
    RAISE NOTICE '✅ Usuario encontrado, actualizando permisos...';

    -- Actualizar rol del usuario a admin
    UPDATE public.users
    SET role = 'admin', updated_at = NOW()
    WHERE id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';

    -- Asegurar que el usuario esté activo
    UPDATE public.users
    SET is_active = true, updated_at = NOW()
    WHERE id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';

    RAISE NOTICE '✅ Usuario actualizado a rol ADMIN';

  ELSE
    RAISE NOTICE '❌ Usuario no encontrado en la tabla users';
  END IF;
END $$;

-- 4. Verificar permisos actuales del rol admin
SELECT '=== PERMISOS DEL ROL ADMIN ===' as info;
SELECT
  p.name as permission_name,
  p.description,
  rp.granted,
  COUNT(*) OVER() as total_permissions
FROM public.permissions p
LEFT JOIN public.role_permissions rp ON p.id = rp.permission_id AND rp.role = 'admin'
ORDER BY p.name;

-- 5. Verificar resultado final
SELECT '=== RESULTADO FINAL ===' as info;
SELECT
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE u.id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';
