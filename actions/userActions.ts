"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { userSchema, type UserInput } from "@/lib/validations";
import { getCurrentDate } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { checkUserPermission } from "./permissionActions";

export async function createUser(data: UserInput & { password: string }) {
  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(currentUser.id, "users.create");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para crear usuarios" };
    }

    // Validar con Zod
    const validated = userSchema.parse(data);

    // Crear cliente admin para operaciones de auth
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Crear usuario en auth usando cliente admin
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: validated.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Crear registro en tabla users
    const { error: userError } = await supabase.from("users").insert([
      {
        id: authData.user.id,
        email: validated.email,
        name: validated.name,
        role: validated.role,
        is_active: validated.is_active,
        dni: validated.dni || null,
        created_at: getCurrentDate().toISOString(),
      },
    ]);

    if (userError) throw userError;

    revalidatePath("/usuarios");
    return { success: true, data: authData.user };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return {
      success: false,
      message: error.message || "Error al crear el usuario",
    };
  }
}

export async function updateUser(id: string, data: Partial<UserInput>) {
  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(currentUser.id, "users.edit");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para editar usuarios" };
    }

    // Blindaje: nunca persistir un rol vacío/ inválido (esto dejaba usuarios
    // "sin rol" y desconfigurados al editar cajeros/supervisores desde la UI).
    const VALID_ROLES = ["admin", "supervisor", "cashier", "waiter", "kitchen"];
    if (data.role !== undefined && (data.role === null || !VALID_ROLES.includes(String(data.role)))) {
      return { success: false, message: "Rol inválido. Seleccioná un rol válido." };
    }

    // Actualizar usuario
    const { data: user, error } = await supabase
      .from("users")
      .update({
        name: data.name,
        role: data.role,
        is_active: data.is_active,
        dni: data.dni !== undefined ? data.dni : undefined,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/usuarios");
    return { success: true, data: user };
  } catch (error: any) {
    console.error("Error updating user:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar el usuario",
    };
  }
}

export async function getUsers() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, role, is_active, dni, created_at, updated_at")
      .order("name");

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      message: error.message || "Error al obtener usuarios",
      data: [],
    };
  }
}

export async function getWorkShifts(userId?: string) {
  try {
    const supabase = await createClient();

    // Intentar primero con orden por check_in
    let query = supabase
      .from("work_shifts")
      .select(
        `
        *,
        user:users(name),
        cash_register_session:cash_register_sessions(
          cash_register:cash_registers(name, type)
        )
      `
      )
      .order("check_in", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    let { data, error } = await query;

    // Si falla por columna inexistente, intentar con created_at
    if (error && error.code === '42703') {
      console.log("⚠️ Columna check_in no existe, intentando con created_at...");
      query = supabase
        .from("work_shifts")
        .select(
          `
          *,
          user:users(name),
          cash_register_session:cash_register_sessions(
            cash_register:cash_registers(name, type)
          )
        `
        )
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const retryResult = await query;
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching work shifts:", error);
    return {
      success: false,
      message: error.message || "Error al obtener turnos",
      data: [],
    };
  }
}

export async function loginUser(email: string, password: string) {
  const startTime = performance.now();
  const loginTimestamp = new Date().toISOString();

  try {
    console.log("🔐 LOGIN - Iniciando proceso de autenticación:", {
      email: email.trim(),
      timestamp: loginTimestamp,
    });

    const supabase = await createClient();

    // Autenticar con Supabase
    console.log("🔐 LOGIN - Enviando credenciales a Supabase Auth...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    const authTime = performance.now() - startTime;
    console.log(`🔐 LOGIN - Respuesta de Supabase Auth (${authTime.toFixed(2)}ms):`, {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.status,
      userId: data?.user?.id,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ LOGIN - Error de autenticación:", {
        error: error.message,
        code: error.status,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }

    if (!data.user) {
      console.error("❌ LOGIN - No se recibió usuario en la respuesta");
      throw new Error("No se pudo autenticar");
    }

    if (!data.session) {
      console.error("❌ LOGIN - No se recibió sesión en la respuesta");
      throw new Error("No se pudo crear la sesión");
    }

    console.log("✅ LOGIN - Autenticación exitosa, obteniendo perfil de usuario...");

    // Consultar usuario desde el servidor (tiene acceso RLS)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, is_active, role, name")
      .eq("id", data.user.id)
      .single();

    const profileTime = performance.now() - startTime;
    console.log(`🔐 LOGIN - Perfil de usuario obtenido (${profileTime.toFixed(2)}ms):`, {
      hasUserData: !!userData,
      hasError: !!userError,
      errorMessage: userError?.message,
      userId: userData?.id,
      userEmail: userData?.email,
      userRole: userData?.role,
      isActive: userData?.is_active,
      timestamp: new Date().toISOString(),
    });

    if (userError) {
      console.error("❌ LOGIN - Error al obtener perfil:", {
        error: userError.message,
        code: userError.code,
        userId: data.user.id,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Error de base de datos al obtener perfil (${userError.code}): ${userError.message}`);
    }

    if (!userData) {
      console.error("❌ LOGIN - Usuario no encontrado en la base de datos:", {
        userId: data.user.id,
        timestamp: new Date().toISOString(),
      });
      throw new Error("Usuario no encontrado en el sistema");
    }

    if (!userData.is_active) {
      console.warn("⚠️ LOGIN - Intento de login con cuenta desactivada:", {
        userId: userData.id,
        email: userData.email,
        timestamp: new Date().toISOString(),
      });
      throw new Error("Tu cuenta está desactivada. Contacta al administrador");
    }

    // Log del login exitoso
    logger.logLogin(userData.id, userData.name);

    const totalTime = performance.now() - startTime;
    console.log(`✅ LOGIN - Login completado exitosamente (${totalTime.toFixed(2)}ms):`, {
      userId: userData.id,
      email: userData.email,
      role: userData.role,
      name: userData.name,
      hasSession: !!data.session,
      sessionExpiresAt: data.session.expires_at,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      user: userData
    };
  } catch (error: any) {
    const totalTime = performance.now() - startTime;
    console.error(`❌ LOGIN - Error en proceso de login (${totalTime.toFixed(2)}ms):`, {
      error: error.message,
      code: error.status || error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    let message = "Error al iniciar sesión";

    if (error.message.includes("Invalid login credentials")) {
      message = "Email o contraseña incorrectos";
    } else if (error.message.includes("Email not confirmed")) {
      message = "Debes confirmar tu email antes de iniciar sesión";
    } else if (error.message.includes("Too many requests")) {
      message = "Demasiados intentos. Espera un momento e intenta de nuevo";
    } else {
      message = error.message;
    }

    return { success: false, message };
  }
}

export async function getUserData(userId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, role, is_active")
      .eq("id", userId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching user data:", error);
    return {
      success: false,
      message: error.message || "Error al obtener datos del usuario"
    };
  }
}

export async function logoutUser() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("Error logging out:", error);
    return {
      success: false,
      message: error.message || "Error al cerrar sesión",
    };
  }
}

