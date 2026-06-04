"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { checkUserPermission } from "./permissionActions";
import { buildDefaultSalonLayout, needsBarLayoutNormalization } from "@/lib/barLayoutDefaults";

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

const layoutSchema = z.object({
  table_number: z.number().min(1),
  zone: z.enum(['principal', 'exterior']),
  position_x: z.number().min(0), // Píxeles exactos (DECIMAL)
  position_y: z.number().min(0), // Píxeles exactos (DECIMAL)
  width: z.number().min(0.5).max(4).optional(),
  height: z.number().min(0.5).max(4).optional(),
  shape: z.enum(['square', 'circle', 'rectangle']).optional(),
  size_variant: z.enum(['small', 'normal', 'large']).optional(),
  custom_name: z.string().optional(),
  custom_color: z.string().optional(),
  area: z.enum(['salon', 'vereda']).optional(),
  order_index: z.number().optional(),
});

const updateTableSizeSchema = z.object({
  width: z.number().min(0.5).max(4),
  height: z.number().min(0.5).max(4),
});

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Obtiene el layout completo del bar
 * Accesible para todos los usuarios autenticados
 * @deprecated Usar getTablesByArea en su lugar
 */
export async function getBarLayout() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("bar_layout")
      .select("*")
      .eq("is_active", true)
      .eq("area", "salon") // Por defecto 'salon' para retrocompatibilidad
      .order("zone")
      .order("position_y")
      .order("position_x");

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("❌ Error getting bar layout:", error);
    return {
      success: false,
      message: error.message || "Error al obtener layout del bar",
      data: [],
    };
  }
}

/**
 * Obtiene las mesas por área específica
 * Accesible para todos los usuarios autenticados
 */
