-- 🔍 VERIFICACIÓN COMPLETA DEL SISTEMA Almendra
-- Ejecutar después de agregar la columna 'area'

-- =====================================================
-- 1. ESTRUCTURA DE TABLAS CRÍTICAS
-- =====================================================

-- Verificar si existen las tablas
SELECT '=== 📊 TABLAS EXISTENTES ===' as info;
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('cash_registers', 'cash_register_sessions', 'users', 'products', 'permissions')
ORDER BY table_name;

SELECT '=== 📊 ESTRUCTURA DE CASH_REGISTERS ===' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'cash_registers'
ORDER BY ordinal_position;

SELECT '=== 📊 ESTRUCTURA DE CASH_REGISTER_SESSIONS ===' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'cash_register_sessions'
ORDER BY ordinal_position;

-- =====================================================
-- 2. DATOS EXISTENTES
-- =====================================================

SELECT '=== 💰 CAJAS REGISTRADORAS ===' as info;
DO $$
DECLARE
    caja RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers') THEN
        FOR caja IN SELECT id, name, type, is_active, created_at FROM cash_registers ORDER BY created_at LOOP
            RAISE NOTICE 'ID: %, Name: %, Type: %, Active: %, Created: %', caja.id, caja.name, caja.type, caja.is_active, caja.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla cash_registers no existe';
    END IF;
END $$;

SELECT '=== 📋 SESIONES DE CAJA ===' as info;
DO $$
DECLARE
    ses RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions') THEN
        FOR ses IN SELECT crs.id, crs.cash_register_id, cr.name as caja_name, cr.type as caja_type,
                        crs.area, crs.shift, crs.opened_by, crs.opened_at, crs.closed_at
                   FROM cash_register_sessions crs
                   LEFT JOIN cash_registers cr ON crs.cash_register_id = cr.id
                   ORDER BY crs.opened_at DESC LOOP
            RAISE NOTICE 'ID: %, Caja: %, Área: %, Turno: %, Abierta: %, Cerrada: %',
                       ses.id, ses.caja_name, ses.area, ses.shift, ses.opened_at, ses.closed_at;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla cash_register_sessions no existe';
    END IF;
END $$;

SELECT '=== 👥 USUARIOS ===' as info;
DO $$
DECLARE
    usr RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        FOR usr IN SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at LOOP
            RAISE NOTICE 'ID: %, Email: %, Rol: %, Activo: %, Creado: %', usr.id, usr.email, usr.role, usr.is_active, usr.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla users no existe';
    END IF;
END $$;

SELECT '=== 🔐 PERMISOS ===' as info;
DO $$
DECLARE
    perm RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
        FOR perm IN SELECT p.name as permiso, p.module, rp.role, rp.granted
                   FROM permissions p
                   LEFT JOIN role_permissions rp ON p.id = rp.permission_id
                   ORDER BY p.module, p.name, rp.role LOOP
            RAISE NOTICE 'Permiso: %, Módulo: %, Rol: %, Otorgado: %', perm.permiso, perm.module, perm.role, perm.granted;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla permissions no existe';
    END IF;
END $$;

SELECT '=== 📦 PRODUCTOS ACTIVOS ===' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
        THEN (SELECT COUNT(*) FROM products WHERE is_active = true)
        ELSE 0
    END as total_productos_activos;

SELECT '=== 🏷️ CATEGORÍAS DE PRODUCTOS ===' as info;
DO $$
DECLARE
    cat RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        -- Mostrar categorías si la tabla existe
        FOR cat IN SELECT id, name, created_at FROM categories ORDER BY name LOOP
            RAISE NOTICE 'ID: %, Name: %, Created: %', cat.id, cat.name, cat.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla categories no existe';
    END IF;
END $$;

-- =====================================================
-- 3. VERIFICACIONES DE INTEGRIDAD
-- =====================================================

SELECT '=== ⚠️ SESIONES SIN ÁREA ASIGNADA ===' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions')
        THEN (SELECT COUNT(*) FROM cash_register_sessions WHERE area IS NULL)
        ELSE 0
    END as sesiones_sin_area;

SELECT '=== ✅ SESIONES CON ÁREA BAR ===' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions')
        THEN (SELECT COUNT(*) FROM cash_register_sessions WHERE area = 'bar')
        ELSE 0
    END as sesiones_con_area_bar;

SELECT '=== 🔍 SESIONES ACTIVAS ===' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions')
        THEN (SELECT COUNT(*) FROM cash_register_sessions WHERE closed_at IS NULL)
        ELSE 0
    END as sesiones_activas;

SELECT '=== 👤 USUARIOS POR ROL ===' as info;
DO $$
DECLARE
    usr_stat RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        FOR usr_stat IN SELECT role, COUNT(*) as cantidad
                        FROM users
                        WHERE is_active = true
                        GROUP BY role
                        ORDER BY role LOOP
            RAISE NOTICE 'Rol: %, Cantidad: %', usr_stat.role, usr_stat.cantidad;
        END LOOP;
    ELSE
        RAISE NOTICE 'Tabla users no existe';
    END IF;
END $$;

-- =====================================================
-- 4. DATOS PARA PRUEBA
-- =====================================================

SELECT '=== 🎯 SESIÓN BAR ACTIVA (para testing) ===' as info;
DO $$
DECLARE
    ses_act RECORD;
    found_session BOOLEAN := FALSE;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions') THEN
        FOR ses_act IN SELECT crs.id, crs.cash_register_id, cr.name as caja_name, crs.area,
                              crs.opened_by, crs.opened_at, crs.closed_at
                       FROM cash_register_sessions crs
                       LEFT JOIN cash_registers cr ON crs.cash_register_id = cr.id
                       WHERE crs.area = 'bar' AND crs.closed_at IS NULL
                       LIMIT 1 LOOP
            RAISE NOTICE 'Sesión BAR activa - ID: %, Caja: %, Abierta: %',
                       ses_act.id, ses_act.caja_name, ses_act.opened_at;
            found_session := TRUE;
        END LOOP;
        IF NOT found_session THEN
            RAISE NOTICE 'No hay sesiones BAR activas';
        END IF;
    ELSE
        RAISE NOTICE 'Tabla cash_register_sessions no existe';
    END IF;
END $$;

SELECT '=== 📊 ESTADÍSTICAS GENERALES ===' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers')
        THEN (SELECT COUNT(*) FROM cash_registers WHERE is_active = true)
        ELSE 0
    END as cajas_activas,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_register_sessions')
        THEN (SELECT COUNT(*) FROM cash_register_sessions WHERE closed_at IS NULL)
        ELSE 0
    END as sesiones_abiertas,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
        THEN (SELECT COUNT(*) FROM users WHERE is_active = true)
        ELSE 0
    END as usuarios_activos,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
        THEN (SELECT COUNT(*) FROM products WHERE is_active = true)
        ELSE 0
    END as productos_activos,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions')
        THEN (SELECT COUNT(*) FROM permissions)
        ELSE 0
    END as permisos_totales;
