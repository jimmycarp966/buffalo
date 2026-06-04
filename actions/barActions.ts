"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getErrorMessage } from "@/lib/types";
import { checkUserPermission } from "./permissionActions";
import {
  getMissingSalePayments,
  normalizeItemsWithProductCatalog,
  type PaymentSnapshot,
} from "@/lib/tableSaleGuards";


type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Esquemas de validación siguiendo el patrón del sistema
const partialPaymentSchema = z.object({
  sale_id: z.string().uuid(),
  payments: z
    .array(
      z.object({
        payment_method_id: z.string().uuid(),
        amount: z.number().min(0.01),
      }),
    )
    .min(1, "Debes seleccionar al menos un método de pago"),
  items: z
    .array(
      z.object({
        sale_item_id: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
});

const tableSplitSchema = z.object({
  sale_id: z.string().uuid(),
  split_name: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
    subtotal: z.number().min(0),
  })),
  total_amount: z.number().min(0),
});

// Tipos TypeScript
export interface TablePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method_id: string;
  created_at: string;
}

export interface TableSplit {
  id: string;
  sale_id: string;
  split_name: string;
  items: any[];
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
}

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrency = (value: number) => Number(value.toFixed(2));

const aggregateStockAdjustments = (
  items: Array<{ product_id: string; quantity: number }>
) => {
  const aggregated = new Map<string, number>();

  items.forEach((item) => {
    aggregated.set(
      item.product_id,
      (aggregated.get(item.product_id) ?? 0) + Number(item.quantity || 0)
    );
  });

  return aggregated;
};

async function restoreReservedStock(
  supabase: SupabaseServerClient,
  items: Array<{ product_id: string; quantity: number }>
) {
  if (!items.length) {
    return;
  }

  const aggregatedAdjustments = aggregateStockAdjustments(items);
  const productIds = Array.from(aggregatedAdjustments.keys());

  const { data: products, error } = await supabase
    .from("products")
    .select("id, stock, unlimited_stock")
    .in("id", productIds);

  if (error) {
    throw error;
  }

  const productMap = new Map((products || []).map((product: any) => [product.id, product]));

  for (const [productId, quantity] of aggregatedAdjustments.entries()) {
    const product = productMap.get(productId);
    if (!product || product.unlimited_stock) {
      continue;
    }

    const nextStock = Number(product.stock || 0) + quantity;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", productId);

    if (updateError) {
      throw updateError;
    }
  }
}

async function reserveValidatedStock(
  supabase: SupabaseServerClient,
  items: Array<{ product_id: string; quantity: number }>,
  products: any[]
) {
  const productMap = new Map((products || []).map((product: any) => [product.id, product]));
  const aggregatedAdjustments = aggregateStockAdjustments(items);
  const reservedItems: Array<{ product_id: string; quantity: number }> = [];

  for (const [productId, quantity] of aggregatedAdjustments.entries()) {
    const product = productMap.get(productId);
    if (!product || product.unlimited_stock) {
      continue;
    }

    const nextStock = Number(product.stock || 0) - quantity;
    const { data: updatedRows, error: updateError } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", productId)
      .gte("stock", quantity)
      .select("id");

    if (updateError) {
      throw updateError;
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(`No se pudo reservar stock para el producto ${product.name}`);
    }

    reservedItems.push({ product_id: productId, quantity });
  }

  return reservedItems;
}

async function ensureActiveTableExists(
  supabase: SupabaseServerClient,
  tableNumber: number
) {
  const { data: tableLayout, error } = await supabase
    .from("bar_layout")
    .select("table_number")
    .eq("table_number", tableNumber)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(tableLayout);
}

async function migrateMissingTablePaymentsToSalePayments(
  supabase: SupabaseServerClient,
  saleId: string
) {
  const { data: tablePayments, error: tablePaymentsError } = await supabase
    .from("table_payments")
    .select("payment_method_id, amount")
    .eq("sale_id", saleId);

  if (tablePaymentsError) {
    throw tablePaymentsError;
  }

  const { data: salePayments, error: salePaymentsError } = await supabase
    .from("sale_payments")
    .select("payment_method_id, amount")
    .eq("sale_id", saleId);

  if (salePaymentsError) {
    throw salePaymentsError;
  }

  const missingPayments = getMissingSalePayments(
    (tablePayments || []) as PaymentSnapshot[],
    (salePayments || []) as PaymentSnapshot[]
  );

  if (missingPayments.length === 0) {
    return;
  }

  const rowsToInsert = missingPayments.map((payment) => ({
    sale_id: saleId,
    payment_method_id: payment.payment_method_id,
    amount: normalizeCurrency(Number(payment.amount)),
  }));

  const { error: insertError } = await supabase
    .from("sale_payments")
    .insert(rowsToInsert);

  if (insertError) {
    throw insertError;
  }
}

const normalizeSaleItemsWithPayments = (rawItems: any[] | null | undefined) => {
  return (rawItems || []).map((item: any) => {
    const payments = Array.isArray(item.sale_item_payments) ? item.sale_item_payments : [];
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unit_price);
    const subtotal = item.subtotal !== undefined && item.subtotal !== null ? toNumber(item.subtotal) : quantity * unitPrice;
    const paidQuantity = payments.reduce((sum: number, payment: any) => sum + toNumber(payment.quantity_paid), 0);
    const cappedPaidQuantity = Math.min(paidQuantity, quantity);
    const paidAmount = cappedPaidQuantity * unitPrice;
    const remainingQuantity = Math.max(quantity - cappedPaidQuantity, 0);
    const remainingAmount = Math.max(subtotal - paidAmount, 0);

    const { sale_item_payments, ...rest } = item;

    return {
      ...rest,
      subtotal, // ✅ Asegurar que subtotal siempre esté presente
      paid_quantity: cappedPaidQuantity,
      remaining_quantity: remainingQuantity,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
    };
  });
};

const buildTablePaymentSummary = (table: any) => {
  const saleItems = normalizeSaleItemsWithPayments(table.sale_items);

  // ✅ SIEMPRE calcular el total desde los items si hay items
  // Esto asegura que el total siempre coincida con la suma real de los items
  const hasItems = saleItems && saleItems.length > 0;
  const itemsTotal = hasItems
    ? saleItems.reduce(
      (sum: number, item: any) => {
        // Usar subtotal si existe, sino calcular desde quantity * unit_price
        const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null
          ? toNumber(item.subtotal)
          : toNumber(item.quantity) * toNumber(item.unit_price);
        return sum + itemSubtotal;
      },
      0,
    )
    : 0;

  const baseTotal = toNumber(table.total_amount);

  // ✅ Si hay items, SIEMPRE usar itemsTotal (fuente de verdad)
  // Solo usar baseTotal si NO hay items (mesa vacía o error)
  const finalTotal = hasItems ? itemsTotal : baseTotal;

  const paymentsTotal = table.sale_payments?.reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0) || 0;
  const paidFromItems = saleItems.reduce((sum: number, item: any) => sum + toNumber(item.paid_amount), 0);
  const hasItemPayments = saleItems.some((item: any) => toNumber(item.paid_quantity) > 0);
  const extraPaid = Math.max(paymentsTotal - paidFromItems, 0);
  const paidAmount = hasItemPayments ? Math.min(finalTotal, paidFromItems + extraPaid) : paymentsTotal;
  const remainingAmount = Math.max(finalTotal - paidAmount, 0);

  return {
    ...table,
    sale_items: saleItems,
    total_amount: finalTotal,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
  };
};