export async function getTablesByArea(area: 'salon' | 'vereda' = 'salon') {
  try {
    const supabase = await createClient();

    let { data, error } = await supabase
      .from("bar_layout")
      .select("*")
      .eq("is_active", true)
      .eq("area", area)
      .order("order_index")
      .order("zone")
      .order("position_y")
      .order("position_x");

    if (error) throw error;

    if (area === "salon" && (!data || data.length === 0)) {
      const defaultLayout = buildDefaultSalonLayout();
      const { data: insertedLayout, error: insertError } = await supabase
        .from("bar_layout")
        .insert(defaultLayout)
        .select("*")
        .order("order_index")
        .order("zone")
        .order("position_y")
        .order("position_x");

      if (insertError) throw insertError;

      data = insertedLayout || [];
      revalidatePath("/caja-bar");
      revalidateTag("bar-layout");
    } else if (area === "salon" && needsBarLayoutNormalization(data)) {
      const normalizedLayout = buildDefaultSalonLayout();
      const updates = normalizedLayout.map((table) =>
        supabase
          .from("bar_layout")
          .update({
            position_x: table.position_x,
            position_y: table.position_y,
            width: table.width,
            height: table.height,
            shape: table.shape,
            size_variant: table.size_variant,
            zone: table.zone,
            area: table.area,
            order_index: table.order_index,
            is_active: true,
          })
          .eq("table_number", table.table_number),
      );

      await Promise.all(updates);

      const normalizedResult = await supabase
        .from("bar_layout")
        .select("*")
        .eq("is_active", true)
        .eq("area", area)
        .order("order_index")
        .order("zone")
        .order("position_y")
        .order("position_x");

      if (normalizedResult.error) throw normalizedResult.error;

      data = normalizedResult.data || [];
      revalidatePath("/caja-bar");
      revalidateTag("bar-layout");
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error(`❌ Error getting tables for area ${area}:`, error);
    return {
      success: false,
      message: error.message || `Error al obtener mesas del área ${area}`,
      data: [],
    };
  }
}

export async function getBarLayoutsForAreas(areas: Array<'salon' | 'vereda'> = ['salon', 'vereda']) {
  const uniqueAreas = Array.from(new Set(areas));

  const results = await Promise.all(
    uniqueAreas.map(async (area) => {
      const result = await getTablesByArea(area);
      return { area, result };
    })
  );

  const data: Record<string, any[]> = {};
  for (const { area, result } of results) {
    data[area] = result.success ? result.data : [];
  }

  return { success: true, data };
}

/**
 * Obtiene todas las mesas disponibles de todas las áreas (salon y vereda)
 * Usado para el cambio de mesa entre áreas
 */
export async function getAllAvailableTables() {
  try {
    const [salonResult, veredaResult] = await Promise.all([
      getTablesByArea('salon'),
      getTablesByArea('vereda')
    ]);

    if (!salonResult.success || !veredaResult.success) {
      return {
        success: false,
        message: "Error al obtener mesas de una o más áreas",
        data: [],
      };
    }

    // Combinar mesas de ambas áreas y agregar propiedad de área a cada mesa
    const allTables = [
      ...salonResult.data.map(table => ({ ...table, area: 'salon' })),
      ...veredaResult.data.map(table => ({ ...table, area: 'vereda' }))
    ];

    return { success: true, data: allTables };
  } catch (error: any) {
    console.error("❌ Error getting all available tables:", error);
    return {
      success: false,
      message: error.message || "Error al obtener todas las mesas disponibles",
      data: [],
    };
  }
}

/**
 * Actualiza la posición de una mesa en el layout
 * Solo Admin puede usar esta función
 */
export async function updateTablePosition(
  tableNumber: number,
  position: { x: number; y: number; zone: string }
) {
  try {
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero pueden editar layout
    if (userData.role !== "admin" && userData.role !== "cashier") {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden editar el layout del bar",
      };
    }

    // Validar zona
    if (position.zone !== 'principal' && position.zone !== 'exterior') {
      return {
        success: false,
        message: "Zona inválida. Debe ser 'principal' o 'exterior'",
      };
    }

    // Obtener mesa para saber su área antes de actualizar
    const { data: tableBefore } = await supabase
      .from("bar_layout")
      .select("area")
      .eq("table_number", tableNumber)
      .single();

    if (!tableBefore) {
      return { success: false, message: "Mesa no encontrada" };
    }

    // Actualizar posición
    const { error } = await supabase
      .from("bar_layout")
      .update({
        position_x: Math.round(position.x),
        position_y: Math.round(position.y),
        zone: position.zone,
      })
      .eq("table_number", tableNumber);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag(`bar-layout:${tableBefore.area}`);
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error updating table position:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar posición",
    };
  }
}

/**
 * Actualiza propiedades de una mesa (nombre, color, tamaño, etc.)
 * Solo Admin puede usar esta función
 */
export async function updateTableLayout(
  tableNumber: number,
  updates: Partial<z.infer<typeof layoutSchema>>
) {
  try {
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero pueden editar layout
    if (userData.role !== "admin" && userData.role !== "cashier") {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden editar el layout del bar",
      };
    }

    // Validar que no se actualice a una zona inválida
    if (updates.zone && updates.zone !== 'principal' && updates.zone !== 'exterior') {
      return {
        success: false,
        message: "Zona inválida. Debe ser 'principal' o 'exterior'",
      };
    }

    // Obtener mesa para saber su área antes de actualizar
    const { data: tableBefore } = await supabase
      .from("bar_layout")
      .select("area")
      .eq("table_number", tableNumber)
      .single();

    if (!tableBefore) {
      return { success: false, message: "Mesa no encontrada" };
    }

    const { error } = await supabase
      .from("bar_layout")
      .update(updates)
      .eq("table_number", tableNumber);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag(`bar-layout:${tableBefore.area}`);
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error updating table layout:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar layout",
    };
  }
}

/**
 * Actualiza el tamaño de una mesa (width y height)
 * Solo Admin o Cajero pueden usar esta función
 */
