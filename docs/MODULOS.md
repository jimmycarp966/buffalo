# Módulos y roles

> Todas las páginas viven bajo `app/(dashboard)/` y comparten `app/(dashboard)/layout.tsx` (monta el `Navbar`). UI en `components/shared/`, lógica de servidor en `actions/*.ts`.

## Dashboard (Inicio)
Pantalla de bienvenida que cambia según rol: el **cajero** ve accesos directos grandes (Caja Bar + Historial); **supervisor/admin** ven métricas (ventas de hoy, productos, ingresos del mes, usuarios/stock bajo). Admin ve además `SystemMonitor` y `WelcomeWizard`.
- `app/(dashboard)/dashboard/page.tsx`, `components/shared/DashboardNew.tsx`, `actions/dashboardActions.ts` (`getDashboardData`).

## Caja Bar (Punto de Venta) — núcleo del POS
Página `app/(dashboard)/caja-bar/page.tsx` → `PointOfSaleTabs.tsx` con **3 pestañas**. Arriba siempre la barra de caja (`CashRegisterInfo`) con apertura/cierre de caja e ingresos de dinero.

### Las 3 pestañas
- **Mesas** — `BarWithSaleView.tsx` (+ `BarCanvasView`/`TableSelectorView` para el plano salón/vereda). Tocar mesa libre → `AvailableTableDetail` → **Abrir Mesa**. Mesa abierta → `SelectedTableDetail.tsx`.
- **Mostrador** — `CounterSaleView.tsx` + `CounterSaleForm.tsx`. Lista de pedidos + **Nuevo Pedido** (`sale_type: "counter"`).
- **Delivery** — `DeliveryOrdersList.tsx` + `DeliverySaleForm.tsx`. Igual pero con cliente, dirección, teléfono, notas (`sale_type: "delivery"`).

### Flujo de pedido (abrir → agregar → cobrar)
1. **Abrir** pedido/mesa.
2. **Agregar ítems**: búsqueda con autocompletado; valida stock salvo `unlimited_stock`. Productos `cocina_only` se envían a impresión de cocina y dejan la venta `pending` hasta que cocina la marca lista.
3. **Cerrar/cobrar** con `CloseTableModal.tsx`: productos a la izquierda, formas de pago a la derecha. Permite **varias formas de pago**, calcula **vuelto**, bloquea cierre si falta. Toggle **Descuento / Recargo %** (atajos 10/15/20%). También **Facturar y cerrar** (AFIP), bloqueado si hay descuento/recargo.
4. Desde `SelectedTableDetail`: pago parcial, imprimir cuenta, agregar/quitar ítems, cambiar de mesa, unir mesas, editar datos del cliente.

> **IMPORTANTE (comportamiento actual):** mostrador y delivery ya **no** se cobran en el acto — crean pedidos **`pending` (abiertos)** que se **cierran como una mesa** con el mismo `CloseTableModal`. Funciones de cierre: `closeTable` (mesa), `completeCounter` (mostrador), `completeDelivery` (delivery).

### Apertura/cierre de caja
`CashRegisterInfo.tsx` (estado, turno, monto inicial), `OpenCashModal.tsx`, `CloseCashModal.tsx` (arqueo: efectivo esperado vs contado, desglose por método, diferencia), `IncomeModal.tsx`. Acciones en `actions/cashActions.ts`.

## Cocina
Display de cocina (KDS): ve pedidos con productos `cocina_only` y los marca listos. `app/(dashboard)/cocina/page.tsx` → `KitchenView.tsx` (realtime Supabase, sonido de alarma, pantalla completa, reimpresión). Acciones: `markKitchenReady`, `markAllKitchenReady`.

## Ventas (historial)
`ventas/page.tsx`: historial con stats (total, monto, hoy con "día comercial", ticket promedio). `SalesTable.tsx`, `SaleDetailModal.tsx`, `SalesFilters.tsx`. Acciones: `getSales`.

## Productos
`productos/page.tsx` → `ProductTabs` → `ProductsTable.tsx` (búsqueda, orden, paginación, alerta stock bajo, import PDF, edición rápida de precio con doble click, borrado **solo admin**). `ProductModal.tsx`: **selector de categoría**, precio costo/venta/margen %, imagen, stock/mínimo, **stock ilimitado** y (si ilimitado) **`cocina_only`**. Acciones: `actions/productActions.ts`.

## Gastos
`gastos/page.tsx` → `ExpensesTable` + `ExpenseModal`. Registro de gastos con totales; impactan el arqueo de caja.