// Server Actions siguiendo el patrón del sistema

const SALES_SELECT_BASE = `
  id,
  sale_number,
  total_amount,
  status,
  table_number,
  sale_type,
  kitchen_ready,
  customer_name,
  customer_phone,
  delivery_address,
  delivery_notes,
  created_at,
  cash_register_session_id,
  user:users!sales_user_id_fkey(name),
  sale_items(
    id,
    quantity,
    unit_price,
    subtotal,
    product:products!sale_items_product_id_fkey(
      name,
      cocina_only
    ),
    sale_item_payments:sale_item_payments_sale_item_id_fkey(
      quantity_paid,
      amount_paid
    )
  ),
  sale_payments(
    id,
    amount,
    payment_method:payment_methods(name)
  )
`;

const SALES_SELECT_WITH_ACCOUNT_PRINTED = `
  ${SALES_SELECT_BASE},
  account_printed_at
`;

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = getErrorMessage(error)?.toLowerCase() ?? "";
  const missingColumn = `column sales.${columnName}`.toLowerCase();
  return message.includes(missingColumn) && message.includes("does not exist");
};

const fetchSalesWithOptionalAccountPrinted = async (
  supabase: SupabaseServerClient,
  options?: {
    sessionId?: string;
    pendingOnly?: boolean;
  },
) => {
  const sessionId = options?.sessionId;
  const pendingOnly = options?.pendingOnly === true;

  const applyFilters = (query: any) => {
    let nextQuery = query.in("sale_type", ["table", "counter", "delivery"]);
    if (pendingOnly) {
      nextQuery = nextQuery.eq("status", "pending");
    }
    if (sessionId) {
      nextQuery = nextQuery.eq("cash_register_session_id", sessionId);
    }
    return nextQuery;
  };

  const withAccountQuery = applyFilters(
    supabase.from("sales").select(SALES_SELECT_WITH_ACCOUNT_PRINTED),
  );
  const withAccountResult = await withAccountQuery.order("created_at", { ascending: false });

  if (!withAccountResult.error) {
    return { data: withAccountResult.data ?? [], error: null };
  }

  if (!isMissingColumnError(withAccountResult.error, "account_printed_at")) {
    return { data: [], error: withAccountResult.error };
  }

  console.warn("account_printed_at no existe en esta base. Usando fallback sin esa columna.");

  const fallbackQuery = applyFilters(
    supabase.from("sales").select(SALES_SELECT_BASE),
  );
  const fallbackResult = await fallbackQuery.order("created_at", { ascending: false });

  if (fallbackResult.error) {
    return { data: [], error: fallbackResult.error };
  }

  const normalizedData = (fallbackResult.data ?? []).map((sale: any) => ({
    ...sale,
    account_printed_at: null,
  }));

  return { data: normalizedData, error: null };
};

export async function getOpenTables() {
  try {
    const supabase = await createClient();

    const { data, error } = await fetchSalesWithOptionalAccountPrinted(supabase, {
      pendingOnly: true,
    });

    if (error) {
      throw error;
    }

    const filteredData =
      data?.filter((sale: any) => {
        if (sale.table_number !== null) {
          return true;
        }

        if (sale.sale_type === "counter" || sale.sale_type === "delivery") {
          return sale.sale_items?.some((item: any) => item.product?.cocina_only) ?? false;
        }

        return false;
      }) ?? [];

    const tablesWithBalances = filteredData.map((table: any) => buildTablePaymentSummary(table));

    return { success: true, data: tablesWithBalances };
  } catch (error: unknown) {
    console.error("❌ ERROR getOpenTables:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener mesas abiertas",
      data: [],
    };
  }
}

export async function getAllTablesAndOrders(sessionId?: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await fetchSalesWithOptionalAccountPrinted(supabase, {
      sessionId,
    });

    if (error) throw error;

    // Calcular saldos restantes
    const tablesWithBalances = data?.map((table: any) => buildTablePaymentSummary(table)) || [];

    return { success: true, data: tablesWithBalances };
  } catch (error: unknown) {
    console.error("Error getting all tables and orders:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener mesas y pedidos",
      data: [],
    };
  }
}


