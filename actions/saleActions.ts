"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { saleSchema, type SaleInput } from "@/lib/validations";
import { getKitchenPrinterConfig, getPrinterConfig } from "./configActions";
import type { KitchenPrintData } from "@/lib/kitchenPrinter";
import { PrintService } from "@/lib/printService";
import { checkUserPermission } from "./permissionActions";
import { getErrorMessage } from "@/lib/types";
import { normalizeItemsWithProductCatalog } from "@/lib/tableSaleGuards";


export interface Sale {
  id: string;
  sale_number: string;
  cash_register_session_id: string;
  user_id: string;
  waiter_id?: string | null;
  total_amount: number;
  status: "completed" | "pending" | "cancelled";
  sale_type?: "table" | "counter" | "delivery";
  table_number?: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
  };
  waiter?: {
    full_name: string;
  };
  sale_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    customization?: string | null;
    product?: {
      name: string;
    };
  }>;
  sale_payments?: Array<{
    id: string;
    payment_method_id: string;
    amount: number;
    payment_method?: {
      name: string;
    };
  }>;
}

interface MarkKitchenReadyInput {
  saleId: string;
}

export async function getSaleKitchenItems(saleId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        sale_type,
        table_number,
        customer_name,
        delivery_address,
        sale_items (
          quantity,
          customization,
          product:products!sale_items_product_id_fkey(name, cocina_only)
        )
      `)
      .eq("id", saleId)
      .single();

    if (error) throw error;

    const kitchenItems =
      data.sale_items
        ?.filter((item: any) => item.product?.cocina_only)
        .map((item: any) => ({
          quantity: item.quantity,
          name: item.product?.name || "Producto",
          customization: item.customization || undefined,
        })) || [];

    return {
      success: true,
      data: {
        saleNumber: data.sale_number,
        saleType: data.sale_type,
        tableNumber: data.table_number,
        customerName: data.customer_name,
        deliveryAddress: data.delivery_address,
        items: kitchenItems,
      },
    };
  } catch (error: unknown) {
    console.error("❌ Error getSaleKitchenItems:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "No se pudo obtener los productos de cocina",
      data: null,
    };
  }
}

function generateTransactionCode(prefix: string): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Obtiene el siguiente número de ticket secuencial desde la base de datos
 * Formato: 0000000001, 0000000002, etc.
 * Usa una función SQL atómica para evitar duplicados en concurrencia
 */
async function getNextTicketNumber(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_next_ticket_number');

    if (error) {
      console.warn('⚠️ Error al obtener número de ticket secuencial, usando fallback:', error.message);
      // Fallback al método anterior si falla
      return generateTransactionCode('SALE');
    }

    return data || generateTransactionCode('SALE');
  } catch (err) {
    console.warn('⚠️ Error inesperado en getNextTicketNumber, usando fallback:', err);
    return generateTransactionCode('SALE');
  }
}

/**
 * Enviar pedido a impresora de cocina
 * No bloquea la venta si falla la impresión
 */
export async function printToKitchenHelper(params: {
  saleId: string;
  tableNumber?: number | null;
  items: Array<{ product_id: string; quantity: number; customization?: string }>;
  userId: string;
  orderType: 'new' | 'add';
  saleType?: 'table' | 'counter' | 'delivery';
  customerName?: string;
  deliveryAddress?: string;
}) {
  try {
    // DEBUG: Log completo en producción para rastrear el flujo
    console.log('🖨️ [DEBUG PRODUCCIÓN] printToKitchenHelper llamado:', {
      saleId: params.saleId,
      saleType: params.saleType,
      orderType: params.orderType,
      itemsCount: params.items.length,
      tableNumber: params.tableNumber,
      customerName: params.customerName,
      deliveryAddress: params.deliveryAddress,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });

    // IMPORTANTE: Counter y delivery NO deben imprimir desde el servidor de Vercel (Server Actions)
    // El servidor de Vercel NO puede acceder a localhost:3001 porque está en la nube
    // La impresión se hace desde el cliente (navegador) que está en la PC local y SÍ puede acceder a localhost:3001
    // El servidor local (localhost:3001) es el servidor Node.js en tu PC que SÍ puede imprimir
    // Solo las mesas (table) imprimen desde el servidor de Vercel (porque funciona correctamente)
    const isCounterOrDelivery = params.saleType === 'counter' || params.saleType === 'delivery';

    if (isCounterOrDelivery) {
      console.log(`🖨️ [DEBUG PRODUCCIÓN] [${params.saleType?.toUpperCase()}] Impresión cancelada desde servidor de Vercel`);
      console.log(`🖨️ [DEBUG PRODUCCIÓN] Razón: El servidor de Vercel NO puede acceder a localhost:3001 (está en la nube)`);
      console.log(`🖨️ [DEBUG PRODUCCIÓN] La impresión se hará desde el cliente (navegador) → localhost:3001 → impresora`);
      return;
    }

    // Verificar si la impresión está habilitada (solo para mesas)
    const configResult = await getPrinterConfig();

    // Si la configuración falla o está deshabilitada, no imprimir
    if (!configResult.success) {
      console.warn("🖨️ Error al obtener configuración de impresora");
      return;
    }

    if (configResult.data && !configResult.data!.kitchen.enabled) {
      console.warn("🖨️ Impresión de cocina deshabilitada");
      return;
    }

    const config = configResult.success && configResult.data ? configResult.data.kitchen : { enabled: true, printOnOpenTable: true, printOnAddItems: true };

    // Verificar si debe imprimir según el tipo de operación (solo para mesas)
    const shouldPrintOnOpen =
      config.printOnOpenTable ?? config.printOnAddItems ?? true;
    if (params.orderType === 'new' && !shouldPrintOnOpen) {
      console.warn("🖨️ Impresión en apertura de mesa deshabilitada (fallback a printOnAddItems)");
      return;
    }

    if (params.orderType === 'add' && !config.printOnAddItems) {
      console.warn("🖨️ Impresión al agregar items deshabilitada");
      return;
    }

    // Obtener información del usuario (mozo)
    const supabase = await createClient();
    const { data: userData } = await supabase
      .from("users")
      .select("name")
      .eq("id", params.userId)
      .single();

    // ✅ Obtener siempre sale_type y table_number de la venta si no vienen en params
    const { data: saleData } = await supabase
      .from("sales")
      .select("sale_type, table_number, customer_name, delivery_address")
      .eq("id", params.saleId)
      .maybeSingle();

    // Resolver valores: priorizar params, luego BD, luego defaults
    const resolvedSaleType: 'table' | 'counter' | 'delivery' =
      (params.saleType as 'table' | 'counter' | 'delivery') ||
      (saleData?.sale_type as 'table' | 'counter' | 'delivery') ||
      'table';

    const resolvedTableNumber =
      params.tableNumber ??
      saleData?.table_number ??
      null;

    const resolvedCustomerName =
      params.customerName ??
      saleData?.customer_name ??
      undefined;

    const resolvedDeliveryAddress =
      params.deliveryAddress ??
      saleData?.delivery_address ??
      undefined;

    // Obtener información completa de productos (incluyendo cocina_only)
    const productIds = params.items.map(item => item.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, cocina_only")
      .in("id", productIds);

    if (!products) {
      console.error("🖨️ No se pudieron obtener los productos");
      return;
    }

    // Filtrar solo productos de cocina (cocina_only) para imprimir
    const kitchenItems = params.items.filter(item => {
      const product = products.find(p => p.id === item.product_id);
      return product?.cocina_only === true;
    });

    // Si no hay productos de cocina, no imprimir
    if (kitchenItems.length === 0) {
      console.warn("⚠️ No hay productos de cocina en este pedido, no se imprime");
      return;
    }

    // Preparar datos para impresión
    const printData: KitchenPrintData = {
      tableNumber: resolvedTableNumber,
      items: kitchenItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          name: product?.name || "Producto desconocido",
          quantity: item.quantity,
          customization: item.customization
        };
      }),
      waiterName: userData?.name || undefined,
      timestamp: new Date().toISOString(),
      orderType: params.orderType,
      saleType: resolvedSaleType,
      customerName: resolvedCustomerName,
      deliveryAddress: resolvedDeliveryAddress,
    };

    // Generar ticket de cocina y enviarlo al servidor de impresión
    try {
      const { generateKitchenTicket, generateKitchenTicketHTML } = await import("@/lib/kitchenPrinter");
      const configResultForPrint = await getPrinterConfig();

      // Para mesas (table), respetar la configuración
      const shouldPrint = configResultForPrint.success && configResultForPrint.data && configResultForPrint.data.kitchen.enabled;

      if (shouldPrint) {
        // Usar configuración de ancho
        const width = configResultForPrint.success && configResultForPrint.data
          ? configResultForPrint.data.kitchen.width
          : 48; // Ancho por defecto

        const ticketContent = generateKitchenTicket(printData, width);
        const ticketHTML = generateKitchenTicketHTML(printData);

        // ENVIAR AL SERVIDOR DE IMPRESIÓN LOCAL (solo para mesas)
        try {
          // Obtener el nombre de la impresora (prioriza nombre UNC/local sobre IP)
          const { getKitchenPrinterString } = await import('@/actions/configActions');
          const printerStringResult = await getKitchenPrinterString();

          let printerName: string | undefined;
          if (printerStringResult.success) {
            printerName = printerStringResult.data;
          } else if (configResultForPrint.success && configResultForPrint.data) {
            printerName = configResultForPrint.data.kitchen.ip;
          }

          await PrintService.printTicket(ticketContent, printerName, 'kitchen');
        } catch (printError) {
          console.error("❌ Error al enviar ticket al servidor de impresión:", printError);
          // No lanzar error - la venta continúa aunque falle la impresión
        }
      }
    } catch (printError) {
      console.error("❌ Error al procesar impresión de cocina:", printError);
      // No lanzar error - la impresión es no-crítica para la venta
    }

  } catch (error) {
    // No lanzar error - la impresión es no-crítica
    console.error("❌ Error al intentar imprimir en cocina (no crítico):", error);
  }
}

export async function createSale(data: SaleInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Validación estricta del user.id
    if (!user.id || user.id.trim() === "") {
      console.error("❌ createSale: user.id es null o vacío", { user });
      return { success: false, message: "Error de autenticación: ID de usuario inválido" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "sales.create");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para crear ventas" };
    }

    // 🔍 DEBUG DELIVERY: Verificar datos recibidos en createSale
    console.log('🔍 [DEBUG DELIVERY] createSale - Datos recibidos:');
    console.log('  - data.delivery_address:', data.delivery_address);
    console.log('  - Tipo de data.delivery_address:', typeof data.delivery_address);
    console.log('  - data.customer_name:', data.customer_name);
    console.log('  - data.sale_type:', data.sale_type);
    console.log('  - data completo:', data);

    // Validar con Zod
    const validated = saleSchema.parse(data);

    // 🔍 DEBUG DELIVERY: Verificar datos después de validación Zod
    console.log('🔍 [DEBUG DELIVERY] createSale - Datos después de validación Zod:');
    console.log('  - validated.delivery_address:', validated.delivery_address);
    console.log('  - Tipo de validated.delivery_address:', typeof validated.delivery_address);
    console.log('  - Es null?:', validated.delivery_address === null);
    console.log('  - Es undefined?:', validated.delivery_address === undefined);
    console.log('  - Es string vacío?:', validated.delivery_address === '');
    console.log('  - Valor truthy?:', !!validated.delivery_address);
    console.log('  - validated.customer_name:', validated.customer_name);

    // Verificar que hay una sesión de caja abierta
    let sessionQuery = supabase
      .from("cash_register_sessions")
      .select("*")
      .eq("cash_register_id", validated.cash_register_id)
      .is("closed_at", null);

    // Si se especifica el área, filtrar por ella
    if (validated.area) {
      sessionQuery = sessionQuery.eq("area", validated.area);
    }

    const { data: cashSession } = await sessionQuery.maybeSingle();

    if (!cashSession) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta",
      };
    }

    if (validated.sale_type === "table" && validated.table_number) {
      const { data: tableLayout, error: tableLayoutError } = await supabase
        .from("bar_layout")
        .select("table_number, is_active")
        .eq("table_number", validated.table_number)
        .eq("is_active", true)
        .maybeSingle();

      if (tableLayoutError) {
        throw tableLayoutError;
      }

      if (!tableLayout) {
        return {
          success: false,
          message: `La mesa ${validated.table_number} no existe o está deshabilitada en el mapa del bar`,
        };
      }

      const { data: existingPendingSale, error: pendingSaleError } = await supabase
        .from("sales")
        .select("id")
        .eq("table_number", validated.table_number)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingSaleError) {
        throw pendingSaleError;
      }

      if (existingPendingSale) {
        return {
          success: false,
          message: `La mesa ${validated.table_number} ya está ocupada`,
        };
      }
    }

    const productIds = validated.items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sale_price, stock, unlimited_stock, is_active")
      .in("id", productIds);

    if (productsError) {
      throw productsError;
    }

    const { normalizedItems, total } = normalizeItemsWithProductCatalog(
      validated.items,
      products || []
    );

    // Solo validar pagos si la venta no es pendiente
    if (validated.status === "completed") {
      // Verificar que los pagos suman el total
      const totalPayments = validated.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      if (Math.abs(totalPayments - total) > 0.01) {
        return {
          success: false,
          message: "Los pagos no coinciden con el total de la venta",
        };
      }
    }

    // Obtener número de ticket secuencial
    const ticketNumber = await getNextTicketNumber(supabase);

    // Preparar datos para la función RPC
    const saleData = {
      sale_number: ticketNumber,
      cash_register_session_id: cashSession.id,
      user_id: user.id,
      waiter_id: user.id, // Asignar el usuario actual como waiter por defecto
      total_amount: total,
      sale_type: validated.sale_type || "table",
      items: normalizedItems,
      payments: validated.payments,
      ...(validated.table_number ? { table_number: validated.table_number } : {}),
      status: validated.status,
      // Campos de delivery
      ...(validated.customer_name ? { customer_name: validated.customer_name } : {}),
      ...(validated.customer_phone ? { customer_phone: validated.customer_phone } : {}),
      ...(validated.delivery_address ? { delivery_address: validated.delivery_address } : {}),
      ...(validated.delivery_notes ? { delivery_notes: validated.delivery_notes } : {}),
    };

    // 🔍 DEBUG DELIVERY: Verificar saleData antes de enviar a RPC
    console.log('🔍 [DEBUG DELIVERY] createSale - saleData antes de RPC:');
    console.log('  - saleData.user_id:', saleData.user_id);
    console.log('  - saleData.delivery_address:', saleData.delivery_address);
    console.log('  - saleData.customer_name:', saleData.customer_name);
    console.log('  - saleData.sale_type:', saleData.sale_type);
    console.log('  - ¿Incluye delivery_address en saleData?:', 'delivery_address' in saleData);
    console.log('  - saleData completo:', JSON.stringify(saleData, null, 2));

    // Llamar a la función RPC que hace todo en una transacción
    const { data: saleId, error } = await supabase.rpc("create_sale", {
      p_sale_data: saleData,
    });

    if (error) {
      throw error;
    }

    if (!saleId) {
      throw new Error("La función RPC no devolvió un ID válido");
    }

    // Asegurar que los metadatos críticos quedan grabados (sale_type, sesión, datos de cliente)
    const saleMetadataUpdate: Record<string, any> = {
      sale_type: validated.sale_type || "table",
      cash_register_session_id: cashSession.id,
      session_id: cashSession.id,
      total_amount: total,
      total,
    };

    if (validated.customer_name) saleMetadataUpdate.customer_name = validated.customer_name;
    if (validated.customer_phone) saleMetadataUpdate.customer_phone = validated.customer_phone;
    if (validated.delivery_address) saleMetadataUpdate.delivery_address = validated.delivery_address;
    if (validated.delivery_notes) saleMetadataUpdate.delivery_notes = validated.delivery_notes;

    // 🔍 DEBUG DELIVERY: Verificar saleMetadataUpdate antes de actualizar
    console.log('🔍 [DEBUG DELIVERY] createSale - saleMetadataUpdate antes de UPDATE:');
    console.log('  - saleMetadataUpdate.delivery_address:', saleMetadataUpdate.delivery_address);
    console.log('  - saleMetadataUpdate.customer_name:', saleMetadataUpdate.customer_name);
    console.log('  - ¿Incluye delivery_address en saleMetadataUpdate?:', 'delivery_address' in saleMetadataUpdate);
    console.log('  - saleMetadataUpdate completo:', JSON.stringify(saleMetadataUpdate, null, 2));
    console.log('  - saleId para UPDATE:', saleId);

    const { error: metadataError } = await supabase
      .from("sales")
      .update(saleMetadataUpdate)
      .eq("id", saleId);

    // 🔍 DEBUG DELIVERY: Verificar resultado del UPDATE
    if (metadataError) {
      console.warn("⚠️ [DEBUG DELIVERY] No se pudieron actualizar los metadatos de la venta:", metadataError.message);
    } else {
      console.log('✅ [DEBUG DELIVERY] UPDATE exitoso de metadatos');
    }

    // Verificar que la venta se guardó correctamente en la BD
    const { data: savedSale, error: checkError } = await supabase
      .from("sales")
      .select("id, sale_number, sale_type, cash_register_session_id, status, total_amount, created_at, customer_name, delivery_address")
      .eq("id", saleId)
      .single();

    // 🔍 DEBUG DELIVERY: Verificar venta guardada en BD
    console.log('🔍 [DEBUG DELIVERY] createSale - Venta guardada en BD:');
    console.log('  - savedSale.delivery_address:', savedSale?.delivery_address);
    console.log('  - savedSale.customer_name:', savedSale?.customer_name);
    console.log('  - savedSale.sale_type:', savedSale?.sale_type);
    console.log('  - savedSale completo:', savedSale);

    // Imprimir en cocina si es venta pendiente (mesa o delivery) o venta de mostrador (pendiente o completada)
    console.log('🖨️ [DEBUG PRODUCCIÓN] createSale - Intentando imprimir:', {
      saleId,
      saleType: validated.sale_type,
      status: validated.status,
      tableNumber: validated.table_number,
      itemsCount: validated.items.length
    });

    if (validated.status === "pending") {
      if (validated.sale_type === "table" && validated.table_number) {
        // ✅ FIX: La impresión de mesas se hace desde el cliente (QuickSalePanel/SaleView)
        // El servidor de Vercel NO puede acceder a localhost:3001 (está en la nube)
        // El cliente (navegador) SÍ puede acceder al PrintServer local
        console.log('🖨️ [DEBUG] Mesa creada - impresión delegada al cliente (evita duplicación)');
      } else if (validated.sale_type === "delivery") {
        console.log('🖨️ [DEBUG PRODUCCIÓN] Llamando printToKitchenHelper para DELIVERY (se cancelará en servidor)');
        await printToKitchenHelper({
          saleId,
          tableNumber: null,
          items: normalizedItems,
          userId: user.id,
          orderType: 'new',
          saleType: validated.sale_type,
          customerName: validated.customer_name,
          deliveryAddress: validated.delivery_address,
        });
      } else if (validated.sale_type === "counter") {
        console.log('🖨️ [DEBUG PRODUCCIÓN] Llamando printToKitchenHelper para COUNTER (se cancelará en servidor)');
        // Ventas de mostrador pendientes (con productos de cocina) también van a cocina
        await printToKitchenHelper({
          saleId,
          tableNumber: null,
          items: normalizedItems,
          userId: user.id,
          orderType: 'new',
          saleType: validated.sale_type,
        });
      }
    } else if (validated.status === "completed" && validated.sale_type === "counter") {
      console.log('🖨️ [DEBUG PRODUCCIÓN] Llamando printToKitchenHelper para COUNTER COMPLETED (se cancelará en servidor)');
      // Imprimir a cocina para ventas de mostrador completadas (sin productos de cocina)
      // Esto es solo para productos de inventario que igualmente deben imprimirse
      await printToKitchenHelper({
        saleId,
        tableNumber: null,
        items: normalizedItems,
        userId: user.id,
        orderType: 'new',
        saleType: validated.sale_type,
      });
    }

    // Intentar revalidar rutas (no crítico si falla)
    try {
      revalidatePath("/caja-drugstore");
      revalidatePath("/caja-bar");
      revalidatePath("/ventas");
      revalidatePath("/productos");
      revalidatePath("/cocina"); // ✅ Revalidar cocina cuando se crea una venta nueva
    } catch (revalidateError) {
      console.warn("⚠️ DEBUG: Error al revalidar rutas (no crítico):", revalidateError);
    }

    // Obtener la venta completa de la base de datos para incluir sale_number
    const { data: createdSale, error: fetchError } = await supabase
      .from("sales")
      .select("id, sale_number, total_amount, created_at")
      .eq("id", saleId)
      .single();

    if (fetchError) {
      console.warn("⚠️ No se pudo obtener sale_number de la venta creada:", fetchError);
    }

    return {
      success: true,
      data: {
        ...saleData,
        id: saleId,
        sale_number: createdSale?.sale_number || saleData.sale_number,
        total_amount: createdSale?.total_amount || saleData.total_amount,
        created_at: createdSale?.created_at || new Date().toISOString(),
      }
    };
  } catch (error: unknown) {
    console.error("Error creating sale:", error);

    // Mensajes de error específicos
    if (getErrorMessage(error).includes("Stock insuficiente")) {
      return {
        success: false,
        message: "Stock insuficiente para uno o más productos",
      };
    }

    return {
      success: false,
      message: getErrorMessage(error) || "Error al crear la venta",
    };
  }
}

export async function getSales(sessionId?: string) {
  try {
    const supabase = await createClient();

    // Primero obtener las ventas sin la relación de sesión (para evitar errores)
    let query = supabase
      .from("sales")
      .select(`
        *,
        user:users!sales_user_id_fkey(name),
        sale_items(
          *,
          product:products(name)
        ),
        sale_payments(
          *,
          payment_method:payment_methods(name, id)
        ),
        invoice:invoices(
          id,
          sale_id,
          invoice_number,
          status,
          thermal_content
        )
      `)
      .order("created_at", { ascending: false });

    if (sessionId) {
      // Intentar con ambos nombres de columna posibles para compatibilidad
      query = query.or(`cash_register_session_id.eq.${sessionId},session_id.eq.${sessionId}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Obtener información de sesiones de caja para las ventas (optimizado)
    if (data && data.length > 0) {
      // Obtener IDs únicos de sesiones
      const sessionIds = [...new Set(
        data
          .map((sale: any) => sale.cash_register_session_id)
          .filter((id: any) => id)
      )];

      // Obtener todas las sesiones de una vez
      const { data: sessionsData } = await supabase
        .from("cash_register_sessions")
        .select("id, shift, area, opened_at")
        .in("id", sessionIds);

      // Crear un mapa para acceso rápido
      const sessionsMap = new Map(
        (sessionsData || []).map((session: any) => [session.id, session])
      );

      // Agregar información de sesión a cada venta
      const salesWithSessions = data.map((sale: any) => ({
        ...sale,
        cash_register_sessions: sale.cash_register_session_id
          ? sessionsMap.get(sale.cash_register_session_id) || null
          : null,
      }));

      return { success: true, data: salesWithSessions };
    }

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error fetching sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener ventas",
      data: [],
    };
  }
}

