# Integraciones, variables de entorno y deploy

## 1. Facturación AFIP (OPCIONAL)
El POS funciona sin facturación; si no se configura, las acciones de factura devuelven error controlado y el resto sigue.

- **`lib/afipClient.ts`** — cliente bajo nivel (SDK `@afipsdk/afip.js`). Lee certificados PEM de env vars. Por defecto emite **Factura C** (`invoiceType=11`), comprador "Consumidor Final".
- **`actions/invoiceActions.ts`** — Server Action de alto nivel: valida permiso `sales.edit`, exige `sale.status='completed'`, es **idempotente** (si ya hay factura la devuelve), guarda en `invoices`. También `updateAfipConfig` (solo admin), `testAfipConnection`.
- **`app/api/afip/generate-invoice/route.ts`** — endpoint POST alternativo; soporta A/B/C según el cliente (RI → A, Monotributo → B, resto → C).

Config **operativa** (CUIT, punto de venta, ambiente) en `app_settings`. **Certificados** en env vars.

### Variables AFIP
| Variable | Uso | Requerida |
|---|---|---|
| `AFIP_CERT_PEM` | Certificado PEM completo | Sí (si se usa AFIP) |
| `AFIP_KEY_PEM` | Clave privada PEM | Sí (si se usa AFIP) |
| `AFIP_ACCESS_TOKEN` | Token de app.afipsdk.com | Solo producción |

### Homologación por defecto
Arranca en **homologación** (prueba): el seed deja `afip_environment = 'homologacion'`. Para producción: cargar las env `AFIP_*` y setear `afip_environment = 'production'` en `app_settings` (en homologación no se requiere `AFIP_ACCESS_TOKEN`).

## 2. Impresión térmica (80 mm)
Dos caminos con **fallback automático**:

### A) Puente local — `PrintServer/`
Servidor **Node + Express** que corre **en la PC del local** (la de la impresora). Escucha en `localhost:3001`, habla ESC/POS y envía bytes RAW vía la API de Windows `winspool.drv`. Soporta impresora local por nombre, UNC (`\\SERVIDOR\Cocina`) o TCP (`IP:9100`). Instaladores Windows (`.bat`, PowerShell) en `PrintServer/installer/`.
- La web NO llama directo a `localhost:3001`: pasa por el proxy `app/api/print-bridge/[action]/route.ts`. La base URL se arma con `getPrinterConfig()` (en `app_settings`) y `lib/printBridgeConfig.ts`.
- **Por defecto el puente está deshabilitado** (`DEFAULT_PRINT_BRIDGE_HOST = ""`): si no se configura una PC puente en *Configuración*, imprime por navegador.
- `lib/localPrinter.ts` orquesta: intenta el bridge y, si falla, abre el diálogo del navegador.

### B) Impresión por navegador (Windows print)
Cuando no hay puente. `lib/browserPrint.ts` crea un iframe oculto de **80 mm reales** (un iframe 0×0 saca papel en blanco) y llama `window.print()`. `lib/ticketHtml.ts` arma el HTML del ticket (`buildReceiptHtml`) y de la comanda (`buildKitchenReceiptHtml`), **todo en negro puro** (las térmicas no imprimen grises).

| Situación | Camino |
|---|---|
| PC puente configurada | PrintServer local (ESC/POS, corte automático) |
| Sin puente (default) o falla | Navegador (`window.print`, 80 mm) |

Otros: `lib/kitchenPrinter.ts` (ESC/POS de comanda), `lib/ticketTransferInfo.ts` (alias + teléfono al pie — **rebranding**).

## 3. PWA (offline)
- `public/manifest.json` — name, `theme_color #A8341C`, `background_color #F4EAD7`, íconos `febrero-icon-*`, shortcuts (Caja Bar, Cocina, Pedidos).
- `public/sw.js` — Service Worker (`CACHE_NAME = "febrero-pwa-v1"`): navegación network-first con fallback a `/offline.html`; estáticos cache-first; chunks de Next nunca cacheados. Soporta push.
- `public/offline.html`, registro vía `components/PWAInstaller.tsx`.

## 4. Variables de entorno (confirmadas con `grep process.env`)

### Supabase (REQUERIDAS)
| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta** — admin/AFIP/crear usuarios. Nunca exponer al cliente |

### AFIP (OPCIONALES) — ver sección 1.
`AFIP_CERT_PEM`, `AFIP_KEY_PEM`, `AFIP_ACCESS_TOKEN` (solo prod).

### Otras
`PRINT_SERVER_DEBUG` (solo en la PC del puente). `AFIP_P12_PASSWORD`/`AFIP_USERNAME`/… solo en `scripts/` locales de certificados.

> **Confirmado: NO quedan GEMINI/TWILIO** en el código. Las coincidencias de "whatsapp"/"twilio" son: un stub SMS inactivo de Supabase Auth en `supabase/config.toml`, un label `source:"whatsapp"` de origen de pedido, y un botón deep-link `wa.me` (no bot).

## 5. Deploy a Vercel
- Build: `next build` (autodetección de Vercel, sin `vercel.json`).
- Cargar en **Settings → Environment Variables** las 3 de Supabase (+ AFIP si se factura). Las `AFIP_*_PEM` son multilínea: pegar completas.
- **El PrintServer NO se despliega en Vercel** — corre en la PC del local. En la nube solo vive el proxy `/api/print-bridge`. Para alcanzar una PC del local desde Vercel hay que exponer el puente (túnel) y cargar ese host en Configuración. Sin puente, imprime por navegador.
- **Base de datos:** ejecutar `supabase/BUFFALO_SETUP.sql` en el Supabase destino **antes** del primer uso. Los SQL en `supabase/legacy/` son históricos, no ejecutar.
