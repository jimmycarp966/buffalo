"use client";

import { useEffect } from "react";
import { generateCashierTicket, printToLocal } from "@/lib/localPrinter";
import { buildReceiptHtml } from "@/lib/ticketHtml";
import { TICKET_TRANSFER_ALIAS } from "@/lib/ticketTransferInfo";
import { getPrinterConfig, getAppSettings } from "@/actions/configActions";
import { markAccountAsPrinted } from "@/actions/barActions";
import { brand, brandTicketThanks } from "@/lib/brand";
import { useNotificationStore } from "@/store/notificationStore";

interface PrintAccountTicketProps {
  tableNumber?: number | null;
  saleType?: "table" | "counter" | "delivery";
  saleId?: string;
  saleNumber?: string | null;
  customerName?: string | null;
  deliveryAddress?: string | null;
  items: Array<{
    name: string;
    unit_price: number;
    quantity: number;
    customization?: string;
  }>;
  total: number;
  paidAmount?: number; // Monto pagado (para mostrar en pagos parciales)
  onAfterPrint: () => void;
}

export function PrintAccountTicket({ tableNumber, saleType, saleId, saleNumber, customerName, deliveryAddress, items, total, paidAmount, onAfterPrint }: PrintAccountTicketProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    // Imprimir automáticamente al montar el componente en segundo plano
    handlePrint();
  }, []);

  const handlePrint = async () => {
    try {
      // Obtener configuración de impresora y generar ticket en segundo plano
      const configResult = await getPrinterConfig();
      const config = configResult.success && configResult.data ? configResult.data.cash : { width: 32 };

      // Obtener datos del negocio desde Configuración (mismo origen que PrintTicket)
      const settingsResult = await getAppSettings();
      const settings: { [key: string]: string } = settingsResult.data || {};

      // Generar contenido del ticket usando generateCashierTicket
      // Si hay pagos parciales, mostrar información adicional
      const lines: Array<{ label: string; value: string }> = [
        { label: 'Fecha', value: new Date().toLocaleDateString('es-AR') },
        ...(saleNumber ? [{ label: 'Ticket', value: saleNumber }] : [])
      ];

      // Si hay pagos parciales, agregar información de total y pagado antes de los items
      let totalLabel = 'TOTAL:';
      if (paidAmount && paidAmount > 0) {
        const totalAmount = total + paidAmount;
        lines.push(
          { label: 'Total', value: `$${totalAmount.toFixed(2)}` },
          { label: 'Pagado', value: `$${paidAmount.toFixed(2)}` }
        );
        // Cambiar el label del total a "RESTANTE:" cuando hay pagos parciales
        totalLabel = 'RESTANTE:';
      }

      // Campos compartidos entre el ticket ESC/POS (térmica) y el HTML (navegador)
      const ticketData = {
        header: settings.business_name || brand.name,
        businessInfo: {
          address: settings.business_address || undefined,
          phone: settings.business_phone || undefined,
          cuit: settings.business_cuit || undefined
        },
        saleType: saleType,
        tableNumber: tableNumber,
        customerName: customerName || undefined,
        deliveryAddress: deliveryAddress || undefined,
        lines: lines,
        items: items.map(item => ({
          quantity: item.quantity,
          name: item.name,
          unit_price: item.unit_price
        })),
        total: total,
        totalLabel: totalLabel
      };

      // Contenido ESC/POS para la impresión térmica directa (PC puente)
      const ticketContent = generateCashierTicket(ticketData);

      // Diseño HTML lindo para el fallback de impresión por navegador.
      // El total usa la misma etiqueta (sin los dos puntos finales del formato ESC/POS).
      const ticketHtml = buildReceiptHtml({
        ...ticketData,
        totalLabel: totalLabel.replace(/:\s*$/, ""),
        footer: settings.ticket_footer_message || brandTicketThanks,
        transferAlias: TICKET_TRANSFER_ALIAS,
      });

      const result = await printToLocal(ticketContent, "", "cash", config.width, ticketHtml);

      if (result.success) {
        if (saleId) {
          try {
            await markAccountAsPrinted(saleId);
          } catch (error) {
            console.error('Error al marcar cuenta como impresa:', error);
          }
        }
        addNotification("success", `Cuenta ${tableNumber ? `de mesa ${tableNumber}` : saleType === 'counter' ? 'de mostrador' : saleType === 'delivery' ? 'de delivery' : ''} lista para imprimir`);
      } else {
        addNotification("error", `Error al imprimir cuenta: ${result.message || 'Error desconocido'}`);
      }
    } catch (error: any) {
      console.error('❌ Error al procesar impresión:', error);
      addNotification("error", `Error al procesar impresión: ${error.message || 'Error desconocido'}`);
    } finally {
      onAfterPrint();
    }
  };

  // Este componente no renderiza nada visible, solo ejecuta la lógica
  return null;
}