export async function updateSalePayments(
  saleId: string,
  payments: Array<{ payment_method_id: string; amount: number }>
) {
  try {
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

    if (!payments || payments.length === 0) {
      return {
        success: false,
        message: "Debes indicar al menos un pago",
      };
    }

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status, total_amount")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.status !== "completed") {
      return {
        success: false,
        message: "Solo se pueden editar pagos de ventas completadas",
      };
    }

    const totalPayments = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    if (Math.abs(totalPayments - Number(sale.total_amount)) > 0.01) {
      return {
        success: false,
        message: "La suma de los pagos debe coincidir con el total de la venta",
      };
    }

    const { error: deleteError } = await supabase
      .from("sale_payments")
      .delete()
      .eq("sale_id", saleId);

    if (deleteError) {
      throw deleteError;
    }

    const paymentsToInsert = payments.map((payment) => ({
      sale_id: saleId,
      payment_method_id: payment.payment_method_id,
      amount: payment.amount,
    }));

    const { error: insertError } = await supabase
      .from("sale_payments")
      .insert(paymentsToInsert);

    if (insertError) {
      throw insertError;
    }

    revalidatePath("/ventas");
    revalidatePath("/caja-bar");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating sale payments:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al actualizar los pagos de la venta",
    };
  }
}