export async function updateTableSize(
  tableNumber: number,
  size: { width: number; height: number }
) {
  try {
    const validated = updateTableSizeSchema.parse(size);
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero pueden editar layout
    if (userData.role !== "admin" && userData.role !== "cashier") {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden editar el layout del bar",
      };
    }

    // Obtener mesa para saber su área
    const { data: table } = await supabase
      .from("bar_layout")
      .select("area")
      .eq("table_number", tableNumber)
      .single();

    if (!table) {
      return { success: false, message: "Mesa no encontrada" };
    }

    // Actualizar tamaño
    const { error } = await supabase
      .from("bar_layout")
      .update({
        width: validated.width,
        height: validated.height,
      })
      .eq("table_number", tableNumber);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag(`bar-layout:${table.area}`);
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error updating table size:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Tamaño inválido: " + error.errors.map(e => e.message).join(", "),
      };
    }

    return {
      success: false,
      message: error.message || "Error al actualizar tamaño de mesa",
    };
  }
}

/**
 * Duplica las mesas de Salón a Vereda y normaliza a 15 mesas
 * Solo Admin puede usar esta función
 */
export async function duplicateSalonToVeredaAndNormalize() {
  try {
    const supabase = await createClient();

    // Verificar permisos
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden duplicar mesas",
      };
    }

    // Verificar si Vereda ya tiene mesas
    const { data: existingVeredaTables } = await supabase
      .from("bar_layout")
      .select("table_number")
      .eq("area", "vereda")
      .eq("is_active", true);

    if (existingVeredaTables && existingVeredaTables.length > 0) {
      return {
        success: false,
        message: "Vereda ya tiene mesas. Elimínalas primero si querés duplicar de nuevo.",
      };
    }

    // Obtener mesas de Salón ordenadas por order_index
    const { data: salonTables } = await supabase
      .from("bar_layout")
      .select("*")
      .eq("area", "salon")
      .eq("is_active", true)
      .order("order_index")
      .order("table_number");

    if (!salonTables || salonTables.length === 0) {
      return {
        success: false,
        message: "No hay mesas en Salón para duplicar",
      };
    }

    // Normalizar a 15 mesas
    let tablesToDuplicate = salonTables;

    // Si hay más de 15, tomar las primeras 15
    if (salonTables.length > 15) {
      tablesToDuplicate = salonTables.slice(0, 15);
    }

    // Obtener el siguiente número de mesa disponible para Vereda
    const { data: maxTable } = await supabase
      .from("bar_layout")
      .select("table_number")
      .order("table_number", { ascending: false })
      .limit(1)
      .single();

    const baseTableNumber = maxTable?.table_number ? maxTable.table_number + 1 : 100;

    // Si hay menos de 15, crear mesas adicionales
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 700;
    const MESA_SIZE = 80;
    const GRID_SIZE = MESA_SIZE + 10;
    const PADDING = 10;
    const perRow = Math.max(1, Math.floor((CANVAS_WIDTH - PADDING * 2) / GRID_SIZE));

    const tablesToInsert: any[] = [];

    // Duplicar mesas existentes de Salón con nuevos números de mesa para Vereda
    tablesToDuplicate.forEach((table, index) => {
      tablesToInsert.push({
        table_number: baseTableNumber + index, // Usar números nuevos para Vereda
        zone: table.zone || 'principal',
        position_x: table.position_x,
        position_y: table.position_y,
        width: table.width || 1,
        height: table.height || 1,
        shape: table.shape || 'square',
        size_variant: table.size_variant || 'normal',
        custom_name: table.custom_name ? `${table.custom_name} (Vereda)` : null,
        custom_color: table.custom_color,
        area: 'vereda',
        order_index: index + 1,
        is_active: true,
      });
    });

    // Si hay menos de 15, crear mesas adicionales
    if (tablesToDuplicate.length < 15) {
      const startIndex = tablesToDuplicate.length;
      for (let i = startIndex; i < 15; i++) {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const newX = PADDING + col * GRID_SIZE;
        const newY = PADDING + row * GRID_SIZE;

        tablesToInsert.push({
          table_number: baseTableNumber + i, // Continuar con la numeración
          zone: 'principal',
          position_x: newX,
          position_y: newY,
          width: 1,
          height: 1,
          shape: 'square',
          size_variant: 'normal',
          area: 'vereda',
          order_index: i + 1,
          is_active: true,
        });
      }
    }

    // Insertar todas las mesas de Vereda
    const { error } = await supabase
      .from("bar_layout")
      .insert(tablesToInsert);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag("bar-layout:vereda");
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return {
      success: true,
      message: `${tablesToInsert.length} mesas duplicadas exitosamente a Vereda`,
    };
  } catch (error: any) {
    console.error("❌ Error duplicating salon to vereda:", error);
    return {
      success: false,
      message: error.message || "Error al duplicar mesas a Vereda",
    };
  }
}

