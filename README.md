# Sistema POS para Bar / Cafetería — PLANTILLA REUTILIZABLE

> 📋 **Qué es esta carpeta:** es la **plantilla base** del sistema. **De acá se sacan las copias** para cada cliente nuevo. El flujo es:
> **copiar esta carpeta → rebrandear → conectar un Supabase nuevo → aplicar el SQL → deploy.**
> El código es exactamente el que está funcionando en producción; solo cambia la marca y la base de datos de cada copia.

Punto de venta para bar/cafetería: caja, mesas, mostrador, delivery, cocina (KDS), productos/stock, gastos, compras y proveedores (cuentas por pagar), reportes, usuarios con permisos granulares, facturación AFIP (opcional) e impresión térmica. Construido con **Next.js 15 + React 19 + Supabase**.

---

## 📚 Documentación

| Documento | Para qué |
|---|---|
| **[INSTRUCCIONES.md](INSTRUCCIONES.md)** | **Empezá acá.** Guía paso a paso: instalar → base de datos → admin → rebranding → deploy. |
| [docs/REBRANDING.md](docs/REBRANDING.md) | **Lista completa** de qué cambiar para adaptar a un cliente nuevo (incluye los strings hardcodeados a barrer). |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Stack, estructura de carpetas, ruteo, flujo de datos (Server Actions, Supabase), estado, convenciones. |
| [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md) | El SQL único, tablas por dominio, funciones/RPC, modelo RLS, sistema de permisos por rol, datos sembrados. |
| [docs/MODULOS.md](docs/MODULOS.md) | Cada módulo (caja-bar, cocina, productos, compras, reportes, usuarios…), el Navbar y la **matriz de roles**. |
| [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md) | AFIP, impresión térmica (PrintServer + navegador), PWA, **variables de entorno** y deploy a Vercel. |

> Los `.md` históricos del proyecto original (ARCHITECTURE.md viejo, etc.) fueron eliminados/archivados: describían el sistema **antes** del saneamiento (con RRHH y bot de WhatsApp) y no eran confiables. La documentación vigente es la de arriba.

---

## 🚀 Puesta en marcha rápida

```bash
npm install
cp .env.example .env.local      # completá las 3 variables de Supabase
npm run dev                      # http://localhost:3000
```

Base de datos: ejecutar **`supabase/BUFFALO_SETUP.sql`** en el SQL Editor de un proyecto Supabase nuevo (crea todo: tablas, RLS, permisos, seeds y el usuario admin). Detalle completo en **[INSTRUCCIONES.md](INSTRUCCIONES.md)**.

## 🧱 Stack

Next.js (App Router) + React 19 · TypeScript · Supabase (Auth + Postgres + RLS) · Tailwind CSS + shadcn/ui · Zustand · TanStack React Query · Vercel.

## 🗂️ Estructura (resumen)

`app/` rutas · `actions/` server actions · `components/` UI · `lib/` utilidades + branding + clientes · `hooks/` React Query · `store/` Zustand · `supabase/` esquema (SQL único) · `public/` assets + PWA · `PrintServer/` puente de impresión térmica (corre en la PC del local).

## 🔒 Notas

- **No subir claves reales** al repo: los secretos van solo en `.env.local` (y en las env vars de Vercel). El `.env.example` es la referencia.
- AFIP viene **opcional** y en homologación (prueba); si no se configura, el resto funciona igual.
- Para rebrandear: empezá por `lib/brand.ts` y seguí **[docs/REBRANDING.md](docs/REBRANDING.md)**.
