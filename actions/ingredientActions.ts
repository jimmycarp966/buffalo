"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkUserPermission } from "./permissionActions";
import { getCurrentDate } from "@/lib/utils";

export interface IngredientInput {
  name: string;
  unit: string; // 'kg' | 'l' | 'unidad'
  cost: number; // costo por unidad de compra
  purchase_price?: number | null; // precio del entero (modo "rinde")
  yield_units?: number | null;    // cuántas porciones rinde el entero
}

// Si el insumo se compra entero y rinde porciones (ej: pan → rodajas), deriva el
// costo POR PORCIÓN = precio del entero / porciones, y fuerza unidad = 'unidad'.
function deriveYield(data: IngredientInput) {
  const yieldUnits = Number(data.yield_units) || 0;
  const purchasePrice = Number(data.purchase_price) || 0;
  if (yieldUnits > 0) {
    return {
      unit: "unidad",
      cost: purchasePrice / yieldUnits,
      purchase_price: purchasePrice,
      yield_units: yieldUnits,
    };
  }
  return { unit: data.unit || "kg", cost: Number(data.cost) || 0, purchase_price: null, yield_units: null };
}

// Detecta que faltan las columnas purchase_price/yield_units (base sin el ALTER todavía)
const isMissingYieldColumn = (error: any) => {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("purchase_price") ||
    msg.includes("yield_units") ||
    error?.code === "42703" ||
    error?.code === "PGRST204"
  );
};

// Lista de insumos activos
export async function getIngredients() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado", data: [] as any[] };

    const primary = await supabase
      .from("ingredients")
      .select("id, name, unit, cost, is_active, purchase_price, yield_units")
      .eq("is_active", true)
      .order("name");

    let data: any[] | null = primary.data;
    let error: any = primary.error;

    // Fallback si la base todavía no tiene las columnas de "rinde"
    if (error && isMissingYieldColumn(error)) {
      const fb = await supabase
        .from("ingredients")
        .select("id, name, unit, cost, is_active")
        .eq("is_active", true)
        .order("name");
      data = fb.data;
      error = fb.error;
    }

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

    const d = deriveYield(data);
    const fullRow: any = {
      name: data.name.trim(),
      unit: d.unit,
      cost: d.cost,
      purchase_price: d.purchase_price,
      yield_units: d.yield_units,
    };

    let { data: row, error } = await supabase.from("ingredients").insert([fullRow]).select().single();
    if (error && isMissingYieldColumn(error)) {
      const { purchase_price, yield_units, ...rest } = fullRow;
      ({ data: row, error } = await supabase.from("ingredients").insert([rest]).select().single());
    }

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

    const d = deriveYield(data);
    const fullUpdate: any = {
      name: data.name?.trim(),
      unit: d.unit,
      cost: d.cost,
      purchase_price: d.purchase_price,
      yield_units: d.yield_units,
      updated_at: getCurrentDate().toISOString(),
    };

    let { data: row, error } = await supabase.from("ingredients").update(fullUpdate).eq("id", id).select().single();
    if (error && isMissingYieldColumn(error)) {
      const { purchase_price, yield_units, ...rest } = fullUpdate;
      ({ data: row, error } = await supabase.from("ingredients").update(rest).eq("id", id).select().single());
    }

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
