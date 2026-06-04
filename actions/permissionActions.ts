"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Obtener todos los permisos disponibles
export async function getAllPermissions() {
  try {
    console.log("🔍 getAllPermissions: Starting...");
    const supabase = await createClient();

    // Intentar primero con ordenación completa (module, action)
    let query = supabase
      .from("permissions")
      .select("*")
      .order("module", { ascending: true })
      .order("action", { ascending: true });

    let { data, error } = await query;

    // Si falla por columnas inexistentes, intentar con ordenación alternativa
    if (error && error.code === '42703') {
      console.log("⚠️ Ordenación por module/action falló, intentando con name...");
      const retryQuery = supabase
        .from("permissions")
        .select("*")
        .order("name", { ascending: true });

      const retryResult = await retryQuery;
      data = retryResult.data;
      error = retryResult.error;
    }

    // Si aún falla, intentar sin ordenación
    if (error && error.code === '42703') {
      console.log("⚠️ Ordenación por name falló, intentando sin ordenación...");
      const noOrderQuery = supabase
        .from("permissions")
        .select("*");

      const noOrderResult = await noOrderQuery;
      data = noOrderResult.data;
      error = noOrderResult.error;
    }

    if (error) {
      console.error("❌ getAllPermissions: Supabase error:", error);
      throw error;
    }

    console.log("✅ getAllPermissions: Success, found", data?.length || 0, "permissions");
    return { success: true, data };
  } catch (error: unknown) {
    console.error("❌ getAllPermissions: Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener permisos",
      data: [],
    };
  }
}

// Obtener permisos de un rol específico
export async function getRolePermissions(role: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("role_permissions")
      .select(`
        *,
        permissions (*)
      `)
      .eq("role", role);

    if (error) throw error;

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error fetching role permissions:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener permisos del rol",
      data: [],
    };
  }
}

// Obtener permisos específicos de un usuario
export async function getUserPermissions(userId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_permissions")
      .select(`
        *,
        permissions (*)
      `)
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error fetching user permissions:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener permisos del usuario",
      data: [],
    };
  }
}

// Actualizar permisos de un rol
export async function updateRolePermission(
  role: string,
  permissionId: string,
  isGranted: boolean
) {
  try {
    const supabase = await createClient();

    // Verificar que el usuario es admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!dbUser || dbUser.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden gestionar permisos",
      };
    }

    // Verificar si ya existe el permiso para este rol
    const { data: existing } = await supabase
      .from("role_permissions")
      .select("id")
      .eq("role", role)
      .eq("permission_id", permissionId)
      .maybeSingle();

    if (existing) {
      // Actualizar
      const { error } = await supabase
        .from("role_permissions")
        .update({ granted: isGranted })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      // Insertar
      const { error } = await supabase
        .from("role_permissions")
        .insert({
          role,
          permission_id: permissionId,
          granted: isGranted,
        });

      if (error) throw error;
    }

    revalidatePath("/usuarios");

    return { success: true, message: "Permiso actualizado exitosamente" };
  } catch (error: unknown) {
    console.error("Error updating role permission:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al actualizar permiso",
    };
  }
}

// Actualizar permiso específico de un usuario
export async function updateUserPermission(
  userId: string,
  permissionId: string,
  isGranted: boolean | null // null = usar permiso del rol
) {
  try {
    console.log("🔍 updateUserPermission: Starting...", { userId, permissionId, isGranted });
    const supabase = await createClient();

    // Verificar que el usuario es admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("❌ updateUserPermission: No user authenticated");
      return { success: false, message: "No autenticado" };
    }

    console.log("✅ updateUserPermission: User authenticated:", user.id);

    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("❌ updateUserPermission: Error getting user role:", userError);
      throw userError;
    }

    if (!dbUser || dbUser.role !== "admin") {
      console.error("❌ updateUserPermission: User is not admin:", dbUser?.role);
      return {
        success: false,
        message: "Solo administradores pueden gestionar permisos",
      };
    }

    console.log("✅ updateUserPermission: Admin verified");

    // Si isGranted es null, eliminar el override
    if (isGranted === null) {
      console.log("🗑️ updateUserPermission: Deleting override...");
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("permission_id", permissionId);

      if (error) {
        console.error("❌ updateUserPermission: Error deleting:", error);
        throw error;
      }
      console.log("✅ updateUserPermission: Override deleted");
    } else {
      // Verificar si ya existe
      console.log("🔍 updateUserPermission: Checking existing override...");
      const { data: existing, error: checkError } = await supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", userId)
        .eq("permission_id", permissionId)
        .maybeSingle();

      if (checkError) {
        console.error("❌ updateUserPermission: Error checking existing:", checkError);
        throw checkError;
      }

      if (existing) {
        // Actualizar
        console.log("🔄 updateUserPermission: Updating existing override...");
        const { error } = await supabase
          .from("user_permissions")
          .update({ granted: isGranted })
          .eq("id", existing.id);

        if (error) {
          console.error("❌ updateUserPermission: Error updating:", error);
          throw error;
        }
        console.log("✅ updateUserPermission: Override updated");
      } else {
        // Insertar
        console.log("➕ updateUserPermission: Creating new override...");
        const { error } = await supabase
          .from("user_permissions")
          .insert({
            user_id: userId,
            permission_id: permissionId,
            granted: isGranted,
          });

        if (error) {
          console.error("❌ updateUserPermission: Error inserting:", error);
          throw error;
        }
        console.log("✅ updateUserPermission: Override created");
      }
    }

    revalidatePath("/usuarios");

    return { success: true, message: "Permiso de usuario actualizado" };
  } catch (error: unknown) {
    console.error("❌ updateUserPermission: Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al actualizar permiso del usuario",
    };
  }
}

