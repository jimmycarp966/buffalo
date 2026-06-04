"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { expenseSchema, type ExpenseInput } from "@/lib/validations";
import { getCurrentDate } from "@/lib/utils";
import { checkUserPermission } from "./permissionActions";

export async function createExpense(data: ExpenseInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "expenses.create");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para registrar gastos" };
    }

    // Validar con Zod
    const validated = expenseSchema.parse(data);

    // Verificar que la sesión de caja esté abierta
    const { data: session } = await supabase
      .from("cash_register_sessions")
      .select("*")
      .eq("id", validated.cash_register_session_id)
      .is("closed_at", null)
      .single();

    if (!session) {
      return {
        success: false,
        message: "La sesión de caja debe estar abierta",
      };
    }

    // Crear gasto
    // Mapear cash_register_session_id a session_id si la tabla tiene ambas columnas
    const expenseData: any = {
      description: validated.description,
      category: validated.category,
      amount: validated.amount,
      cash_register_session_id: validated.cash_register_session_id,
      user_id: user.id,
      created_at: getCurrentDate().toISOString(),
    };

    // Si la tabla tiene una columna session_id (vieja), también llenarla
    // Esto evita el error "null value in column session_id"
    expenseData.session_id = validated.cash_register_session_id;

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert([expenseData])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/gastos");
    revalidatePath("/caja-drugstore");
    revalidatePath("/caja-bar");

    return { success: true, data: expense };
  } catch (error: any) {
    console.error("Error creating expense:", error);
    return {
      success: false,
      message: error.message || "Error al registrar el gasto",
    };
  }
}

export async function getExpenses(sessionId?: string) {
  try {
    const supabase = await createClient();

    // Primero probar con una consulta simple para diagnosticar
    let query = supabase.from("expenses").select("*");

    if (sessionId) {
      query = query.eq("cash_register_session_id", sessionId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Si la consulta básica funciona, intentar con relaciones
    if (data && data.length > 0) {
      try {
        let fullQuery = supabase.from("expenses").select(
          `
            *,
            user:users!expenses_user_id_fkey(name),
            cash_register_session:cash_register_sessions(
              cash_register:cash_registers(name, type)
            )
          `
        );

        if (sessionId) {
          fullQuery = fullQuery.eq("cash_register_session_id", sessionId);
        }

        const { data: fullData, error: fullError } = await fullQuery.order("created_at", { ascending: false });

        if (!fullError) {
          return { success: true, data: fullData };
        } else {
          console.warn("Error with full query, falling back to basic data:", fullError);
        }
      } catch (relationError) {
        console.warn("Error with relations, falling back to basic data:", relationError);
      }
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching expenses:", {
      error,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      fullError: JSON.stringify(error, null, 2)
    });

    // Mejorar el mensaje de error para casos específicos
    let errorMessage = "Error al obtener gastos";
    if (error?.code === 'PGRST116') {
      errorMessage = "Error en la consulta de base de datos - posible problema con las relaciones";
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      message: errorMessage,
      data: [],
    };
  }
}

export async function updateExpense(id: string, data: Partial<ExpenseInput>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "expenses.edit");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para editar gastos" };
    }

    const existingResult = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();

    if (existingResult.error || !existingResult.data) {
      return { success: false, message: "Gasto no encontrado" };
    }

    const partialSchema = expenseSchema.partial();
    const validated = partialSchema.parse(data);

    const updates: Record<string, any> = {};

    if (validated.description !== undefined) {
      updates.description = validated.description;
    }
    if (validated.category !== undefined) {
      updates.category = validated.category;
    }
    if (validated.amount !== undefined) {
      updates.amount = validated.amount;
    }
    if (validated.cash_register_session_id !== undefined) {
      const { data: session } = await supabase
        .from("cash_register_sessions")
        .select("*")
        .eq("id", validated.cash_register_session_id)
        .is("closed_at", null)
        .single();

      if (!session) {
        return {
          success: false,
          message: "La sesión de caja debe estar abierta",
        };
      }

      updates.cash_register_session_id = validated.cash_register_session_id;
      updates.session_id = validated.cash_register_session_id;
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No hay cambios para aplicar" };
    }

    const { data: updatedExpense, error } = await supabase
      .from("expenses")
      .update({
        ...updates,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/gastos");
    revalidatePath("/caja-drugstore");
    revalidatePath("/caja-bar");

    return { success: true, data: updatedExpense };
  } catch (error: any) {
    console.error("Error updating expense:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar el gasto",
    };
  }
}

export async function deleteExpense(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos (admins, supervisores y cajeros pueden eliminar gastos)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "supervisor", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "No tienes permisos para eliminar gastos",
      };
    }

    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) throw error;

    revalidatePath("/gastos");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting expense:", error);
    return {
      success: false,
      message: error.message || "Error al eliminar el gasto",
    };
  }
}