export async function makePartialPayment(data: z.infer<typeof partialPaymentSchema>) {
  try {
    const validated = partialPaymentSchema.parse(data);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "sales.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay una sesión de caja abierta en el área "bar"
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id, cash_register_id, area")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR. Por favor, abre la caja primero.",
      };
    }

    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, total_amount, status, cash_register_session_id")
      .eq("id", validated.sale_id)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "La venta no está pendiente",
      };
    }

    // Obtener el saldo restante de la mesa
    const { data: balanceData } = await supabase
      .rpc("get_table_remaining_balance", { p_sale_id: validated.sale_id });

    const remainingBalance = balanceData?.[0]?.remaining_balance ?? sale.total_amount;
    const totalPaymentAmount = validated.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const tolerance = 0.01;

    // Validar que el monto no exceda el saldo restante
    if (totalPaymentAmount - remainingBalance > tolerance) {
      return {
        success: false,
        message: `El monto excede el saldo restante de $${remainingBalance.toFixed(2)}`,
      };
    }

    // Obtener items de la venta con sus pagos aplicados
    const { data: saleItems, error: saleItemsError } = await supabase
      .from("sale_items")
      .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        sale_item_payments:sale_item_payments_sale_item_id_fkey(quantity_paid)
      `)
      .eq("sale_id", validated.sale_id);

    if (saleItemsError) throw saleItemsError;

    const saleItemMap = new Map<
      string,
      {
        quantity: number;
        unit_price: number;
        subtotal: number;
        paid_quantity: number;
      }
    >();

    saleItems?.forEach((item: any) => {
      const payments = Array.isArray(item.sale_item_payments) ? item.sale_item_payments : [];
      const paidQuantity = payments.reduce((sum: number, payment: any) => sum + Number(payment.quantity_paid || 0), 0);
      saleItemMap.set(item.id, {
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal ?? (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)) || 0,
        paid_quantity: paidQuantity,
      });
    });

    const itemPaymentRecords: Array<{ sale_item_id: string; quantity: number; amount: number }> = [];
    let calculatedItemsAmount = 0;

    if (validated.items && validated.items.length > 0) {
      for (const itemPayment of validated.items) {
        const itemData = saleItemMap.get(itemPayment.sale_item_id);
        if (!itemData) {
          return {
            success: false,
            message: "Uno de los productos seleccionados ya no existe en la mesa.",
          };
        }

        const remainingQuantity = Math.max(itemData.quantity - itemData.paid_quantity, 0);
        if (remainingQuantity <= 0) {
          return {
            success: false,
            message: "El producto seleccionado ya fue pagado completamente.",
          };
        }

        if (itemPayment.quantity > remainingQuantity) {
          return {
            success: false,
            message: `El producto seleccionado solo tiene ${remainingQuantity} unidad(es) pendiente(s).`,
          };
        }

        const amountForItem = itemData.unit_price * itemPayment.quantity;
        calculatedItemsAmount += amountForItem;
        itemPaymentRecords.push({
          sale_item_id: itemPayment.sale_item_id,
          quantity: itemPayment.quantity,
          amount: amountForItem,
        });
      }

      if (Math.abs(calculatedItemsAmount - totalPaymentAmount) > tolerance) {
        return {
          success: false,
          message: `El monto de los productos seleccionados (${calculatedItemsAmount.toFixed(
            2,
          )}) debe coincidir con el total a pagar (${totalPaymentAmount.toFixed(2)}).`,
        };
      }
    }

    // Actualizar la sesión de caja de la venta a la actual si es necesario
    if (sale.cash_register_session_id !== activeCashSession.id) {
      const { error: updateSessionError } = await supabase
        .from("sales")
        .update({ cash_register_session_id: activeCashSession.id })
        .eq("id", validated.sale_id);

      if (updateSessionError) throw updateSessionError;
    }

    const insertedTablePayments: Array<{ id: string | null }> = [];

    for (const payment of validated.payments) {
      const { data: newTablePayment, error: tablePaymentError } = await supabase
        .from("table_payments")
        .insert({
          sale_id: validated.sale_id,
          amount: payment.amount,
          payment_method_id: payment.payment_method_id,
        })
        .select()
        .single();

      if (tablePaymentError) throw tablePaymentError;
      insertedTablePayments.push({ id: newTablePayment?.id ?? null });

      const { error: salePaymentError } = await supabase
        .from("sale_payments")
        .insert({
          sale_id: validated.sale_id,
          amount: payment.amount,
          payment_method_id: payment.payment_method_id,
        });

      if (salePaymentError) throw salePaymentError;
    }

    if (itemPaymentRecords.length > 0) {
      const canLinkSinglePayment = insertedTablePayments.length === 1 && insertedTablePayments[0].id;
      const itemRows = itemPaymentRecords.map((itemRecord) => ({
        sale_id: validated.sale_id,
        sale_item_id: itemRecord.sale_item_id,
        table_payment_id: canLinkSinglePayment ? insertedTablePayments[0].id : null,
        quantity_paid: itemRecord.quantity,
        amount_paid: itemRecord.amount,
        created_by: user?.id ?? null,
      }));

      const { error: itemPaymentError } = await supabase.from("sale_item_payments").insert(itemRows);
      if (itemPaymentError) throw itemPaymentError;
    }

    // Revalidar páginas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error making partial payment:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al registrar pago parcial",
    };
  }
}

export async function getTableRemainingBalance(saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID: Prevenir errores de sintaxis si el ID es temporal (Optimistic UI)
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return {
        success: false,
        message: "Sincronizando mesa...",
        data: { remainingBalance: 0, paidAmount: 0 }
      };
    }

    const supabase = await createClient();

    // Obtener el total de la venta y sus items
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    const { data: saleItems, error: saleItemsError } = await supabase
      .from("sale_items")
      .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        sale_item_payments:sale_item_payments_sale_item_id_fkey(
          quantity_paid,
          amount_paid
        )
      `)
      .eq("sale_id", saleId);

    if (saleItemsError) throw saleItemsError;

    const { data: tablePayments, error: tablePaymentsError } = await supabase
      .from("table_payments")
      .select("id, amount")
      .eq("sale_id", saleId);

    if (tablePaymentsError) throw tablePaymentsError;

    let itemsTotal = 0;
    let paidFromItems = 0;
    let trackedAmount = 0;

    saleItems?.forEach((item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const subtotal = item.subtotal !== undefined && item.subtotal !== null ? Number(item.subtotal) : quantity * unitPrice;
      const paymentsForItem = Array.isArray(item.sale_item_payments) ? item.sale_item_payments : [];
      const paidQuantity = paymentsForItem.reduce((sum: number, payment: any) => sum + Number(payment.quantity_paid || 0), 0);
      const cappedPaidQuantity = Math.min(paidQuantity, quantity);
      const paidAmountForItem = cappedPaidQuantity * unitPrice;
      const trackedAmountForItem = paymentsForItem.reduce((sum: number, payment: any) => sum + Number(payment.amount_paid || 0), 0);

      itemsTotal += subtotal;
      paidFromItems += paidAmountForItem;
      trackedAmount += trackedAmountForItem;
    });

    const baseTotal = Number(sale.total_amount || 0);
    // ✅ Si hay items, SIEMPRE usar itemsTotal (fuente de verdad)
    // Solo usar baseTotal si NO hay items
    const hasItems = saleItems && saleItems.length > 0;
    const totalAmount = hasItems ? itemsTotal : baseTotal;
    const tablePaymentsTotal = tablePayments?.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0;
    const legacyPaid = Math.max(tablePaymentsTotal - trackedAmount, 0);
    const paidAmount = Math.min(totalAmount, paidFromItems + legacyPaid);
    const remainingBalance = Math.max(totalAmount - paidAmount, 0);

    return {
      success: true,
      data: {
        totalAmount,
        paidAmount,
        remainingBalance
      }
    };
  } catch (error: unknown) {
    console.error("Error getting table balance:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener saldo de mesa",
      data: {
        totalAmount: 0,
        paidAmount: 0,
        remainingBalance: 0
      }
    };
  }
}

export async function getTablePartialPayments(saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: true, data: [] };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("table_payments")
      .select(`
        id,
        amount,
        created_at,
        payment_method:payment_methods(id, name)
      `)
      .eq("sale_id", saleId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error: unknown) {
    console.error("Error getting table partial payments:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener pagos parciales",
      data: []
    };
  }
}


