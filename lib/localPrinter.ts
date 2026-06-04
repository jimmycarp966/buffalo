import { buildThermalPreHtml, openBrowserPrintWindow } from "./browserPrint";

import { TICKET_TRANSFER_ALIAS } from "./ticketTransferInfo";
import { buildPrintBridgeBaseUrl } from "./printBridgeConfig";

export interface PrintResult {
  success: boolean;
  message?: string;
  printer?: string;
  availablePrinters?: string[];
}

interface PrinterSettingsResponse {
  success?: boolean;
  data?: {
    config?: {
      localServer?: {
        enabled?: boolean;
        host?: string;
        port?: number;
      };
    };
  };
}

function buildPrintBridgeHeaders(
  baseUrl: string,
  includeJsonContentType = false
) {
  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const hostname = new URL(baseUrl).hostname;
    if (/\.ngrok(-free)?\.(app|dev)$/i.test(hostname)) {
      headers["ngrok-skip-browser-warning"] = "1";
    }
  } catch {
  }

  return headers;
}

function buildEscPosFinishSequence(lf: string) {
  let finish = "";

  // Dejar algo de papel visible, pero sin exagerar el espacio al final.
  finish += lf.repeat(4);
  finish += "\x1B\x64\x03"; // Feed 3 líneas

  // Probar variantes comunes de corte ESC/POS.
  finish += "\x1D\x56\x00"; // GS V 0 - corte completo
  finish += "\x1D\x56\x41\x03"; // GS V A n - corte con pequeño feed
  finish += "\x1B\x69"; // ESC i - corte completo en varios modelos

  return finish;
}

