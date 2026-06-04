/**
 * Cliente para comunicarse directamente con los Web Services de ARCA/AFIP
 * Usa el SDK @afipsdk/afip.js para facturación electrónica
 */

"use server";

import Afip from "@afipsdk/afip.js";
import { createClient } from "@/lib/supabase/server";

// Tipos para la configuración de AFIP
interface AfipConfig {
  cuit: string;
  cert: string; // Path al certificado .p12 o contenido en base64
  key?: string; // No es necesario con .p12
  passphrase: string; // Contraseña del certificado .p12
  production: boolean; // true = producción, false = homologación
}

// Tipos para items de factura
export interface AfipInvoiceItem {
  producto: string;
  cantidad: number;
  precio_unitario: number;
  iva: number; // 21, 10.5, 5, 2.5, 0
  subtotal: number;
}

// Tipos para datos del comprador (opcional para Factura C)
export interface AfipBuyer {
  nombre?: string;
  documento_tipo?: number; // 80=CUIT, 96=DNI, 99=Sin identificar
  documento_numero?: string;
  domicilio?: string;
  provincia?: string;
  condicion_iva?: number; // 5=Consumidor Final, 1=IVA Responsable Inscripto
}

// Tipos para la respuesta de AFIP
export interface AfipInvoiceResponse {
  success: boolean;
  cae?: string;
  cae_expiration?: string;
  invoice_number?: number;
  invoice_date?: string;
  error_message?: string;
  afip_errors?: any[];
}

/**
 * Obtiene la configuración de AFIP desde la base de datos
 */
async function getAfipConfig(): Promise<AfipConfig | null> {
  try {
    // Usar Service Role Key para acceder a la configuración
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[AFIP] Missing Supabase credentials');
      return null;
    }

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Obtener configuración desde app_settings (columnas correctas: key, value)
    const { data: settings, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "afip_cuit",
        "afip_cert_path",
        "afip_passphrase",
        "afip_environment",
      ]);

    if (error || !settings || settings.length === 0) {
      console.error("Error obteniendo configuración de AFIP:", error);
      return null;
    }

    // Convertir array a objeto
    const config: any = {};
    settings.forEach((setting) => {
      config[setting.key] = setting.value;
    });

    // Validar que tengamos todos los datos necesarios
    if (!config.afip_cuit || !config.afip_cert_path || !config.afip_passphrase) {
      console.error("Configuración de AFIP incompleta");
      return null;
    }

    // Por defecto SIEMPRE homologación (modo prueba). Solo se usa producción
    // si afip_environment está explícitamente seteado en "production".
    const environment = (config.afip_environment ?? "").toString().trim().toLowerCase();
    const isProduction = environment === "production";

    return {
      cuit: config.afip_cuit,
      cert: config.afip_cert_path,
      passphrase: config.afip_passphrase,
      production: isProduction,
    };
  } catch (error: any) {
    console.error("Error en getAfipConfig:", error);
    return null;
  }
}

/**
 * Inicializa el cliente de AFIP
 * Lee los certificados PEM desde variables de entorno
 */
export async function getAfipClient(): Promise<Afip | null> {
  try {
    console.log('[AFIP] 1. Obteniendo configuración...');
    const config = await getAfipConfig();
    if (!config) {
      console.error('[AFIP] ERROR: No se pudo obtener configuración');
      return null;
    }
    console.log('[AFIP] ✓ Configuración OK:', { cuit: config.cuit, production: config.production });

    console.log('[AFIP] 2. Leyendo certificados PEM desde variables de entorno...');
    
    // Leer desde variables de entorno (Vercel)
    const cert = process.env.AFIP_CERT_PEM;
    const key = process.env.AFIP_KEY_PEM;
    
    if (!cert || !key) {
      throw new Error('Variables de entorno AFIP_CERT_PEM o AFIP_KEY_PEM no configuradas');
    }
    
    console.log('[AFIP] ✓ Cert PEM:', cert.length, 'caracteres');
    console.log('[AFIP] ✓ Key PEM:', key.length, 'caracteres');

    console.log('[AFIP] 3. Inicializando SDK de AFIP...');
    
    // Si está en producción, necesita access_token
    const accessToken = process.env.AFIP_ACCESS_TOKEN;
    
    const afipConfig: any = {
      CUIT: config.cuit,
      production: config.production,
      cert: cert,
      key: key,
    };
    
    // Agregar access_token solo si está en producción
    if (config.production && accessToken) {
      afipConfig.access_token = accessToken;
      console.log('[AFIP] ✓ Access token configurado para producción');
    } else if (config.production && !accessToken) {
      throw new Error('Modo producción requiere AFIP_ACCESS_TOKEN. Obtén uno en https://app.afipsdk.com/');
    }
    
    const afip = new Afip(afipConfig);
    console.log('[AFIP] ✓ SDK inicializado correctamente');

    return afip;
  } catch (error: any) {
    console.error("[AFIP] ERROR FATAL inicializando cliente:", error);
    console.error("[AFIP] Stack:", error.stack);
    return null;
  }
}