export async function splitTableByItems(data: z.infer<typeof tableSplitSchema>) {
  try {
    const validated = tableSplitSchema.parse(data);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No autenticado" };
    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) return { success: false, message: "No tenés permisos para esta acción" };

    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status")
      .eq("id", validated.sale_id)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "La venta no está pendiente",
      };
    }

    // Crear división
    const { error: splitError } = await supabase
      .from("table_splits")
      .insert({
        sale_id: validated.sale_id,
        split_name: validated.split_name,
        items: validated.items,
        total_amount: validated.total_amount,
        remaining_amount: validated.total_amount,
      });

    if (splitError) throw splitError;

    // Revalidar página
    revalidatePath("/caja-bar");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error splitting table by items:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al dividir mesa por items",
    };
  }
}

export async function addItemsToOpenTable(saleId: string, items: Array<{
  product_id: string;
  quantity: number;
  unit_price: number;
  customization?: string;
}>) {
  try {
    // ✅ VALIDACIÓN DE UUID: Prevenir errores de sintaxis si el ID es temporal (Optimistic UI)
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      console.warn('⚠️ [DEBUG BAR] Intento de agregar items con ID no válido o temporal:', saleId);
      return {
        success: false,
        message: "La mesa se está sincronizando, por favor reintenta en un instante.",
      };
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay una sesión de caja abierta en el área "bar"
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id, cash_register_id, area")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR. Por favor, abre la caja primero.",
      };
    }

    // Verificar que la venta existe y está pendiente
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status, total_amount, cash_register_session_id")
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "La venta no está pendiente",
      };
    }

    const productIds = items.map(i => i.product_id);
    const { data: productsInfo, error: productsError } = await supabase
      .from("products")
      .select("id, name, sale_price, stock, unlimited_stock, is_active")
      .in("id", productIds);

    if (productsError) {
      throw productsError;
    }

    const { normalizedItems, total: newItemsTotal } = normalizeItemsWithProductCatalog(
      items,
      productsInfo || []
    );

    const saleItems = normalizedItems.map(item => ({
      sale_id: saleId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      ...(item.customization ? { customization: item.customization } : {}),
    }));

    const { data: insertedSaleItems, error: itemsError } = await supabase
      .from("sale_items")
      .insert(saleItems)
      .select("id");

    if (itemsError) throw itemsError;

    const insertedIds = (insertedSaleItems || []).map((item: any) => item.id);
    let reservedStock: Array<{ product_id: string; quantity: number }> = [];

    try {
      reservedStock = await reserveValidatedStock(
        supabase,
        normalizedItems,
        productsInfo || []
      );

      const currentSaleTotal = Number(sale.total_amount || 0);
      const newTotal = normalizeCurrency(currentSaleTotal + newItemsTotal);

      const { error: updateError } = await supabase
        .from("sales")
        .update({
          total_amount: newTotal,
          total: newTotal,
          subtotal: newTotal,
          cash_register_session_id: activeCashSession.id,
        })
        .eq("id", saleId);

      if (updateError) throw updateError;
    } catch (error) {
      if (insertedIds.length > 0) {
        await supabase.from("sale_items").delete().in("id", insertedIds);
      }

      if (reservedStock.length > 0) {
        await restoreReservedStock(supabase, reservedStock);
      }

      throw error;
    }

    // Imprimir items agregados en cocina
    // Obtener número de mesa, tipo de venta y usuario
    const { data: saleWithTable } = await supabase
      .from("sales")
      .select("table_number, user_id, sale_type, customer_name, delivery_address")
      .eq("id", saleId)
      .single();

    if (saleWithTable?.table_number) {
      // ✅ FIX: La impresión de items agregados se hace desde el cliente (TableDetailsModal)
      // El servidor de Vercel NO puede acceder a localhost:3001 (está en la nube)
      // El cliente (navegador) SÍ puede acceder al PrintServer local via ThermalPrintTicket
      console.log('🖨️ [DEBUG] Items agregados a mesa - impresión delegada al cliente (evita duplicación)');
    }

    // Revalidar página
    revalidatePath("/caja-bar");

    return {
      success: true,
      data: {
        normalizedItems,
        newItemsTotal,
      },
    };
  } catch (error: unknown) {
    console.error("Error adding items to open table:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al agregar items a la mesa",
    };
  }
}

export async function reduceItemQuantity(saleItemId: string, saleId: string, quantityToRemove: number) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando..." };
    }

    const supabase = await createClient();

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay una sesión de caja abierta
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR",
      };
    }

    // Obtener el item actual
    const { data: item, error: itemError } = await supabase
      .from("sale_items")
      .select("id, product_id, quantity, unit_price, subtotal, sale_id")
      .eq("id", saleItemId)
      .eq("sale_id", saleId)
      .single();

    if (itemError || !item) {
      return { success: false, message: "Item no encontrado" };
    }

    // Verificar que la venta está pendiente
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status, total_amount")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.status !== "pending") {
      return { success: false, message: "Solo se pueden modificar items de ventas pendientes" };
    }

    // Verificar que no haya pagos parciales
    const { data: partialPayments } = await supabase
      .from("table_payments")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (partialPayments && partialPayments.length > 0) {
      return {
        success: false,
        message: "No se pueden modificar items de una mesa con pagos parciales",
      };
    }

    const newQuantity = item.quantity - quantityToRemove;

    const stockToRestore = Math.min(quantityToRemove, item.quantity);

    if (newQuantity <= 0) {
      // Si la cantidad llega a 0 o menos, eliminar el item completamente
      const { error: deleteError } = await supabase
        .from("sale_items")
        .delete()
        .eq("id", saleItemId);

      if (deleteError) throw deleteError;

      // Actualizar el total de la venta
      const newTotal = sale.total_amount - item.subtotal;
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          total_amount: Math.max(0, newTotal),
          total: Math.max(0, newTotal),
          subtotal: Math.max(0, newTotal),
          cash_register_session_id: activeCashSession.id
        })
        .eq("id", saleId);

      if (updateError) throw updateError;
    } else {
      // Reducir la cantidad y actualizar el subtotal
      const newSubtotal = newQuantity * item.unit_price;
      const amountToSubtract = item.subtotal - newSubtotal;

      const { error: updateItemError } = await supabase
        .from("sale_items")
        .update({
          quantity: newQuantity,
          subtotal: newSubtotal,
        })
        .eq("id", saleItemId);

      if (updateItemError) throw updateItemError;

      // Actualizar el total de la venta
      const newTotal = sale.total_amount - amountToSubtract;
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          total_amount: Math.max(0, newTotal),
          total: Math.max(0, newTotal),
          subtotal: Math.max(0, newTotal),
          cash_register_session_id: activeCashSession.id
        })
        .eq("id", saleId);

      if (updateError) throw updateError;
    }

    await restoreReservedStock(supabase, [
      {
        product_id: item.product_id,
        quantity: stockToRestore,
      },
    ]);

    // Revalidar páginas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");
    revalidateTag("tables");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error reducing item quantity:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al reducir cantidad del artículo",
    };
  }
}

