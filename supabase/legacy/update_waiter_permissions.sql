-- Actualizar permisos del rol WAITER para acceso completo a Caja bar, Cocina, Ventas y Gastos
-- Ejecutar este script en Supabase SQL Editor

-- Agregar permisos adicionales al rol WAITER
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'waiter', p.id, true
FROM permissions p
WHERE p.name IN (
  -- Ventas - acceso completo
  'sales.view_all',  -- Para ver todas las ventas en el módulo Ventas
  'sales.edit',      -- Para editar ventas si es necesario

  -- Gastos - acceso completo
  'expenses.create', -- Crear gastos
  'expenses.view',   -- Ver gastos
  'expenses.edit',   -- Editar gastos

  -- Cocina - acceso completo para marcar pedidos
  'kitchen.view_orders', -- Ver pedidos
  'kitchen.mark_ready',  -- Marcar como listo
  'kitchen.reprint',     -- Reimprimir

  -- Caja bar - acceso completo (ya tiene algunos, agregamos más)
  'cash.view',       -- Ver caja
  'cash.open',       -- Abrir caja
  'cash.close',      -- Cerrar caja

  -- Productos - acceso para ver en ventas
  'products.view',   -- Ya lo tiene, pero aseguramos

  -- Dashboard
  'dashboard.view'   -- Ya lo tiene
)
ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;

-- Verificar permisos actuales del waiter
SELECT
  '=== PERMISOS ACTUALES DEL ROL WAITER ===' as info;

SELECT
  p.name,
  p.description,
  p.module,
  rp.granted
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role = 'waiter' AND rp.granted = true
ORDER BY p.module, p.name;
