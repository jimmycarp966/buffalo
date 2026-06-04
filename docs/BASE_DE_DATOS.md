# Base de datos y seguridad

> El setup canónico es un único script idempotente: **`supabase/BUFFALO_SETUP.sql`** (~2505 líneas). Al reutilizar la plantilla, renombrar los seeds (nombre de tienda, email de admin, catálogo de ejemplo).

## 1. El SQL único: `supabase/BUFFALO_SETUP.sql`

### Cómo se aplica
1. Abrir el **SQL Editor** del proyecto Supabase nuevo.
2. Pegar el archivo completo y ejecutar (**Run**).
3. El admin se crea automáticamente al final **si la instancia permite escribir en `auth.users`**. Si no, crearlo a mano (sección 6).

Todo corre en una transacción única (`BEGIN;` … `COMMIT;`). Es **idempotente** (usa `IF NOT EXISTS`, `ON CONFLICT`, `CREATE OR REPLACE`, bloques `DO $$ ... EXCEPTION WHEN duplicate_object`). Se puede re-ejecutar sin error.

### Qué hace (resumen de bloques)
Extensiones (`pgcrypto`, `uuid-ossp`) · pre-creación de `suppliers` e `is_admin()` (orden de dependencias) · ENUMs (`user_role`, `sale_type`, `sale_status`, …) · todas las tablas · índices (incluye el índice parcial único `idx_sales_pending_table_unique` que impide dos ventas `pending` de tipo `table` en la misma mesa) · **RLS habilitada en todas las tablas** · constraint `UNIQUE(invoices.sale_id)` (idempotencia AFIP) · funciones/RPC/triggers · `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` de compatibilidad + secuencia `ticket_number_seq` · bootstrap del admin · seeds (métodos de pago, store/app settings, permisos + role_permissions, categorías + catálogo de ejemplo) · bucket `private-files` + GRANTS · verificación final.

> Varias secciones (seeds, RLS, columnas) están **duplicadas a propósito**: una pasada temprana mínima y una final completa. La pasada final (~línea 2236+) es la fuente de verdad para métodos de pago y permisos de roles.

## 2. Tablas principales por dominio

- **Ventas:** `sales` (cabecera: `sale_number`, `sale_type`, `status` pending/completed/cancelled, `payment_status`, `kitchen_status`, totales), `sale_items`, `sale_payments` (pagos mixtos), `table_payments`, `sale_item_payments`, `table_splits`, `table_changes`.
- **Caja:** `cash_registers` (cajas físicas, `type` shop/bar), `cash_register_sessions` (apertura/cierre de turno: opening/closing/expected/difference), `cash_movements`, `cash_incomes`, `daily_cash`, `work_shifts`.
- **Productos:** `products` (`sale_price`, `cost_price`, `stock`, `unlimited_stock`, `cocina_only`, `category_id`, `supplier_id`), `categories` (`display_order`, `cocina_only`, `parent_id`).
- **Compras:** `suppliers`, `purchases` (`payment_status`, `payment_method_id`), `purchase_items`, `inventory_movements`, `stock_movements`.
- **Gastos:** `expenses` (`amount`, `category`, `cash_register_session_id`).
- **Facturación:** `invoices` (factura AFIP por venta: `cae`, `status`, **`UNIQUE(sale_id)`**), `price_history`.
- **Mesas/Bar:** `bar_layout` (plano: `table_number`, posición, forma, área/zona).
- **Usuarios/permisos:** `users` (1:1 con `auth.users`, `role`), `permissions`, `role_permissions`, `user_permissions`.
- **Otros:** `customers`, `promotions`, `app_settings`, `store_settings`, `audit_logs`. **Legacy sin UI:** `employees`, `employee_*`, rutas/viajes.

## 3. Funciones / RPC clave

| Función | Qué hace |
|---|---|
| **`is_admin()`** | `SECURITY DEFINER`. TRUE si `auth.uid()` tiene `role='admin'`. Usada en RLS administrativa. |
| **`is_active_staff()`** | TRUE si `auth.uid()` está en `users` con `is_active`. Base de casi toda la RLS operativa. |
| **`has_permission(p_user_id, p_permission_name)`** | Núcleo de permisos: admin → TRUE siempre; si no, busca override en `user_permissions` y luego el permiso del rol en `role_permissions`. La invoca `checkUserPermission`. |
| **`create_sale(p_sale_data JSONB)`** | Venta atómica: valida usuario; para `pending` de mesa valida que no esté ocupada; inserta `sales` + `sale_items` descontando stock (salvo `unlimited_stock`) + `sale_payments`. |
| **`close_pending_sale(...)`** | Pasa venta `pending → completed`, fija método de pago, inserta `sale_payments`, audita. |
| **`cancel_pending_sale(...)`** | Cancela `pending`: **devuelve el stock**, marca `cancelled`, audita. |
| **`get_next_ticket_number()`** | Siguiente número de ticket (secuencia `ticket_number_seq`, padding 10 dígitos). |
| **`remove_item_from_table(...)`** | **Solo admin**: quita un ítem de venta `pending`, devuelve stock, recalcula. |
| **Reportes** | `get_top_selling_products`, `get_sales_by_payment_method`, `get_sales_by_cash_register`, `get_sales_by_shift`. |
| Triggers | `update_updated_at_column()` (genérico), `validate_shift_uniqueness()` (evita 2 sesiones de caja abiertas). |