export async function getPendingSales() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        user:users!sales_user_id_fkey(name),
        sale_items(
          *,
          product:products(name)
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error fetching pending sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener ventas pendientes",
      data: [],
    };
  }
}

export async function closePendingSale(saleId: string, payments: Array<{ payment_method_id: string; amount: number }>) {
  try {
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

    const { error } = await supabase.rpc("close_pending_sale", {
      p_sale_id: saleId,
      p_payments: payments,
      p_closed_by: user.id,
    });

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidatePath("/ventas");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error closing pending sale:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al cerrar la venta pendiente",
    };
  }
}

export async function cancelPendingSale(saleId: string, reason: string) {
  try {
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

    const { error } = await supabase.rpc("cancel_pending_sale", {
      p_sale_id: saleId,
      p_reason: reason,
      p_cancelled_by: user.id,
    });

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidatePath("/ventas");
    revalidatePath("/productos");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling pending sale:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al cancelar la venta pendiente",
    };
  }
}

export async function checkPendingSales() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select("id")
      .eq("status", "pending");

    if (error) throw error;

    return { success: true, data: { hasPending: (data || []).length > 0, count: (data || []).length } };
  } catch (error: unknown) {
    console.error("Error checking pending sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al verificar ventas pendientes",
      data: { hasPending: false, count: 0 },
    };
  }
}

