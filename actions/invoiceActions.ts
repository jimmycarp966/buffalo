"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAfipInvoice, type AfipInvoiceItem, type AfipBuyer } from "@/lib/afipClient";
import { generateThermalInvoiceContent, generateQRData } from "@/lib/invoiceThermalGenerator";
import { getAppSettings } from "./configActions";
import { checkUserPermission } from "./permissionActions";
import { getCurrentDate } from "@/lib/utils";
import type { InvoiceCustomerInput } from "@/lib/validations";
import { brand } from "@/lib/brand";
import { Buffer } from "node:buffer";

export interface Invoice {
  id: string;
  sale_id: string;
  invoice_type: 'C';
  invoice_number: string;
  point_of_sale: number;
  cae: string;
  cae_expiration: string;
  thermal_content: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Obtener configuración de AFIP desde app_settings
 */
async function getAfipConfig(): Promise<{ 
  success: boolean; 
  cuit?: string; 
  pointOfSale?: number; 
  error?: string;
}> {
  try {
    const settingsResult = await getAppSettings();
    if (!settingsResult.success || !settingsResult.data) {
      return { success: false, error: 'No se pudo obtener configuración' };
    }

    const settings = settingsResult.data as { [key: string]: string };
    const cuit = settings['afip_cuit'] || '';
    const pointOfSale = parseInt(settings['afip_point_of_sale'] || '0');

    if (!cuit || !pointOfSale) {
      return { success: false, error: 'Configuración de AFIP incompleta. Configure CUIT y punto de venta en la configuración del sistema.' };
    }

    return {
      success: true,
      cuit,
      pointOfSale,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al obtener configuración de AFIP' };
  }
}

/**
 * Generar factura C desde una venta
 */
export async function generateInvoice(
  saleId: string,
  customerData?: InvoiceCustomerInput
): Promise<{ success: boolean; data?: Invoice; message?: string }> {
  try {
    console.log('[FACTURACION] Iniciando generación de factura para venta:', saleId);
    
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[FACTURACION] Error: Usuario no autenticado');
      return { success: false, message: 'No autenticado' };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "sales.edit");
    if (!hasPermission) {
      console.error('[FACTURACION] Error: Sin permisos para facturar:', user.id);
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    console.log('[FACTURACION] Usuario autenticado:', user.id);

    // Verificar que la venta existe y está completada
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items(
          *,
          product:products(name)
        ),
        user:users!sales_user_id_fkey(name)
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      console.error('[FACTURACION] Error obteniendo venta:', saleError);
      return { success: false, message: 'Venta no encontrada' };
    }

    console.log('[FACTURACION] Venta encontrada, status:', sale.status);

    if (sale.status !== 'completed') {
      console.error('[FACTURACION] Error: Venta no completada, status:', sale.status);
      return { success: false, message: 'Solo se pueden facturar ventas completadas' };
    }

    // IDEMPOTENCIA: si ya existe factura para esta venta, devolverla sin volver a emitir
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('sale_id', saleId)
      .maybeSingle();

    if (existingInvoice) {
      console.log('[FACTURACION] Factura ya existente para esta venta, devolviendo sin re-emitir:', existingInvoice.id);
      return { success: true, data: existingInvoice as Invoice };
    }

    console.log('[FACTURACION] Obteniendo configuración de AFIP...');
    // Obtener configuración de AFIP
    const configResult = await getAfipConfig();
    if (!configResult.success || !configResult.cuit || !configResult.pointOfSale) {
      console.error('[FACTURACION] Error en configuración AFIP:', configResult.error);
      return { success: false, message: configResult.error || 'Error en configuración de AFIP' };
    }

    const { cuit, pointOfSale } = configResult;
    console.log('[FACTURACION] Configuración AFIP OK, CUIT:', cuit, 'Punto de venta:', pointOfSale);

    // Preparar datos para factura AFIP
    console.log('[FACTURACION] Preparando items de factura...');
    const invoiceItems: AfipInvoiceItem[] = (sale.sale_items || []).map((item: any) => ({
      producto: item.product?.name || 'Producto',
      cantidad: item.quantity,
      precio_unitario: item.unit_price,
      iva: 0, // Factura C no discrimina IVA
      subtotal: item.subtotal,
    }));

    console.log('[FACTURACION] Items preparados:', invoiceItems.length, 'items');

    // Preparar datos del comprador
    const buyer: AfipBuyer | undefined = customerData ? {
      nombre: customerData.name,
      documento_tipo: customerData.cuit ? 80 : customerData.dni ? 96 : 99,
      documento_numero: customerData.cuit || customerData.dni || undefined,
      domicilio: customerData.address || sale.delivery_address || undefined,
      condicion_iva: 5, // 5 = Consumidor Final (para Factura C)
    } : undefined;

    console.log('[FACTURACION] Generando factura en AFIP...');
    // Generar factura directamente con AFIP
    const invoiceResponse = await createAfipInvoice(
      pointOfSale,
      11, // 11 = Factura C
      sale.total_amount,
      invoiceItems,
      buyer
    );

    console.log('[FACTURACION] Respuesta de AFIP:', invoiceResponse.success ? 'OK' : 'ERROR', invoiceResponse.error_message || '');

    if (!invoiceResponse.success || !invoiceResponse.cae || !invoiceResponse.invoice_number) {
      console.error('[FACTURACION] Error en respuesta de AFIP:', invoiceResponse.error_message);
      // Guardar error en BD
      const { error: insertError } = await supabase
        .from('invoices')
        .insert({
          sale_id: saleId,
          invoice_type: 'C',
          invoice_number: invoiceResponse.invoice_number?.toString() || 'ERROR',
          point_of_sale: pointOfSale,
          cae: invoiceResponse.cae || 'ERROR',
          cae_expiration: invoiceResponse.cae_expiration || new Date().toISOString(),
          status: 'error',
          error_message: invoiceResponse.error_message || 'Error desconocido al generar factura',
        });

      return {
        success: false,
        message: invoiceResponse.error_message || 'Error al generar factura en AFIP',
      };
    }

    console.log('[FACTURACION] Factura generada en AFIP exitosamente, CAE:', invoiceResponse.cae);

    // Obtener configuración del negocio para el formato térmico
    console.log('[FACTURACION] Obteniendo configuración del negocio...');
    const settingsResult = await getAppSettings();
    const settings = (settingsResult.success ? settingsResult.data : {}) as { [key: string]: string };

    const currentDate = getCurrentDate();
    const dateStr = currentDate.toLocaleDateString('es-AR');
    const timeStr = currentDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    console.log('[FACTURACION] Generando contenido térmico...');
    // Generar contenido térmico
    const qrData = generateQRData({
      cuit,
      pointOfSale,
      invoiceNumber: invoiceResponse.invoice_number.toString(),
      date: dateStr,
      total: sale.total_amount,
      cae: invoiceResponse.cae,
      caeExpiration: invoiceResponse.cae_expiration || '',
    });

    const thermalContent = await generateThermalInvoiceContent({
      businessName: settings.business_name || brand.defaultStoreName,
      businessCuit: cuit,
      businessAddress: settings.business_address || undefined,
      businessPhone: settings.business_phone || undefined,
      invoiceType: 'C',
      pointOfSale,
      invoiceNumber: invoiceResponse.invoice_number.toString(),
      date: dateStr,
      time: timeStr,
      issuedAt: currentDate.toISOString(),
      customerName: buyer?.nombre,
      customerCuit: buyer?.documento_tipo === 80 ? buyer.documento_numero : undefined,
      customerDni: buyer?.documento_tipo === 96 ? buyer.documento_numero : undefined,
      customerAddress: buyer?.domicilio,
      items: invoiceItems.map((item: AfipInvoiceItem) => ({
        description: item.producto,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal,
      })),
      subtotal: sale.total_amount,
      total: sale.total_amount,
      cae: invoiceResponse.cae,
      caeExpiration: invoiceResponse.cae_expiration || '',
      qrData,
    });

    console.log('[FACTURACION] Contenido térmico generado, tamaño:', thermalContent.length, 'caracteres');

    const thermalContentPayload = `base64:${Buffer.from(thermalContent, 'utf8').toString('base64')}`;

    // Guardar factura en BD
    console.log('[FACTURACION] Guardando factura en base de datos...');
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        sale_id: saleId,
        invoice_type: 'C',
        invoice_number: invoiceResponse.invoice_number.toString(),
        point_of_sale: pointOfSale,
        cae: invoiceResponse.cae,
        cae_expiration: invoiceResponse.cae_expiration || new Date().toISOString(),
        thermal_content: thermalContentPayload,
        status: 'approved',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[FACTURACION] Error guardando factura en BD:', insertError);
      return { success: false, message: 'Error al guardar factura en base de datos: ' + insertError.message };
    }

    console.log('[FACTURACION] Factura guardada exitosamente, ID:', invoice?.id);

    revalidatePath('/ventas');
    revalidatePath(`/ventas/${saleId}`);

    return { success: true, data: invoice };
  } catch (error: any) {
    console.error('[FACTURACION] ERROR CRÍTICO generando factura:', error);
    console.error('[FACTURACION] Stack trace:', error.stack);
    return { success: false, message: error.message || 'Error al generar factura' };
  }
}

