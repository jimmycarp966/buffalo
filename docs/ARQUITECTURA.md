# Arquitectura y estructura

> Documento generado analizando el **código real actual** de la plantilla (no los `.md` históricos). El sistema fue saneado: se quitaron RRHH y el bot de WhatsApp/Gemini/Twilio, y se rebrandeó a "Febrero". Ver **Deuda / residuos conocidos** al final.

## 1. Stack y versiones

Fuente: `package.json` (`name: "febrero-pos"`).

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | **Next.js** (App Router) | `^15.5.4` |
| UI runtime | **React** / React DOM | `^19.0.0` |
| Lenguaje | **TypeScript** | `^5` |
| Backend / DB / Auth | **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) | `^2.47` / `^0.5` |
| Estilos | **Tailwind CSS** (+ `tailwindcss-animate`, `tailwind-merge`, `class-variance-authority`, `clsx`) | `^3.4` |
| Estado global | **Zustand** | `^5.0` |
| Data fetching / cache | **TanStack React Query** | `^5.90` |
| Componentes base | **shadcn/ui** sobre **Radix UI** + `lucide-react` | varias |
| Tablas | `@tanstack/react-table` | `^8.20` |
| Formularios / validación | `react-hook-form` + `@hookform/resolvers` + **Zod** | — |
| Drag & drop | `@dnd-kit/*` (mapa de mesas) | — |
| Animación / Charts | `framer-motion` / `recharts` (lazy) | — |
| Facturación AFIP | `@afipsdk/afip.js`, `pem` | — |
| Impresión | `node-printer`, `react-to-print`, `jspdf` | — |
| Fechas | `date-fns` | `^4.1` |

**Tooling:** Jest + Testing Library, Playwright (e2e), ESLint + Prettier, `tsx`. Scripts en `package.json` (`test:*`, `type-check` = `next typegen && tsc --noEmit`, `build`, `vercel-build`).

> No hay dependencias de WhatsApp, Twilio ni Gemini (confirmado: no aparecen en `package.json` ni en imports de `app/ actions/ lib/ components/`).

## 2. Estructura de carpetas

| Carpeta | Propósito |
|---|---|
| `app/` | App Router de Next.js: rutas, layouts, route handlers (API). Toda la UI. |
| `actions/` | **Server Actions** (`"use server"`), una por dominio (`saleActions`, `cashActions`, `productActions`, `permissionActions`, …). Toda la mutación/lectura sensible pasa por acá. |
| `components/` | React. Subcarpetas: `ui/` (primitivas shadcn), `shared/` (~100 componentes de feature), `public/` (carta pública), `providers/`, `design-system/`. |
| `lib/` | Utilidades e infraestructura: `supabase/` (server/client), impresión (`localPrinter`, `kitchenPrinter`, `browserPrint`, `ticketHtml`), AFIP (`afipClient`), `validations.ts` (Zod), `brand.ts`, `payments.ts`, `utils.ts`. |
| `hooks/` | Hooks de cliente, wrappers de React Query (`useProducts`, `useSales`, `useCashSession`, `useOpenTables`, `useCanEditPrices`, …). |
| `store/` | Stores **Zustand**: `authStore.ts` (usuario + persistencia localStorage), `tablesStore.ts`, `notificationStore.ts`. |
| `types/` | Tipos TS: `database.types.ts` (modelo DB, enums de roles/estados) y `mesa.ts`. |
| `supabase/` | `BUFFALO_SETUP.sql` = **script único** de setup. `config.toml`, `legacy/` (scripts viejos archivados). |
| `public/` | Assets estáticos: logos/íconos de marca (`febrero-*.png`), `manifest.json` (PWA), favicons. |
| `PrintServer/` | App **Node independiente** (fuera de Next) que corre en la PC del local: puente de impresión ESC/POS. |
| `scripts/` | Scripts operativos (certificados AFIP, mantenimiento, tests de impresoras). |

## 3. Ruteo (App Router en `app/`)

Grupos de rutas (route groups, no afectan la URL):

- **`(auth)`** → `app/(auth)/login/` — login público.
- **`(dashboard)`** → backoffice protegido; `layout.tsx` valida sesión server-side, renderiza `Navbar` + `Footer`, fuerza `dynamic = "force-dynamic"`. Rutas: `dashboard/` · `caja-bar/` · `cocina/` · `ventas/` · `productos/` · `gastos/` · `reportes/` · `proveedores/` · `compras/` · `configuracion/` · `usuarios/` · `promociones/` · `pedidos/`.
- **`(public)`** → `app/(public)/pedidos/` (carta + pedidos online).
- **Sueltas:** `app/page.tsx`, `app/menu/page.tsx` (alias `/menu`), `app/layout.tsx` raíz (fuentes Google, metadata desde `brand`, envuelve en `ErrorBoundary > Providers`).