export async function getRecentCounterSales(sessionId: string, limit: number = 20, offset: number = 0) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        created_at,
        customer_name,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          product:products(name)
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("cash_register_session_id", sessionId)
      .eq("sale_type", "counter")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Obtener el total de ventas para la paginación
    const { count } = await supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("cash_register_session_id", sessionId)
      .eq("sale_type", "counter");

    return {
      success: true,
      data: data || [],
      total: count || 0
    };
  } catch (error: unknown) {
    console.error("Error fetching recent counter sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener ventas de mostrador",
      data: [],
      total: 0
    };
  }
}

export async function getRecentDeliverySales(sessionId: string, limit: number = 20, offset: number = 0) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        created_at,
        customer_name,
        customer_phone,
        delivery_address,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          product:products(name)
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("cash_register_session_id", sessionId)
      .eq("sale_type", "delivery")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Obtener el total de ventas para la paginación
    const { count } = await supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("cash_register_session_id", sessionId)
      .eq("sale_type", "delivery");

    return {
      success: true,
      data: data || [],
      total: count || 0
    };
  } catch (error: unknown) {
    console.error("Error fetching recent delivery sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener ventas de delivery",
      data: [],
      total: 0
    };
  }
}

export async function checkTableAvailability(tableNumber: number) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select("id")
      .eq("status", "pending")
      .eq("table_number", tableNumber);

    if (error) throw error;

    const isAvailable = !(data && data.length > 0);
    return {
      success: true,
      data: {
        isAvailable,
        tableNumber,
        message: isAvailable ? "Mesa disponible" : `La mesa ${tableNumber} ya está abierta`
      }
    };
  } catch (error: unknown) {
    console.error("Error checking table availability:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al verificar disponibilidad de mesa",
      data: { isAvailable: false, tableNumber }
    };
  }
}