/**
 * Obtiene el siguiente número de mesa disponible
 * Considera todas las mesas (activas e inactivas) para evitar conflictos
 */
export async function getNextTableNumber() {
  try {
    const supabase = await createClient();

    // Obtener el número máximo de todas las mesas (activas e inactivas)
    const { data, error } = await supabase
      .from("bar_layout")
      .select("table_number")
      .order("table_number", { ascending: false })
      .limit(1);

    if (error) throw error;

    // Si no hay mesas, retornar 1
    if (!data || data.length === 0) {
      return { success: true, data: 1 };
    }

    const maxTableNumber = data[0].table_number;
    return { success: true, data: maxTableNumber + 1 };
  } catch (error: any) {
    console.error("❌ Error getting next table number:", error);
    return {
      success: false,
      message: error.message || "Error al obtener siguiente número de mesa",
      data: 1, // Fallback seguro
    };
  }
}

/**
 * Agrega una nueva mesa al layout
 * Solo Admin puede usar esta función
 */
export async function addNewTable(data: z.infer<typeof layoutSchema>) {
  try {
    const validated = layoutSchema.parse(data);
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero con permisos de layout
    if (!["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden agregar mesas al bar",
      };
    }

    // Verificar que el número de mesa no exista
    const { data: existingTable } = await supabase
      .from("bar_layout")
      .select("id")
      .eq("table_number", validated.table_number)
      .single();

    if (existingTable) {
      return {
        success: false,
        message: `La mesa ${validated.table_number} ya existe`,
      };
    }

    // Preparar datos para insertar (solo incluir campos que no sean undefined)
    const dataToInsert: any = {
      table_number: validated.table_number,
      zone: validated.zone,
      position_x: validated.position_x,
      position_y: validated.position_y,
      area: validated.area || 'salon', // Por defecto 'salon'
      order_index: validated.order_index || validated.table_number,
    };

    // Agregar campos opcionales solo si están definidos
    if (validated.width !== undefined) dataToInsert.width = validated.width;
    if (validated.height !== undefined) dataToInsert.height = validated.height;
    if (validated.shape) dataToInsert.shape = validated.shape;
    if (validated.size_variant) dataToInsert.size_variant = validated.size_variant;
    if (validated.custom_name) dataToInsert.custom_name = validated.custom_name;
    if (validated.custom_color) dataToInsert.custom_color = validated.custom_color;

    const { error } = await supabase
      .from("bar_layout")
      .insert(dataToInsert);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag(`bar-layout:${dataToInsert.area}`);
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return { success: true, message: "Mesa agregada exitosamente" };
  } catch (error: any) {
    console.error("❌ Error adding new table:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Datos inválidos: " + error.errors.map(e => e.message).join(", "),
      };
    }

    return {
      success: false,
      message: error.message || "Error al agregar mesa",
    };
  }
}

/**
 * Elimina una mesa del layout (soft delete)
 * Solo Admin puede usar esta función
 */