export async function removeItemFromTable(saleItemId: string, saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando..." };
    }

    console.log("🔍 DEBUG removeItemFromTable - Iniciando...", { saleItemId, saleId });
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("🔍 DEBUG removeItemFromTable - Usuario autenticado:", user?.id);

    if (!user) {
      console.log("❌ DEBUG removeItemFromTable - No hay usuario autenticado");
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    console.log("🔍 DEBUG removeItemFromTable - Usando flujo server-side endurecido");
    return await removeItemFromTableFallback(supabase, saleItemId, saleId, user.id);
  } catch (error: unknown) {
    console.error("❌ ERROR removeItemFromTable - Error en validación o autenticación:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al eliminar artículo",
    };
  }
}

async function removeItemFromTableFallback(
  supabase: SupabaseServerClient,
  saleItemId: string,
  saleId: string,
  userId: string
) {
  try {
    console.log("🔁 DEBUG removeItemFromTableFallback - Ejecutando eliminación directa");

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (!userData || userData.role !== "admin") {
      console.log("❌ DEBUG removeItemFromTableFallback - Usuario sin permisos:", userData?.role);
      return {
        success: false,
        message: "Solo los administradores pueden eliminar artículos de las mesas",
      };
    }

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status, total_amount")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      console.log("❌ DEBUG removeItemFromTableFallback - Venta no encontrada");
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "Solo se pueden eliminar items de mesas pendientes",
      };
    }

    const { data: partialPayments } = await supabase
      .from("table_payments")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (partialPayments && partialPayments.length > 0) {
      return {
        success: false,
        message: "No se pueden eliminar artículos de una mesa con pagos parciales",
      };
    }

    const { data: itemToDelete, error: itemError } = await supabase
      .from("sale_items")
      .select("product_id, quantity, subtotal")
      .eq("id", saleItemId)
      .eq("sale_id", saleId)
      .single();

    if (itemError || !itemToDelete) {
      return {
        success: false,
        message: "Artículo no encontrado",
      };
    }

    const { error: deleteError } = await supabase
      .from("sale_items")
      .delete()
      .eq("id", saleItemId)
      .eq("sale_id", saleId);

    if (deleteError) throw deleteError;

    const saleTotal = Number(sale.total_amount) || 0;
    const itemSubtotal = Number(itemToDelete.subtotal) || 0;
    const newTotal = Math.max(0, saleTotal - itemSubtotal);
    const { error: updateError } = await supabase
      .from("sales")
      .update({
        total_amount: newTotal,
        total: newTotal,
        subtotal: newTotal,
      })
      .eq("id", saleId);

    if (updateError) throw updateError;

    await restoreReservedStock(supabase, [
      {
        product_id: itemToDelete.product_id,
        quantity: Number(itemToDelete.quantity || 0),
      },
    ]);

    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");
    revalidateTag("tables");

    console.log("✅ DEBUG removeItemFromTableFallback - Item eliminado exitosamente (fallback)");
    return { success: true };
  } catch (error: unknown) {
    console.error("❌ ERROR removeItemFromTableFallback:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al eliminar artículo",
    };
  }
}

