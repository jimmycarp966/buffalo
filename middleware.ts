import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type PermissionRule = {
  pattern: RegExp;
  permissions: string[];
};

const routePermissions: PermissionRule[] = [
  { pattern: /^\/dashboard(?:\/|$)/, permissions: ["dashboard.view"] },
  { pattern: /^\/caja-bar(?:\/|$)/, permissions: ["cash.view"] },
  { pattern: /^\/cocina(?:\/|$)/, permissions: ["kitchen.view_orders"] },
  { pattern: /^\/ventas(?:\/|$)/, permissions: ["sales.view_own", "sales.view_all"] },
  { pattern: /^\/productos(?:\/|$)/, permissions: ["products.view"] },
  { pattern: /^\/inventario(?:\/|$)/, permissions: ["inventory.view"] },
  { pattern: /^\/gastos(?:\/|$)/, permissions: ["expenses.view"] },
  { pattern: /^\/reportes(?:\/|$)/, permissions: ["reports.view"] },
  { pattern: /^\/proveedores(?:\/|$)/, permissions: ["suppliers.view"] },
  { pattern: /^\/compras(?:\/|$)/, permissions: ["suppliers.view"] },
  { pattern: /^\/configuracion(?:\/|$)/, permissions: ["config.view"] },
  { pattern: /^\/usuarios(?:\/|$)/, permissions: ["users.view"] },
];

async function hasRequiredPermissions(
  supabase: SupabaseClient,
  userId: string,
  permissions: string[],
) {
  if (permissions.length === 1) {
    const { data, error } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_name: permissions[0],
    });

    return !error && !!data;
  }

  for (const permission of permissions) {
    const { data, error } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_name: permission,
    });

    if (!error && data) {
      return true;
    }
  }

  return false;
}

function handleUnauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const matchedRule = routePermissions.find((rule) => rule.pattern.test(pathname));

  if (!matchedRule) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }

    throw new Error("Variables de entorno de Supabase requeridas");
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (!user && getUserError) {
    try {
      const {
        data: { session },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !session) {
        return handleUnauthorized(request);
      }

      const refreshedResult = await supabase.auth.getUser();
      if (refreshedResult.error || !refreshedResult.data.user) {
        return handleUnauthorized(request);
      }

      user = refreshedResult.data.user;
    } catch {
      return handleUnauthorized(request);
    }
  }

  if (!user) {
    return handleUnauthorized(request);
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("users")
    .select("id, is_active, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !userProfile?.is_active) {
    return handleUnauthorized(request);
  }

  const allowed =
    userProfile.role.toLowerCase() === "admin"
      ? true
      : await hasRequiredPermissions(supabase, user.id, matchedRule.permissions);

  if (!allowed) {
    if (userProfile.role === "kitchen" && pathname === "/dashboard") {
      return NextResponse.redirect(new URL("/cocina", request.url));
    }

    return handleUnauthorized(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/caja-bar/:path*",
    "/cocina/:path*",
    "/ventas/:path*",
    "/productos/:path*",
    "/inventario/:path*",
    "/gastos/:path*",
    "/reportes/:path*",
    "/proveedores/:path*",
    "/compras/:path*",
    "/configuracion/:path*",
    "/usuarios/:path*",
  ],
};
