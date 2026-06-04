# Changelog - Almendra

Registro de cambios del sistema.

---

## 2026-01-08 — IA: Fix de Impresión a Cocina

**Cambios:**
- **Bug Fix Crítico**: La impresión a la impresora de cocina no funcionaba al abrir mesas con productos de cocina.
- **Causa raíz identificada**: El callback `onSuccess` de la mutación no se ejecutaba porque el componente `QuickSalePanel` se desmontaba antes de que la mutación completara (debido a la UI optimista).
- **Solución implementada**: Mover la lógica de impresión FUERA del callback `onSuccess` y ejecutarla inmediatamente al presionar "Abrir Mesa".
- **Debug agregado**: Logs extensivos con prefijos `🔍 [DEBUG COCINA]` (cliente) y `🔍 [DEBUG SERVER]` (PrintServer) para facilitar diagnóstico futuro.
- **Documentación**: Sección expandida de impresión en `ARCHITECTURE_SUMMARY.md` con arquitectura, flujo, componentes, gotchas y archivos clave.

**Archivos:** `components/shared/QuickSalePanel.tsx`, `PrintServer/print-server.js`, `ARCHITECTURE_SUMMARY.md`

**Impacto:** Crítico (Restaura funcionalidad de impresión de cocina)

---

## 2026-01-06 — IA: UI Optimista Real para Apertura de Mesas

**Cambios:**
- **UI Optimista Real**: Implementado feedback instantáneo (<10ms) al abrir mesas, cerrando el panel inmediatamente.
- **Background Mutation**: La creación de la venta ocurre en segundo plano con rollback automático si falla.
- **Optimización de Fetch**: Eliminada llamada innecesaria a `getTableRemainingBalance` en mesas temporales, acelerando la aparición de productos.
- **Limpieza**: Eliminados imports dinámicos innecesarios y logs de performance.

**Archivos:** `components/shared/QuickSalePanel.tsx`, `components/shared/BarCanvasView.tsx`, `architecture_summary.md`

**Impacto:** Medio (UX Crítica: Apertura de mesa 3.6s -> 1.6ms)

## 2026-01-06 — IA: Activación de Caché del Servidor

**Cambios:**
- **Caché de Layouts**: Conectado `lib/cache.ts` con `caja-bar/page.tsx`. Layouts de mesas (TTL 30 min) se sirven desde caché.
- **Productos SIN caché**: Revertido después de auditoría - el stock debe estar siempre actualizado.
- **Invalidación**: Agregado `revalidateTag('bar-layout')` en todas las funciones de `barLayoutActions.ts`.

**Archivos:** `lib/cache.ts`, `app/(dashboard)/caja-bar/page.tsx`, `actions/barLayoutActions.ts`

**Impacto:** Medio (Mejora rendimiento sin riesgo de inconsistencias)

---

## 2026-01-06 — IA: Auditoría de DB y Optimizaciones

**Cambios:**
- **Seguridad (RLS)**: Restringida escritura pública en tablas de `inventory`, `regions`, `recipes`.
- **Performance**: Creados índices faltantes en claves foráneas (`sales.session_id`, `sale_items.product_id`, etc).
- **Auditoría**: Análisis completo de infraestructura (estado saludable).

**Archivos:** `(Database Schema)`, `OPTIMIZATION_REPORT.md`

**Impacto:** Medio (Mejora seguridad y previene degradación futura)

---

## 2026-01-06 — Daniel: Correcciones de estabilidad, performance y lógica de negocio

**Cambios:**
- **DB & Performance**: Agregados índices SQL críticos y optimizada query de permisos (N+1 -> 2 queries) para eliminar timeouts.
- **Frontend Config**: Fix `ChunkLoadError` eliminando optimizaciones experimentales inestables en `next.config.js`.
- **Lógica de Stock**: Implementada validación estricta de stock disponible antes de agregar items a mesas (TC008).
- **UX**: Renombrado botón "Ingreso" a "Ingreso Extra" para evitar confusión de usuario y tests.

**Archivos:** `actions/permissionActions.ts`, `actions/barActions.ts`, `next.config.js`, `optimize_db.sql`, `components/shared/CashRegisterView.tsx`

**Impacto:** Crítico (Estabilidad y corrección de bugs bloqueantes)

---

## 2026-01-05 — Daniel: Mejora de responsividad UI

**Cambios:**
- Navbar: Cambio de breakpoint de `lg:` (1024px) a `2xl:` (1536px) para evitar overflow de items en pantallas medianas
- Dashboard layout: Padding responsive mejorado (`py-4 px-3 sm:py-6 sm:px-4 lg:py-8 lg:px-6`)
- Dashboard page: Espaciado vertical responsive y header con tamaños adaptativos
- CSS global: Nueva clase `.scrollbar-hide` para ocultar scrollbars manteniendo funcionalidad

**Archivos:** `components/shared/Navbar.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx`, `app/globals.css`

**Impacto:** Ninguno (solo UI)

---
