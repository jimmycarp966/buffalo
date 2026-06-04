# Supabase - Fuente de verdad

La unica referencia canonica para inicializar el proyecto Supabase es:

- **[BUFFALO_SETUP.sql](./BUFFALO_SETUP.sql)**

Es un script unico, idempotente, que deja una Supabase NUEVA 100% funcional
para el POS (Next.js + Supabase/Postgres) de **Buffalo Coffee & Food**.

## Como aplicarlo

1. Abrir el **SQL Editor** del proyecto Supabase nuevo.
2. Pegar `BUFFALO_SETUP.sql` completo y ejecutar (**Run**).
3. Crear el usuario administrador (ver siguiente seccion).

El script se puede correr mas de una vez sin error (usa `CREATE TABLE IF NOT
EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` antes de crear
politicas, `INSERT ... ON CONFLICT DO NOTHING` para seeds, etc.).

## Crear el admin

El script intenta crear automaticamente un admin (`admin@buffalo.com`) si la
instancia permite escribir en `auth.users`. Si no, hacelo manual:

1. **Authentication > Users > Add user**: email + password, marcar *Auto Confirm*.
2. Copiar el UUID del usuario creado y ejecutar en el SQL Editor:

   ```sql
   INSERT INTO public.users (id, email, name, full_name, role, is_active)
   VALUES ('<UUID_DE_AUTH>', 'admin@buffalo.com', 'Administrador',
           'Administrador', 'admin', TRUE)
   ON CONFLICT (id) DO UPDATE
     SET role = 'admin', is_active = TRUE,
         email = EXCLUDED.email, updated_at = NOW();
   ```

## Que incluye BUFFALO_SETUP.sql

- Esquema completo (tablas POS/bar, caja, ventas, compras, inventario, creditos,
  rutas/viajes, permisos, facturacion AFIP).
- Funciones / RPCs usadas por la app (`create_sale`, `close_pending_sale`,
  `cancel_pending_sale`, `has_permission`, reportes, `remove_item_from_table`,
  `get_next_ticket_number`, etc.), con **una sola firma por nombre**.
- **RLS habilitada en TODAS las tablas.** El dominio operativo autenticado usa
  `is_active_staff()`; configuracion y permisos usan `is_admin()`; `audit_logs`
  es solo de administradores. El menu publico conserva lectura `anon` minima
  sobre `products`, `categories`, `store_settings` y sesiones de caja abiertas.
- Catalogo de **cafeteria de ejemplo** (categorias + ~30 productos) y config
  base (`store_settings`, `payment_methods`, `app_settings`, `afip_environment`
  en `homologacion`).
- Catalogo de permisos completo + asignacion por rol (`admin`, `cashier`,
  `waiter`, `kitchen`).

## Seguridad operativa

- No guardar claves reales en el repo.
- Rotar cualquier `SUPABASE_SERVICE_ROLE_KEY` que se haya expuesto.
- Cambiar la password del admin por defecto luego del primer login.

## SQL legacy

Los scripts sueltos historicos se movieron a [`legacy/`](./legacy/) y **no deben
ejecutarse**. La fuente de verdad es `BUFFALO_SETUP.sql`.
