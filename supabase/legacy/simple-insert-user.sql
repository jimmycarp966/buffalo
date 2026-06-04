-- Script SIMPLE para insertar usuario admin
-- Este script inserta directamente el usuario usando la estructura con "name"

-- Insertar usuario administrador con la estructura correcta
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

-- Verificar que se insertó correctamente
SELECT '=== USUARIO INSERTADO ===' as info;
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.created_at
FROM public.users u
WHERE u.id = 'e39f54e5-c10b-47f6-9162-4ce3c6f88292';

-- Asignar todos los permisos al rol admin
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'admin', p.id, true
FROM public.permissions p
ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- Verificar permisos
SELECT '=== PERMISOS ASIGNADOS ===' as info;
SELECT COUNT(*) as total_permissions_admin
FROM public.role_permissions
WHERE role = 'admin' AND granted = true;




























































