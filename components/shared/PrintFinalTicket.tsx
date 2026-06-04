"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { generateCashierTicket, printToLocal } from "@/lib/localPrinter";
import { buildReceiptHtml } from "@/lib/ticketHtml";
import { TICKET_TRANSFER_ALIAS } from "@/lib/ticketTransferInfo";
import { getPrinterConfig, getAppSettings } from "@/actions/configActions";
import { groupTicketItems } from "@/lib/tickets";
import { brand, brandTicketThanks } from "@/lib/brand";

interface PrintFinalTicketProps {
  sale: any;
  items: Array<{
    name: string;
    unit_price: number;
    quantity: number;
  }>;
  payments: Array<{
    payment_method_name: string;
    amount: number;
  }>;
  onAfterPrint: () => void;
}

export function PrintFinalTicket({ sale, items, payments, onAfterPrint }: PrintFinalTicketProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const groupedItems = useMemo(() => groupTicketItems(items), [items]);

  useEffect(() => {
    // Imprimir automáticamente al montar el componente
    handlePrint();
  }, []);

  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      // Obtener configuración de impresora
      const configResult = await getPrinterConfig();
      const config = configResult.success && configResult.data ? configResult.data.cash : { width: 32 };

      // Obtener datos del negocio desde Configuración (mismo origen que PrintTicket)
      const settingsResult = await getAppSettings();
      const settings: { [key: string]: string } = settingsResult.data || {};

      // Asegurar que el total es un número válido
      const totalAmount = Number(sale.total_amount) || 0;

      // Campos compartidos entre el ticket ESC/POS (térmica) y el HTML (navegador)
      const ticketData = {
        header: settings.business_name || brand.name,
        businessInfo: {
          address: settings.business_address || undefined,
          phone: settings.business_phone || undefined,
          cuit: settings.business_cuit || undefined
        },
        saleType: sale.sale_type,
        tableNumber: sale.table_number,
        customerName: sale.customer_name,
        deliveryAddress: sale.delivery_address,
        lines: [
          { label: 'Fecha', value: new Date(sale.created_at).toLocaleDateString('es-AR') },
          { label: 'Ticket', value: sale.sale_number || sale.id },
          ...(sale.table_number ? [{ label: 'Mesa', value: sale.table_number.toString() }] : [])
        ],
        items: groupedItems.map(item => ({
          quantity: item.quantity,
          name: item.name,
          unit_price: item.unit_price
        })),
        total: totalAmount,
        // Desglose del ajuste global (solo se imprime si hay descuento o recargo)
        subtotal: typeof sale.subtotal === 'number' ? sale.subtotal : undefined,
        discount: Number(sale.discount) || 0,
        surcharge: Number(sale.surcharge) || 0,
        discountPercent: sale.discount_percent || undefined,
        surchargePercent: sale.surcharge_percent || undefined,
        payments: payments.map(p => ({
          method: p.payment_method_name,
          amount: p.amount
        }))
      };

      // Contenido ESC/POS para la impresión térmica directa (PC puente)
      const ticketContent = generateCashierTicket(ticketData);

      // Diseño HTML lindo para el fallback de impresión por navegador
      const ticketHtml = buildReceiptHtml({
        ...ticketData,
        footer: settings.ticket_footer_message || brandTicketThanks,
        transferAlias: TICKET_TRANSFER_ALIAS,
      });

      const result = await printToLocal(ticketContent, "", "cash", config.width, ticketHtml);
      if (result.success) {
        onAfterPrint();
      } else {
        console.error('❌ Error al imprimir ticket final:', result.message);
        // Aun así cerrar el modal para no bloquear la UI
        onAfterPrint();
      }
    } catch (error) {
      console.error('❌ Error al enviar ticket final a imprimir:', error);
      onAfterPrint();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Imprimiendo Ticket Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">
              Imprimiendo ticket final...
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onAfterPrint}
              variant="outline"
              size="sm"
              disabled={isPrinting}
            >
              Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

