-- ========================================================================================
-- SCRIPT PARA BORRAR TODAS LAS VENTAS, CAJAS Y MOVIMIENTOS - RESET DEL SISTEMA
-- ========================================================================================
-- ⚠️  ATENCIÓN: Este script BORRA TODOS LOS DATOS de ventas, cajas y movimientos
-- ✅ MANTIENE: Empleados (users) y Productos intactos para comenzar desde cero
-- ========================================================================================
-- Ejecutar con precaución - hace backup automático antes de borrar
-- ========================================================================================

-- PASO 1: HACER BACKUP DE LOS DATOS ANTES DE BORRAR
-- ========================================================================================

-- Crear tabla temporal para backup de ventas
CREATE TEMP TABLE backup_sales AS
SELECT * FROM sales;

-- Crear tabla temporal para backup de items de venta
CREATE TEMP TABLE backup_sale_items AS
SELECT * FROM sale_items;

-- Crear tabla temporal para backup de pagos de venta
CREATE TEMP TABLE backup_sale_payments AS
SELECT * FROM sale_payments;

-- Crear tabla temporal para backup de facturas
CREATE TEMP TABLE backup_invoices AS
SELECT * FROM invoices;

-- Crear tabla temporal para backup de sesiones de caja
CREATE TEMP TABLE backup_cash_register_sessions AS
SELECT * FROM cash_register_sessions;

-- Crear tabla temporal para backup de cajas registradoras
CREATE TEMP TABLE backup_cash_registers AS
SELECT * FROM cash_registers;

-- Crear tabla temporal para backup de movimientos de inventario
CREATE TEMP TABLE backup_inventory_item_movements AS
SELECT * FROM inventory_item_movements;

-- Crear tabla temporal para backup de pagos de mesa
CREATE TEMP TABLE backup_table_payments AS
SELECT * FROM table_payments;

-- Mostrar resumen antes de borrar
DO $$
DECLARE
    v_sales_count INTEGER;
    v_sale_items_count INTEGER;
    v_sale_payments_count INTEGER;
    v_invoices_count INTEGER;
    v_sessions_count INTEGER;
    v_registers_count INTEGER;
    v_movements_count INTEGER;
    v_table_payments_count INTEGER;
    v_users_count INTEGER;
    v_products_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sales_count FROM sales;
    SELECT COUNT(*) INTO v_sale_items_count FROM sale_items;
    SELECT COUNT(*) INTO v_sale_payments_count FROM sale_payments;
    SELECT COUNT(*) INTO v_invoices_count FROM invoices;
    SELECT COUNT(*) INTO v_sessions_count FROM cash_register_sessions;
    SELECT COUNT(*) INTO v_registers_count FROM cash_registers;
    SELECT COUNT(*) INTO v_movements_count FROM inventory_item_movements;
    SELECT COUNT(*) INTO v_table_payments_count FROM table_payments;
    SELECT COUNT(*) INTO v_users_count FROM users;
    SELECT COUNT(*) INTO v_products_count FROM products;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '📊 RESUMEN DE DATOS A BORRAR:';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'Ventas: %', v_sales_count;
    RAISE NOTICE 'Items de venta: %', v_sale_items_count;
    RAISE NOTICE 'Pagos de venta: %', v_sale_payments_count;
    RAISE NOTICE 'Facturas: %', v_invoices_count;
    RAISE NOTICE 'Sesiones de caja: %', v_sessions_count;
    RAISE NOTICE 'Cajas registradoras: %', v_registers_count;
    RAISE NOTICE 'Movimientos de inventario: %', v_movements_count;
    RAISE NOTICE 'Pagos de mesa: %', v_table_payments_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ DATOS QUE SE MANTIENEN INTACTOS:';
    RAISE NOTICE 'Empleados (users): %', v_users_count;
    RAISE NOTICE 'Productos: %', v_products_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ¿Estás seguro de que quieres continuar?';
    RAISE NOTICE '   Los datos estarán disponibles en las tablas temporales backup_*';
    RAISE NOTICE '================================================================================';
END $$;

-- PASO 2: BORRAR DATOS EN ORDEN CORRECTO (respetando foreign keys)
-- ========================================================================================

-- 2.1 BORRAR PAGOS DE MESA (referencian ventas)
DELETE FROM table_payments;

-- 2.2 BORRAR FACTURAS (referencian ventas)
DELETE FROM invoices;

-- 2.3 BORRAR PAGOS DE VENTA (referencian ventas)
DELETE FROM sale_payments;