> **`create_purchase` NO existe como RPC.** Las compras se crean en la Server Action **`createPurchase`** (`actions/supplierActions.ts`), con `INSERT` directo + RLS.

## 4. Modelo RLS

Todas las tablas tienen RLS. Tres patrones:

- **A — `public_read_*`** (catálogo público): SELECT para `anon, authenticated` con `is_active=true`; escritura solo staff. En `categories`, `products`, `store_settings`, `cash_register_sessions` (open).
- **B — `staff_manage_*`** vía `is_active_staff()`: `FOR ALL TO authenticated USING (is_active_staff())`. El patrón mayoritario — cualquier usuario **autenticado y activo** opera. La **granularidad por rol** (cajero vs mozo) NO se hace en RLS, sino en las Server Actions.
- **C — `admin_manage_*`** vía `is_admin()`: solo admin. En `users`, `permissions`, `role_permissions`, `user_permissions`, `app_settings`, `audit_logs`.

**GRANTS:** `anon` → solo SELECT de catálogo público; `authenticated` → CRUD sobre todo (la RLS filtra); `service_role` → total.

## 5. Sistema de permisos

### Catálogo (`permissions`) — 46 permisos por módulo
`dashboard.view` · `users.*` · `cash.*` (open/close/view/deposit/withdraw) · `sales.*` (create/view_own/view_all/edit/delete) · `tables.*` · `products.*` · `inventory.*` · `kitchen.*` · `reports.*` · `settings.*` · `suppliers.*` · `purchases.*` · `expenses.*` · `config.view`.

### `role_permissions` por rol
El form de usuarios ofrece 5 roles. **El SQL siembra `role_permissions` para `admin`, `waiter`, `cashier`, `kitchen`.** **`supervisor` NO tiene filas sembradas** — su acceso se resuelve por UI/nav (ve casi todo el menú salvo Usuarios/Config) y checks de rol en código.

| Rol | Permisos |
|---|---|
| **admin** | TODOS (+ `has_permission` cortocircuita a TRUE). |
| **waiter** (Mozo) | dashboard; cash.*; sales create/view_own/view_all/edit; tables view/open/close/move; inventory.view; kitchen view/mark_ready; expenses view/create; reports.view. |
| **cashier** (Cajero) | dashboard; cash.*; sales create/edit; tables view/open/close/move/edit; kitchen view/mark_ready; expenses view/create. |
| **kitchen** (Cocina) | dashboard; kitchen view_orders/mark_ready/manage. |
| **supervisor** | *(sin filas — gestionado por UI)*. |

### Restricciones del cajero (3 capas)
1. **No se le otorgan** `sales.view_*`, `products.*`, `reports.view`, `inventory.view`.
2. **`DELETE` idempotente** en el SQL borra esos permisos del rol `cashier` aunque se re-aplique sobre una base previa.
3. **Navbar** (`components/shared/Navbar.tsx`): el cajero solo ve `/dashboard`, `/caja-bar`, `/cocina`, `/gastos`. Sin menú "Más".
4. **Precio manual bloqueado** (`hooks/useCanEditPrices.ts`): override de precio solo para `admin`/`supervisor`.

### Cómo lo aplican las Server Actions
`checkUserPermission(userId, permission)` (`actions/permissionActions.ts`) → RPC `has_permission`. Patrón:
```ts
const { hasPermission } = await checkUserPermission(user.id, "sales.create");
if (!hasPermission) return { success: false, message: "No tienes permisos..." };
```
La gestión de permisos en sí (`updateRolePermission`, `updateUserPermission`) está además gateada a `role === "admin"`.

## 6. Datos sembrados

- **Métodos de pago** (UUIDs fijos): Efectivo, Transferencia, Débito, Crédito, **QR**.
- **Cash register:** "CAJA BAR" (tipo bar).
- **store_settings:** `store_name = 'Febrero Tostadores de Café'`.
- **app_settings:** `bar_config` (20 mesas, áreas salon/vereda), currency ARS, timezone Buenos Aires, **`afip_environment = 'homologacion'`**.
- **Categorías + catálogo de ejemplo** (~29 productos de muestra, `unlimited_stock=TRUE`). → Al reutilizar, reemplazar por el catálogo real del cliente.
- **Admin bootstrap:** crea/vincula `auth.users` + `public.users` con `role='admin'`. Credenciales por defecto: **`admin@febrero.cafe` / `Admin123456!`** — cambiar tras el primer login. Si la instancia no permite escribir en `auth.users`, crearlo manual (Authentication → Add user, Auto Confirm) y ejecutar el `INSERT ... ON CONFLICT (id) DO UPDATE` sobre `public.users` documentado en el encabezado del SQL.

## Notas para la plantilla
- `supervisor` no tiene `role_permissions` sembrados: si necesitás que `has_permission` funcione para supervisores, agregá su bloque de seed (análogo al de `cashier`).
- No existe RPC `create_purchase` (es Server Action).
- Las tablas `employee_*` existen solo por la FK `sales.employee_id`; no hay módulo RRHH.