export async function getLastSaleFromSession(sessionId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        sale_items(
          *,
          product:products(name)
        )
      `)
      .eq("cash_register_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || null };
  } catch (error: unknown) {
    console.error("Error fetching last sale:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener la última venta",
      data: null,
    };
  }
}

export async function getPaymentMethods() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error fetching payment methods:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener métodos de pago",
      data: [],
    };
  }
}

export async function deleteSale(saleId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "sales.delete");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Verificar que la venta existe y obtener más información
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, status, sale_number, total_amount, cash_register_session_id")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.status === "cancelled") {
      return { success: false, message: "Esta venta ya fue eliminada anteriormente" };
    }

    // Marcar la venta como eliminada en lugar de borrarla
    const { error } = await supabase
      .from("sales")
      .update({
        status: "cancelled"
      })
      .eq("id", saleId);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidatePath("/ventas");
    revalidatePath("/productos");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error al eliminar venta:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al eliminar la venta",
    };
  }
}

export async function getDailyStats(sessionId: string) {
  try {
    const supabase = await createClient();

    // Obtener información de la sesión
    const { data: session, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select("opening_amount, cash_register_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return {
        success: false,
        message: "Sesión no encontrada",
        data: { sales: 0, transactions: 0, expenses: 0, cash: 0 }
      };
    }

    // Obtener ventas del día (completadas)
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("cash_register_session_id", sessionId)
      .eq("status", "completed");

    if (salesError) throw salesError;

    // Obtener gastos del día (con manejo de error si la columna no existe)
    let totalExpenses = 0;
    try {
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("amount")
        .eq("cash_register_session_id", sessionId);

      if (expensesError) {
        console.warn("⚠️ Error al obtener gastos (columna cash_register_session_id puede no existir):", expensesError.message);
        // Si hay error, intentar obtener gastos sin filtrar por sesión (workaround temporal)
        const { data: allExpenses } = await supabase
          .from("expenses")
          .select("amount");
        totalExpenses = allExpenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
      } else {
        totalExpenses = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
      }
    } catch (expError: any) {
      console.warn("⚠️ Error crítico al obtener gastos:", expError.message);
      totalExpenses = 0; // Asumir 0 gastos en caso de error
    }

    // Calcular totales
    const totalSales = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const cashAvailable = session.opening_amount + totalSales - totalExpenses;
    const transactionCount = sales?.length || 0;

    return {
      success: true,
      data: {
        sales: totalSales,
        transactions: transactionCount,
        expenses: totalExpenses,
        cash: cashAvailable
      }
    };
  } catch (error: unknown) {
    console.error("Error getting daily stats:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener estadísticas del día",
      data: { sales: 0, transactions: 0, expenses: 0, cash: 0 }
    };
  }
}

/**
 * Obtener pedidos de delivery pendientes
 */
export async function getPendingCounterSales() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        sale_type,
        kitchen_ready,
        customer_name,
        customer_phone,
        created_at,
        sale_items(
          id,
          quantity,
          unit_price,
          subtotal,
          customization,
          product:products!sale_items_product_id_fkey(
            name,
            unlimited_stock
          )
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("status", "pending")
      .eq("sale_type", "counter")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error getting pending counter sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener pedidos de mostrador pendientes",
      data: [],
    };
  }
}

export async function getAllCounterSales(sessionId?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        sale_type,
        kitchen_ready,
        customer_name,
        customer_phone,
        cash_register_session_id,
        created_at,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          unit_price,
          subtotal,
          customization,
          product:products!sale_items_product_id_fkey(
            name,
            unlimited_stock
          )
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("sale_type", "counter")
      .order("created_at", { ascending: false });

    if (sessionId) {
      query = query.eq("cash_register_session_id", sessionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error getting all counter sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener ventas de mostrador",
      data: [],
    };
  }
}

export async function getPendingDeliveries() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        user:users!sales_user_id_fkey(name),
        sale_items(
          *,
          product:products(
            name,
            unlimited_stock
          )
        )
      `)
      .eq("status", "pending")
      .eq("sale_type", "delivery")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error fetching pending deliveries:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener pedidos de delivery pendientes",
      data: [],
    };
  }
}

