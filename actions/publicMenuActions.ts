"use server";

import { revalidatePath } from "next/cache";
import { brand } from "@/lib/brand";
import { createAdminClient, createAnonClient } from "@/lib/supabase/server";

export interface PublicProduct {
  id: string;
  name: string;
  description?: string;
  sale_price: number;
  category_id?: string;
  category_name?: string;
  image_url?: string;
  is_available: boolean;
}

export interface PublicCategory {
  id: string;
  name: string;
  product_count: number;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  customization?: string;
}

export interface PublicOrderInput {
  items: CartItem[];
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  delivery_notes?: string;
  payment_method: "mercadopago" | "transfer" | "cash";
  estimated_time?: number;
}

function normalizeText(value?: string | null) {
  return value?.trim() || "";
}

function parsePositiveQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

export async function getPublicProducts(): Promise<{
  success: boolean;
  data?: PublicProduct[];
  message?: string;
}> {
  try {
    const supabase = createAnonClient();

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        sale_price,
        stock,
        unlimited_stock,
        category_id,
        image_url,
        category:categories(name)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    const publicProducts: PublicProduct[] = (data || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description || "",
      sale_price: product.sale_price,
      category_id: product.category_id,
      category_name: Array.isArray(product.category) ? product.category[0]?.name : product.category?.name,
      image_url: product.image_url,
      is_available: product.unlimited_stock || product.stock > 0,
    }));

    return { success: true, data: publicProducts };
  } catch (error: any) {
    console.error("Error fetching public products:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos",
    };
  }
}

export async function getPublicCategories(): Promise<{
  success: boolean;
  data?: PublicCategory[];
  message?: string;
}> {
  try {
    const supabase = createAnonClient();

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (catError) throw catError;

    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("category_id")
      .eq("is_active", true);

    if (prodError) throw prodError;

    const countMap = new Map<string, number>();
    products?.forEach((product: any) => {
      if (product.category_id) {
        countMap.set(product.category_id, (countMap.get(product.category_id) || 0) + 1);
      }
    });

    const publicCategories: PublicCategory[] = (categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      product_count: countMap.get(category.id) || 0,
    }));

    return { success: true, data: publicCategories };
  } catch (error: any) {
    console.error("Error fetching public categories:", error);
    return {
      success: false,
      message: error.message || "Error al obtener categorías",
    };
  }
}

export async function createPublicOrder(input: PublicOrderInput): Promise<{
  success: boolean;
  data?: {
    order_id: string;
    order_number: string;
    total: number;
    estimated_time: number;
    payment_status: string;
    tracking_code: string;
  };
  message?: string;
}> {
  try {
    if (!input.items?.length) {
      return { success: false, message: "El carrito está vacío" };
    }

    const customerName = normalizeText(input.customer_name);
    const customerPhone = normalizeText(input.customer_phone);

    if (!customerName || !customerPhone) {
      return { success: false, message: "Nombre y teléfono son requeridos" };
    }

    const requestedItems = input.items.map((item) => ({
      product_id: item.product_id,
      quantity: parsePositiveQuantity(item.quantity),
      customization: normalizeText(item.customization) || null,
    }));

    if (requestedItems.some((item) => !item.product_id || !item.quantity)) {
      return { success: false, message: "Hay productos con cantidades inválidas en el pedido" };
    }

    const publicSupabase = createAnonClient();
    const productIds = [...new Set(requestedItems.map((item) => item.product_id))];

    const { data: products, error: productsError } = await publicSupabase
      .from("products")
      .select("id, name, sale_price, stock, unlimited_stock, is_active")
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map((products || []).map((product: any) => [product.id, product]));
    const validatedItems = requestedItems.map((item) => {
      const product = productMap.get(item.product_id);

      if (!product || !product.is_active) {
        throw new Error("Uno de los productos ya no está disponible");
      }

      if (!product.unlimited_stock && product.stock < item.quantity!) {
        throw new Error(`No hay stock suficiente para ${product.name}`);
      }

      const unitPrice = Number(product.sale_price) || 0;

      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity!,
        unit_price: unitPrice,
        total: unitPrice * item.quantity!,
        customization: item.customization,
      };
    });

    const total = validatedItems.reduce((sum, item) => sum + item.total, 0);
    const supabase = createAdminClient();

    const { data: activeSession } = await supabase
      .from("cash_register_sessions")
      .select("id, user_id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let systemUserId: string | null = activeSession?.user_id || null;

    if (!systemUserId) {
      const { data: adminUser } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      systemUserId = adminUser?.id || null;
    }

    if (!systemUserId) {
      const { data: anyUser } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      systemUserId = anyUser?.id || null;
    }

    if (!systemUserId) {
      console.error("createPublicOrder: no se encontró un usuario del sistema");
      return { success: false, message: "Error de configuración: no hay usuarios activos en el sistema" };
    }

    const orderNumber = `WA-${Date.now().toString(36).toUpperCase()}`;
    const paymentStatus = input.payment_method === "mercadopago" ? "pending_payment" : "pending";

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        sale_number: orderNumber,
        sale_type: "delivery",
        source: "whatsapp",
        status: "pending",
        payment_status: paymentStatus,
        total,
        total_amount: total,
        user_id: systemUserId,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: normalizeText(input.delivery_address) || null,
        delivery_notes: normalizeText(input.delivery_notes) || null,
        session_id: activeSession?.id || null,
        cash_register_session_id: activeSession?.id || null,
        kitchen_ready: false,
      } as any)
      .select("id, sale_number")
      .single();

    if (saleError) throw saleError;

    const saleItems = validatedItems.map((item) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      subtotal: item.total,
      customization: item.customization,
    }));

    const { error: itemsError } = await supabase.from("sale_items").insert(saleItems as any);
    if (itemsError) throw itemsError;

    const estimatedTime = input.estimated_time || 30;

    revalidatePath("/cocina");
    revalidatePath("/caja-bar");

    return {
      success: true,
      data: {
        order_id: sale.id,
        order_number: sale.sale_number || orderNumber,
        total,
        estimated_time: estimatedTime,
        payment_status: paymentStatus,
        tracking_code: sale.sale_number || orderNumber,
      },
    };
  } catch (error: any) {
    console.error("Error creating public order:", error);
    return {
      success: false,
      message: error.message || "Error al crear el pedido",
    };
  }
}

