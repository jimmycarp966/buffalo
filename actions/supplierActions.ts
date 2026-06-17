"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentDate } from "@/lib/utils";
import { z } from "zod";
import { checkUserPermission } from "./permissionActions";

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional(),
  address: z.string().optional(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().uuid("Proveedor inválido"),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid().optional().nullable(),
        ingredient_id: z.string().uuid().optional().nullable(),
        description: z.string().optional().nullable(),
        quantity: z.number().min(0.01),
        unit_cost: z.number().min(0),
      })
    )
    .min(1, "Debe agregar al menos un ítem"),
  payment_status: z.enum(["paid", "pending"]).optional().default("pending"),
  payment_method_id: z.string().uuid().optional().nullable(),
});

export async function createSupplier(data: z.infer<typeof supplierSchema>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "suppliers.create");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    const validated = supplierSchema.parse(data);

    const { data: supplier, error } = await supabase
      .from("suppliers")
      .insert([
        {
          ...validated,
          created_at: getCurrentDate().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/proveedores");
    return { success: true, data: supplier };
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    return {
      success: false,
      message: error.message || "Error al crear el proveedor",
    };
  }
}

export async function updateSupplier(id: string, data: Partial<z.infer<typeof supplierSchema>>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "suppliers.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    const { data: supplier, error } = await supabase
      .from("suppliers")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/proveedores");
    return { success: true, data: supplier };
  } catch (error: any) {
    console.error("Error updating supplier:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar el proveedor",
    };
  }
}

export async function getSuppliers() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    return {
      success: false,
      message: error.message || "Error al obtener proveedores",
      data: [],
    };
  }
}

export async function createPurchase(data: z.infer<typeof purchaseSchema>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "purchases.create");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    const validated = purchaseSchema.parse(data);

    // Calcular total
    const total = validated.items.reduce(
      (sum, item) => sum + item.unit_cost * item.quantity,
      0
    );

    // Crear compra
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert([
        {
          supplier_id: validated.supplier_id,
          total_amount: total,
          user_id: user.id,
          payment_status: validated.payment_status || "pending",
          payment_method_id: validated.payment_method_id || null,
          paid_at:
            validated.payment_status === "paid"
              ? getCurrentDate().toISOString()
              : null,
          created_at: getCurrentDate().toISOString(),
        },
      ])
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Insertar items. Solo los productos de la carta actualizan stock;
    // los insumos y los ítems con detalle libre solo quedan registrados.
    for (const item of validated.items) {
      const productId = (item as any).product_id || null;
      const ingredientId = (item as any).ingredient_id || null;

      await supabase.from("purchase_items").insert([
        {
          purchase_id: purchase.id,
          product_id: productId,
          ingredient_id: ingredientId,
          description: (item as any).description || null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          subtotal: item.unit_cost * item.quantity,
          created_at: getCurrentDate().toISOString(),
        },
      ]);

      if (productId) {
        const qty = Math.round(item.quantity);
        await supabase.rpc("increment_product_stock", {
          product_id: productId,
          quantity: qty,
        });
        await supabase.from("inventory_movements").insert([
          {
            product_id: productId,
            movement_type: "entry",
            quantity: qty,
            reason: `Compra #${purchase.id}`,
            user_id: user.id,
            created_at: getCurrentDate().toISOString(),
          },
        ]);
      }
    }

    revalidatePath("/compras");
    revalidatePath("/productos");
    return { success: true, data: purchase };
  } catch (error: any) {
    console.error("Error creating purchase:", error);
    return {
      success: false,
      message: error.message || "Error al registrar la compra",
    };
  }
}

export async function markPurchaseAsPaid(
  purchaseId: string,
  paymentMethodId?: string | null
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares (mismo permiso que crear compras)
    const { hasPermission } = await checkUserPermission(user.id, "purchases.create");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    const updateData: {
      payment_status: string;
      paid_at: string;
      payment_method_id?: string | null;
    } = {
      payment_status: "paid",
      paid_at: getCurrentDate().toISOString(),
    };

    // El método de pago es opcional
    if (paymentMethodId !== undefined) {
      updateData.payment_method_id = paymentMethodId || null;
    }

    const { error } = await supabase
      .from("purchases")
      .update(updateData)
      .eq("id", purchaseId);

    if (error) throw error;

    revalidatePath("/compras");
    return { success: true, message: "Compra marcada como pagada" };
  } catch (error: any) {
    console.error("Error marking purchase as paid:", error);
    return {
      success: false,
      message: error.message || "Error al marcar la compra como pagada",
    };
  }
}

export async function getPurchases() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        *,
        supplier:suppliers(name),
        user:users!purchases_user_id_fkey(name),
        payment_method:payment_methods(name),
        purchase_items(
          *,
          product:products(name)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    return {
      success: false,
      message: error.message || "Error al obtener compras",
      data: [],
    };
  }
}

