-- 🔧 CORRECCIÓN: Actualizar rol del usuario juan@almendra.com a administrador

-- Actualizar el rol del usuario administrador en la tabla users
UPDATE public.users
SET role = 'admin'
WHERE email = 'juan@almendra.com';

-- Verificar que el cambio se aplicó correctamente
SELECT
    id,
    email,
    role,
    is_active,
    created_at
FROM public.users
WHERE email = 'juan@almendra.com';

-- Mostrar mensaje de confirmación
SELECT '✅ Usuario juan@almendra.com actualizado a rol ADMINISTRADOR' as status;
