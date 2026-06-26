"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkUserPermission } from "./permissionActions";
import { getCurrentDate } from "@/lib/utils";

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  cuit?: string | null;
  credit_limit?: number;
}

async function requireManage(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado", user: null };
  const { hasPermission } = await checkUserPermission(user.id, "customers.manage");
  if (!hasPermission) return { ok: false, message: "No tenés permisos para gestionar clientes", user: null };
  return { ok: true, message: "", user };
}

// Lectura: cualquier staff activo (sirve para el selector al abrir mesa)
export async function getCustomers() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado", data: [] as any[] };

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, cuit, credit_limit, current_balance, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return { success: false, message: error.message || "Error al obtener clientes", data: [] as any[] };
  }
}

export async function createCustomer(data: CustomerInput) {
  try {
    const supabase = await createClient();
    const auth = await requireManage(supabase);
    if (!auth.ok) return { success: false, message: auth.message };
    if (!data.name?.trim()) return { success: false, message: "El nombre es requerido" };

    const { data: row, error } = await supabase
      .from("customers")
      .insert([
        {
          name: data.name.trim(),
          phone: data.phone || null,
          email: data.email || null,
          cuit: data.cuit || null,
          credit_limit: data.credit_limit || 0,
          current_balance: 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/clientes");
    return { success: true, data: row };
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return { success: false, message: error.message || "Error al crear el cliente" };
  }
}

export async function updateCustomer(id: string, data: CustomerInput) {
  try {
    const supabase = await createClient();
    const auth = await requireManage(supabase);
    if (!auth.ok) return { success: false, message: auth.message };

    const { data: row, error } = await supabase
      .from("customers")
      .update({
        name: data.name?.trim(),
        phone: data.phone || null,
        email: data.email || null,
        cuit: data.cuit || null,
        credit_limit: data.credit_limit || 0,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/clientes");
    return { success: true, data: row };
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return { success: false, message: error.message || "Error al actualizar el cliente" };
  }
}

export async function deleteCustomer(id: string) {
  try {
    const supabase = await createClient();
    const auth = await requireManage(supabase);
    if (!auth.ok) return { success: false, message: auth.message };

    const { error } = await supabase
      .from("customers")
      .update({ is_active: false, updated_at: getCurrentDate().toISOString() })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/clientes");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return { success: false, message: error.message || "Error al eliminar el cliente" };
  }
}

// Registrar un PAGO del cliente (baja el saldo). NO toca la caja del día.
export async function registerCustomerPayment(customerId: string, amount: number, description?: string) {
  try {
    const supabase = await createClient();
    const auth = await requireManage(supabase);
    if (!auth.ok) return { success: false, message: auth.message };
    if (!amount || amount <= 0) return { success: false, message: "El monto debe ser mayor a 0" };

    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("current_balance")
      .eq("id", customerId)
      .single();
    if (cErr) throw cErr;

    const { error: mErr } = await supabase.from("customer_credit_movements").insert([
      {
        customer_id: customerId,
        type: "payment",
        amount: amount,
        description: description?.trim() || "Pago de cuenta corriente",
      },
    ]);
    if (mErr) throw mErr;

    const newBalance = (Number(customer?.current_balance) || 0) - amount;
    const { error: uErr } = await supabase
      .from("customers")
      .update({ current_balance: newBalance, updated_at: getCurrentDate().toISOString() })
      .eq("id", customerId);
    if (uErr) throw uErr;

    revalidatePath("/clientes");
    return { success: true, data: { newBalance } };
  } catch (error: any) {
    console.error("Error registering customer payment:", error);
    return { success: false, message: error.message || "Error al registrar el pago" };
  }
}

// Cargar una venta/consumo a la cuenta corriente (usado al cerrar mesa).
// Auth solo (corre dentro del flujo de cierre, que ya está gateado por tables.close).
export async function chargeSaleToCustomer(
  customerId: string,
  amount: number,
  saleId?: string | null,
  description?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };
    if (!amount || amount <= 0) return { success: false, message: "Monto inválido" };

    const { data: customer } = await supabase
      .from("customers")
      .select("current_balance")
      .eq("id", customerId)
      .single();

    await supabase.from("customer_credit_movements").insert([
      {
        customer_id: customerId,
        type: "charge",
        amount: amount,
        description: description?.trim() || "Consumo en mesa",
        reference_id: saleId || null,
      },
    ]);

    const newBalance = (Number(customer?.current_balance) || 0) + amount;
    await supabase.from("customers").update({ current_balance: newBalance }).eq("id", customerId);

    return { success: true, data: { newBalance } };
  } catch (error: any) {
    console.error("Error charging sale to customer:", error);
    return { success: false, message: error.message || "Error al cargar a cuenta corriente" };
  }
}

export async function getCustomerMovements(customerId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado", data: [] as any[] };

    const { data, error } = await supabase
      .from("customer_credit_movements")
      .select("id, type, amount, description, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching customer movements:", error);
    return { success: false, message: error.message || "Error al obtener movimientos", data: [] as any[] };
  }
}
