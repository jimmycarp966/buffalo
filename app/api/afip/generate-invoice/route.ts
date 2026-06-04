import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAfipClient } from '@/lib/afipClient';
import { checkUserPermission } from '@/actions/permissionActions';

export async function POST(request: NextRequest) {
  try {
    const { saleId, totalAmount, items, client } = await request.json();

    // Validar datos
    if (!saleId || !totalAmount || !items || !client) {
      return NextResponse.json(
        { success: false, message: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Validar sesión y permisos ANTES de emitir
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'No autenticado' },
        { status: 403 }
      );
    }

    const { hasPermission } = await checkUserPermission(user.id, 'sales.edit');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: 'No tenés permisos para esta acción' },
        { status: 403 }
      );
    }

    // IDEMPOTENCIA: si ya existe factura para esta venta, devolverla sin volver a llamar a AFIP
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('sale_id', saleId)
      .maybeSingle();

    if (existingInvoice) {
      return NextResponse.json({
        success: true,
        data: {
          invoiceNumber: existingInvoice.invoice_number,
          cae: existingInvoice.cae,
          caeExpirationDate: existingInvoice.cae_expiration_date,
          invoiceType: existingInvoice.invoice_type,
        },
      });
    }

    // Inicializar cliente AFIP
    const afip = await getAfipClient();
    if (!afip) {
      return NextResponse.json(
        { success: false, message: 'No se pudo inicializar AFIP' },
        { status: 500 }
      );
    }

    // Obtener configuración de AFIP
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['afip_cuit', 'afip_point_of_sale']);

    const settingsMap = settings?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const pointOfSale = parseInt(settingsMap?.afip_point_of_sale || '1');

    // Determinar tipo de comprobante según tipo de cliente
    let voucherType = 11; // Factura C por defecto
    let docType = 99; // Sin identificar
    let docNumber = 0;

    if (client.clientType === 'responsable_inscripto') {
      voucherType = 1; // Factura A
      docType = 80; // CUIT
      docNumber = parseInt(client.cuit.replace(/\D/g, ''));
    } else if (client.clientType === 'monotributista' || client.clientType === 'exento') {
      voucherType = 6; // Factura B
      docType = 80; // CUIT
      docNumber = parseInt(client.cuit.replace(/\D/g, ''));
    }

    // Obtener último número de comprobante
    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(pointOfSale, voucherType);
    const nextNumber = (lastVoucher || 0) + 1;

    // Preparar datos para AFIP
    const invoiceData = {
      'CantReg': 1,
      'PtoVta': pointOfSale,
      'CbteTipo': voucherType,
      'Concepto': 1, // Productos
      'DocTipo': docType,
      'DocNro': docNumber,
      'CbteDesde': nextNumber,
      'CbteHasta': nextNumber,
      'CbteFch': parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
      'ImpTotal': totalAmount,
      'ImpTotConc': 0,
      'ImpNeto': totalAmount,
      'ImpOpEx': 0,
      'ImpIVA': 0,
      'ImpTrib': 0,
      'MonId': 'PES',
      'MonCotiz': 1,
    };

    // Generar factura en AFIP
    const afipResponse = await afip.ElectronicBilling.createVoucher(invoiceData);

    if (!afipResponse || !afipResponse.CAE) {
      return NextResponse.json(
        { success: false, message: 'Error al generar CAE en AFIP' },
        { status: 500 }
      );
    }

    // Guardar factura en la base de datos
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        sale_id: saleId,
        invoice_type: voucherType === 1 ? 'A' : voucherType === 6 ? 'B' : 'C',
        invoice_number: `${String(pointOfSale).padStart(4, '0')}-${String(nextNumber).padStart(8, '0')}`,
        cae: afipResponse.CAE,
        cae_expiration_date: afipResponse.CAEFchVto,
        total_amount: totalAmount,
        client_type: client.clientType,
        client_cuit: client.cuit || null,
        client_name: client.name || 'Consumidor Final',
        client_address: client.address || null,
        afip_response: afipResponse,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error guardando factura:', invoiceError);
      return NextResponse.json(
        { success: false, message: 'Error guardando factura en BD' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invoiceNumber: invoice.invoice_number,
        cae: invoice.cae,
        caeExpirationDate: invoice.cae_expiration_date,
        invoiceType: invoice.invoice_type,
      },
    });
  } catch (error: any) {
    console.error('Error en generate-invoice:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