/**
 * Obtener factura por ID de venta
 */
export async function getInvoiceBySaleId(saleId: string): Promise<{ success: boolean; data?: Invoice; message?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('sale_id', saleId)
      .maybeSingle();

    if (error) throw error;

    return { success: true, data: data || undefined };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al obtener factura' };
  }
}

/**
 * Obtener facturas con filtros
 */
export async function getInvoices(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{ success: boolean; data?: Invoice[]; message?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al obtener facturas' };
  }
}

/**
 * Imprimir factura en térmica
 * Nota: La impresión real se maneja desde el cliente enviando el contenido al servidor local (`localhost:3001`)
 * Esta función solo retorna el contenido térmico para que el cliente lo imprima
 */
export async function getThermalInvoiceContent(invoiceId: string): Promise<{ success: boolean; content?: string; message?: string }> {
  try {
    const supabase = await createClient();

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('thermal_content')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return { success: false, message: 'Factura no encontrada' };
    }

    if (!invoice.thermal_content) {
      return { success: false, message: 'No hay contenido térmico disponible para esta factura' };
    }

    let content = invoice.thermal_content;
    if (content.startsWith('base64:')) {
      try {
        const encoded = content.slice('base64:'.length);
        content = Buffer.from(encoded, 'base64').toString('utf8');
      } catch (error) {
        console.error('Error decodificando thermal_content:', error);
        return { success: false, message: 'No se pudo decodificar el contenido térmico de la factura' };
      }
    }

    return { success: true, content };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al obtener contenido de factura' };
  }
}

