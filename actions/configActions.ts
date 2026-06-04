"use server";

import { brand } from "@/lib/brand";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// [GENÉRICO] Configuración del establecimiento - Personalizable para multi-tenant
export async function getAppSettings() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .order("key");

    if (error) throw error;

    // Convertir array a objeto para facilitar el acceso
    const settings: { [key: string]: string } = {};
    data?.forEach((setting) => {
      settings[setting.key] = setting.value;
    });

    return { success: true, data: settings };
  } catch (error: any) {
    console.error("Error fetching app settings:", error);
    return {
      success: false,
      message: error.message || "Error al obtener configuraciones",
      data: {},
    };
  }
}

export async function updateAppSetting(key: string, value: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden modificar configuraciones",
      };
    }

    // Verificar si existe
    const { data: existing } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      // Actualizar
      const { error } = await supabase
        .from("app_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);

      if (error) throw error;
    } else {
      // Crear
      const { error } = await supabase
        .from("app_settings")
        .insert([{ key, value }]);

      if (error) throw error;
    }

    revalidatePath("/configuracion");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating app setting:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar configuración",
    };
  }
}

export async function initializeDefaultSettings() {
  try {
    const supabase = await createClient();

    const defaultSettings = [
      { key: "business_name", value: brand.defaultStoreName, description: "Nombre del negocio" },
      { key: "business_address", value: "", description: "Dirección del negocio" },
      { key: "business_phone", value: "", description: "Teléfono de contacto" },
      { key: "business_cuit", value: "", description: "CUIT/RUC" },
      { key: "ticket_footer_message", value: "¡Gracias por su compra!", description: "Mensaje en el pie del ticket" },
      { key: "kitchen_printer_name", value: "", description: "Nombre de la impresora de cocina" },
      { key: "cashier_printer_name", value: "", description: "Nombre de la impresora del cajero" },
    ];

    for (const setting of defaultSettings) {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", setting.key)
        .maybeSingle();

      if (!existing) {
        await supabase.from("app_settings").insert([setting]);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error initializing settings:", error);
    return {
      success: false,
      message: error.message || "Error al inicializar configuraciones",
    };
  }
}

/**
 * Obtener configuración de impresoras
 */
export async function getPrinterSettings() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .in("key", [
        "kitchen_printer_name",
        "cashier_printer_name",
        "local_print_server_enabled",
        "local_print_server_host",
        "local_print_server_port",
      ]);

    if (error) throw error;

    const settings = {
      kitchen_printer_name: data?.find(s => s.key === "kitchen_printer_name")?.value || "",
      cashier_printer_name: data?.find(s => s.key === "cashier_printer_name")?.value || "",
      local_print_server_enabled:
        data?.find(s => s.key === "local_print_server_enabled")?.value === "true",
      local_print_server_host:
        data?.find(s => s.key === "local_print_server_host")?.value || "",
      local_print_server_port:
        data?.find(s => s.key === "local_print_server_port")?.value || "3001",
    };

    return { success: true, data: settings };
  } catch (error: any) {
    console.error("Error fetching printer settings:", error);
    return {
      success: false,
      message: error.message || "Error al obtener configuración de impresoras",
      data: {
        kitchen_printer_name: "",
        cashier_printer_name: "",
        local_print_server_enabled: false,
        local_print_server_host: "",
        local_print_server_port: "3001",
      },
    };
  }
}

/**
 * Actualizar configuración de impresoras
 */
