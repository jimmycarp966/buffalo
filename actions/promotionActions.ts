"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentDate } from "@/lib/utils";
import { z } from "zod";

const promotionSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed", "2x1"]),
  discount_value: z.number().optional(),
  product_id: z.string().uuid().optional(),
  start_date: z.string(),
  end_date: z.string(),
  is_active: z.boolean().default(true),
});

export async function createPromotion(data: z.infer<typeof promotionSchema>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Validar permisos
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "supervisor"].includes(userData.role)) {
      return {
        success: false,
        message: "No tienes permisos para crear promociones",
      };
    }

    const validated = promotionSchema.parse(data);

    const { data: promotion, error } = await supabase
      .from("promotions")
      .insert([
        {
          ...validated,
          created_at: getCurrentDate().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/promociones");
    return { success: true, data: promotion };
  } catch (error: any) {
    console.error("Error creating promotion:", error);
    return {
      success: false,
      message: error.message || "Error al crear la promoción",
    };
  }
}

export async function updatePromotion(id: string, data: Partial<z.infer<typeof promotionSchema>>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Validar permisos
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "supervisor"].includes(userData.role)) {
      return {
        success: false,
        message: "No tienes permisos para editar promociones",
      };
    }

    const { data: promotion, error } = await supabase
      .from("promotions")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/promociones");
    return { success: true, data: promotion };
  } catch (error: any) {
    console.error("Error updating promotion:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar la promoción",
    };
  }
}

export async function getPromotions() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("promotions")
      .select(
        `
        *,
        product:products(id, name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching promotions:", error);
    return {
      success: false,
      message: error.message || "Error al obtener promociones",
      data: [],
    };
  }
}

export async function getActivePromotions() {
  try {
    const supabase = await createClient();
    const now = getCurrentDate().toISOString();

    const { data, error } = await supabase
      .from("promotions")
      .select(
        `
        *,
        product:products(id, name, sale_price)
      `
      )
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now);

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching active promotions:", error);
    return {
      success: false,
      message: error.message || "Error al obtener promociones activas",
      data: [],
    };
  }
}

export async function checkPromotionForProduct(productId: string) {
  try {
    const supabase = await createClient();
    const now = getCurrentDate().toISOString();

    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error checking promotion:", error);
    return {
      success: false,
      message: error.message || "Error al verificar promoción",
      data: null,
    };
  }
}

