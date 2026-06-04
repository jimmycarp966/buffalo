import { unstable_cache } from 'next/cache';

// ============================================================================
// CACHÉ DE SERVER COMPONENTS
// ============================================================================
// Este archivo contiene funciones de caché para Server Components usando unstable_cache

// Caché para productos (5 minutos)
export const getCachedProducts = unstable_cache(
  async () => {
    const { getProducts } = await import('@/actions/productActions');
    return getProducts();
  },
  ['products-cache'],
  {
    revalidate: 300, // 5 minutos
    tags: ['products']
  }
);

// Caché para productos con estadísticas (5 minutos)
export const getCachedProductsWithStats = unstable_cache(
  async () => {
    const { getProductsWithStats } = await import('@/actions/productActions');
    return getProductsWithStats();
  },
  ['products-stats-cache'],
  {
    revalidate: 300, // 5 minutos
    tags: ['products', 'stats']
  }
);


// Caché para proveedores (1 hora)
export const getCachedSuppliers = unstable_cache(
  async () => {
    const { getSuppliers } = await import('@/actions/supplierActions');
    return getSuppliers();
  },
  ['suppliers-cache'],
  {
    revalidate: 3600, // 1 hora
    tags: ['suppliers']
  }
);

// Caché para métodos de pago (1 hora)
export const getCachedPaymentMethods = unstable_cache(
  async () => {
    const { getPaymentMethods } = await import('@/actions/saleActions');
    return getPaymentMethods();
  },
  ['payment-methods-cache'],
  {
    revalidate: 3600, // 1 hora
    tags: ['payment-methods']
  }
);

// Caché para permisos por usuario (1 hora)
export const getCachedUserPermissions = unstable_cache(
  async (userId: string) => {
    const { getUserEffectivePermissions } = await import('@/actions/permissionActions');
    return getUserEffectivePermissions(userId);
  },
  ['user-permissions-cache'],
  {
    revalidate: 3600, // 1 hora
    tags: ['permissions', 'users']
  }
);

// Caché para layout del bar (30 minutos)
export const getCachedBarLayout = unstable_cache(
  async () => {
    const { getBarLayout } = await import('@/actions/barLayoutActions');
    return getBarLayout();
  },
  ['bar-layout-cache'],
  {
    revalidate: 1800, // 30 minutos
    tags: ['bar-layout']
  }
);

// Caché para productos de búsqueda rápida (5 minutos)
export const getCachedProductsForSearch = unstable_cache(
  async () => {
    const { getProductsForSearch } = await import('@/actions/productActions');
    return getProductsForSearch();
  },
  ['products-search-cache'],
  {
    revalidate: 300, // 5 minutos
    tags: ['products']
  }
);

// Caché para layouts de Salón y Vereda (30 minutos)
// NOTA: Usa createAnonClient directamente para evitar error de cookies() dentro de unstable_cache
export const getCachedBarLayoutsForAreas = unstable_cache(
  async () => {
    const { createAnonClient } = await import('@/lib/supabase/server');
    const supabase = createAnonClient();

    const areas = ['salon', 'vereda'] as const;
    const results = await Promise.all(
      areas.map(async (area) => {
        const { data, error } = await supabase
          .from("bar_layout")
          .select("*")
          .eq("is_active", true)
          .eq("area", area)
          .order("order_index")
          .order("zone")
          .order("position_y")
          .order("position_x");

        return { area, data: error ? [] : (data || []) };
      })
    );

    const data: Record<string, any[]> = {};
    for (const { area, data: areaData } of results) {
      data[area] = areaData;
    }

    return { success: true, data };
  },
  ['bar-layouts-areas-cache'],
  {
    revalidate: 1800, // 30 minutos
    tags: ['bar-layout']
  }
);

/*
// Caché para categorías (1 hora)
export const getCachedCategories = unstable_cache(
  async () => {
    const { getCategories } = await import('@/actions/productActions');
    return getCategories();
  },
  ['categories-cache'],
  { 
    revalidate: 3600, // 1 hora
    tags: ['categories'] 
  }
);

// Caché para configuración del sistema (2 horas)
export const getCachedSystemConfig = unstable_cache(
  async () => {
    const { getSystemConfig } = await import('@/actions/configActions');
    return getSystemConfig();
  },
  ['system-config-cache'],
  { 
    revalidate: 7200, // 2 horas
    tags: ['config'] 
  }
);
*/

// ============================================================================
// FUNCIONES DE INVALIDACIÓN DE CACHÉ
// ============================================================================

import { revalidateTag } from 'next/cache';

// Invalidar caché de productos
export function invalidateProductsCache() {
  revalidateTag('products');
  revalidateTag('stats');
}

// Invalidar caché de inventario
export function invalidateInventoryCache() {
  revalidateTag('inventory');
}

// Invalidar caché de permisos
export function invalidatePermissionsCache() {
  revalidateTag('permissions');
  revalidateTag('users');
}

// Invalidar caché de sesiones de caja
export function invalidateCashSessionCache() {
  revalidateTag('activeCashSession');
}

// Invalidar caché de layout del bar
export function invalidateBarLayoutCache() {
  revalidateTag('bar-layout');
}

// Invalidar caché de sesiones de caja
export function invalidateCashSessionsCache() {
  revalidateTag('cash-sessions');
  revalidateTag('cash');
  revalidateTag('activeCashSession'); // Mantener compatibilidad
}

// Invalidar todo el caché
export function invalidateAllCache() {
  revalidateTag('products');
  revalidateTag('stats');
  revalidateTag('inventory');
  revalidateTag('suppliers');
  revalidateTag('payment-methods');
  revalidateTag('permissions');
  revalidateTag('users');
  revalidateTag('bar-layout');
  revalidateTag('cash-sessions');
  revalidateTag('cash');
  revalidateTag('activeCashSession');
  // revalidateTag('categories');
  // revalidateTag('config');
}

// ============================================================================
// FUNCIONES CONSOLIDADAS DE INVALIDACIÓN
// ============================================================================

// Invalidar todos los caches relacionados con ventas
// Usar esta función en lugar de múltiples revalidateTag individuales
export function invalidateSalesRelatedCaches() {
  revalidateTag('sales');
  revalidateTag('openTables');
  revalidateTag('stats');
  revalidateTag('dashboard');
}

// Invalidar caches del dashboard
export function invalidateDashboardCaches() {
  revalidateTag('dashboard');
  revalidateTag('stats');
  revalidateTag('sales');
}

/*
-- ============================================================================
-- COMENTARIOS SOBRE EL CACHÉ
-- ============================================================================
-- Este sistema de caché mejora significativamente el rendimiento de:
-- 1. Páginas de productos (caché de 5 minutos)
-- 2. Dashboard de inventario (caché de 10 minutos)
-- 3. Datos estáticos como proveedores y métodos de pago (caché de 1 hora)  
-- 4. Permisos de usuario (caché de 1 hora)
-- 5. Layout del bar (caché de 30 minutos)

-- Las funciones de invalidación permiten refrescar el caché cuando sea necesario
-- Los tags permiten invalidar selectivamente diferentes tipos de datos
-- El caché se invalida automáticamente según los tiempos de revalidación
*/