/**
 * Obtiene el último número de comprobante para un punto de venta
 */
export async function getLastInvoiceNumber(
  pointOfSale: number,
  invoiceType: number = 11 // 11 = Factura C
): Promise<{ success: boolean; number?: number; message?: string }> {
  try {
    console.log('[AFIP] getLastInvoiceNumber - Iniciando...');
    console.log('[AFIP] Punto de venta:', pointOfSale);
    console.log('[AFIP] Tipo de comprobante:', invoiceType);
    
    const afip = await getAfipClient();
    if (!afip) {
      console.error('[AFIP] No se pudo inicializar el cliente');
      return {
        success: false,
        message: "No se pudo inicializar el cliente de AFIP",
      };
    }

    console.log('[AFIP] Cliente inicializado, forzando renovación de TA...');
    // Forzar renovación del Token Authorization para evitar problemas de caché
    await afip.ElectronicBilling.getTokenAuthorization(true);
    console.log('[AFIP] TA renovado, consultando último comprobante...');
    
    const lastNumber = await afip.ElectronicBilling.getLastVoucher(
      pointOfSale,
      invoiceType
    );

    console.log('[AFIP] Último número obtenido:', lastNumber);
    return {
      success: true,
      number: lastNumber || 0,
    };
  } catch (error: any) {
    console.error("[AFIP] ERROR obteniendo último número:", error);
    console.error("[AFIP] Error response:", error.response?.data);
    console.error("[AFIP] Error status:", error.response?.status);
    console.error("[AFIP] Error full:", JSON.stringify(error, null, 2));
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Error al consultar AFIP",
    };
  }
}

/**
 * Genera una factura electrónica en AFIP
 */