export async function getAllDeliverySales(sessionId?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        sale_type,
        kitchen_ready,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_notes,
        cash_register_session_id,
        created_at,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          unit_price,
          subtotal,
          customization,
          product:products!sale_items_product_id_fkey(
            name,
            unlimited_stock
          )
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("sale_type", "delivery")
      .order("created_at", { ascending: false });

    if (sessionId) {
      query = query.eq("cash_register_session_id", sessionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: unknown) {
    console.error("Error getting all delivery sales:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al obtener pedidos de delivery",
      data: [],
    };
  }
}

/**
 * Marcar un pedido como listo en cocina
 * Solo actualiza kitchen_ready = true para que desaparezca de la vista de cocina
 * No requiere validaciones: si puedes ver /cocina, puedes marcar como listo
 */
export async function markKitchenReady({ saleId }: MarkKitchenReadyInput) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "kitchen.mark_ready");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    const adminClient = createAdminClient();

    // Simplemente actualizar kitchen_ready = true
    // No validamos nada: si puedes ver /cocina, puedes marcar como listo
    const { error: updateError } = await adminClient
      .from("sales")
      .update({ kitchen_ready: true })
      .eq("id", saleId);

    if (updateError) {
      console.error("Error actualizando kitchen_ready:", updateError);
      return { success: false, message: "Error al actualizar el pedido" };
    }

    // Solo revalidar la ruta de cocina (no afecta nada más)
    revalidatePath("/cocina");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error marking kitchen ready:", error);
    return {
      success: false,
      message: "Error al marcar pedido como listo",
    };
  }
}

