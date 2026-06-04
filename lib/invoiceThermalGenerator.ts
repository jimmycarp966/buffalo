/**
 * Generador de formato térmico para facturas ARCA/AFIP
 * Formato: 80mm (estándar térmica)
 */

import QRCode from 'qrcode';

export interface InvoiceThermalData {
  // Datos del negocio
  businessName: string;
  businessCuit: string;
  businessAddress?: string;
  businessPhone?: string;
  businessStartDate?: string;
  
  // Datos de la factura
  invoiceType: 'C';
  pointOfSale: number;
  invoiceNumber: string;
  date: string;
  time: string;
  tableNumber?: number;
  issuedAt?: string;
  
  // Datos del cliente (opcional para Factura C)
  customerName?: string;
  customerCuit?: string;
  customerDni?: string;
  customerAddress?: string;
  
  // Items
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  
  // Totales
  subtotal: number;
  total: number;
  
  // CAE
  cae: string;
  caeExpiration: string;
  
  // QR Code (datos para generar QR)
  qrData?: string;
}

/**
 * Generar contenido de factura térmica según formato ARCA
 */
export async function generateThermalInvoiceContent(data: InvoiceThermalData): Promise<string> {
  const width = 48; // Ancho en caracteres para impresora 80mm
  
  let content = '';
  
  const sanitizeText = (text?: string | null) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N');
  };
  
  // Función helper para centrar texto
  const centerText = (text: string, lineWidth = width): string => {
    const padding = Math.max(0, Math.floor((lineWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  };
  
  // Función helper para línea separadora
  const drawLine = (char = '-', lineWidth = width): string => {
    return char.repeat(lineWidth);
  };
  
  // Función helper para formatear números
  const formatNumber = (num: number): string => {
    return num.toFixed(2).replace('.', ',');
  };

  const formatDateTime = (): string => {
    if (data.issuedAt) {
      const date = new Date(data.issuedAt);
      const formatted = date.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour12: true,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return formatted.replace('a. m.', 'AM').replace('p. m.', 'PM');
    }

    const fallback = `${sanitizeText(data.date)} ${sanitizeText(data.time)}`.trim();
    return fallback || '';
  };
  
  // ENCABEZADO
  content += '\n';
  content += `Razon social: ${sanitizeText(data.businessName)}\n`;
  content += `Direccion: ${sanitizeText(data.businessAddress || '-')}\n`;
  content += `C.U.I.T.: ${sanitizeText(data.businessCuit)}\n`;
  content += `IVA: Monotributista\n`;
  content += `IIBB: ${sanitizeText(data.businessCuit)}\n`;
  content += `Inicio de actividad: ${sanitizeText(data.businessStartDate || '')}\n`;
  content += drawLine() + '\n';
  
  // TIPO DE COMPROBANTE
  const invoiceTypeText = `FACTURA ${sanitizeText(data.invoiceType ?? 'C')}`;
  content += centerText(invoiceTypeText) + '\n';
  content += centerText('(Exento IVA)') + '\n';
  content += '\n';
  
  // PUNTO DE VENTA Y NÚMERO
  const pvFormatted = String(data.pointOfSale).padStart(5, '0');
  const invoiceFormatted = String(data.invoiceNumber).padStart(8, '0');
  content += `P.V.: ${pvFormatted}\n`;
  content += `Nro: ${invoiceFormatted}\n`;
  content += `Fecha: ${formatDateTime()}\n`;
  content += `Concepto: Productos\n`;
  content += drawLine() + '\n';
  
  // DATOS DEL CLIENTE (si aplica)
  if (data.customerName && data.customerName !== 'Consumidor Final') {
    content += `${sanitizeText(data.customerName).toUpperCase()}\n`;
    if (data.customerCuit) {
      content += `CUIT: ${sanitizeText(data.customerCuit)}\n`;
    } else if (data.customerDni) {
      content += `DNI: ${sanitizeText(data.customerDni)}\n`;
    }
  } else {
    content += 'A CONSUMIDOR FINAL\n';
  }
  content += drawLine() + '\n';

  if (data.tableNumber) {
    content += `Mesa: ${data.tableNumber}\n`;
  }
  
  content += drawLine() + '\n';
  
  data.items.forEach((item) => {
    const desc = sanitizeText(item.description);
    const qty = item.quantity.toString();
    const iva = '21%';
    const subtotal = formatNumber(item.subtotal);
    content += `${qty} ${desc.padEnd(24, ' ')}`.substring(0, 26);
    content += `${iva}`.padEnd(8, ' ');
    content += `${subtotal}`.padStart(10, ' ');
    content += '\n';
  });
  
  content += drawLine() + '\n';
  
  // TOTALES
  content += `TOTAL`.padEnd(width - formatNumber(data.total).length, ' ') + formatNumber(data.total) + '\n';
  content += drawLine() + '\n';
  
  // CAE
  content += `CAE: ${data.cae}\n`;
  content += `Vto.: ${data.caeExpiration}\n`;
  content += '\n';
  content += centerText(sanitizeText(data.businessName)) + '\n';
  content += '\n';
  if (data.qrData) {
    try {
      content += centerText('CODIGO QR') + '\n';
      content += '\n';

      content += '\x1B\x61\x01'; // centrar
      const setModel = '\x1D(k\x04\x00\x31\x41\x32\x00';
      const setSize = '\x1D(k\x03\x00\x31\x43\x06';
      const setError = '\x1D(k\x03\x00\x31\x45\x30';
      
      const qrString = sanitizeText(data.qrData);
      const storeLen = qrString.length + 3;
      const pL = String.fromCharCode(storeLen & 0xff);
      const pH = String.fromCharCode((storeLen >> 8) & 0xff);
      const storeData = `\x1D(k${pL}${pH}\x31\x50\x30${qrString}`;
      const printQr = '\x1D(k\x03\x00\x31\x51\x30';

      content += setModel;
      content += setSize;
      content += setError;
      content += storeData;
      content += printQr;
      content += '\x1B\x61\x00'; // volver a izquierda
      content += '\n\n';
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  }
  content += '\n\n\n\n';
  content += '\x1D\x56\x01'; // corte completo
  
  return content;
}

/**
 * Generar código QR como imagen base64 (para uso futuro)
 */
export async function generateQRCodeImage(data: string): Promise<string> {
  try {
    const qrImage = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
    });
    return qrImage;
  } catch (error) {
    console.error('Error generando QR:', error);
    throw error;
  }
}

/**
 * Generar datos para QR según formato ARCA
 */
export function generateQRData(data: {
  cuit: string;
  pointOfSale: number;
  invoiceNumber: string;
  date: string;
  total: number;
  cae: string;
  caeExpiration: string;
}): string {
  // Formato según especificación ARCA para QR
  // Estructura: URL con datos codificados
  const qrData = [
    data.cuit,
    String(data.pointOfSale).padStart(4, '0'),
    String(data.invoiceNumber).padStart(8, '0'),
    data.cae,
    data.caeExpiration.replace(/-/g, ''),
    String(Math.round(data.total * 100)).padStart(16, '0'),
  ].join('|');
  
  return qrData;
}




