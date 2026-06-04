/**
 * Kitchen Printer Utility - RPT004
 * ================================
 * Utilidad para formatear e imprimir tickets de cocina
 * Compatible con impresoras térmicas ESC/POS
 * Modelo específico: RPT004
 */

export interface KitchenPrintData {
  tableNumber?: number | null; // Opcional para delivery
  items: Array<{
    name: string;
    quantity: number;
    customization?: string;
  }>;
  waiterName?: string;
  timestamp: string;
  orderType?: 'new' | 'add'; // nuevo pedido o agregar items
  saleType?: 'table' | 'counter' | 'delivery';
  customerName?: string;
  deliveryAddress?: string;
}

/**
 * Sanitiza texto del cliente antes de armar el ticket ESC/POS.
 * Elimina bytes de control (code < 0x20) que podrían inyectar comandos ESC/POS,
 * preservando saltos de línea y tabulaciones (\n \r \t).
 */
function sanitize(text: unknown): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Permitir \t (0x09), \n (0x0A), \r (0x0D); descartar el resto de controles < 0x20
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    out += str[i];
  }
  return out;
}

function buildEscPosFinishSequence(lf: string) {
  let finish = "";
  finish += lf.repeat(4);
  finish += "\x1B\x64\x03";
  finish += "\x1D\x56\x00";
  finish += "\x1D\x56\x41\x03";
  finish += "\x1B\x69";
  return finish;
}

/**
 * Genera el contenido del ticket de cocina en formato ESC/POS
 */
export function generateKitchenTicket(data: KitchenPrintData, width: number = 48): string {
  const centerText = (text: string) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  };

  const line = '='.repeat(width);
  const dashLine = '-'.repeat(width);

  let ticket = '';

  // Configurar ancho de la impresora (CRÍTICO para que use todo el ancho disponible)
  // Para impresoras térmicas: 48 caracteres = 58mm, 42-48 caracteres = 80mm
  // Comando ESC/POS para establecer el ancho de impresión
  // IMPORTANTE: Inicializar la impresora ANTES de cualquier otro comando
  // CRÍTICO: Inicializar impresora con comandos correctos
  // El comando ESC @ (0x1B 0x40) resetea la impresora y desactiva cualquier modo especial
  ticket += '\x1B\x40'; // Inicializar impresora (reset completo)
  // Configurar tamaño de letra grande para todo el ticket (doble ancho y alto)
  ticket += '\x1D\x21\x11'; // Tamaño doble ancho y alto (2x2)
  ticket += '\x1B\x61\x00'; // Alinear izquierda
  ticket += '\x1B\x45\x00'; // Negrita OFF
  
  // Usar CRLF (\r\n) para saltos de línea en impresoras ESC/POS
  // Windows Print Spooler requiere CRLF para saltos de línea correctos
  const LF = '\r\n'; // CRLF en lugar de solo LF

  // Información de la mesa, mostrador o delivery
  ticket += '\x1B\x45\x01'; // Negrita ON
  ticket += '\x1B\x61\x01'; // Centrar texto
  ticket += '\x1D\x21\x11'; // Tamaño doble ancho y alto
  
  if (data.saleType === 'delivery') {
    ticket += 'DELIVERY';
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
    ticket += '\x1B\x61\x00'; // Alinear izquierda
    if (data.customerName) {
      ticket += `Cliente: ${sanitize(data.customerName)}` + LF;
    }
    if (data.deliveryAddress) {
      ticket += `Dirección: ${sanitize(data.deliveryAddress)}` + LF;
    }
  } else if (data.saleType === 'counter') {
    ticket += 'MOSTRADOR';
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
    ticket += '\x1B\x61\x00'; // Alinear izquierda
  } else {
    // Mesa (table)
    ticket += `MESA: ${data.tableNumber || 'N/A'}`;
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
    ticket += '\x1B\x61\x00'; // Alinear izquierda
  }
  ticket += '\x1B\x45\x00'; // Negrita OFF

  // Hora y mozo (solo para mesas, no para mostrador ni delivery)
  // Validar timestamp para evitar "Invalid Date"
  let timeStr = 'N/A';
  try {
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    if (!isNaN(timestamp.getTime())) {
      timeStr = timestamp.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  } catch (error) {
    // Si falla el parseo, usar hora actual
    timeStr = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  ticket += `Hora: ${timeStr}` + LF;
  
  // Solo mostrar mozo para mesas (table), no para mostrador ni delivery
  if (data.waiterName && data.saleType === 'table') {
    ticket += `Mozo: ${data.waiterName}` + LF;
  }

  ticket += dashLine + LF;

  // Items
  ticket += '\x1B\x45\x01'; // Negrita ON
  data.items.forEach((item) => {
    const qtyStr = `${item.quantity}x`;
    const nameMaxLength = width - qtyStr.length - 1;
    const safeName = sanitize(item.name);
    const truncatedName = safeName.length > nameMaxLength
      ? safeName.substring(0, nameMaxLength - 3) + '...'
      : safeName;

    ticket += `${qtyStr} ${truncatedName}` + LF;

    // Personalización/notas
    if (item.customization) {
      ticket += '\x1B\x45\x00'; // Negrita OFF
      ticket += `   ${sanitize(item.customization)}` + LF;
      ticket += '\x1B\x45\x01'; // Negrita ON
    }
  });
  ticket += '\x1B\x45\x00'; // Negrita OFF

  ticket += dashLine + LF;
  
  // Información de la mesa, mostrador o delivery - REPETIR AL FINAL
  ticket += LF; // Espacio antes del tipo de pedido
  ticket += '\x1B\x45\x01'; // Negrita ON
  ticket += '\x1B\x61\x01'; // Centrar texto
  ticket += '\x1D\x21\x11'; // Tamaño doble ancho y alto
  
  if (data.saleType === 'delivery') {
    ticket += 'DELIVERY';
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
  } else if (data.saleType === 'counter') {
    ticket += 'MOSTRADOR';
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
  } else {
    // Mesa (table)
    ticket += `MESA: ${data.tableNumber || 'N/A'}`;
    if (data.orderType === 'add') {
      ticket += ' (AGREGAR)';
    }
    ticket += LF;
  }
  ticket += '\x1B\x61\x00'; // Alinear izquierda
  ticket += '\x1B\x45\x00'; // Negrita OFF
  ticket += '\x1D\x21\x00'; // Tamaño normal
  
  // Espacios adicionales para asegurar que todo el contenido salga antes del corte
  ticket += LF + LF + LF + LF + LF; // 5 saltos de línea adicionales
  
  // Feed adicional antes del corte para asegurar que todo salga
  ticket += '\x1B\x64\x05'; // Feed de papel 5 líneas (ESC d n)
  
  // Cortar papel (si la impresora lo soporta)
  ticket += '\x1D\x56\x01'; // Corte completo (en lugar de parcial)

  ticket += buildEscPosFinishSequence(LF);
  return ticket;
}

/**
 * Convierte el ticket a ArrayBuffer para enviarlo a la impresora
 * Usa ISO-8859-1 (Latin1) en lugar de UTF-8 para preservar bytes ESC/POS
 * CRÍTICO: TextEncoder usa UTF-8 que corrompe los comandos ESC/POS
 */
export function ticketToArrayBuffer(ticket: string): ArrayBuffer {
  // Crear buffer manualmente byte por byte
  const buffer = new ArrayBuffer(ticket.length);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < ticket.length; i++) {
    // Obtener el código del carácter (preserva bytes 0-255)
    // El operador & 0xFF asegura que solo tomamos el byte bajo
    view[i] = ticket.charCodeAt(i) & 0xFF;
  }

  return buffer;
}

