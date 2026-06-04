"use client";

import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { generateKitchenTicket } from "@/lib/kitchenPrinter";
import { printToLocal } from "@/lib/localPrinter";
import { buildKitchenReceiptHtml } from "@/lib/ticketHtml";
import { brand } from "@/lib/brand";

// Función local para verificar servidor (evita problemas de importación en Vercel)
const checkPrintServerStatus = async (): Promise<boolean> => {
  return false;
};

const fetchPrinterSettings = async () => {
  try {
    const response = await fetch("/api/settings/printers");
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data ?? null;
  } catch {
    return null;
  }
};

interface ThermalPrintTicketProps {
  tableNumber: number;
  items: Array<{
    name: string;
    quantity: number;
    customization?: string;
  }>;
  timestamp: string;
  onAfterPrint: () => void;
}

export function ThermalPrintTicket({ 
  tableNumber, 
  items, 
  timestamp, 
  onAfterPrint 
}: ThermalPrintTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  // Cargar configuración de impresora de cocina y verificar servidor local
  useEffect(() => {
    const loadPrinterConfig = async () => {
      // Solo verificar configuración de impresora sin almacenar estado local
      const settings = await fetchPrinterSettings();
      if (settings?.config?.kitchen) {
        console.log('🔧 Configuración de impresora cargada:', settings.config.kitchen);
      }
      
      // Verificar si el servidor local está disponible
      const available = await checkPrintServerStatus();
      setServerAvailable(available);
      if (available) {
        console.log('✅ Servidor local de impresión disponible');
      } else {
        console.log('⚠️ Servidor local de impresión no disponible');
      }
    };
    loadPrinterConfig();
  }, []);

  // Función de impresión directa usando servidor local
  const handleDirectPrint = async () => {
    setIsLoading(true);

    try {
      console.log('🖨️ Iniciando impresión directa para Mesa:', tableNumber);

      // Obtener configuración de impresora
      const printerSettings = await fetchPrinterSettings();
      const kitchenConfig = printerSettings?.config?.kitchen;

      if (!kitchenConfig?.enabled) {
        console.log('❌ Impresión de cocina deshabilitada o error en configuración');
        setIsLoading(false);
        return;
      }

      console.log('🔧 Configuración de impresora:', kitchenConfig);

      // Generar contenido del ticket usando función con comandos ESC/POS
      const ticketContent = generateKitchenTicket({
        tableNumber,
        timestamp,
        items: items.map(item => ({
          quantity: item.quantity,
          name: item.name,
          customization: item.customization
        })),
        waiterName: 'Sistema', // Opcional
        orderType: 'new',
        saleType: 'table'
      });

      // ✅ AGREGAR esto justo antes del fetch
      console.log('🔍 DIAGNÓSTICO DE IMPRESIÓN:');
      console.log('Longitud del contenido:', ticketContent.length);
      console.log('Contiene comandos ESC/POS:', ticketContent.includes('\x1B'));
      console.log('Primeros 100 caracteres:', ticketContent.substring(0, 100));
      console.log('Códigos de los primeros 20 bytes:',
        Array.from(ticketContent.substring(0, 20))
          .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(' ')
      );

      // Diseño HTML lindo para el fallback de impresión por navegador (comanda de cocina)
      const ticketHtml = buildKitchenReceiptHtml({
        header: "Cocina",
        tableNumber,
        timestamp,
        saleType: 'table',
        items: items.map(item => ({
          quantity: item.quantity,
          name: item.name,
          customization: item.customization
        })),
        footer: "--- CORTAR AQUÍ ---",
      });

      // Obtener la cadena de impresora desde Supabase (puede ser UNC o IP:puerto)
      const printerName =
        printerSettings?.kitchenPrinterString ||
        kitchenConfig.ip ||
        '\\\\SERVIDOR\\\\Cocina';

      const result = await printToLocal(ticketContent, printerName, 'kitchen', kitchenConfig.width || 48, ticketHtml);
      if (!result.success) {
        throw new Error(result.message || 'Error al imprimir');
      }

      console.log('✅ Ticket de cocina impreso');
      // Cerrar modal automáticamente después de 1 segundo
      setTimeout(() => {
        onAfterPrint();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error en impresión directa:', error);
      // Fallback al método manual
      handlePrint();
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-imprimir al montar el componente (solo si el servidor está disponible)
  useEffect(() => {
    if (serverAvailable === true) {
      const timer = setTimeout(() => {
        handleDirectPrint();
      }, 500);
      
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [serverAvailable]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: onAfterPrint,
    // Configuración específica para impresora térmica POS-58
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 0 !important;
        padding: 0 !important;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 20px;
          line-height: 1.3;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        .thermal-ticket {
          width: 80mm;
          max-width: 80mm;
          margin: 0 !important;
          padding: 3mm 5mm !important;
          background: white;
          color: black;
          page-break-after: avoid;
        }
        .thermal-ticket * {
          color: black !important;
          background: white !important;
        }
        .thermal-ticket h1 {
          font-size: 24px !important;
          font-weight: bold !important;
          margin: 0 !important;
        }
        .thermal-ticket .product-name {
          font-size: 22px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }
        .thermal-ticket .product-note {
          font-size: 20px !important;
          margin: 0 !important;
        }
      }
    `
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-center mb-4">🖨️ Imprimir Pedido de Cocina</h2>
        
        {/* Vista previa del ticket térmico */}
        <div className="max-h-[400px] overflow-y-auto border border-border rounded p-4 bg-muted/30">
          <div
            ref={printRef}
            className="thermal-ticket bg-white text-black font-mono text-xs"
            style={{ width: '80mm', maxWidth: '80mm' }}
          >
            {/* Encabezado */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold">{brand.name.toUpperCase()}</h1>
              <p className="text-lg font-semibold">BAR - PEDIDO DE COCINA</p>
              <div className="border-t border-b border-dashed my-2"></div>
            </div>

            {/* Información de la mesa */}
            <div className="mb-4">
              <p className="text-xl font-bold">MESA: {tableNumber}</p>
              <p className="text-lg">HORA: {timestamp}</p>
              <div className="border-t border-b border-dashed my-2"></div>
            </div>

            {/* Items del pedido */}
            <div className="mb-4">
              <p className="text-xl font-bold mb-2">PEDIDO:</p>
              {items.map((item, index) => (
                <div key={index} className="mb-3">
                  <p className="product-name text-lg font-semibold">
                    {item.quantity}x {item.name}
                  </p>
                  {item.customization && item.customization.trim() && (
                    <p className="product-note text-base ml-4 mt-1">
                      NOTA: {item.customization}
                    </p>
                  )}
                </div>
              ))}
              <div className="border-t border-b border-dashed my-2"></div>
            </div>

            {/* Espacio para cortar */}
            <div className="text-center mt-4">
              <p className="text-xs">--- CORTAR AQUÍ ---</p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-2 mt-4">
          {serverAvailable === true && (
            <div className="text-xs text-center text-green-600 bg-green-50 rounded p-2 border border-green-200">
              ✅ Servidor local disponible - Impresión automática
            </div>
          )}
          {serverAvailable === false && (
            <div className="text-xs text-center text-yellow-600 bg-yellow-50 rounded p-2 border border-yellow-200">
              ⚠️ Servidor local no disponible - Se usará método manual
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDirectPrint}
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Enviando..." : "🖨️ Enviar a Cocina"}
            </button>
            <button
              onClick={onAfterPrint}
              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cerrar
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 text-sm"
            title="Método manual si la impresión directa falla"
          >
            🔧 Imprimir Manual (Fallback)
          </button>
        </div>
      </div>
    </div>
  );
}