export async function createAfipInvoice(
  pointOfSale: number,
  invoiceType: number = 11, // 11 = Factura C
  total: number,
  items: AfipInvoiceItem[],
  buyer?: AfipBuyer
): Promise<AfipInvoiceResponse> {
  try {
    console.log('[AFIP] createAfipInvoice - Iniciando...');
    console.log('[AFIP] Parámetros:', { pointOfSale, invoiceType, total, itemsCount: items.length });
    
    const afip = await getAfipClient();
    if (!afip) {
      console.error('[AFIP] ERROR: No se pudo inicializar el cliente de AFIP');
      return {
        success: false,
        error_message: "No se pudo inicializar el cliente de AFIP. Verifique las variables de entorno AFIP_CERT_PEM y AFIP_KEY_PEM.",
      };
    }

    console.log('[AFIP] Cliente inicializado correctamente');

    // Obtener el siguiente número de comprobante
    console.log('[AFIP] Obteniendo último número de comprobante...');
    const lastNumberResult = await getLastInvoiceNumber(pointOfSale, invoiceType);
    if (!lastNumberResult.success) {
      console.error('[AFIP] ERROR obteniendo último número:', lastNumberResult.message);
      return {
        success: false,
        error_message: lastNumberResult.message || "Error al obtener último número de comprobante",
      };
    }

    const invoiceNumber = (lastNumberResult.number || 0) + 1;
    console.log('[AFIP] Siguiente número de comprobante:', invoiceNumber);

    // Preparar datos de la factura
    const invoiceDate = new Date();
    const dateStr = invoiceDate.toISOString().split("T")[0].replace(/-/g, "");
    console.log('[AFIP] Fecha de factura:', dateStr);

    // Preparar datos del comprador (por defecto Consumidor Final)
    const buyerData = {
      DocTipo: buyer?.documento_tipo || 99, // 99 = Sin identificar
      DocNro: buyer?.documento_numero ? parseInt(buyer.documento_numero) : 0,
      ImpTotal: total,
    };

    console.log('[AFIP] Datos del comprador:', buyerData);

    // Crear factura
    const data = {
      CantReg: 1, // Cantidad de comprobantes (1)
      PtoVta: pointOfSale,
      CbteTipo: invoiceType,
      Concepto: 1, // 1=Productos, 2=Servicios, 3=Productos y Servicios
      DocTipo: buyerData.DocTipo,
      DocNro: buyerData.DocNro,
      CbteDesde: invoiceNumber,
      CbteHasta: invoiceNumber,
      CbteFch: dateStr,
      ImpTotal: total,
      ImpTotConc: 0, // Importe neto no gravado
      ImpNeto: total, // Importe neto gravado
      ImpOpEx: 0, // Importe exento
      ImpIVA: 0, // Importe IVA (Factura C no discrimina IVA)
      ImpTrib: 0, // Impuestos adicionales
      MonId: "PES", // Moneda (PES = Pesos)
      MonCotiz: 1, // Cotización de la moneda
    };

    console.log('[AFIP] Datos de factura preparados:', JSON.stringify(data, null, 2));

    // Enviar a AFIP
    console.log('[AFIP] Enviando factura a AFIP...');
    const result = await afip.ElectronicBilling.createVoucher(data);

    console.log('[AFIP] Respuesta de AFIP:', result ? 'OK' : 'NULL');
    if (result) {
      console.log('[AFIP] CAE recibido:', result.CAE ? 'SÍ' : 'NO');
      console.log('[AFIP] Observaciones:', result.Observaciones || 'Ninguna');
    }

    if (result && result.CAE) {
      console.log('[AFIP] Factura creada exitosamente, CAE:', result.CAE);
      return {
        success: true,
        cae: result.CAE,
        cae_expiration: result.CAEFchVto,
        invoice_number: invoiceNumber,
        invoice_date: dateStr,
      };
    } else {
      const errorMsg = result?.Observaciones 
        ? `AFIP no devolvió CAE. Observaciones: ${JSON.stringify(result.Observaciones)}`
        : "AFIP no devolvió CAE";
      console.error('[AFIP] ERROR:', errorMsg);
      return {
        success: false,
        error_message: errorMsg,
        afip_errors: result?.Observaciones || [],
      };
    }
  } catch (error: any) {
    console.error("[AFIP] ERROR CRÍTICO creando factura:", error);
    console.error("[AFIP] Stack trace:", error.stack);
    console.error("[AFIP] Error completo:", JSON.stringify(error, null, 2));
    
    const errorMessage = error.response?.data?.message 
      || error.message 
      || "Error al generar factura en AFIP";
    
    return {
      success: false,
      error_message: errorMessage,
    };
  }
}

/**
 * Obtiene información de un comprobante ya emitido
 */
export async function getInvoiceInfo(
  pointOfSale: number,
  invoiceType: number,
  invoiceNumber: number
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const afip = await getAfipClient();
    if (!afip) {
      return {
        success: false,
        message: "No se pudo inicializar el cliente de AFIP",
      };
    }

    const info = await afip.ElectronicBilling.getVoucherInfo(
      invoiceNumber,
      pointOfSale,
      invoiceType
    );

    return {
      success: true,
      data: info,
    };
  } catch (error: any) {
    console.error("Error obteniendo información de factura:", error);
    return {
      success: false,
      message: error.message || "Error al consultar AFIP",
    };
  }
}

/**
 * Verifica el estado del servidor de AFIP
 */
export async function checkAfipStatus(): Promise<{
  success: boolean;
  status?: string;
  message?: string;
}> {
  try {
    const afip = await getAfipClient();
    if (!afip) {
      return {
        success: false,
        message: "No se pudo inicializar el cliente de AFIP",
      };
    }

    console.log('[AFIP] Forzando renovación de TA para checkStatus...');
    // Forzar renovación del Token Authorization para evitar problemas de caché
    await afip.ElectronicBilling.getTokenAuthorization(true);
    console.log('[AFIP] TA renovado, verificando estado del servidor...');

    const status = await afip.ElectronicBilling.getServerStatus();

    return {
      success: true,
      status: status?.AppServer || "unknown",
    };
  } catch (error: any) {
    console.error("Error verificando estado de AFIP:", error);
    return {
      success: false,
      message: error.message || "Error al consultar AFIP",
    };
  }
}

