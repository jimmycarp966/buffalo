/**
 * Helper para subir el certificado .p12 de AFIP a Supabase Storage de forma segura
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Sube el certificado .p12 a Supabase Storage
 * El archivo se almacena en el bucket 'private-files' con RLS activado
 */
export async function uploadAfipCertificate(
  certPath: string
): Promise<{ success: boolean; storagePath?: string; message?: string }> {
  try {
    const supabase = await createClient();

    // Verificar permisos de admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden subir certificados",
      };
    }

    // Leer archivo del sistema de archivos local
    const certBuffer = await readFile(certPath);
    const fileName = path.basename(certPath);
    const storagePath = `afip/${fileName}`;

    // Verificar/crear bucket
    const { data: buckets } = await supabase.storage.listBuckets();
    const privateBucket = buckets?.find((b) => b.name === "private-files");

    if (!privateBucket) {
      // Crear bucket privado si no existe
      const { error: createError } = await supabase.storage.createBucket(
        "private-files",
        {
          public: false,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ["application/x-pkcs12", "application/octet-stream"],
        }
      );

      if (createError) {
        console.error("Error creando bucket:", createError);
        return {
          success: false,
          message: "Error al crear bucket de almacenamiento",
        };
      }
    }

    // Subir archivo
    const { error: uploadError } = await supabase.storage
      .from("private-files")
      .upload(storagePath, certBuffer, {
        contentType: "application/x-pkcs12",
        upsert: true, // Reemplazar si ya existe
      });

    if (uploadError) {
      console.error("Error subiendo certificado:", uploadError);
      return { success: false, message: `Error al subir certificado: ${uploadError.message}` };
    }

    return {
      success: true,
      storagePath,
      message: "Certificado subido exitosamente",
    };
  } catch (error: any) {
    console.error("Error en uploadAfipCertificate:", error);
    return {
      success: false,
      message: error.message || "Error al subir certificado",
    };
  }
}

/**
 * Descarga el certificado .p12 desde Supabase Storage
 * Esto se usa internamente por afipClient.ts
 */
export async function downloadAfipCertificate(
  storagePath: string
): Promise<{ success: boolean; data?: Buffer; message?: string }> {
  try {
    // Usar Service Role Key para acceder al bucket privado
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return {
        success: false,
        message: 'Missing Supabase environment variables',
      };
    }

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.storage
      .from("private-files")
      .download(storagePath);

    if (error) {
      console.error("Error descargando certificado:", error);
      return {
        success: false,
        message: `Error al descargar certificado: ${error.message}`,
      };
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    return {
      success: true,
      data: buffer,
    };
  } catch (error: any) {
    console.error("Error en downloadAfipCertificate:", error);
    return {
      success: false,
      message: error.message || "Error al descargar certificado",
    };
  }
}

/**
 * Elimina el certificado del storage (útil para rotación de certificados)
 */
export async function deleteAfipCertificate(
  storagePath: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient();

    // Verificar permisos de admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      return {
        success: false,
        message: "Solo administradores pueden eliminar certificados",
      };
    }

    const { error } = await supabase.storage
      .from("private-files")
      .remove([storagePath]);

    if (error) {
      return {
        success: false,
        message: `Error al eliminar certificado: ${error.message}`,
      };
    }

    return { success: true, message: "Certificado eliminado exitosamente" };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error al eliminar certificado",
    };
  }
}

