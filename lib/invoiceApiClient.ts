/**
 * Cliente API REST para servicios intermediarios de facturación ARCA/AFIP
 * Soporta TusFacturasAPP, Facturear, y otros servicios similares
 */

export interface ArcaConfig {
  cuit: string;
  pointOfSale: number;
  apiKey: string;
  service: 'tusfacturasapp' | 'facturear' | 'afipsdk';
  environment: 'testing' | 'production';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceData {
  items: InvoiceItem[];
  total: number;
  customerName?: string;
  customerCuit?: string;
  customerDni?: string;
  customerAddress?: string;
}

export interface InvoiceResponse {
  success: boolean;
  invoiceNumber?: string;
  pointOfSale?: number;
  cae?: string;
  caeExpiration?: string;
  qrCode?: string;
  message?: string;
  error?: string;
}

export class InvoiceApiClient {
  private config: ArcaConfig;

  constructor(config: ArcaConfig) {
    this.config = config;
  }

  /**
   * Generar factura C usando el servicio intermediario configurado
   */
  async generateInvoiceC(data: InvoiceData): Promise<InvoiceResponse> {
    try {
      switch (this.config.service) {
        case 'tusfacturasapp':
          return await this.generateWithTusFacturasAPP(data);
        case 'facturear':
          return await this.generateWithFacturear(data);
        case 'afipsdk':
          return await this.generateWithAfipSDK(data);
        default:
          throw new Error(`Servicio no soportado: ${this.config.service}`);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error desconocido al generar factura',
      };
    }
  }

  /**
   * Generar factura usando TusFacturasAPP
   * Documentación: https://developers.tusfacturas.app/
   */
  private async generateWithTusFacturasAPP(data: InvoiceData): Promise<InvoiceResponse> {
    const baseUrl = this.config.environment === 'production'
      ? 'https://api.tusfacturas.app'
      : 'https://api-test.tusfacturas.app';

    const invoiceData = {
      tipo_comprobante: 'C', // Factura C
      punto_venta: this.config.pointOfSale,
      fecha_emision: new Date().toISOString().split('T')[0],
      concepto: data.items.map(item => ({
        codigo: '', // Código del producto (opcional)
        descripcion: item.description,
        cantidad: item.quantity,
        precio_unitario: item.unitPrice,
        importe: item.subtotal,
      })),
      importe_total: data.total,
      cliente: {
        nombre: data.customerName || 'Consumidor Final',
        cuit: data.customerCuit || data.customerDni || '0',
        domicilio: data.customerAddress || '',
      },
    };

    const response = await fetch(`${baseUrl}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(invoiceData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || result.error || 'Error al generar factura',
      };
    }

    return {
      success: true,
      invoiceNumber: result.numero_comprobante?.toString(),
      pointOfSale: result.punto_venta,
      cae: result.cae,
      caeExpiration: result.cae_fecha_vencimiento,
      qrCode: result.qr_code,
    };
  }

  /**
   * Generar factura usando Facturear
   * Documentación: https://docs.facture.ar/
   */
  private async generateWithFacturear(data: InvoiceData): Promise<InvoiceResponse> {
    const baseUrl = this.config.environment === 'production'
      ? 'https://api.facture.ar'
      : 'https://api-test.facture.ar';

    const invoiceData = {
      tipo: 'C',
      punto_venta: this.config.pointOfSale,
      fecha: new Date().toISOString().split('T')[0],
      items: data.items.map(item => ({
        descripcion: item.description,
        cantidad: item.quantity,
        precio_unitario: item.unitPrice,
        subtotal: item.subtotal,
      })),
      total: data.total,
      cliente: {
        nombre: data.customerName || 'Consumidor Final',
        documento: data.customerCuit || data.customerDni || '0',
        direccion: data.customerAddress || '',
      },
    };

    const response = await fetch(`${baseUrl}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify(invoiceData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || 'Error al generar factura',
      };
    }

    return {
      success: true,
      invoiceNumber: result.numero?.toString(),
      pointOfSale: result.punto_venta,
      cae: result.cae,
      caeExpiration: result.cae_vencimiento,
      qrCode: result.qr,
    };
  }

  /**
   * Generar factura usando Afip SDK (si ofrece API REST)
   */
  private async generateWithAfipSDK(data: InvoiceData): Promise<InvoiceResponse> {
    // Implementación pendiente - depende de la API específica de Afip SDK
    // Por ahora retornamos error
    return {
      success: false,
      error: 'Afip SDK API REST no implementado aún',
    };
  }

  /**
   * Validar configuración antes de generar factura
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.cuit || this.config.cuit.length < 11) {
      errors.push('CUIT inválido');
    }

    if (!this.config.pointOfSale || this.config.pointOfSale < 1) {
      errors.push('Punto de venta inválido');
    }

    if (!this.config.apiKey || this.config.apiKey.length < 10) {
      errors.push('API Key inválida');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}




