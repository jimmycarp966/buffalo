# Supabase Connection

Esta app usa el proyecto de Supabase configurado en las variables de entorno locales del repo, no necesariamente el mismo proyecto que pueda aparecer conectado por MCP en una sesión de Codex.

## Proyecto canónico de la app

- La app toma `NEXT_PUBLIC_SUPABASE_URL` desde `/.env.local` o `/.env`.
- En este entorno, ese valor apunta al proyecto de La Movida Retro Pub:
  - `xfkrrvmpfufawnlgvkth.supabase.co`

## Dónde se configura

- Cliente browser: [lib/supabase/client.ts](/C:/Clientes/Bar/lib/supabase/client.ts)
- Cliente server con cookies: [lib/supabase/server.ts](/C:/Clientes/Bar/lib/supabase/server.ts)
- Cliente admin con service role: [lib/supabase/server.ts](/C:/Clientes/Bar/lib/supabase/server.ts)

Variables relevantes:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Cómo fluye la conexión

1. El frontend usa `createBrowserClient(...)` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Las Server Actions usan `createServerClient(...)` con la misma URL y la anon key, apoyándose en cookies para la sesión autenticada.
3. Las operaciones administrativas usan `createAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY`.

## Tablas que usa hoy la app

La app de La Movida Retro consulta principalmente tablas en inglés dentro del proyecto correcto:

- Productos: `public.products`
- Ventas: `public.sales`
- Items de venta: `public.sale_items`
- Usuarios: `public.users`
- Caja: `public.cash_register_sessions`

Referencias directas:

- Listado y buscador de productos: [actions/productActions.ts](/C:/Clientes/Bar/actions/productActions.ts)
- Página de productos: [app/(dashboard)/productos/page.tsx](/C:/Clientes/Bar/app/(dashboard)/productos/page.tsx)
- Flujo de abrir mesa: [actions/saleActions.ts](/C:/Clientes/Bar/actions/saleActions.ts)
- Flujo de agregar items a una mesa: [actions/barActions.ts](/C:/Clientes/Bar/actions/barActions.ts)

## Importante: `products` vs `productos`

En sesiones anteriores apareció otro proyecto Supabase accesible por MCP que exponía `public.productos`.

Eso no es el proyecto canónico de la app. Si se cargan datos ahí:

- no aparecen en `/productos`
- no aparecen al abrir o editar mesas
- no afectan el flujo real de La Movida Retro

Para la app actual, los productos deben existir en `public.products` del proyecto `xfkrrvmpfufawnlgvkth`.

## Cómo verificar rápido que estás en el proyecto correcto

1. Revisá `NEXT_PUBLIC_SUPABASE_URL` en `/.env.local`.
2. Confirmá que el host sea `xfkrrvmpfufawnlgvkth.supabase.co`.
3. Verificá que existan usuarios como:
   - `admin@movidaretropub.com`
   - `mozo1@movidaretropub.com`
4. Verificá que la tabla consultada por la app sea `products`, no `productos`.

## Regla operativa

Si hay duda entre el proyecto visto por MCP y el proyecto usado por la app:

- tomar siempre como fuente de verdad el `NEXT_PUBLIC_SUPABASE_URL` del repo
- validar la tabla objetivo antes de insertar datos
- evitar cargas manuales en proyectos MCP si no coinciden con `/.env.local`