/**
 * Imprimir factura en térmica (wrapper para uso desde cliente)
 */
export async function printThermalInvoice(invoiceId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await getThermalInvoiceContent(invoiceId);
    
    if (!result.success || !result.content) {
      return { success: false, message: result.message || 'Error al obtener contenido' };
    }

    // La impresión real se maneja desde el cliente (que envía a localhost:3001)
    // Retornamos éxito para que el cliente proceda con el envío al PrintServer local
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al imprimir factura' };
  }
}

/**
 * Actualizar configuración de AFIP
 */
export async function updateAfipConfig(config: {
  cuit: string;
  pointOfSale: number;
  certPath: string;
  passphrase: string;
  environment: 'testing' | 'production';
}): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'No autenticado' };
    }

    // Verificar permisos (solo admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return { success: false, message: 'Solo administradores pueden modificar configuración de AFIP' };
    }

    // Actualizar configuraciones
    const { updateAppSetting } = await import('./configActions');
    await updateAppSetting('afip_cuit', config.cuit);
    await updateAppSetting('afip_point_of_sale', config.pointOfSale.toString());
    await updateAppSetting('afip_cert_path', config.certPath);
    await updateAppSetting('afip_passphrase', config.passphrase);
    await updateAppSetting('afip_environment', config.environment);

    revalidatePath('/configuracion');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al actualizar configuración' };
  }
}

/**
 * Test de conexión con AFIP
 * Verifica la configuración, certificado y conectividad sin generar facturas
 */
export async function testAfipConnection(): Promise<{
  success: boolean;
  data?: {
    cuit: string;
    pointOfSale: number;
    environment: string;
    serverStatus: string;
    lastInvoiceNumber: number;
    certificateValid: boolean;
  };
  message?: string;
  errors?: string[];
}> {
  const errors: string[] = [];
  
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'No autenticado' };
    }

    // 1. Verificar configuración
    const configResult = await getAfipConfig();
    if (!configResult.success || !configResult.cuit || !configResult.pointOfSale) {
      return { 
        success: false, 
        message: configResult.error || 'Configuración incompleta',
        errors: ['Configuración de AFIP no encontrada o incompleta']
      };
    }

    const { cuit, pointOfSale } = configResult;

    // Obtener ambiente
    const settingsResult = await getAppSettings();
    const settings = (settingsResult.success ? settingsResult.data : {}) as { [key: string]: string };
    const environment = settings['afip_environment'] || 'testing';

    // 2. Verificar estado del servidor de AFIP
    const { checkAfipStatus } = await import('@/lib/afipClient');
    const statusResult = await checkAfipStatus();
    
    if (!statusResult.success) {
      errors.push(`Error al conectar con AFIP: ${statusResult.message}`);
    }

    // 3. Consultar último número de comprobante
    const { getLastInvoiceNumber } = await import('@/lib/afipClient');
    const lastNumberResult = await getLastInvoiceNumber(pointOfSale, 11); // 11 = Factura C
    
    if (!lastNumberResult.success) {
      errors.push(`Error al consultar último número: ${lastNumberResult.message}`);
    }

    // Si hay errores críticos, retornar fallo
    if (errors.length > 0 && (!statusResult.success || !lastNumberResult.success)) {
      return {
        success: false,
        message: 'Error en la conexión con AFIP',
        errors,
      };
    }

    // Todo OK
    return {
      success: true,
      data: {
        cuit,
        pointOfSale,
        environment,
        serverStatus: statusResult.status || 'unknown',
        lastInvoiceNumber: lastNumberResult.number || 0,
        certificateValid: statusResult.success,
      },
      message: 'Conexión exitosa con AFIP',
    };
  } catch (error: any) {
    console.error('Error en test de AFIP:', error);
    return {
      success: false,
      message: error.message || 'Error al probar conexión con AFIP',
      errors: [error.message],
    };
  }
}