async function getRemotePrintServerBaseUrl() {
  try {
    const response = await fetch("/api/settings/printers", {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as PrinterSettingsResponse;
    const localServer = payload?.data?.config?.localServer;

    return buildPrintBridgeBaseUrl({
      enabled: localServer?.enabled,
      host: localServer?.host,
      port: localServer?.port,
      fallbackHost: undefined,
    });
  } catch {
    return null;
  }
}

function getPrintBridgeApiUrl(action: "status" | "printers" | "print") {
  return `/api/print-bridge/${action}`;
}

export async function checkPrintServerStatus(): Promise<boolean> {
  try {
    const response = await fetch(getPrintBridgeApiUrl("status"), {
      method: "GET",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getAvailablePrinters(): Promise<string[]> {
  try {
    const response = await fetch(getPrintBridgeApiUrl("printers"), {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return [];

    const payload = await response.json();
    if (!payload?.success || !Array.isArray(payload.printers)) return [];

    return payload.printers
      .map((printer: { name?: string }) => printer.name?.trim() || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function printToLocal(
  content: string,
  printerName?: string,
  type: 'kitchen' | 'cash' = 'kitchen',
  width?: number,
  htmlOverride?: string
): Promise<PrintResult> {
  if (typeof window === "undefined") {
    return {
      success: false,
      message: "La impresión solo está disponible desde el navegador.",
    };
  }

  const printWidth = width || (type === 'kitchen' ? 48 : 32);
  let bridgeFailureMessage: string | null = null;

  try {
    const baseUrl = await getRemotePrintServerBaseUrl();
    if (baseUrl) {
      const response = await fetch(getPrintBridgeApiUrl("print"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          printerName,
          type,
          width: printWidth,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.success) {
        return {
          success: true,
          message: payload.message || "Ticket enviado a la PC del bar.",
          printer: payload.printer || printerName,
          availablePrinters: payload.availablePrinters,
        };
      }

      bridgeFailureMessage =
        payload?.message ||
        (payload?.baseUrl
          ? `No se pudo contactar la PC puente en ${payload.baseUrl}.`
          : "No se pudo imprimir usando la PC puente del bar.");
    }
  } catch (error: any) {
    console.error("Error al imprimir por bridge:", error);
    bridgeFailureMessage =
      error?.message || "No se pudo imprimir usando la PC puente del bar.";
  }

  try {
    await openBrowserPrintWindow({
      title: type === 'kitchen' ? 'Comanda de Cocina' : 'Ticket',
      html: htmlOverride !== undefined ? htmlOverride : buildThermalPreHtml(content),
      styles: htmlOverride !== undefined
        ? undefined
        : `
        body {
          width: ${printWidth}ch;
          max-width: 80mm;
        }
      `,
    });

    return {
      success: true,
      message: bridgeFailureMessage
        ? `Se abrió la impresión del navegador porque falló la PC puente. ${bridgeFailureMessage}`
        : "Se abrió el diálogo de impresión del navegador.",
      printer: printerName,
    };
  } catch (error: any) {
    console.error('Error al imprimir:', error);
    return {
      success: false,
      message:
        bridgeFailureMessage ||
        error.message ||
        'No se pudo abrir la ventana de impresión.',
    };
  }
}

/**
 * Generar contenido de ticket de caja en formato texto simple
 * Compatible con impresoras térmicas
 */
export function generateCashierTicket(data: {
  header: string;
  businessInfo?: {
    address?: string;
    phone?: string;
    cuit?: string;
  };
  saleType?: 'table' | 'counter' | 'delivery';
  tableNumber?: number | null;
  customerName?: string;
  deliveryAddress?: string;
  lines: Array<{ label: string; value: string }>;
  items: Array<{ quantity: number; name: string; unit_price: number }>;
  total: number;
  totalLabel?: string; // Label para el total (por defecto "TOTAL:", puede ser "RESTANTE:" para pagos parciales)
  // Ajuste global opcional: si hay descuento o recargo se imprime el desglose
  subtotal?: number; // Bruto antes del ajuste
  discount?: number; // Monto de descuento (resta)
  surcharge?: number; // Monto de recargo (suma)
  discountPercent?: number; // % de descuento (solo para la etiqueta)
  surchargePercent?: number; // % de recargo (solo para la etiqueta)
  payments?: Array<{ method: string; amount: number }>;
  footer?: string;
}): string {
  let ticket = '';
  const WIDTH = 48;

  // Usar CRLF (\r\n) para saltos de línea en impresoras ESC/POS
  // Windows Print Spooler para impresoras compartidas requiere CRLF
  const LF = '\r\n'; // CRLF en lugar de solo LF

  // Helper: Centrar texto (solo para encabezado)
  const center = (text: string) => {
    const padding = Math.floor((WIDTH - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text + LF;
  };

  // Helper: Alinear a la izquierda (para mejor aprovechamiento del ancho)
  // IMPORTANTE: No usar padEnd porque puede agregar espacios innecesarios
  // En su lugar, simplemente agregar el texto y el salto de línea
  const leftAlign = (text: string) => {
    // Truncar si es muy largo para evitar desbordamiento
    const truncated = text.length > WIDTH ? text.substring(0, WIDTH) : text;
    return truncated + LF;
  };

  // Helper: Línea
  const line = (char = '=') => char.repeat(WIDTH) + LF;

  // Helper: Alinear texto
  const align = (left: string, right: string) => {
    const space = WIDTH - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right + LF;
  };

  // CRÍTICO: Inicializar impresora con comandos correctos
  // El comando ESC @ (0x1B 0x40) resetea la impresora y desactiva cualquier modo especial
  ticket += '\x1B\x40'; // Inicializar impresora (reset completo)
  // Asegurar que la impresora esté en modo normal (no en modo de caracteres especiales)
  ticket += '\x1B\x61\x00'; // Alinear izquierda
  ticket += '\x1D\x21\x00'; // Tamaño normal
  ticket += '\x1B\x45\x00'; // Negrita OFF

  // Encabezado - CENTRADO Y MÁS GRANDE (pero no extremo)
  ticket += line();
  ticket += '\x1B\x61\x01'; // Centrar texto (ESC/POS)
  ticket += '\x1D\x21\x01'; // Tamaño doble ancho (solo ancho, altura normal) - más sutil
  ticket += data.header.toUpperCase() + LF; // Sin center() - el comando de centrado ya está activo
  // RESTAURAR tamaño normal y alineación ANTES de cualquier otra cosa
  ticket += '\x1D\x21\x00'; // Tamaño normal - CRÍTICO restaurar antes de la línea
  ticket += '\x1B\x61\x00'; // Alinear izquierda
  ticket += line();
  // NO reiniciar la impresora aquí - solo asegurar tamaño normal
  ticket += '\x1D\x21\x00'; // Asegurar tamaño normal explícitamente

  // Información del negocio (alineada a izquierda para mejor aprovechamiento)
  if (data.businessInfo) {
    if (data.businessInfo.address) {
      ticket += leftAlign(data.businessInfo.address);
    }
    if (data.businessInfo.phone) {
      ticket += leftAlign(`Tel: ${data.businessInfo.phone}`);
    }
    if (data.businessInfo.cuit) {
      ticket += leftAlign(`CUIT: ${data.businessInfo.cuit}`);
    }
  }

  ticket += LF;
  ticket += '\x1D\x21\x00'; // Asegurar tamaño normal antes de las líneas de información

  // Líneas de información (fecha, ticket, mesa, etc.)
  // Combinar fecha y hora si ambas están presentes
  let fechaValue = '';
  let horaValue = '';
  const otherLines: Array<{ label: string; value: string }> = [];

  data.lines.forEach(({ label, value }) => {
    if (label.toLowerCase() === 'fecha' || label.toLowerCase() === 'date') {
      fechaValue = value;
    } else if (label.toLowerCase() === 'hora' || label.toLowerCase() === 'time') {
      horaValue = value;
    } else {
      otherLines.push({ label, value });
    }
  });

  // Mostrar MOSTRADOR o DELIVERY en negrita y centrado, similar al encabezado
  if (data.saleType === 'counter') {
    ticket += LF;
    ticket += '\x1B\x45\x01'; // Negrita ON
    ticket += '\x1B\x61\x01'; // Centrar texto
    ticket += '\x1D\x21\x01'; // Tamaño doble ancho
    ticket += 'MOSTRADOR' + LF;
    ticket += '\x1D\x21\x00'; // Tamaño normal
    ticket += '\x1B\x61\x00'; // Alinear izquierda
    ticket += '\x1B\x45\x00'; // Negrita OFF
    // Mostrar nombre del cliente si existe
    if (data.customerName) {
      ticket += `Cliente: ${data.customerName}` + LF;
    }
  } else if (data.saleType === 'delivery') {
    // 🔍 DEBUG DELIVERY: Verificar datos recibidos en generateCashierTicket
    console.log('🔍 [DEBUG DELIVERY] generateCashierTicket - Sección DELIVERY:');
    console.log('  - data.saleType:', data.saleType);
    console.log('  - data.deliveryAddress:', data.deliveryAddress);
    console.log('  - Tipo de data.deliveryAddress:', typeof data.deliveryAddress);
    console.log('  - Es null?:', data.deliveryAddress === null);
    console.log('  - Es undefined?:', data.deliveryAddress === undefined);
    console.log('  - Es string vacío?:', data.deliveryAddress === '');
    console.log('  - Valor truthy?:', !!data.deliveryAddress);
    console.log('  - data.customerName:', data.customerName);
    console.log('  - ¿Pasa condición if (data.deliveryAddress)?:', !!data.deliveryAddress);

    ticket += LF;
    ticket += '\x1B\x45\x01'; // Negrita ON
    ticket += '\x1B\x61\x01'; // Centrar texto
    ticket += '\x1D\x21\x01'; // Tamaño doble ancho
    ticket += 'DELIVERY' + LF;
    ticket += '\x1D\x21\x00'; // Tamaño normal
    ticket += '\x1B\x61\x00'; // Alinear izquierda
    ticket += '\x1B\x45\x00'; // Negrita OFF
    // Mostrar nombre del cliente y dirección si existen
    if (data.customerName) {
      console.log('  ✅ [DEBUG DELIVERY] Agregando Cliente:', data.customerName);
      ticket += `Cliente: ${data.customerName}` + LF;
    } else {
      console.log('  ❌ [DEBUG DELIVERY] NO se agrega Cliente (no existe o es falsy)');
    }
    if (data.deliveryAddress) {
      console.log('  ✅ [DEBUG DELIVERY] Agregando Dirección:', data.deliveryAddress);
      ticket += `Dirección: ${data.deliveryAddress}` + LF;
    } else {
      console.log('  ❌ [DEBUG DELIVERY] NO se agrega Dirección (no existe o es falsy)');
      console.log('  ❌ [DEBUG DELIVERY] Razón: data.deliveryAddress es', data.deliveryAddress);
    }
  } else if (data.tableNumber !== null && data.tableNumber !== undefined) {
    ticket += align('Mesa:', data.tableNumber.toString());
  }

  // Si hay fecha y hora, combinarlas en una sola línea
  if (fechaValue && horaValue) {
    ticket += `Fecha: ${fechaValue} ${horaValue}` + LF;
  } else if (fechaValue) {
    // Si solo hay fecha, obtener la hora actual de impresión
    // Usar formato 24h para evitar problemas con "p.ám." en el locale es-AR
    const now = new Date();
    const hora = now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // Usar formato 24h
    });
    ticket += `Fecha: ${fechaValue} ${hora}` + LF;
  }

  // Mostrar otras líneas (Ticket, Mesa, etc.)
  otherLines.forEach(({ label, value }) => {
    ticket += `${label}: ${value}` + LF;
  });
  ticket += LF;
  ticket += '\x1D\x21\x00'; // Asegurar tamaño normal antes de los items

  // Items
  ticket += line('-');
  data.items.forEach(item => {
    const itemLine = `${item.quantity}x ${item.name}`;
    const price = `$${(item.unit_price * item.quantity).toFixed(2)}`;
    ticket += align(itemLine, price);
  });
  ticket += line('-');

  // Desglose del ajuste global (Subtotal / Descuento / Recargo) si corresponde
  const discountMonto = Math.max(0, data.discount || 0);
  const surchargeMonto = Math.max(0, data.surcharge || 0);
  const hasAdjustment = discountMonto > 0 || surchargeMonto > 0;
  if (hasAdjustment) {
    const subtotalValue =
      typeof data.subtotal === 'number'
        ? data.subtotal
        : data.total + discountMonto - surchargeMonto;
    ticket += align('Subtotal:', `$${subtotalValue.toFixed(2)}`);
    if (discountMonto > 0) {
      const label = data.discountPercent
        ? `Descuento (${data.discountPercent}%):`
        : 'Descuento:';
      ticket += align(label, `-$${discountMonto.toFixed(2)}`);
    }
    if (surchargeMonto > 0) {
      const label = data.surchargePercent
        ? `Recargo (${data.surchargePercent}%):`
        : 'Recargo:';
      ticket += align(label, `+$${surchargeMonto.toFixed(2)}`);
    }
  }

  // Total
  const totalLabel = data.totalLabel || 'TOTAL:';
  ticket += align(totalLabel, `$${data.total.toFixed(2)}`);
  ticket += LF;

  // Pagos
  if (data.payments && data.payments.length > 0) {
    ticket += line('-');
    data.payments.forEach(payment => {
      ticket += align(payment.method, `$${payment.amount.toFixed(2)}`);
    });
    ticket += line('-');
    ticket += LF;
  }

  // Footer
  if (data.footer) {
    ticket += LF;
    ticket += line();
    ticket += '\x1B\x61\x01'; // Centrar texto (ESC/POS)
    ticket += data.footer + LF; // Sin center() - el comando de centrado ya está activo
    ticket += '\x1B\x61\x00'; // Alinear izquierda
    ticket += line();
  }

  ticket += LF;
  ticket += '\x1B\x61\x01'; // Centrar texto (ESC/POS)
  ticket += `ALIAS: ${TICKET_TRANSFER_ALIAS}` + LF;
  ticket += '\x1B\x61\x00'; // Alinear izquierda

  ticket += buildEscPosFinishSequence(LF);

  return ticket;
}

/**
 * Generar contenido de ticket de cocina en formato texto simple
 */
export function generateKitchenTicket(data: {
  header: string;
  tableNumber: number | null;
  timestamp: string;
  items: Array<{
    quantity: number;
    name: string;
    customization?: string;
  }>;
  footer?: string;
}): string {
  let ticket = '';
  const WIDTH = 48;

  // Usar CRLF (\r\n) para saltos de línea en impresoras ESC/POS
  // Windows Print Spooler para impresoras compartidas requiere CRLF
  const LF = '\r\n'; // CRLF en lugar de solo LF

  // Helper: Centrar texto
  const center = (text: string) => {
    const padding = Math.floor((WIDTH - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text + LF;
  };

  // Helper: Línea
  const line = (char = '-') => char.repeat(WIDTH) + LF;

  // Encabezado
  ticket += line('=');
  ticket += center(data.header.toUpperCase());
  ticket += line('=');
  ticket += LF;

  // Información de mesa y hora
  if (data.tableNumber) {
    ticket += `MESA: ${data.tableNumber}` + LF;
  } else {
    ticket += `MESA: SIN MESA` + LF;
  }
  ticket += `HORA: ${data.timestamp}` + LF;
  ticket += LF;

  ticket += line('-');
  ticket += 'PEDIDO:' + LF;
  ticket += line('-');
  ticket += LF;

  // Items
  data.items.forEach((item, index) => {
    ticket += `${index + 1}. ${item.quantity}x ${item.name}` + LF;
    if (item.customization && item.customization.trim()) {
      ticket += `   NOTA: ${item.customization}` + LF;
    }
    ticket += LF;
  });

  ticket += line('-');

  // Footer
  if (data.footer) {
    ticket += LF;
    ticket += center(data.footer);
  }

  ticket += buildEscPosFinishSequence(LF);

  return ticket;
}



