"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { productSchema, type ProductInput } from "@/lib/validations";
import { getCurrentDate } from "@/lib/utils";
import { extractProductsFromPDF } from "@/lib/pdfUtils";
import { checkUserPermission } from "./permissionActions";

function normalizeProductPayload<T extends Partial<ProductInput>>(data: T): T {
  if (!Object.prototype.hasOwnProperty.call(data, "cocina_only")) {
    return data;
  }

  return {
    ...data,
    cocina_only: data.cocina_only ?? false,
  };
}

export async function createProduct(data: ProductInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "products.create");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para crear productos" };
    }

    // Validar con Zod
    const validated = normalizeProductPayload(productSchema.parse(data));

    // Calcular precio si es automático
    if (validated.use_auto_price && validated.profit_margin && validated.cost_price) {
      validated.sale_price = validated.cost_price * (1 + validated.profit_margin / 100);
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert([
        {
          ...validated,
          created_at: getCurrentDate().toISOString(),
          updated_at: getCurrentDate().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Guardar primer precio en historial
    await supabase.from("price_history").insert([
      {
        product_id: product.id,
        old_price: 0,
        new_price: product.sale_price,
        changed_by: user.id,
        changed_at: getCurrentDate().toISOString(),
      },
    ]);

    revalidatePath("/productos");

    // Invalidar caché de productos
    revalidateTag("products");
    revalidateTag("stats");

    return { success: true, data: product };
  } catch (error: any) {
    console.error("Error creating product:", error);
    return {
      success: false,
      message: error.message || "Error al crear el producto",
    };
  }
}

export async function updateProduct(id: string, data: Partial<ProductInput>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "products.edit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Obtener producto actual para historial de precios
    const { data: currentProduct } = await supabase
      .from("products")
      .select("sale_price")
      .eq("id", id)
      .single();

    // Calcular precio si es automático
    const normalizedData = normalizeProductPayload(data);

    if (
      normalizedData.use_auto_price &&
      normalizedData.profit_margin &&
      normalizedData.cost_price
    ) {
      normalizedData.sale_price =
        normalizedData.cost_price * (1 + normalizedData.profit_margin / 100);
    }

    const { data: product, error } = await supabase
      .from("products")
      .update({
        ...normalizedData,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Guardar historial de precios si cambió
    if (
      currentProduct &&
      normalizedData.sale_price &&
      currentProduct.sale_price !== normalizedData.sale_price
    ) {
      await supabase.from("price_history").insert([
        {
          product_id: id,
          old_price: currentProduct.sale_price,
          new_price: normalizedData.sale_price,
          changed_by: user.id,
          changed_at: getCurrentDate().toISOString(),
        },
      ]);
    }

    revalidatePath("/productos");

    // Invalidar caché de productos
    revalidateTag("products");
    revalidateTag("stats");

    return { success: true, data: product };
  } catch (error: any) {
    console.error("Error updating product:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar el producto",
    };
  }
}

export async function getProducts(page = 1, limit = 50) {
  try {
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    // Select solo campos necesarios para reducir payload
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        sale_price,
        cost_price,
        stock,
        min_stock,
        unlimited_stock,
        cocina_only,
        is_active,
        category:categories(name)
      `)
      .eq("is_active", true)
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Obtener total para paginación
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    return {
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos",
      data: [],
    };
  }
}

export async function getProductsForSearch() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        code,
        name,
        sale_price,
        stock,
        min_stock,
        unlimited_stock,
        cocina_only,
        is_active
      `)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return {
      success: true,
      data: data || [],
    };
  } catch (error: any) {
    console.error("Error fetching products for search:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos para la búsqueda",
      data: [],
    };
  }
}

export async function getAllProducts() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        category:categories(name)
      `)
      .order("name");

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching all products:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos",
      data: [],
    };
  }
}

export async function getPriceHistory(productId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("price_history")
      .select(`
        *,
        user:users!inventory_movements_user_id_fkey(name)
      `)
      .eq("product_id", productId)
      .order("changed_at", { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching price history:", error);
    return {
      success: false,
      message: error.message || "Error al obtener historial",
      data: [],
    };
  }
}

export async function searchProductByName(searchTerm: string) {
  try {
    const supabase = await createClient();

    // Buscar por nombre (case insensitive)
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        code,
        name,
        sale_price,
        stock,
        min_stock,
        unlimited_stock,
        cocina_only,
        is_active
      `)
      .ilike("name", `%${searchTerm}%`)
      .eq("is_active", true)
      .limit(10)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      return {
        success: false,
        message: "Producto no encontrado",
        data: null,
      };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Error searching product:", error);
    return {
      success: false,
      message: error.message || "Error al buscar producto",
      data: null,
    };
  }
}

export async function searchProducts(searchTerm: string) {
  try {
    const supabase = await createClient();

    if (!searchTerm || searchTerm.trim().length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        code,
        name,
        sale_price,
        stock,
        min_stock,
        unlimited_stock,
        cocina_only,
        is_active
      `)
      .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
      .eq("is_active", true)
      .order("name")
      .limit(10);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error searching products:", error);
    return {
      success: false,
      message: error.message || "Error al buscar productos",
      data: [],
    };
  }
}

export async function getLowStockProducts() {
  try {
    const supabase = await createClient();

    // Obtener todos los productos activos y filtrar en cliente
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        category:categories(name)
      `)
      .eq("is_active", true)
      .order("stock", { ascending: true });

    if (error) throw error;

    // Filtrar productos con stock bajo o igual al mínimo (excluir stock ilimitado)
    const lowStockProducts = data?.filter(product =>
      !product.unlimited_stock && product.stock <= product.min_stock
    ) || [];

    return { success: true, data: lowStockProducts };
  } catch (error: any) {
    console.error("Error fetching low stock products:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos con stock bajo",
      data: [],
    };
  }
}

