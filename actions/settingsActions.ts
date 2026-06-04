"use server";

import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { storeSettingsSchema, type StoreSettingsInput } from "@/lib/validations";
import { checkUserPermission } from "./permissionActions";

// ============================================================================
// GET ADMIN SETTINGS
// Obtiene la configuración para el panel de admin (requiere permisos)
// ============================================================================
export async function getAdminSettings() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, message: "No autenticado" };
        }

        // Verificar permisos (solo admin o usuarios con permiso settings.view)
        const { hasPermission } = await checkUserPermission(user.id, "settings.view");
        if (!hasPermission) {
            return { success: false, message: "No tienes permisos para ver la configuración" };
        }

        const { data, error } = await supabase
            .from("store_settings")
            .select("*")
            .single();

        if (error) {
            // Si no existe, devolver valores por defecto sin error (se creará al guardar)
            if (error.code === 'PGRST116') {
                return {
                    success: true,
                    data: {
                        store_name: brand.defaultStoreName,
                        estimated_delivery_time: 30,
                        is_open: true,
                        daily_menu_content: "",
                        daily_menu_active: false
                    }
                };
            }
            throw error;
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching admin settings:", error);
        return {
            success: false,
            message: error.message || "Error al obtener configuración",
        };
    }
}

// ============================================================================
// UPDATE STORE SETTINGS
// Actualiza la configuración global
// ============================================================================
export async function updateStoreSettings(data: StoreSettingsInput) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, message: "No autenticado" };
        }

        // Verificar permisos de edición contra el permiso real en BD
        // (NO confiar en user_metadata, que es manipulable desde el cliente)
        const { hasPermission } = await checkUserPermission(user.id, "settings.edit");
        if (!hasPermission) {
            return { success: false, message: "No tenés permisos para esta acción" };
        }

        // Validar datos
        const validated = storeSettingsSchema.parse(data);

        // Verificar si ya existe configuración
        const { data: existing } = await supabase
            .from("store_settings")
            .select("id")
            .single();

        let result;
        if (existing) {
            // Actualizar
            result = await supabase
                .from("store_settings")
                .update({
                    ...validated,
                    updated_at: new Date().toISOString()
                })
                .eq("id", existing.id)
                .select()
                .single();
        } else {
            // Crear
            result = await supabase
                .from("store_settings")
                .insert({
                    ...validated,
                    // Valores por defecto si faltan
                    store_name: validated.store_name || brand.defaultStoreName,
                    estimated_delivery_time: validated.estimated_delivery_time || 30
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        // Revalidar paths públicos y de admin
        revalidatePath("/pedidos");
        revalidatePath("/configuracion");

        return { success: true, data: result.data };
    } catch (error: any) {
        console.error("Error updating store settings:", error);
        return {
            success: false,
            message: error.message || "Error al actualizar configuración",
        };
    }
}
