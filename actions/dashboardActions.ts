"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDate } from "@/lib/utils";

export interface DashboardData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  stats: {
    totalProducts: number;
    lowStockProducts: number;
    activeBarSession: boolean;
    // Nuevos campos de ventas
    ventasHoy: number;
    cantidadVentasHoy: number;
    ingresosMes: number;
    usuariosActivos: number;
  };
}

/**
 * Obtiene todos los datos del dashboard en una sola consulta optimizada
 * Consolida: usuario, estadísticas de productos, sesiones activas, ventas
 */
export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; message?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "No autenticado" };
    }

    // Obtener datos del usuario desde la tabla users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      console.error("❌ Error obteniendo datos del usuario:", userError);
      return { success: false, message: "Error al obtener datos del usuario" };
    }

    // Calcular fechas para consultas
    const hoy = getCurrentDate();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

    // Consulta optimizada en paralelo
    const [
      productsCountResult,
      allProductsResult,
      activeSessionsResult,
      ventasHoyResult,
      ventasMesResult,
      usuariosActivosResult
    ] = await Promise.all([
      // Conteo total de productos activos
      supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),

      // Productos para calcular stock bajo
      supabase
        .from("products")
        .select("id, stock, min_stock, unlimited_stock")
        .eq("is_active", true)
        .eq("unlimited_stock", false),

      // Sesiones activas de caja BAR
      supabase
        .from("cash_register_sessions")
        .select("area")
        .is("closed_at", null)
        .eq("area", "bar"),

      // Ventas de hoy (completadas)
      supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", inicioHoy.toISOString())
        .lte("created_at", finHoy.toISOString()),

      // Ventas del mes (completadas)
      supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", finMes.toISOString()),

      // Usuarios activos
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
    ]);

    // Verificar errores críticos (no fallar por errores menores)
    if (productsCountResult.error) {
      console.error("❌ Error en productos:", productsCountResult.error);
    }
    if (allProductsResult.error) {
      console.error("❌ Error en productos completos:", allProductsResult.error);
    }
    if (activeSessionsResult.error) {
      console.error("❌ Error en sesiones:", activeSessionsResult.error);
    }

    // Calcular productos con stock bajo
    const lowStockProducts = allProductsResult.data?.filter(p => p.stock < p.min_stock) || [];

    // Sesiones activas
    const activeSessions = activeSessionsResult.data || [];
    const activeBarSession = activeSessions.length > 0;

    // Calcular totales de ventas
    const ventasHoyData = ventasHoyResult.data || [];
    const ventasHoy = ventasHoyData.reduce((acc, v) => acc + (v.total || 0), 0);
    const cantidadVentasHoy = ventasHoyData.length;

    const ventasMesData = ventasMesResult.data || [];
    const ingresosMes = ventasMesData.reduce((acc, v) => acc + (v.total || 0), 0);

    // Usuarios activos
    const usuariosActivos = usuariosActivosResult.count || 0;

    const dashboardData: DashboardData = {
      user: {
        id: userData.id,
        email: userData.email || "",
        name: userData.full_name || userData.email || "Usuario",
        role: userData.role || "cashier"
      },
      stats: {
        totalProducts: productsCountResult.count || 0,
        lowStockProducts: lowStockProducts.length,
        activeBarSession,
        ventasHoy,
        cantidadVentasHoy,
        ingresosMes,
        usuariosActivos
      }
    };

    return { success: true, data: dashboardData };
  } catch (error: any) {
    console.error("Error getting dashboard data:", error);
    return {
      success: false,
      message: error.message || "Error al obtener datos del dashboard"
    };
  }
}