**Rutas API (`app/api/`):** `auth/user` (perfil del logueado) · `afip/generate-invoice` (factura AFIP) · `print-bridge/[action]` (proxy al PrintServer local) · `products` / `import-products` · `settings/business-info` / `settings/printers`.

> `/inventario` está en el matcher del middleware pero **no** tiene `page.tsx` (permiso reservado).

## 4. Flujo de datos

### Patrón Server Actions
Cada `actions/*.ts` empieza con `"use server"` y exporta funciones async que: (1) crean cliente Supabase server, (2) verifican permisos vía `checkUserPermission()`, (3) ejecutan queries, (4) `revalidatePath("/ruta")`, (5) devuelven `{ success, data?, message? }` (no lanzan al cliente). Referencia: `actions/saleActions.ts`, `actions/permissionActions.ts`.

### Supabase: tres clientes
`lib/supabase/server.ts`:
- **`createClient()`** — server con cookies (`@supabase/ssr`). Respeta sesión y **RLS**. Para Server Actions/Components/API.
- **`createAdminClient()`** — usa `SUPABASE_SERVICE_ROLE_KEY`, **bypassa RLS**. Solo admin (p.ej. alta de usuarios). Peligroso.
- **`createAnonClient()`** — anónimo, lecturas públicas cacheables (carta).

`lib/supabase/client.ts` → **`createClient()`** browser, para componentes `"use client"`.

Las 3 env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) hacen *throw* si faltan.

### Autenticación + permisos (`middleware.ts`)
Dos capas:
1. **Middleware** — corre en el `matcher`. Busca regla en **`routePermissions`** (regex → permisos). Hace `auth.getUser()` (con `refreshSession()` de respaldo); valida `users.is_active`. **Gating:** `admin` ⇒ acceso total; si no, RPC **`has_permission(p_user_id, p_permission_name)`**. Si la regla lista varios permisos, basta tener **uno** (OR). Caso especial: `kitchen` en `/dashboard` → redirect a `/cocina`.
2. **Layout server-side** (`app/(dashboard)/layout.tsx`) — revalida sesión + `is_active`; si falla → `redirect("/login")`.

> **Al agregar una ruta nueva del dashboard, registrala en AMBOS:** el array `routePermissions` y el `config.matcher` de `middleware.ts`.

## 5. Estado

**Zustand (`store/`):** `authStore.ts` `{ user, isLoading }` con `persist` (key `auth-storage`). Lo hidrata el `AuthProvider` (`components/Providers.tsx`) vía `/api/auth/user` + `onAuthStateChange`. `tablesStore.ts` (mapa de mesas), `notificationStore.ts`.

**React Query (`lib/react-query.ts`):** `QueryClient` con defaults conservadores (`staleTime` 5 min, sin refetch en foco, `retry: 1`) — pensado para conexión lenta. `queryConfigs` por dominio (products 30 min, sales 2 min, tables 15 s, cash 2–30 s). Refresco "en vivo": `hooks/useRealtimeData.ts` (Supabase Realtime), no polling.

## 6. Convenciones clave

- **Marca centralizada:** todo el branding sale de `lib/brand.ts`. Para clonar a un cliente nuevo, empezá por ese archivo + assets en `public/` + `store_settings` en DB (ver `docs/REBRANDING.md`). No hardcodear el nombre en componentes.
- **Idioma:** UI/comentarios/rutas en **español**; identificadores y permisos en inglés (`sales.view_all`).
- **Mutaciones siempre vía Server Actions**, nunca escritura directa desde el cliente. Retorno `{ success, data, message }` + `revalidatePath`.
- **Cliente Supabase correcto:** server con cookies para autenticado, `createAnonClient` para público, `createAdminClient` solo admin.
- **Seguridad en dos capas:** middleware + revalidación en layout/acciones. Admin siempre bypassa.
- **Validación con Zod** centralizada en `lib/validations.ts`.
- **UI:** primitivas en `components/ui/` (no editar ad-hoc); features en `components/shared/`. Tailwind + `cn()`.
- **Deploy:** Vercel (`vercel-build`); las 3 env de Supabase son obligatorias.

## Deuda / residuos conocidos

- **`supabase/BUFFALO_SETUP.sql`** todavía crea tablas de RRHH/no usadas: `employees`, `work_shifts`, `employee_attendance*`, `employee_payments`, `employee_advances`, `daily_routes`, `route_products`. La app no las consume (existen por la FK `sales.employee_id → employees`).
- **`components/shared/WorkShiftsTable.tsx`** no se importa en ningún lado (componente muerto, leftover de RRHH).
- Las menciones a **"WhatsApp"** que quedan NO son el bot: son (a) un deep-link `wa.me` para que el staff le escriba al cliente de delivery, y (b) un literal `source: "whatsapp"` como etiqueta de origen de pedido. No hay Twilio/Gemini.
- Los `.md` históricos del repo original (ARCHITECTURE.md, etc.) eran previos al saneamiento y **no eran confiables** — fueron reemplazados por estos `docs/`.