// Verificar si un usuario tiene un permiso específico
export async function checkUserPermission(userId: string, permissionName: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission_name: permissionName,
    });

    if (error) {
      throw error;
    }

    return { success: true, hasPermission: data };
  } catch (error: unknown) {
    console.error("Error checking permission:", error);
    return { success: false, hasPermission: false };
  }
}

// Obtener permisos del usuario para navegación (OPTIMIZADO - Estrategia de consulta única)
export async function getUserNavigationPermissions(userId: string) {
  try {
    const supabase = await createClient();

    // 1. Obtener usuario y su rol
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("❌ getUserNavigationPermissions: Error user/role:", userError);
      return { success: false, data: {} };
    }

    // 2. Ejecutar consultas en paralelo: Permisos del Rol y Overrides del Usuario
    const [rolePermsResult, userPermsResult] = await Promise.all([
      supabase
        .from("role_permissions")
        .select("permissions!inner(name)")
        .eq("role", user.role)
        .eq("granted", true),
      supabase
        .from("user_permissions")
        .select("granted, permissions!inner(name)")
        .eq("user_id", userId)
    ]);

    // 3. Procesar permisos del rol (base)
    const permissionsMap: Record<string, boolean> = {};

    rolePermsResult.data?.forEach((rp: any) => {
      if (rp.permissions?.name) {
        permissionsMap[rp.permissions.name] = true;
      }
    });

    // 4. Aplicar overrides del usuario (pueden otorgar o revocar)
    userPermsResult.data?.forEach((up: any) => {
      if (up.permissions?.name) {
        permissionsMap[up.permissions.name] = up.granted;
      }
    });

    return { success: true, data: permissionsMap };
  } catch (error: unknown) {
    console.error("Error getting user navigation permissions:", error);
    return { success: false, data: {} };
  }
}

// Obtener todos los permisos de un usuario (combinando rol + overrides)
export async function getUserEffectivePermissions(userId: string) {
  try {
    console.log("🔍 getUserEffectivePermissions: Starting for user:", userId);
    const supabase = await createClient();

    // Obtener usuario con su rol
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("❌ getUserEffectivePermissions: Error getting user:", userError);
      throw userError;
    }

    console.log("✅ getUserEffectivePermissions: User role:", user.role);

    // Obtener permisos del rol
    console.log("🔍 getUserEffectivePermissions: Querying role_permissions for role:", user.role);
    const { data: rolePerms, error: roleError } = await supabase
      .from("role_permissions")
      .select(`
        permission_id,
        granted,
        permissions (*)
      `)
      .eq("role", user.role);

    console.log("🔍 getUserEffectivePermissions: Raw role_permissions query result:", { rolePerms, roleError });

    if (roleError) {
      console.error("❌ getUserEffectivePermissions: Error getting role permissions:", roleError);
    } else {
      console.log("✅ getUserEffectivePermissions: Role permissions found:", rolePerms?.length || 0);
    }

    // Obtener overrides del usuario
    const { data: userPerms, error: userPermsError } = await supabase
      .from("user_permissions")
      .select(`
        permission_id,
        granted,
        permissions (*)
      `)
      .eq("user_id", userId);

    if (userPermsError) {
      console.error("❌ getUserEffectivePermissions: Error getting user permissions:", userPermsError);
    } else {
      console.log("✅ getUserEffectivePermissions: User overrides found:", userPerms?.length || 0);
    }

    // Combinar permisos
    const effectivePermissions = rolePerms || [];
    const userOverrides = new Map(
      userPerms?.map((p) => [p.permission_id, p.granted]) || []
    );

    const result = effectivePermissions.map((perm) => {
      const override = userOverrides.get(perm.permission_id);
      return {
        ...perm,
        is_granted: override !== undefined ? override : perm.granted,
        has_override: override !== undefined,
      };
    });

    console.log("✅ getUserEffectivePermissions: Final result:", result.length, "permissions");
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("❌ getUserEffectivePermissions: Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al obtener permisos efectivos",
      data: [],
    };
  }
}

