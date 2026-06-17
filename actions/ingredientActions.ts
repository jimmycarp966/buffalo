"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkUserPermission } from "./permissionActions";
import { getCurrentDate } from "@/lib/utils";

export interface IngredientInput {
  name: string;
  unit: string; // 'kg' | 'l' | 'unidad'
  cost: number; // costo por unidad de compra
}

// Lista de insumos activos
export async function getIngredients() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado", data: [] as any[] };

    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, unit, cost, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching ingredients:", error);
    return { success: false, message: error.message || "Error al obtener insumos", data: [] as any[] };
  }
}

export async function createIngredient(data: IngredientInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };

    const { hasPermission } = await checkUserPermission(user.id, "products.edit");
    if (!hasPermission) return { success: false, message: "No tenés permisos para gestionar insumos" };

    if (!data.name?.trim()) return { success: false, message: "El nombre es requerido" };

    const { data: row, error } = await supabase
      .from("ingredients")
      .insert([{ name: data.name.trim(), unit: data.unit || "kg", cost: data.cost || 0 }])
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/productos");
    return { success: true, data: row };
  } catch (error: any) {
    console.error("Error creating ingredient:", error);
    return { success: false, message: error.message || "Error al crear el insumo" };
  }
}

export async function updateIngredient(id: string, data: IngredientInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };

    const { hasPermission } = await checkUserPermission(user.id, "products.edit");
    if (!hasPermission) return { success: false, message: "No tenés permisos para gestionar insumos" };

    const { data: row, error } = await supabase
      .from("ingredients")
      .update({
        name: data.name?.trim(),
        unit: data.unit,
        cost: data.cost || 0,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/productos");
    return { success: true, data: row };
  } catch (error: any) {
    console.error("Error updating ingredient:", error);
    return { success: false, message: error.message || "Error al actualizar el insumo" };
  }
}

// Baja lógica: se conserva la referencia en recetas existentes.
export async function deleteIngredient(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };

    const { hasPermission } = await checkUserPermission(user.id, "products.edit");
    if (!hasPermission) return { success: false, message: "No tenés permisos para gestionar insumos" };

    const { error } = await supabase
      .from("ingredients")
      .update({ is_active: false, updated_at: getCurrentDate().toISOString() })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/productos");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting ingredient:", error);
    return { success: false, message: error.message || "Error al eliminar el insumo" };
  }
}

// Receta (insumos + cantidades) de un producto
export async function getProductRecipe(productId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado", data: [] as any[] };

    const { data, error } = await supabase
      .from("product_ingredients")
      .select("id, ingredient_id, quantity, ingredient:ingredients(id, name, unit, cost)")
      .eq("product_id", productId);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching product recipe:", error);
    return { success: false, message: error.message || "Error al obtener la receta", data: [] as any[] };
  }
}