-- 2.4 BORRAR ITEMS DE VENTA (referencian ventas y productos)
DELETE FROM sale_items;

-- 2.5 BORRAR VENTAS (referenciadas por items, pagos y facturas)
DELETE FROM sales;

-- 2.6 BORRAR MOVIMIENTOS DE INVENTARIO INTERNO
DELETE FROM inventory_item_movements;

-- 2.7 BORRAR SESIONES DE CAJA (referencian cajas y usuarios)
DELETE FROM cash_register_sessions;

-- 2.8 BORRAR CAJAS REGISTRADORAS
DELETE FROM cash_registers;

-- PASO 3: VERIFICACIÓN FINAL
-- ========================================================================================

DO $$
DECLARE
    v_sales_count INTEGER;
    v_sale_items_count INTEGER;
    v_sale_payments_count INTEGER;
    v_invoices_count INTEGER;
    v_sessions_count INTEGER;
    v_registers_count INTEGER;
    v_movements_count INTEGER;
    v_table_payments_count INTEGER;
    v_users_count INTEGER;
    v_products_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sales_count FROM sales;
    SELECT COUNT(*) INTO v_sale_items_count FROM sale_items;
    SELECT COUNT(*) INTO v_sale_payments_count FROM sale_payments;
    SELECT COUNT(*) INTO v_invoices_count FROM invoices;
    SELECT COUNT(*) INTO v_sessions_count FROM cash_register_sessions;
    SELECT COUNT(*) INTO v_registers_count FROM cash_registers;
    SELECT COUNT(*) INTO v_movements_count FROM inventory_item_movements;
    SELECT COUNT(*) INTO v_table_payments_count FROM table_payments;
    SELECT COUNT(*) INTO v_users_count FROM users;
    SELECT COUNT(*) INTO v_products_count FROM products;

    RAISE NOTICE '';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE '✅ VERIFICACIÓN FINAL - DATOS BORRADOS:';
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'Ventas restantes: %', v_sales_count;
    RAISE NOTICE 'Items de venta restantes: %', v_sale_items_count;
    RAISE NOTICE 'Pagos de venta restantes: %', v_sale_payments_count;
    RAISE NOTICE 'Facturas restantes: %', v_invoices_count;
    RAISE NOTICE 'Sesiones de caja restantes: %', v_sessions_count;
    RAISE NOTICE 'Cajas registradoras restantes: %', v_registers_count;
    RAISE NOTICE 'Movimientos de inventario restantes: %', v_movements_count;
    RAISE NOTICE 'Pagos de mesa restantes: %', v_table_payments_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ DATOS MANTENIDOS INTACTOS:';
    RAISE NOTICE 'Empleados (users): %', v_users_count;
    RAISE NOTICE 'Productos: %', v_products_count;
    RAISE NOTICE '';

    IF v_sales_count = 0 AND v_sale_items_count = 0 AND v_sale_payments_count = 0
       AND v_invoices_count = 0 AND v_sessions_count = 0 AND v_registers_count = 0
       AND v_movements_count = 0 AND v_table_payments_count = 0 THEN
        RAISE NOTICE '🎉 ¡EXITO! Todos los datos de ventas/cajas/movimientos han sido borrados correctamente.';
        RAISE NOTICE '   Empleados y productos se mantienen intactos.';
        RAISE NOTICE '   Los datos de respaldo están en las tablas temporales backup_*';
    ELSE
        RAISE NOTICE '⚠️  ATENCIÓN: Algunos datos no pudieron ser borrados.';
        RAISE NOTICE '   Revisa las restricciones de foreign key o errores arriba.';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '💡 El sistema está listo para comenzar desde cero con empleados y productos existentes.';
    RAISE NOTICE '================================================================================';
END $$;

-- PASO 4: LIMPIEZA (opcional - descomentar si quieres borrar los backups)
-- ========================================================================================
-- ⚠️  ATENCIÓN: Esto borrará los datos de respaldo permanentemente
-- DROP TABLE IF EXISTS backup_sales;
-- DROP TABLE IF EXISTS backup_sale_items;
-- DROP TABLE IF EXISTS backup_sale_payments;
-- DROP TABLE IF EXISTS backup_invoices;
-- DROP TABLE IF EXISTS backup_cash_register_sessions;
-- DROP TABLE IF EXISTS backup_cash_registers;
-- DROP TABLE IF EXISTS backup_inventory_item_movements;
-- DROP TABLE IF EXISTS backup_table_payments;
