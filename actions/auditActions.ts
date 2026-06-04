"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetAuditLogsParams {
  userId?: string;
  action?: string;
  entityType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  try {
    const supabase = await createClient();

    // Verificar que el usuario es admin o supervisor
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado", data: [] };
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!dbUser || !["admin", "supervisor"].includes(dbUser.role)) {
      return {
        success: false,
        message: "Solo administradores y supervisores pueden ver los logs",
        data: [],
      };
    }

    const { data, error } = await supabase.rpc("get_audit_logs", {
      p_user_id: params.userId || null,
      p_action: params.action || null,
      p_entity_type: params.entityType || null,
      p_from_date: params.fromDate || null,
      p_to_date: params.toDate || null,
      p_limit: params.limit || 100,
    });

    if (error) throw error;

    return { success: true, data: data as AuditLog[] };
  } catch (error: unknown) {
    console.error("Error fetching audit logs:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener logs",
      data: [],
    };
  }
}

export async function getUserActivitySummary(userId: string, days: number = 30) {
  try {
    const supabase = await createClient();

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("action, created_at")
      .eq("user_id", userId)
      .gte("created_at", fromDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Agrupar por tipo de acción
    const summary = data?.reduce((acc: Record<string, number>, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    return { success: true, data: { total: data?.length || 0, summary } };
  } catch (error: unknown) {
    console.error("Error fetching user activity:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener actividad",
      data: { total: 0, summary: {} },
    };
  }
}

export async function getSystemActivityStats(days: number = 7) {
  try {
    const supabase = await createClient();

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("action, created_at, entity_type")
      .gte("created_at", fromDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Estadísticas generales
    const stats = {
      total: data?.length || 0,
      byAction: {} as Record<string, number>,
      byEntityType: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
    };

    data?.forEach((log) => {
      // Por acción
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // Por tipo de entidad
      stats.byEntityType[log.entity_type] =
        (stats.byEntityType[log.entity_type] || 0) + 1;

      // Por día
      const day = new Date(log.created_at).toLocaleDateString();
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    });

    return { success: true, data: stats };
  } catch (error: unknown) {
    console.error("Error fetching system activity stats:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener estadísticas",
      data: { total: 0, byAction: {}, byEntityType: {}, byDay: {} },
    };
  }
}