export async function updatePrinterSettings(
  kitchenPrinter: string,
  cashierPrinter: string,
  localPrintServerEnabled: boolean,
  localPrintServerHost: string,
  localPrintServerPort: string,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden modificar configuraciones",
      };
    }

    // Actualizar ambas configuraciones y verificar resultados
    const kitchenResult = await updateAppSetting("kitchen_printer_name", kitchenPrinter);
    if (!kitchenResult.success) {
      console.error("Error actualizando impresora de cocina:", kitchenResult.message);
      return { success: false, message: kitchenResult.message };
    }

    const cashierResult = await updateAppSetting("cashier_printer_name", cashierPrinter);
    if (!cashierResult.success) {
      console.error("Error actualizando impresora del cajero:", cashierResult.message);
      return { success: false, message: cashierResult.message };
    }

    const localServerEnabledResult = await updateAppSetting(
      "local_print_server_enabled",
      localPrintServerEnabled.toString(),
    );
    if (!localServerEnabledResult.success) {
      console.error(
        "Error actualizando uso del servidor local:",
        localServerEnabledResult.message,
      );
      return { success: false, message: localServerEnabledResult.message };
    }

    const localServerHostResult = await updateAppSetting(
      "local_print_server_host",
      localPrintServerHost.trim(),
    );
    if (!localServerHostResult.success) {
      console.error(
        "Error actualizando host del servidor local:",
        localServerHostResult.message,
      );
      return { success: false, message: localServerHostResult.message };
    }

    const localServerPortResult = await updateAppSetting(
      "local_print_server_port",
      localPrintServerPort.trim() || "3001",
    );
    if (!localServerPortResult.success) {
      console.error(
        "Error actualizando puerto del servidor local:",
        localServerPortResult.message,
      );
      return { success: false, message: localServerPortResult.message };
    }

    revalidatePath("/configuracion");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating printer settings:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar configuración de impresoras",
    };
  }
}

/**
 * Obtener configuración de impresora de cocina (RPT004)
 */
export async function getPrinterConfig() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "No autenticado",
      };
    }

    const adminClient = createAdminClient();
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) throw userError;

    if (!userData?.is_active) {
      return {
        success: false,
        message: "Usuario inactivo",
      };
    }

    const { data, error } = await adminClient
      .from("app_settings")
      .select("*")
      .in("key", [
        "kitchen_printer_enabled",
        "kitchen_printer_ip",
        "kitchen_printer_port",
        "kitchen_printer_model",
        "kitchen_printer_width",
        "kitchen_print_on_open_table",
        "kitchen_print_on_add_items",
        "cash_printer_enabled",
        "cash_printer_name",
        "cash_printer_width",
        "local_print_server_enabled",
        "local_print_server_host",
        "local_print_server_port"
      ]);

    if (error) throw error;

    const settings = {
      kitchen: {
        enabled: data?.find(s => s.key === "kitchen_printer_enabled")?.value === "true",
        ip: data?.find(s => s.key === "kitchen_printer_ip")?.value || "192.168.1.100",
        port: parseInt(data?.find(s => s.key === "kitchen_printer_port")?.value || "9100"),
        model: data?.find(s => s.key === "kitchen_printer_model")?.value || "RPT004",
        width: parseInt(data?.find(s => s.key === "kitchen_printer_width")?.value || "48"),
        printOnOpenTable: data?.find(s => s.key === "kitchen_print_on_open_table")?.value === "true",
        printOnAddItems: data?.find(s => s.key === "kitchen_print_on_add_items")?.value === "true"
      },
      cash: {
        enabled: data?.find(s => s.key === "cash_printer_enabled")?.value === "true",
        name: data?.find(s => s.key === "cash_printer_name")?.value || "",
        width: parseInt(data?.find(s => s.key === "cash_printer_width")?.value || "32")
      },
      localServer: {
        enabled: data?.find(s => s.key === "local_print_server_enabled")?.value === "true",
        host: data?.find(s => s.key === "local_print_server_host")?.value || "",
        port: parseInt(data?.find(s => s.key === "local_print_server_port")?.value || "3001")
      }
    };

    return { success: true, data: settings };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error al obtener configuración de impresoras",
      error
    };
  }
}

// Mantener compatibilidad con versiones anteriores
export async function getKitchenPrinterConfig() {
  const result = await getPrinterConfig();
  if (!result.success || !result.data) return result;
  // TypeScript necesita esta aserción después de la verificación
  return { success: true, data: result.data!.kitchen };
}

/**
 * Obtener la cadena completa de impresora de cocina
 * Prioriza nombre UNC si está configurado, sino usa IP:puerto
 */