export async function deleteProduct(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { hasPermission } = await checkUserPermission(user.id, "products.delete");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para eliminar productos" };
    }

    const { data: pendingUsage, error: pendingUsageError } = await supabase
      .from("sale_items")
      .select("id, sale:sales!inner(status)")
      .eq("product_id", id)
      .eq("sale.status", "pending")
      .limit(1);

    if (pendingUsageError && pendingUsageError.code !== "PGRST116") {
      throw pendingUsageError;
    }

    if (pendingUsage && pendingUsage.length > 0) {
      return {
        success: false,
        message: "No puedes eliminar este producto porque está asociado a una venta pendiente. Cierra la venta primero.",
      };
    }

    const { error } = await supabase
      .from("products")
      .update({
        is_active: false,
        updated_at: getCurrentDate().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/productos");
    revalidateTag("products");
    revalidateTag("stats");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return {
      success: false,
      message: error.message || "Error al eliminar el producto",
    };
  }
}


export interface ProductsWithStats {
  products: any[];
  lowStockProducts: any[];
}

/**
 * Obtiene productos con estadísticas consolidadas en una sola consulta
 * Consolida: productos, stock bajo
 */
export async function getProductsWithStats(): Promise<{ success: boolean; data?: ProductsWithStats; message?: string }> {
  try {
    const supabase = await createClient();

    // Una sola consulta para obtener todos los productos activos con sus categorías
    const { data: allProducts, error } = await supabase
      .from("products")
      .select(`
        *,
        category:categories(name)
      `)
      .eq("is_active", true)
      .order("name");

    // Verificar errores
    if (error) throw error;

    // Filtrar productos con stock bajo en JavaScript usando los datos ya obtenidos
    const lowStockProducts = (allProducts || []).filter(product =>
      !product.unlimited_stock && product.stock <= product.min_stock
    );

    const productsData: ProductsWithStats = {
      products: allProducts || [],
      lowStockProducts: lowStockProducts
    };

    return { success: true, data: productsData };
  } catch (error: any) {
    console.error("Error getting products with stats:", error);
    return {
      success: false,
      message: error.message || "Error al obtener productos con estadísticas"
    };
  }
}

export async function importProductsFromPDF() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Para importación masiva, usar ID de sistema si no hay autenticación
    // (útil para scripts de migración iniciales)
    let userId = user?.id || 'system-import';

    // Extraer productos del PDF
    const pdfProducts = await extractProductsFromPDF();

    if (pdfProducts.length === 0) {
      return { success: false, message: "No se encontraron productos válidos en el PDF" };
    }

    // Verificar productos existentes para evitar duplicados por nombre
    const existingProducts = await supabase
      .from("products")
      .select("name")
      .in("name", pdfProducts.map(p => p.name));

    const existingNames = new Set(existingProducts.data?.map(p => p.name) || []);
    const newProducts = pdfProducts.filter(p => !existingNames.has(p.name));

    if (newProducts.length === 0) {
      return {
        success: false,
        message: `Todos los ${pdfProducts.length} productos del PDF ya existen en el sistema`
      };
    }

    // Preparar datos para inserción con valores por defecto
    const productsToInsert = newProducts.map(product => ({
      name: product.name,
      description: `Importado desde PDF`,
      cost_price: 0, // Valor por defecto, el usuario ajustará manualmente
      sale_price: 0, // Valor por defecto, el usuario ajustará manualmente
      stock: 0, // Valor por defecto, el usuario ajustará manualmente
      min_stock: 1, // Valor por defecto mínimo
      unlimited_stock: false,
      cocina_only: false,
      is_active: true,
      created_at: getCurrentDate().toISOString(),
      updated_at: getCurrentDate().toISOString(),
    }));

    // Insertar productos
    const { data: insertedProducts, error } = await supabase
      .from("products")
      .insert(productsToInsert)
      .select();

    if (error) throw error;

    // Crear entradas en el historial de precios para cada producto
    const priceHistoryEntries = insertedProducts.map(product => ({
      product_id: product.id,
      old_price: 0,
      new_price: product.sale_price,
      changed_by: userId,
      changed_at: getCurrentDate().toISOString(),
    }));

    await supabase.from("price_history").insert(priceHistoryEntries);

    revalidatePath("/productos");

    return {
      success: true,
      message: `Se importaron ${insertedProducts.length} productos exitosamente. ${pdfProducts.length - newProducts.length} productos ya existían.`,
      data: {
        imported: insertedProducts.length,
        skipped: pdfProducts.length - newProducts.length,
        total: pdfProducts.length
      }
    };
  } catch (error: any) {
    console.error("Error importing products from PDF:", error);
    return {
      success: false,
      message: error.message || "Error al importar productos del PDF",
    };
  }
}

