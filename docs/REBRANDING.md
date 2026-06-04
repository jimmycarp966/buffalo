# Rebranding — adaptar la plantilla a un cliente nuevo

> Esta carpeta es una **plantilla**: cada copia se rebrandea para un cliente distinto. La marca actual es **Febrero — Tostadores de Café**. Esta guía lista **todo** lo que hay que cambiar.
>
> ✅ **El nombre de marca ya está centralizado en `lib/brand.ts`:** todos los textos ("Febrero", "TOSTADORES DE CAFÉ", agradecimientos de ticket, headers de PDF, etc.) leen de ahí — ya **no** hay strings de nombre hardcodeados que barrer. Cambiás `lib/brand.ts` y se actualiza en toda la app, tickets, PWA y reportes. Lo que sigue siendo manual: **colores** (2 archivos), **assets**, **alias de transferencia** y el **seed SQL**. Igual, al terminar verificá con grep que no quede nada del cliente anterior:
> ```bash
> grep -rEi "febrero|tostadores|cafefebrero" lib app components public supabase --include=*.ts --include=*.tsx --include=*.css --include=*.json --include=*.sql
> ```

## 1. Config central — `lib/brand.ts` (empezá acá)
Única "fuente de verdad". Cambiar **todos** los campos:

| Campo | Valor actual |
|---|---|
| `name` | `"Febrero"` |
| `shortName` | `"Febrero"` |
| `descriptor` | `"Tostadores de Café"` |
| `platformName` | `"Sistema de Gestión"` |
| `publicTagline` | `"Café de especialidad, tostado acá"` |
| `dashboardTagline` | `"Backoffice de Febrero"` |
| `onlineOrderingLabel` | `"Carta y pedidos online"` |
| `designer` | `"SiriuS"` |
| `defaultStoreName` | `"Febrero"` |
| `logo.src` | `"/febrero-logo.png"` |
| `logo.icon` | `"/febrero-icon-192.png"` |
| `logo.alt` | `"Logo de Febrero Tostadores de Café"` |
| `seo.title` | `"Febrero Tostadores de Café | Sistema de Gestión"` |
| `seo.description` | `"Backoffice y carta pública de Febrero..."` |
| `colors.background` | `#F4EAD7` |
| `colors.surface` | `#FFFDF8` |
| `colors.primary` | `#A8341C` |
| `colors.accent` | `#B5743A` |
| `colors.text` | `#2B1B12` |

`brand` se consume en `app/layout.tsx` (metadata/SEO/theme), login, footer, navbar, wizard — con cambiarlo acá se propaga a esos lugares.

## 2. Colores — `app/globals.css` (`:root`, en HSL)
Los tokens están en **HSL** (no hex). Recalcular: tokens shadcn (`--background`, `--foreground`, `--primary` `11 72% 38%` = terracota, `--secondary`, `--accent`, `--destructive`, `--border`, `--ring`, `--chart-1..5`) y los **tokens propios** `--febrero-terracotta`, `--febrero-espresso`, `--febrero-sand` (renombrar el prefijo `febrero-`). Hay además **hex hardcodeados** en gradientes/utilities: `body background-image` (`#FBF4E6`, `#F4EAD7`), `.brand-shell/.brand-panel/.brand-hero/.brand-grid`, y `rgba(168,52,28,…)` (terracota) / `rgba(181,116,58,…)` (caramelo).

## 3. Nombres de color — `tailwind.config.ts`
La paleta nominal vive en `colors.febrero` (renombrar clave y valores): `terracotta #A8341C`, `espresso #2B1B12`, `ink #1A0F0A`, `cream #F4EAD7`, `sand #E8D5B0`, `caramel #B5743A`, `white #FFFDF8`. Usado en clases `bg-febrero-terracotta` por varios componentes — actualizar también esos usos si renombrás la clave.

## 4. Assets — `public/`
Reemplazar (mismos nombres, o renombrar y actualizar referencias):

