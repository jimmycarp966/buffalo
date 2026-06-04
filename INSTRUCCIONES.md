# Sistema POS para Bar / Cafetería — Plantilla reutilizable

Sistema de punto de venta (caja, mesas, mostrador, delivery, cocina, stock,
gastos, reportes, usuarios con permisos, facturación AFIP opcional e impresión
térmica). Next.js 15 + React 19 + Supabase.

> Esta carpeta es una **copia limpia y funcional** del sistema (sin secretos,
> sin `node_modules`, sin historial de git). El flujo para un cliente nuevo es:
> **copiar esta carpeta → rebrandear → conectar un Supabase nuevo → aplicar el SQL → deploy.**
> El código funciona exactamente igual que el sistema en producción.

---

## 1) Requisitos
- **Node.js 20+** y npm.
- Una cuenta gratis en **Supabase** (base de datos).
- Una cuenta en **Vercel** (deploy) — opcional para probar local.

---

## 2) Instalar y correr en local
```bash
npm install
cp .env.example .env.local      # completá las variables (paso 3)
npm run dev                      # http://localhost:3000
```

---

## 3) Base de datos (Supabase)
1. Creá un proyecto nuevo en https://supabase.com
2. En **Project Settings → API** copiá a tu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Abrí **SQL Editor** y ejecutá TODO el archivo `supabase/BUFFALO_SETUP.sql`.
   Ese script crea, de una sola corrida: tablas, funciones, RLS, permisos por rol,
   métodos de pago (Efectivo, Transferencia, Débito, Crédito, QR) y un catálogo
   de ejemplo. Es idempotente (se puede correr más de una vez).

### Crear el usuario administrador
1. Supabase → **Authentication → Users → Add user**: email + contraseña, tildá
   **Auto Confirm User**. Copiá el **UUID** del usuario.
2. En **SQL Editor**:
   ```sql
   INSERT INTO public.users (id, email, name, role, is_active)
   VALUES ('PEGÁ-EL-UUID', 'admin@tunegocio.com', 'Administrador', 'admin', true)
   ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
   ```
3. Ya podés entrar con ese email/contraseña. Desde **Configuración → Usuarios**
   creás cajeros, supervisores, mozos y cocina (cada rol con sus permisos).

---

## 4) Rebranding (cambiar a la marca del nuevo cliente)
Tocá estos archivos (todo el branding sale de pocos lugares):

| Qué | Archivo |
|---|---|
| **Nombre, descriptor, taglines, colores, rutas de logo, SEO** | `lib/brand.ts` ← *empezá por acá* |
| **Paleta de colores (variables HSL)** | `app/globals.css` (bloque `:root`) |
| **Nombres de colores del tema** | `tailwind.config.ts` |
| **Logos / favicons / íconos PWA** | reemplazá los archivos en `public/` (mismos nombres: `febrero-logo.png`, `febrero-icon-192.png`, `febrero-icon-512.png`, `favicon.ico`, `apple-touch-icon.png`, etc.) o actualizá las rutas en `lib/brand.ts` y `public/manifest.json` |
| **PWA (nombre, colores, íconos)** | `public/manifest.json` |
| **Caché del service worker** | `public/sw.js` (nombres `febrero-*`) |
| **Metadata del sitio (título/íconos)** | `app/layout.tsx` |
| **Alias de transferencia y teléfono del ticket** | `lib/ticketTransferInfo.ts` |
| **Nombre del negocio + catálogo sembrado** | `supabase/BUFFALO_SETUP.sql` (o cambiá nombre y productos después desde la app: **Configuración** y **Productos**) |

**Tip:** para no dejarte nada, buscá referencias remanentes:
```bash
grep -ri "febrero" lib app components public --include=*.ts --include=*.tsx --include=*.css --include=*.json
```

> El nombre del negocio y los productos también se pueden cambiar **desde la app**
> una vez logueado (Configuración + Productos), sin tocar el SQL.

---

## 5) Deploy a Vercel
1. Subí la carpeta a un repo de GitHub nuevo (`git init`, commit, push).
2. En Vercel: **New Project → importá el repo**.
3. Cargá las mismas 3 variables de Supabase en **Settings → Environment Variables**
   (y las de AFIP si las usás).
4. Deploy. Listo.

---

## 6) Impresión térmica (opcional)
La carpeta `PrintServer/` es un puente local para imprimir tickets/comandas en
impresoras térmicas (ESC/POS, 80mm). Se instala en la PC del local. Ver
`PrintServer/README` si vas a usar impresión directa. El sistema también imprime
por el navegador (Windows print) sin el PrintServer.

---

## 7) Checklist puesta en marcha
- [ ] `npm install` ok
- [ ] `.env.local` con las 3 variables de Supabase
- [ ] `BUFFALO_SETUP.sql` aplicado en el Supabase nuevo
- [ ] Usuario admin creado y login ok
- [ ] Rebranding aplicado (`lib/brand.ts`, colores, logos)
- [ ] Datos del negocio cargados (Configuración: dirección, alias, etc.)
- [ ] Productos reales cargados (con costo y precio)
- [ ] Deploy en Vercel con variables
- [ ] (Opcional) PrintServer instalado en la PC del local

---

### Notas
- Sin `.env.local` la app no conecta a la base (es lo primero a completar).
- AFIP viene como **opcional**; si no lo configurás, todo el resto funciona igual.
- Los permisos por rol (admin / supervisor / cajero / mozo / cocina) ya vienen
  sembrados por el SQL. El cajero, por ejemplo, no ve Ventas/Productos ni cambia
  precios, pero cobra, abre/cierra caja y mesas y aplica descuentos %.