export async function cancelTable(saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando..." };
    }

    const supabase = await createClient();

    // Obtener usuario actual y verificar que es admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar que el usuario es administrador
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo los administradores pueden cancelar mesas",
      };
    }

    // Verificar que la venta existe y está pendiente
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        id,
        status,
        sale_items (
          product_id,
          quantity
        )
      `)
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "Solo se pueden cancelar mesas pendientes",
      };
    }

    // Verificar si hay pagos parciales
    const { data: partialPayments } = await supabase
      .from("table_payments")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (partialPayments && partialPayments.length > 0) {
      return {
        success: false,
        message: "No se puede cancelar una mesa con pagos parciales. Cancela los pagos primero.",
      };
    }

    const reservedItems = (sale.sale_items || []).map((item: any) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity || 0),
    }));

    // Cambiar el status de la venta a "cancelled"
    const { error: updateError } = await supabase
      .from("sales")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleId);

    if (updateError) throw updateError;

    await restoreReservedStock(supabase, reservedItems);

    // Revalidar páginas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling table:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al cancelar mesa",
    };
  }
}

export async function closeTable(saleId: string, paymentItems: Array<{ paymentMethodId: string; amount: number }>, discountAmount: number = 0, surchargeAmount: number = 0) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando... por favor reintenta en un instante." };
    }

    console.log("🔍 DEBUG closeTable - Iniciando...", { saleId, paymentItems });
    const supabase = await createClient();

    // Obtener usuario actual
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("🔍 DEBUG closeTable - Usuario:", user?.id);

    if (!user) {
      console.log("❌ DEBUG closeTable - No hay usuario autenticado");
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.close");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay una sesión de caja abierta en el área "bar"
    console.log("🔍 DEBUG closeTable - Buscando sesión de caja abierta en área bar...");
    const { data: activeCashSession, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select("id, cash_register_id, area")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    console.log("🔍 DEBUG closeTable - Sesión encontrada:", activeCashSession);
    console.log("🔍 DEBUG closeTable - Error sesión:", sessionError);

    if (!activeCashSession) {
      console.log("❌ DEBUG closeTable - No hay sesión de caja abierta");
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR. Por favor, abre la caja primero.",
      };
    }

    // Verificar que la venta existe
    console.log("🔍 DEBUG closeTable - Buscando venta...");
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, total_amount, status, table_number, cash_register_session_id")
      .eq("id", saleId)
      .single();

    console.log("🔍 DEBUG closeTable - Venta encontrada:", sale);
    console.log("🔍 DEBUG closeTable - Error venta:", saleError);

    if (saleError) throw saleError;

    if (!sale) {
      console.log("❌ DEBUG closeTable - Venta no encontrada");
      return {
        success: false,
        message: "Venta no encontrada",
      };
    }

    if (sale.status !== "pending") {
      console.log("❌ DEBUG closeTable - La venta no está pendiente:", sale.status);
      return {
        success: false,
        message: "La venta no está pendiente",
      };
    }

    // Obtener el saldo restante de la mesa (considerando pagos parciales)
    console.log("🔍 DEBUG closeTable - Obteniendo saldo restante...");
    const balanceResult = await getTableRemainingBalance(saleId);
    let remainingBalance = sale.total_amount || 0;

    if (balanceResult.success && balanceResult.data) {
      remainingBalance = balanceResult.data.remainingBalance;
      console.log("🔍 DEBUG closeTable - Saldo restante obtenido:", remainingBalance);
    } else {
      // Calcular manualmente si la función RPC falla
      console.log("🔍 DEBUG closeTable - Función RPC falló, calculando manualmente...");
      const { data: payments, error: paymentsError } = await supabase
        .from("table_payments")
        .select("amount")
        .eq("sale_id", saleId);

      if (!paymentsError && payments) {
        const totalPaid = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
        remainingBalance = sale.total_amount - totalPaid;
        console.log("🔍 DEBUG closeTable - Saldo calculado manualmente:", remainingBalance, "Total:", sale.total_amount, "Pagado:", totalPaid);
      }
    }

    console.log("🔍 DEBUG closeTable - Saldo restante:", remainingBalance, "tipo:", typeof remainingBalance);

    // Aplicar ajuste global (% convertido a monto en el frontend)
    // Descuento resta (clamp del saldo a >= 0); recargo suma
    const safeDiscount = Math.max(0, discountAmount || 0);
    const safeSurcharge = Math.max(0, surchargeAmount || 0);
    const effectiveBalance = Math.max(0, remainingBalance - safeDiscount) + safeSurcharge;
    console.log("🔍 DEBUG closeTable - Descuento:", safeDiscount, "Recargo:", safeSurcharge, "Saldo efectivo a cobrar:", effectiveBalance);

    // Si el saldo efectivo es 0 o muy cercano a 0 (tolerancia para decimales)
    const isFullyPaid = Math.abs(effectiveBalance) < 0.01;
    console.log("🔍 DEBUG closeTable - isFullyPaid:", isFullyPaid);
    console.log("🔍 DEBUG closeTable - paymentItems.length:", paymentItems.length);

    // Si el saldo ya está pagado completamente, consolidar pagos sin duplicados y cerrar
    if (isFullyPaid) {
      console.log("✅ DEBUG closeTable - Saldo ya pagado completamente, consolidando pagos sin duplicados");

      await migrateMissingTablePaymentsToSalePayments(supabase, saleId);

      // Si hay pagos adicionales cuando el saldo ya está pagado, ignorarlos (no validar ni insertar)
      if (paymentItems.length > 0) {
        console.log("⚠️  DEBUG closeTable - Se intentaron agregar pagos adicionales pero el saldo ya está pagado. Ignorando pagos adicionales.");
      }
    }
    // Si hay saldo pendiente Y hay pagos adicionales, validarlos e insertarlos
    else if (paymentItems.length > 0) {
      // Validar que la suma de pagos sea igual al saldo efectivo (saldo restante - descuento)
      const totalPaymentAmount = paymentItems.reduce((sum, item) => sum + item.amount, 0);
      console.log("🔍 DEBUG closeTable - Total de pagos del cierre:", totalPaymentAmount, "Saldo efectivo:", effectiveBalance);

      // Usar tolerancia de 0.01 para comparación de montos
      const difference = Math.abs(totalPaymentAmount - effectiveBalance);
      console.log("🔍 DEBUG closeTable - Diferencia:", difference);

      // Permitir sobrepago (vuelto) - solo validar que el pago sea suficiente
      if (totalPaymentAmount < effectiveBalance - 0.01) {
        console.log("❌ DEBUG closeTable - El pago es insuficiente");
        return {
          success: false,
          message: `El monto pagado ($${totalPaymentAmount.toFixed(2)}) debe ser al menos igual al saldo a cobrar ($${effectiveBalance.toFixed(2)})`,
        };
      }

      // Registrar pagos de cierre en table_payments primero para que el flujo sea reintentable
      console.log("🔍 DEBUG closeTable - Registrando pagos de cierre en table_payments...");
      const paymentsToInsert = paymentItems.map(item => ({
        sale_id: saleId,
        amount: item.amount,
        payment_method_id: item.paymentMethodId,
      }));

      console.log("🔍 DEBUG closeTable - Pagos a insertar:", paymentsToInsert);

      const { data: insertedPayments, error: paymentError } = await supabase
        .from("table_payments")
        .insert(paymentsToInsert)
        .select();

      console.log("🔍 DEBUG closeTable - Pagos insertados:", insertedPayments);
      console.log("🔍 DEBUG closeTable - Error al insertar pagos:", paymentError);

      if (paymentError) {
        console.error("❌ ERROR CRÍTICO insertando pagos:", paymentError);
        throw paymentError;
      }

      await migrateMissingTablePaymentsToSalePayments(supabase, saleId);
    }
    // Si el saldo no está pagado y no hay pagos, es un error
    else if (!isFullyPaid && paymentItems.length === 0) {
      console.log("❌ DEBUG closeTable - Saldo pendiente pero no hay pagos");
      return {
        success: false,
        message: `La mesa tiene un saldo pendiente de $${effectiveBalance.toFixed(2)}. Debe proporcionar al menos un método de pago.`,
      };
    }

    // Actualizar venta como completada Y ACTUALIZAR LA SESIÓN DE CAJA a la sesión actual
    console.log("🔍 DEBUG closeTable - Actualizando venta...");
    console.log("🔍 DEBUG closeTable - Sesión antigua:", sale.cash_register_session_id);
    console.log("🔍 DEBUG closeTable - Sesión nueva:", activeCashSession.id);
    console.log("🔍 DEBUG closeTable - ID de venta a actualizar:", saleId);
    console.log("🔍 DEBUG closeTable - Status actual:", sale.status);

    // Intentar actualizar usando el nombre de columna correcto
    let updateData: any = {
      status: "completed",
      cash_register_session_id: activeCashSession.id,
      discount: safeDiscount,
      surcharge: safeSurcharge,
      // El ajuste es global: descuento resta y recargo suma sobre el total original de la venta (no por ítem)
      total_amount: Math.max(0, (sale.total_amount || 0) - safeDiscount) + safeSurcharge,
    };

    console.log("🔍 DEBUG closeTable - Datos de actualización:", updateData);

    const { data: updatedSale, error: updateError, status: updateStatus, statusText: updateStatusText } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", saleId)
      .select();

    console.log("🔍 DEBUG closeTable - Venta actualizada:", updatedSale);
    console.log("🔍 DEBUG closeTable - Error al actualizar venta:", updateError);
    console.log("🔍 DEBUG closeTable - Status del update:", updateStatus);
    console.log("🔍 DEBUG closeTable - Status text del update:", updateStatusText);

    if (updateError) {
      console.error("❌ ERROR CRÍTICO al actualizar venta:", {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      throw updateError;
    }

    if (!updatedSale || updatedSale.length === 0) {
      console.error("❌ ERROR: El UPDATE no devolvió datos. Posible problema de permisos RLS");
      throw new Error("No se pudo actualizar la venta. Verifica los permisos de la base de datos.");
    }

    // Revalidar páginas
    console.log("🔍 DEBUG closeTable - Revalidando rutas...");
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    console.log("✅ DEBUG closeTable - Mesa cerrada exitosamente");
    return { success: true };
  } catch (error: unknown) {
    console.error("❌ ERROR closeTable:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al cerrar mesa",
    };
  }
}

// ============================================================================
// FUNCIONALIDADES AVANZADAS DE MESAS
// ============================================================================

/**
 * Cambiar mesa - Mueve una venta de una mesa a otra
 * Mantiene todos los productos y pagos parciales
 */
export async function changeTable(saleId: string, newTableNumber: number, reason?: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando..." };
    }

    const supabase = await createClient();

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.move");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay sesión abierta
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR",
      };
    }

    // Obtener venta actual
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, table_number, status")
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "Solo se pueden cambiar mesas pendientes",
      };
    }

    if (sale.table_number === newTableNumber) {
      return {
        success: false,
        message: `La venta ya está en la mesa ${newTableNumber}`,
      };
    }

    const tableExists = await ensureActiveTableExists(supabase, newTableNumber);
    if (!tableExists) {
      return {
        success: false,
        message: `La mesa ${newTableNumber} no existe o está deshabilitada en el mapa del bar`,
      };
    }

    // Verificar que la nueva mesa esté libre
    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("table_number", newTableNumber)
      .eq("status", "pending")
      .maybeSingle();

    if (existingSale) {
      return {
        success: false,
        message: `La mesa ${newTableNumber} ya está ocupada`,
      };
    }

    // Guardar cambio en historial (auditoría)
    const { error: historyError } = await supabase
      .from("table_changes")
      .insert({
        sale_id: saleId,
        old_table_number: sale.table_number,
        new_table_number: newTableNumber,
        changed_by: user.id,
        reason: reason || "Cambio solicitado por usuario",
      });

    if (historyError) throw historyError;

    // Actualizar número de mesa
    const { error: updateError } = await supabase
      .from("sales")
      .update({ table_number: newTableNumber })
      .eq("id", saleId);

    if (updateError) throw updateError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Mesa cambiada de ${sale.table_number} a ${newTableNumber} exitosamente`,
    };
  } catch (error: unknown) {
    console.error("❌ ERROR changeTable:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al cambiar mesa",
    };
  }
}