## Compras + Proveedores (cuentas por pagar)
- **Compras** — `compras/page.tsx` → `PurchasesTable` + `PurchaseModal.tsx`: proveedor + ítems (producto/cantidad/costo) + **estado Pagada/Pendiente** (pendiente = cuenta por pagar). Al registrar **actualiza stock**.
- **Proveedores** — `proveedores/page.tsx` → `SuppliersTable` + `SupplierModal`. Acciones: `actions/supplierActions.ts`.

## Reportes
`reportes/page.tsx` → `ReportsContent.tsx`. Filtros (fechas, caja, empleado, categoría, comparación). Stats de ventas, top productos, ventas por método/caja, ingresos vs gastos, rentabilidad. Gráficos `ReportsCharts`, export `ExportButtons`. Acciones: `actions/reportActions.ts`.

## Promociones
`promociones/page.tsx` → `PromotionsTable` + `PromotionModal`. Promos con fecha inicio/fin y estado.

## Usuarios (roles + permisos granulares)
`usuarios/page.tsx` → `UsersTable.tsx` (también embebido en Configuración). `UserModal.tsx`: nombre, email, contraseña (solo alta), **rol** (Mozo/Cajero/Cocina/Supervisor/Administrador), DNI, activo. `PermissionsModal.tsx`: permisos por usuario, ciclando cada uno **Permitir → Denegar → Heredar del rol**. Acciones: `actions/userActions.ts`, `actions/permissionActions.ts`.

## Configuración (solo admin)
`configuracion/page.tsx`:
- `StoreSettingsPanel.tsx` — datos de tienda y menú del día (carta pública).
- `ConfigurationPanel.tsx` — **datos del negocio para tickets**: nombre, dirección, teléfono, CUIT, mensaje al pie. Acción `actions/configActions.ts`.
- `PrinterConfigPanel.tsx` — impresoras. `QRGenerator.tsx` — QR de la carta. `UsersTable` embebida.

> **Alias de transferencia:** lo que se imprime en tickets es una **constante en código** (`TICKET_TRANSFER_ALIAS` en `lib/ticketTransferInfo.ts`), **no** editable desde la UI. Para rebrandear, editar ese archivo.

---

## Navbar (`components/shared/Navbar.tsx`)
Ítems principales + menú **"Más ▾"** de gestión. El rol se lee de `useAuthStore`.
- **Principales:** Inicio · Caja Bar · Cocina · Ventas · Productos · Gastos.
- **"Más ▾":** Reportes · Proveedores · Compras · Promociones · Usuarios · Configuración.

| Rol | Ítems principales | Menú "Más ▾" |
|---|---|---|
| **admin** | todos | Reportes, Proveedores, Compras, Promociones, Usuarios, Configuración |
| **supervisor** | todos | Reportes, Proveedores, Compras, Promociones |
| **cashier** | Inicio, Caja Bar, Cocina, Gastos | **(ninguno)** |
| **waiter** | Inicio, Caja Bar, Cocina, Ventas, Gastos | (ninguno) |
| **kitchen** | Cocina | (ninguno) |

## Matriz de roles

| Capacidad | admin | supervisor | cashier | waiter | kitchen |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | — |
| Caja Bar (mesas/mostrador/delivery) | ✅ | ✅ | ✅ | ✅ | — |
| Abrir/cerrar caja, ingresos | ✅ | ✅ | ✅ | ✅ | — |
| Cobrar / cerrar pedido | ✅ | ✅ | ✅ | ✅ | — |
| Descuento/recargo % al cerrar | ✅ | ✅ | ✅ | ✅ | — |
| Cocina (marcar listo) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ventas (historial) | ✅ | ✅ | ❌ | ✅ | — |
| Productos | ✅ (borra) | ✅ | ❌ | — | — |
| **Editar precio manual (override)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gastos | ✅ | ✅ | ✅ | ✅ | — |
| Reportes | ✅ | ✅ | ❌ | ❌ | — |
| Compras / Proveedores | ✅ | ✅ | ❌ | ❌ | — |
| Promociones | ✅ | ✅ | ❌ | ❌ | — |
| Usuarios + permisos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ | ❌ | ❌ |

> Los permisos finos por usuario se ajustan además vía `PermissionsModal` (override sobre el rol).

### Resumen del CAJERO
- **No ve:** Ventas, Productos, ni el menú "Más ▾". Solo Inicio, Caja Bar, Cocina, Gastos.
- **No puede:** cambiar el precio manual (override bloqueado por `useCanEditPrices`).
- **Sí puede:** cobrar, abrir/cerrar caja y mesas, registrar ingresos, cargar gastos, aplicar descuentos/recargos %.