export async function getKitchenPrinterString() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado", data: "" };
    }

    const adminClient = createAdminClient();
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) throw userError;

    if (!userData?.is_active) {
      return { success: false, message: "Usuario inactivo", data: "" };
    }
    
    // Obtener configuración de nombre de impresora (puede ser UNC)
    const { data: nameData } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "kitchen_printer_name")
      .single();
    
    // Si hay un nombre configurado (puede ser UNC como \\SERVIDOR\Cocina), usarlo
    if (nameData?.value && nameData.value.trim() !== '') {
      const printerName = nameData.value.trim();
      // Si es un nombre UNC o contiene barras invertidas, usarlo directamente
      if (printerName.startsWith('\\\\') || printerName.includes('\\')) {
        return { success: true, data: printerName };
      }
      // Si es un nombre simple, usarlo también
      return { success: true, data: printerName };
    }
    
    // Si no hay nombre, intentar usar IP:puerto como fallback, pero preferir UNC conocido
    // Primero intentar obtener el nombre UNC detectado por el servidor (si está disponible)
    // Si no, usar IP:puerto, pero con una advertencia
    const result = await getPrinterConfig();
    if (!result.success || !result.data) {
      // Fallback con nombre UNC conocido (impresora compartida típica)
      return { success: true, data: "\\\\SERVIDOR\\Cocina" };
    }

    const kitchenConfig = result.data.kitchen;
    
    // Si la IP es 192.168.0.114 (impresora compartida), usar UNC en lugar de IP:puerto
    if (kitchenConfig.ip === '192.168.0.114' || kitchenConfig.ip === '192.168.1.100') {
      // Probablemente es una impresora compartida, usar UNC conocido
      return { success: true, data: "\\\\SERVIDOR\\Cocina" };
    }
    
    // Para otras IPs, usar IP:puerto (impresora de red directa)
    const printerString = `${kitchenConfig.ip}:${kitchenConfig.port}`;
    return { success: true, data: printerString };
  } catch (error: any) {
    console.error("Error obteniendo cadena de impresora de cocina:", error);
    // Fallback con nombre UNC conocido
    return { success: false, message: error.message, data: "\\\\SERVIDOR\\Cocina" };
  }
}

/**
 * Actualizar configuración de impresora de cocina
 */
export async function updateKitchenPrinterConfig(config: {
  enabled: boolean;
  ip: string;
  port: number;
  model: string;
  width: number;
  printOnOpenTable: boolean;
  printOnAddItems: boolean;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden modificar configuraciones",
      };
    }

    // Actualizar cada configuración
    await updateAppSetting("kitchen_printer_enabled", config.enabled.toString());
    await updateAppSetting("kitchen_printer_ip", config.ip);
    await updateAppSetting("kitchen_printer_port", config.port.toString());
    await updateAppSetting("kitchen_printer_model", config.model);
    await updateAppSetting("kitchen_printer_width", config.width.toString());
    await updateAppSetting("kitchen_print_on_open_table", config.printOnOpenTable.toString());
    await updateAppSetting("kitchen_print_on_add_items", config.printOnAddItems.toString());

    revalidatePath("/configuracion");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating kitchen printer config:", error);
    return {
      success: false,
      message: error.message || "Error al actualizar configuración de impresora de cocina",
    };
  }
}

/**
 * Obtener configuración de ARCA
 */
export async function getArcaConfig() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .in("key", [
        "arca_cuit",
        "arca_point_of_sale",
        "arca_api_key",
        "arca_service",
        "arca_environment"
      ]);

    if (error) throw error;

    const settings = {
      cuit: data?.find(s => s.key === "arca_cuit")?.value || "",
      pointOfSale: parseInt(data?.find(s => s.key === "arca_point_of_sale")?.value || "0"),
      apiKey: data?.find(s => s.key === "arca_api_key")?.value || "",
      service: (data?.find(s => s.key === "arca_service")?.value || "tusfacturasapp") as 'tusfacturasapp' | 'facturear' | 'afipsdk',
      environment: (data?.find(s => s.key === "arca_environment")?.value || "testing") as 'testing' | 'production',
    };

    return { success: true, data: settings };
  } catch (error: any) {
    console.error("Error fetching ARCA config:", error);
    return {
      success: false,
      message: error.message || "Error al obtener configuración de ARCA",
      data: {
        cuit: "",
        pointOfSale: 0,
        apiKey: "",
        service: "tusfacturasapp" as const,
        environment: "testing" as const,
      },
    };
  }
}