/**
 * Fusionar mesas - Combina los productos y totales de dos mesas ocupadas
 * Mueve todos los sale_items de la venta origen a la venta destino
 * Mantiene los pagos parciales de ambas mesas
 */
export async function mergeTables(sourceSaleId: string, targetSaleId: string, reason?: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!sourceSaleId || sourceSaleId.startsWith('temp-') || sourceSaleId.length < 36 ||
      !targetSaleId || targetSaleId.startsWith('temp-') || targetSaleId.length < 36) {
      return { success: false, message: "Una de las mesas se está sincronizando..." };
    }

    const supabase = await createClient();

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.move");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay sesión abierta
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR",
      };
    }

    // Obtener ambas ventas con sus items y pagos
    const { data: sourceSale, error: sourceError } = await supabase
      .from("sales")
      .select(`
        id,
        table_number,
        status,
        total_amount,
        sale_items(*),
        sale_payments(*)
      `)
      .eq("id", sourceSaleId)
      .single();

    if (sourceError) throw sourceError;

    const { data: targetSale, error: targetError } = await supabase
      .from("sales")
      .select(`
        id,
        table_number,
        status,
        total_amount,
        sale_items(*),
        sale_payments(*)
      `)
      .eq("id", targetSaleId)
      .single();

    if (targetError) throw targetError;

    if (!sourceSale || !targetSale) {
      return { success: false, message: "Una o ambas ventas no encontradas" };
    }

    // Validar que ambas ventas estén pendientes
    if (sourceSale.status !== "pending" || targetSale.status !== "pending") {
      return {
        success: false,
        message: "Solo se pueden fusionar mesas pendientes",
      };
    }

    // Validar que no sean la misma venta
    if (sourceSale.id === targetSale.id) {
      return {
        success: false,
        message: "No se puede fusionar una mesa consigo misma",
      };
    }

    // Obtener items de la venta origen
    const sourceItems = sourceSale.sale_items || [];

    // Mover todos los items de la venta origen a la venta destino
    if (sourceItems.length > 0) {
      const { error: updateItemsError } = await supabase
        .from("sale_items")
        .update({ sale_id: targetSale.id })
        .eq("sale_id", sourceSale.id);

      if (updateItemsError) throw updateItemsError;
    }

    // Calcular el nuevo total: sumar totales de ambas ventas
    const newTotal = (sourceSale.total_amount || 0) + (targetSale.total_amount || 0);

    // Actualizar el total de la venta destino
    const { error: updateTargetError } = await supabase
      .from("sales")
      .update({
        total_amount: newTotal,
      })
      .eq("id", targetSale.id);

    if (updateTargetError) throw updateTargetError;

    // Registrar el cambio en historial de auditoría
    const { error: historyError } = await supabase
      .from("table_changes")
      .insert({
        sale_id: sourceSale.id,
        old_table_number: sourceSale.table_number,
        new_table_number: targetSale.table_number,
        changed_by: user.id,
        reason: reason || `Fusión con mesa ${targetSale.table_number}`,
      });

    if (historyError) {
      console.warn("Error al registrar historial de fusión:", historyError);
      // No fallar si esto falla, solo loguear
    }

    // Cancelar la venta origen (ya que sus items fueron movidos)
    const { error: cancelError } = await supabase
      .from("sales")
      .update({
        status: "cancelled",
      })
      .eq("id", sourceSale.id);

    if (cancelError) throw cancelError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Mesas fusionadas exitosamente. Mesa ${sourceSale.table_number} → Mesa ${targetSale.table_number}`,
    };
  } catch (error: unknown) {
    console.error("❌ ERROR mergeTables:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al fusionar mesas",
    };
  }
}

/**
 * Unir mesas - Crea un grupo de mesas con una sola cuenta
 * Útil para grupos grandes que necesitan varias mesas
 */
export async function joinTables(primaryTableNumber: number, additionalTables: number[]) {
  try {
    const supabase = await createClient();

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que hay sesión abierta
    const { data: activeCashSession } = await supabase
      .from("cash_register_sessions")
      .select("id")
      .eq("area", "bar")
      .is("closed_at", null)
      .maybeSingle();

    if (!activeCashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta en el área BAR",
      };
    }

    // Validar que se seleccionaron mesas adicionales
    if (!additionalTables || additionalTables.length === 0) {
      return {
        success: false,
        message: "Debes seleccionar al menos una mesa adicional para unir",
      };
    }

    // Todas las mesas del grupo
    const allTables = [primaryTableNumber, ...additionalTables];

    // Verificar que todas las mesas estén libres
    const { data: occupiedTables } = await supabase
      .from("sales")
      .select("table_number")
      .eq("status", "pending")
      .in("table_number", allTables);

    if (occupiedTables && occupiedTables.length > 0) {
      const occupied = occupiedTables.map(t => t.table_number).join(", ");
      return {
        success: false,
        message: `Las siguientes mesas ya están ocupadas: ${occupied}`,
      };
    }

    // Crear venta con el grupo de mesas
    const { data: newSale, error: saleError } = await supabase
      .from("sales")
      .insert({
        sale_number: `GRUPO-${primaryTableNumber}-${Date.now()}`,
        cash_register_session_id: activeCashSession.id,
        user_id: user.id,
        table_number: primaryTableNumber,
        grouped_tables: allTables,
        is_table_group: true,
        total_amount: 0,
        status: "pending",
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: newSale,
      message: `Mesas ${allTables.join("-")} unidas exitosamente`,
    };
  } catch (error: unknown) {
    console.error("❌ ERROR joinTables:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al unir mesas",
    };
  }
}

/**
 * Dividir cuenta - Separa una venta en múltiples partes
 * Útil para cuando cada comensal paga por separado
 */
export async function splitTableAccount(
  saleId: string,
  divisions: Array<{
    name: string;
    items: Array<{ sale_item_id: string; quantity: number }>;
  }>
) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "La mesa se está sincronizando..." };
    }

    const supabase = await createClient();

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "tables.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Obtener venta actual
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        id,
        table_number,
        status,
        cash_register_session_id,
        sale_items (
          id,
          product_id,
          quantity,
          unit_price,
          subtotal
        )
      `)
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.status !== "pending") {
      return {
        success: false,
        message: "Solo se pueden dividir cuentas pendientes",
      };
    }

    // IMPORTANTE: Verificar que NO haya pagos parciales
    // Si hay pagos parciales, no se puede dividir porque se perdería dinero en el arqueo
    const { data: partialPayments } = await supabase
      .from("sale_payments")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (partialPayments && partialPayments.length > 0) {
      return {
        success: false,
        message: "No se puede dividir una cuenta con pagos parciales. Completa el pago total primero o cancela los pagos parciales.",
      };
    }

    // Validar que se proporcionaron divisiones
    if (!divisions || divisions.length < 2) {
      return {
        success: false,
        message: "Debes crear al menos 2 divisiones",
      };
    }

    // Crear ventas separadas para cada división
    const createdSales = [];

    for (let i = 0; i < divisions.length; i++) {
      const division = divisions[i];

      // Calcular total de esta división
      let divisionTotal = 0;
      const divisionItems: any[] = [];

      division.items.forEach(({ sale_item_id, quantity }) => {
        const originalItem = sale.sale_items.find((item: any) => item.id === sale_item_id);
        if (originalItem) {
          const subtotal = originalItem.unit_price * quantity;
          divisionTotal += subtotal;
          divisionItems.push({
            product_id: originalItem.product_id,
            quantity,
            unit_price: originalItem.unit_price,
            subtotal,
          });
        }
      });

      // Crear nueva venta para esta división
      const { data: newSale, error: newSaleError } = await supabase
        .from("sales")
        .insert({
          sale_number: `DIV-${sale.table_number}-${String.fromCharCode(65 + i)}-${Date.now()}`,
          cash_register_session_id: sale.cash_register_session_id,
          user_id: user.id,
          table_number: sale.table_number, // Mismo número de mesa
          total_amount: divisionTotal,
          status: "pending",
        })
        .select()
        .single();

      if (newSaleError) throw newSaleError;

      // Agregar items a la nueva venta
      const itemsToInsert = divisionItems.map(item => ({
        ...item,
        sale_id: newSale.id,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      createdSales.push(newSale);
    }

    // Marcar venta original como cancelada (ya fue dividida)
    const { error: cancelError } = await supabase
      .from("sales")
      .update({ status: "cancelled" })
      .eq("id", saleId);

    if (cancelError) throw cancelError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: createdSales,
      message: `Cuenta dividida en ${divisions.length} partes exitosamente`,
    };
  } catch (error: unknown) {
    console.error("❌ ERROR splitTableAccount:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al dividir cuenta",
    };
  }
}