/**
 * Marcar todos los pedidos actuales en cocina como listos
 * Útil para limpiar la vista de cocina y empezar desde cero
 */
export async function markAllKitchenReady() {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "kitchen.mark_ready");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Obtener todos los pedidos con productos de cocina que no están marcados como listos
    // Solo últimas 24 horas para evitar marcar pedidos muy antiguos
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

    // Primero obtener los IDs de las ventas que tienen productos de cocina
    const { data: salesWithKitchenProducts, error: fetchError } = await supabase
      .from("sales")
      .select(`
        id,
        sale_items(
          product:products(cocina_only)
        )
      `)
      .in("sale_type", ["table", "delivery", "counter"])
      .eq("kitchen_ready", false)
      .gte("created_at", twentyFourHoursAgoISO);

    if (fetchError) {
      console.error("Error obteniendo pedidos de cocina:", fetchError);
      return { success: false, message: "Error al obtener pedidos de cocina" };
    }

    // Filtrar solo las que tienen productos de cocina
    const salesToMark = (salesWithKitchenProducts || []).filter((sale: any) => {
      return sale.sale_items?.some((item: any) => item.product?.cocina_only === true);
    });

    if (salesToMark.length === 0) {
      return { success: true, message: "No hay pedidos para marcar como listos", count: 0 };
    }

    const saleIds = salesToMark.map((sale: any) => sale.id);

    // Marcar todos como listos
    const { error: updateError, count } = await adminClient
      .from("sales")
      .update({ kitchen_ready: true })
      .in("id", saleIds);

    if (updateError) {
      console.error("Error marcando todos los pedidos como listos:", updateError);
      return { success: false, message: "Error al marcar pedidos como listos" };
    }

    // Revalidar la ruta de cocina
    revalidatePath("/cocina");

    return {
      success: true,
      message: `${salesToMark.length} pedido(s) marcado(s) como listo(s)`,
      count: salesToMark.length
    };
  } catch (error: unknown) {
    console.error("Error marking all kitchen ready:", error);
    return {
      success: false,
      message: "Error al marcar pedidos como listos",
    };
  }
}

/**
 * Completar un pedido de delivery
 * Cambia el status a 'completed' y procesa los pagos
 */