export async function getOrderStatus(orderLookup: string): Promise<{
  success: boolean;
  data?: {
    order_number: string;
    status: string;
    payment_status: string;
    kitchen_ready: boolean;
    total: number;
    created_at: string;
  };
  message?: string;
}> {
  try {
    const trackingCode = normalizeText(orderLookup);
    if (!trackingCode) {
      return { success: false, message: "Código de seguimiento inválido" };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("sales")
      .select(`
        sale_number,
        status,
        payment_status,
        kitchen_ready,
        total,
        created_at
      `)
      .eq("source", "whatsapp")
      .eq("sale_number", trackingCode)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { success: false, message: "Pedido no encontrado" };
    }

    return {
      success: true,
      data: {
        order_number: data.sale_number,
        status: data.status,
        payment_status: data.payment_status || "pending",
        kitchen_ready: data.kitchen_ready || false,
        total: data.total,
        created_at: data.created_at,
      },
    };
  } catch (error: any) {
    console.error("Error fetching order status:", error);
    return {
      success: false,
      message: error.message || "Error al consultar el pedido",
    };
  }
}

export async function getStoreSettings(): Promise<{
  success: boolean;
  data?: {
    store_name: string;
    estimated_delivery_time: number;
    is_open: boolean;
    daily_menu_content?: string;
    daily_menu_active?: boolean;
    bank_alias?: string;
    bank_cbu?: string;
    bank_holder?: string;
  };
  message?: string;
}> {
  try {
    const publicSupabase = createAnonClient();

    const { data: settings } = await publicSupabase.from("store_settings").select("*").single();

    const storeSettings = settings || {
      store_name: brand.defaultStoreName,
      estimated_delivery_time: 30,
      daily_menu_content: "",
      daily_menu_active: false,
    };

    const { data: openSession } = await publicSupabase
      .from("cash_register_sessions")
      .select("id")
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      data: {
        store_name: storeSettings.store_name || brand.defaultStoreName,
        estimated_delivery_time: storeSettings.estimated_delivery_time || 30,
        is_open: !!openSession,
        daily_menu_content: storeSettings.daily_menu_content,
        daily_menu_active: storeSettings.daily_menu_active,
        bank_alias: undefined,
        bank_cbu: undefined,
        bank_holder: undefined,
      },
    };
  } catch (error: any) {
    console.error("Error fetching store settings:", error);
    return {
      success: true,
      data: {
        store_name: brand.defaultStoreName,
        estimated_delivery_time: 30,
        is_open: true,
      },
    };
  }
}