/**
 * Obtener mesas ocupadas
 * Devuelve array de números de mesa que tienen ventas pendientes
 */
export async function markAccountAsPrinted(saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "Sincronizando..." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar que la venta existe y está pendiente
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status")
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    // Actualizar el campo account_printed_at
    const { error: updateError } = await supabase
      .from("sales")
      .update({ account_printed_at: new Date().toISOString() })
      .eq("id", saleId);

    if (updateError) {
      if (!isMissingColumnError(updateError, "account_printed_at")) {
        throw updateError;
      }
      console.warn("account_printed_at no existe en esta base. Se omite la actualización.");
    }

    // Revalidar páginas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error marking account as printed:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al marcar cuenta como impresa",
    };
  }
}

/**
 * Limpiar el campo account_printed_at (volver mesa a rojo sin imprimir)
 */
export async function clearAccountPrinted(saleId: string) {
  try {
    // ✅ VALIDACIÓN DE UUID
    if (!saleId || saleId.startsWith('temp-') || saleId.length < 36) {
      return { success: false, message: "Sincronizando..." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status")
      .eq("id", saleId)
      .single();

    if (saleError) throw saleError;

    if (!sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    // Limpiar el campo account_printed_at (poner null)
    const { error: updateError } = await supabase
      .from("sales")
      .update({ account_printed_at: null })
      .eq("id", saleId);

    if (updateError) {
      if (!isMissingColumnError(updateError, "account_printed_at")) {
        throw updateError;
      }
      console.warn("account_printed_at no existe en esta base. Se omite la actualización.");
    }

    // Revalidar páginas
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error clearing account printed:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al limpiar cuenta impresa",
    };
  }
}

export async function getOccupiedTables(): Promise<{ success: boolean; data?: number[]; message?: string }> {
  try {
    const supabase = await createClient();

    // Obtener usuario actual para verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Obtener todas las ventas pendientes con números de mesa
    const { data: pendingSales, error } = await supabase
      .from("sales")
      .select("table_number")
      .eq("status", "pending")
      .not("table_number", "is", null);

    if (error) {
      console.error("❌ ERROR getOccupiedTables:", error);
      return { success: false, message: "Error al obtener mesas ocupadas" };
    }

    // Extraer números de mesa únicos
    const occupiedTableNumbers = [...new Set(
      pendingSales?.map(sale => sale.table_number).filter(Boolean) || []
    )];

    return {
      success: true,
      data: occupiedTableNumbers,
    };
  } catch (error: unknown) {
    console.error("❌ ERROR getOccupiedTables:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener mesas ocupadas",
    };
  }
}