| Archivo | Uso |
|---|---|
| `febrero-logo.png` | Logo principal |
| `febrero-icon-192.png` | Ícono PWA 192 / push / shortcuts |
| `febrero-icon-512.png` | Ícono PWA 512 |
| `apple-touch-icon.png` | Apple touch (180×180) |
| `favicon-16x16.png` / `favicon-32x32.png` / `favicon.ico` | Favicons |
| `offline.html` | Página offline (revisar textos) |

## 5. PWA — `public/manifest.json`
Cambiar `name`, `short_name`, `description`, `theme_color`, `background_color`, rutas de `icons`, `shortcuts[].icons`, `screenshots`.

## 6. Service Worker — `public/sw.js`
Cambiar `CACHE_NAME`/`RUNTIME_CACHE` (`febrero-pwa-v1`, `febrero-runtime-v1`), rutas de íconos en `CRITICAL_ASSETS`/`CACHE_FIRST_ROUTES`, y el `title`/`icon`/`badge` del handler `push`. **Subir la versión** del SW para forzar actualización.

## 7. `app/layout.tsx`
Casi todo sale de `brand`, **pero revisar las fuentes de Google** (`Bungee` para marca, `Space_Grotesk` para UI) si el cliente usa otra tipografía.

## 8. Ticket — `lib/ticketTransferInfo.ts`
Cambiar `TICKET_TRANSFER_ALIAS` (`"cafefebrero"` → alias bancario del cliente) y `TICKET_DELIVERY_PHONE` (`"3863405472"`).

## 9. Seed SQL — `supabase/BUFFALO_SETUP.sql`
- **Nombre del negocio:** `store_settings.store_name` (`'Febrero Tostadores de Café'`, ~línea 2249) y `app_settings.general` (JSON `store_name`, ~2254).
- **Email del admin:** `v_admin_email := 'admin@febrero.cafe'` (~2081; también en comentarios) y password por defecto `'Admin123456!'`.
- **Catálogo de ejemplo:** reemplazar las categorías + productos de muestra por los reales del cliente (o vaciar ese bloque y cargarlos desde la app).
- Considerar renombrar el archivo y la UNC `\\FEBRERO\Cocina`.

## 10. Strings de marca — ✅ ya centralizados en `lib/brand.ts`
Antes había ~160 textos "Febrero"/"FEBRERO"/"TOSTADORES DE CAFÉ" hardcodeados (tickets, exports PDF, PWA, prints, headers). **Ya fueron refactorizados:** todos leen de `lib/brand.ts` mediante `brand.name`, `brand.descriptor` y los helpers `brandFullName` (= "Nombre Descriptor") y `brandTicketThanks` (= "¡Gracias por elegir Nombre!").

**No hay nada hardcodeado que cambiar acá** — con la **sección 1** (`lib/brand.ts`) se actualiza todo el texto de nombre de la app, tickets, comandas, PWA y reportes.

> El único texto de nombre que vive **fuera** de `brand.ts` es el **alias de transferencia** (`lib/ticketTransferInfo.ts`, ver sección 8), porque es un dato bancario distinto del nombre comercial. El default de impresora UNC quedó genérico (`\\SERVIDOR\Cocina`).

## Checklist de rebranding
- [ ] `lib/brand.ts` (todos los campos)
- [ ] `app/globals.css` (HSL + hex hardcodeados)
- [ ] `tailwind.config.ts` (paleta `febrero`)
- [ ] Assets en `public/` (logos, favicons, íconos PWA)
- [ ] `public/manifest.json`
- [ ] `public/sw.js` (+ subir versión)
- [ ] `app/layout.tsx` (fuentes si cambian)
- [ ] `lib/ticketTransferInfo.ts` (alias + teléfono)
- [ ] Seed SQL (nombre, email admin, catálogo)
- [x] Textos de nombre → ya centralizados en `lib/brand.ts` (nada que hacer)
- [ ] `grep -rEi "febrero|tostadores|cafefebrero"` → 0 resultados del cliente anterior