export async function deleteTable(tableNumber: number) {
  try {
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero con permisos de layout
    if (!["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden eliminar mesas del bar",
      };
    }

    // Verificar que no haya ventas pendientes en esa mesa
    const { data: pendingSales } = await supabase
      .from("sales")
      .select("id")
      .eq("table_number", tableNumber)
      .eq("status", "pending")
      .limit(1);

    if (pendingSales && pendingSales.length > 0) {
      return {
        success: false,
        message: `No se puede eliminar la mesa ${tableNumber} porque tiene ventas pendientes. Cierra la mesa primero.`,
      };
    }

    // Desactivar mesa (soft delete)
    const { error } = await supabase
      .from("bar_layout")
      .update({ is_active: false })
      .eq("table_number", tableNumber);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return {
      success: true,
      message: `Mesa ${tableNumber} eliminada exitosamente`
    };
  } catch (error: any) {
    console.error("❌ Error deleting table:", error);
    return {
      success: false,
      message: error.message || "Error al eliminar mesa",
    };
  }
}

/**
 * Obtiene el porcentaje de división de zonas
 * Por defecto es 60% (Principal) / 40% (Exterior)
 */
export async function getZoneDivision() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "bar_zone_division_percentage")
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no encontrado
      throw error;
    }

    // Si no existe, usar valor por defecto 60%
    const percentage = data?.value ? parseFloat(data.value) : 60;

    return {
      success: true,
      data: { percentage }
    };
  } catch (error: any) {
    console.error("❌ Error getting zone division:", error);
    return {
      success: false,
      message: error.message || "Error al obtener división de zonas",
      data: { percentage: 60 } // Fallback al default
    };
  }
}

/**
 * Actualiza el porcentaje de división de zonas
 * Solo Admin puede usar esta función
 */
export async function updateZoneDivision(percentage: number) {
  try {
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero con permisos de layout
    if (!["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden editar la división de zonas",
      };
    }

    // Validar porcentaje (entre 30% y 80%)
    if (percentage < 30 || percentage > 80) {
      return {
        success: false,
        message: "El porcentaje debe estar entre 30% y 80%",
      };
    }

    // Guardar en app_settings
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "bar_zone_division_percentage",
        value: percentage.toString(),
        description: "Porcentaje de división entre Zona Principal y Exterior en el mapa del bar",
      }, {
        onConflict: "key"
      });

    if (error) throw error;

    revalidatePath("/caja-bar");
    return {
      success: true,
      message: `División actualizada: ${percentage}% Principal / ${100 - percentage}% Exterior`
    };
  } catch (error: any) {
    console.error("❌ Error updating zone division:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar división de zonas",
    };
  }
}

/**
 * Restaura una mesa eliminada (activa de nuevo)
 * Solo Admin puede usar esta función
 */
export async function restoreTable(tableNumber: number) {
  try {
    const supabase = await createClient();

    // Verificar permisos: admin o cajero con permisos de layout
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return { success: false, message: "Usuario no encontrado" };
    }

    // Verificar permisos: admin o cajero con permisos de layout
    if (!["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden restaurar mesas del bar",
      };
    }

    const { error } = await supabase
      .from("bar_layout")
      .update({ is_active: true })
      .eq("table_number", tableNumber);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return {
      success: true,
      message: `Mesa ${tableNumber} restaurada exitosamente`
    };
  } catch (error: any) {
    console.error("❌ Error restoring table:", error);
    return {
      success: false,
      message: error.message || "Error al restaurar mesa",
    };
  }
}


/**
 * Resetea el layout a su configuración por defecto
 * Solo Admin puede usar esta función
 */
export async function resetLayoutToDefault() {
  try {
    const supabase = await createClient();

    // Verificar permisos
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "cashier"].includes(userData.role)) {
      return {
        success: false,
        message: "Solo administradores y cajeros pueden resetear el layout",
      };
    }

    // Eliminar todo el layout actual
    await supabase.from("bar_layout").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const defaultLayout = buildDefaultSalonLayout();

    const { error } = await supabase
      .from("bar_layout")
      .insert(defaultLayout);

    if (error) throw error;

    revalidatePath("/caja-bar");
    revalidateTag('bar-layout'); // Invalida cache global de layouts
    return {
      success: true,
      message: "Layout reseteado a configuración por defecto"
    };
  } catch (error: any) {
    console.error("❌ Error resetting layout:", error);
    return {
      success: false,
      message: error.message || "Error al resetear layout",
    };
  }
}