/**
 * Genera el contenido en HTML para visualización en navegador (fallback)
 */
export function generateKitchenTicketHTML(data: KitchenPrintData): string {
  // Validar timestamp para evitar "Invalid Date"
  let time = 'N/A';
  try {
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    if (!isNaN(timestamp.getTime())) {
      time = timestamp.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  } catch (error) {
    // Si falla el parseo, usar hora actual
    time = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  let html = `
    <div style="font-family: 'Courier New', monospace; font-size: 20px; max-width: 400px; margin: 0 auto; padding: 20px; border: 2px solid #000;">
      <div style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 15px;">
        ${data.saleType === 'delivery' 
          ? `DELIVERY${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
          : data.saleType === 'counter'
          ? `MOSTRADOR${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
          : `MESA: ${data.tableNumber || 'N/A'}${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
        }
      </div>
      ${data.saleType === 'delivery' ? `
        ${data.customerName ? `<div style="font-weight: bold; font-size: 20px;">Cliente: ${data.customerName}</div>` : ''}
        ${data.deliveryAddress ? `<div style="font-weight: bold; font-size: 20px;">Dirección: ${data.deliveryAddress}</div>` : ''}
      ` : ''}
      
      <div style="margin-bottom: 10px; font-size: 20px;">
        <div>Hora: ${time}</div>
        ${data.waiterName && data.saleType === 'table' ? `<div>Mozo: ${data.waiterName}</div>` : ''}
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0;">
  `;

  data.items.forEach((item) => {
    html += `
      <div style="font-weight: bold; margin: 5px 0; font-size: 20px;">
        ${item.quantity}x ${item.name}
      </div>
    `;
    
    if (item.customization) {
      html += `
        <div style="font-weight: normal; margin-left: 20px; font-size: 18px; color: #666;">
          ${item.customization}
        </div>
      `;
    }
  });

  html += `
      </div>
      
      <div style="text-align: center; font-size: 24px; font-weight: bold; margin-top: 15px;">
        ${data.saleType === 'delivery' 
          ? `DELIVERY${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
          : data.saleType === 'counter'
          ? `MOSTRADOR${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
          : `MESA: ${data.tableNumber || 'N/A'}${data.orderType === 'add' ? ' (AGREGAR)' : ''}`
        }
      </div>
    </div>
  `;

  return html;
}

/**
 * Configuración de comandos ESC/POS para RPT004
 */
export const ESC_POS_COMMANDS = {
  INIT: '\x1B\x40',                 // Inicializar impresora
  BOLD_ON: '\x1B\x45\x01',          // Activar negrita
  BOLD_OFF: '\x1B\x45\x00',         // Desactivar negrita
  ALIGN_LEFT: '\x1B\x61\x00',       // Alinear izquierda
  ALIGN_CENTER: '\x1B\x61\x01',     // Alinear centro
  ALIGN_RIGHT: '\x1B\x61\x02',      // Alinear derecha
  FONT_SIZE_NORMAL: '\x1D\x21\x00', // Tamaño normal
  FONT_SIZE_DOUBLE: '\x1D\x21\x11', // Doble altura y ancho
  WIDTH_SET: '\x1D\x57',            // Configurar ancho de impresión (requiere parámetros)
  WIDTH_58MM: '\x1D\x57\x02\x00',   // Ancho estándar 58mm (48 caracteres)
  WIDTH_80MM: '\x1D\x57\x03\x00',   // Ancho ancho 80mm (42-48 caracteres)
  CUT_PARTIAL: '\x1D\x56\x00',      // Corte parcial
  CUT_FULL: '\x1D\x56\x01',         // Corte completo
  LINE_FEED: '\x0A',                // Salto de línea
  BEEP: '\x1B\x42\x05\x05',        // Sonido (5 beeps de 50ms)
};