export async function completeDelivery(
  saleId: string,
  payments: Array<{ payment_method_id: string; amount: number }>,
  discountAmount: number = 0,
  surchargeAmount: number = 0
) {
  try {
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

    // Verificar que la venta existe y es de tipo delivery
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        id,
        sale_type,
        status,
        total_amount
      `)
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Pedido no encontrado" };
    }

    if (sale.sale_type !== "delivery") {
      return { success: false, message: "Esta venta no es un pedido de delivery" };
    }

    if (sale.status !== "pending") {
      return { success: false, message: "Este pedido ya fue completado" };
    }

    // Aplicar ajuste global (% convertido a monto en el frontend)
    // Descuento resta (clamp del total a >= 0); recargo suma
    const safeDiscount = Math.max(0, discountAmount || 0);
    const safeSurcharge = Math.max(0, surchargeAmount || 0);
    const effectiveTotal = Math.max(0, (sale.total_amount || 0) - safeDiscount) + safeSurcharge;

    // Validar que los pagos sean suficientes (permitir sobrepago para vuelto)
    const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
    // Permitir sobrepago (vuelto) - solo validar que el pago sea suficiente
    if (totalPayments < effectiveTotal - 0.01) {
      return {
        success: false,
        message: `El monto pagado ($${totalPayments.toFixed(2)}) debe ser al menos igual al total del pedido ($${effectiveTotal.toFixed(2)})`,
      };
    }

    // Actualizar el status de la venta a completed (guardar ajuste y total cobrado)
    const { error: updateError } = await supabase
      .from("sales")
      .update({
        status: "completed",
        discount: safeDiscount,
        surcharge: safeSurcharge,
        total_amount: Math.max(0, (sale.total_amount || 0) - safeDiscount) + safeSurcharge,
      })
      .eq("id", saleId);

    if (updateError) throw updateError;

    // Crear los pagos
    const paymentsToInsert = payments.map((payment) => ({
      sale_id: saleId,
      payment_method_id: payment.payment_method_id,
      amount: payment.amount,
    }));

    const { error: paymentsError } = await supabase
      .from("sale_payments")
      .insert(paymentsToInsert);

    if (paymentsError) throw paymentsError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/ventas");
    revalidatePath("/cocina");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error completing delivery:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al completar el pedido de delivery",
    };
  }
}

/**
 * Completar una venta de mostrador
 * Cambia el status a 'completed' y procesa los pagos
 */
export async function completeCounter(
  saleId: string,
  payments: Array<{ payment_method_id: string; amount: number }>,
  discountAmount: number = 0,
  surchargeAmount: number = 0
) {
  try {
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

    // Verificar que la venta existe y es de tipo counter
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        id,
        sale_type,
        status,
        total_amount
      `)
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    if (sale.sale_type !== "counter") {
      return { success: false, message: "Esta venta no es de mostrador" };
    }

    if (sale.status !== "pending") {
      return { success: false, message: "Esta venta ya fue completada" };
    }

    // Aplicar ajuste global (% convertido a monto en el frontend)
    // Descuento resta (clamp del total a >= 0); recargo suma
    const safeDiscount = Math.max(0, discountAmount || 0);
    const safeSurcharge = Math.max(0, surchargeAmount || 0);
    const effectiveTotal = Math.max(0, (sale.total_amount || 0) - safeDiscount) + safeSurcharge;

    // Validar que los pagos sean suficientes (permitir sobrepago para vuelto)
    const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
    // Permitir sobrepago (vuelto) - solo validar que el pago sea suficiente
    if (totalPayments < effectiveTotal - 0.01) {
      return {
        success: false,
        message: `El monto pagado ($${totalPayments.toFixed(2)}) debe ser al menos igual al total de la venta ($${effectiveTotal.toFixed(2)})`,
      };
    }

    // Actualizar el status de la venta a completed (guardar ajuste y total cobrado)
    const { error: updateError } = await supabase
      .from("sales")
      .update({
        status: "completed",
        discount: safeDiscount,
        surcharge: safeSurcharge,
        total_amount: Math.max(0, (sale.total_amount || 0) - safeDiscount) + safeSurcharge,
      })
      .eq("id", saleId);

    if (updateError) throw updateError;

    // Crear los pagos
    const paymentsToInsert = payments.map((payment) => ({
      sale_id: saleId,
      payment_method_id: payment.payment_method_id,
      amount: payment.amount,
    }));

    const { error: paymentsError } = await supabase
      .from("sale_payments")
      .insert(paymentsToInsert);

    if (paymentsError) throw paymentsError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/ventas");
    revalidatePath("/cocina");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error completing counter sale:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al completar la venta de mostrador",
    };
  }
}

/**
 * Actualizar datos del cliente de una venta (mostrador o delivery)
 * Permite editar customer_name, customer_phone y delivery_address
 * No requiere permisos especiales - cualquiera que pueda ver la página puede editar
 */
export async function updateSaleCustomerData(
  saleId: string,
  customerData: {
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_address?: string | null;
  }
) {
  try {
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

    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, sale_type")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return { success: false, message: "Venta no encontrada" };
    }

    // Solo permitir actualizar para counter o delivery
    if (sale.sale_type !== "counter" && sale.sale_type !== "delivery") {
      return {
        success: false,
        message: "Solo se pueden editar datos de cliente en ventas de mostrador o delivery",
      };
    }

    // Preparar datos de actualización
    const updateData: {
      customer_name?: string | null;
      customer_phone?: string | null;
      delivery_address?: string | null;
    } = {};

    // Para counter, solo se puede editar customer_name
    if (sale.sale_type === "counter") {
      if (customerData.customer_name !== undefined) {
        updateData.customer_name = customerData.customer_name || null;
      }
    }

    // Para delivery, se pueden editar todos los campos
    if (sale.sale_type === "delivery") {
      if (customerData.customer_name !== undefined) {
        updateData.customer_name = customerData.customer_name || null;
      }
      if (customerData.customer_phone !== undefined) {
        updateData.customer_phone = customerData.customer_phone || null;
      }
      if (customerData.delivery_address !== undefined) {
        updateData.delivery_address = customerData.delivery_address || null;
      }
    }

    // Actualizar la venta
    const { error: updateError } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", saleId);

    if (updateError) throw updateError;

    // Revalidar rutas
    revalidatePath("/caja-bar");
    revalidatePath("/ventas");
    revalidatePath("/cocina");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating customer data:", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Error al actualizar los datos del cliente",
    };
  }
}
