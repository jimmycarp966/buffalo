"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { getAppSettings } from "@/actions/configActions";
import { useNotificationStore } from "@/store/notificationStore";
import { groupTicketItems } from "@/lib/tickets";
import { openBrowserPrintWindow } from "@/lib/browserPrint";
import { buildReceiptHtml } from "@/lib/ticketHtml";
import { TICKET_DELIVERY_PHONE, TICKET_TRANSFER_ALIAS } from "@/lib/ticketTransferInfo";
import { brand, brandTicketThanks } from "@/lib/brand";

interface PrintTicketProps {
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

export function PrintTicket({ sale, items, payments, onAfterPrint }: PrintTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotificationStore();
  const [businessInfo, setBusinessInfo] = useState<{
    business_name: string;
    business_address: string;
    business_phone: string;
    business_cuit: string;
    ticket_footer_message: string;
  }>({
    business_name: brand.name,
    business_address: "",
    business_phone: "",
    business_cuit: "",
    ticket_footer_message: brandTicketThanks
  });
  const groupedItems = useMemo(() => groupTicketItems(items), [items]);

  useEffect(() => {
    const loadBusinessInfo = async () => {
      const result = await getAppSettings();
      if (result.success && result.data && typeof result.data === 'object' && Object.keys(result.data).length > 0) {
        const data = result.data as { [key: string]: string };
        setBusinessInfo({
          business_name: data.business_name || brand.name,
          business_address: data.business_address || "",
          business_phone: data.business_phone || "",
          business_cuit: data.business_cuit || "",
          ticket_footer_message:
            data.ticket_footer_message || brandTicketThanks
        });
      }
    };
    loadBusinessInfo();
  }, []);

  const handleBrowserPrint = async () => {
    try {
      const ticketHtml = buildReceiptHtml({
        header: businessInfo.business_name || brand.name,
        businessInfo: {
          address: businessInfo.business_address || undefined,
          phone: businessInfo.business_phone || undefined,
          cuit: businessInfo.business_cuit || undefined,
        },
        saleType: sale.sale_type,
        tableNumber: sale.table_number,
        customerName: sale.customer_name || undefined,
        deliveryAddress: sale.delivery_address || undefined,
        lines: [
          { label: "Fecha", value: formatDate(new Date()) },
          ...(sale.sale_number ? [{ label: "Ticket", value: String(sale.sale_number) }] : []),
        ],
        items: groupedItems.map((item) => ({
          quantity: item.quantity,
          name: item.name,
          unit_price: item.unit_price,
        })),
        total: Number(sale.total_amount) || 0,
        payments:
          payments && payments.length > 0
            ? payments.map((p) => ({ method: p.payment_method_name, amount: p.amount }))
            : undefined,
        footer: businessInfo.ticket_footer_message || brandTicketThanks,
        transferAlias: TICKET_TRANSFER_ALIAS,
      });

      await openBrowserPrintWindow({
        title: `Ticket ${sale.sale_number ?? ""}`.trim(),
        html: ticketHtml,
      });
    } catch (error: any) {
      console.error("Error abriendo impresión:", error);
      addNotification("error", error.message || "No se pudo abrir la ventana de impresión");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <h2 className="text-xl font-bold text-center">¡Venta exitosa!</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vista previa del ticket con scroll */}
          <div className="max-h-[400px] overflow-y-auto">
            <div
              ref={printRef}
              className="bg-white p-6 rounded border text-sm font-mono"
            >
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold">{businessInfo.business_name.toUpperCase()}</h1>
                <p className="text-sm font-semibold">Ruta 38 - Monteros - Tucumán</p>
                {businessInfo.business_address && (
                  <p className="text-xs">{businessInfo.business_address}</p>
                )}
                {businessInfo.business_phone && (
                  <p className="text-xs">Tel: {businessInfo.business_phone}</p>
                )}
                {businessInfo.business_cuit && (
                  <p className="text-xs">CUIT: {businessInfo.business_cuit}</p>
                )}
                <p className="text-xs mt-2">
                  {formatDate(new Date())}
                </p>
                <p className="text-xs">Ticket: {sale.sale_number}</p>
                {sale.table_number && (
                  <p className="text-sm font-bold mt-1 inline-block px-3 py-1 rounded bg-yellow-100">
                    {`MESA ${sale.table_number}`}
                  </p>
                )}
              </div>

              <div className="border-t border-b border-dashed py-2 my-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left">Producto</th>
                      <th className="text-right">Precio Unit.</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems.map((item, index) => (
                      <tr key={index}>
                        <td className="py-1">{item.quantity}x {item.name}</td>
                        <td className="text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold text-base">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(sale.total_amount)}</span>
                </div>
              </div>

              {/* Sección de pagos o cuenta abierta */}
              {payments && payments.length > 0 ? (
                <div className="border-t border-dashed pt-2 mt-2 text-xs">
                  <p className="font-semibold mb-1">Forma de Pago:</p>
                  {payments.map((payment, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{payment.payment_method_name}</span>
                      <span>{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-t border-dashed pt-2 mt-2 text-xs">
                  <div className="bg-yellow-100 border border-yellow-400 rounded p-2 text-center">
                    <p className="font-bold text-sm">CUENTA ABIERTA</p>
                    <p className="text-xs mt-1">Pendiente de pago</p>
                  </div>
                </div>
              )}

              {/* Información de transferencias */}
              <div className="border-t border-dashed pt-3 mt-3 text-xs">
                <div className="text-center bg-gray-50 rounded p-2">
                  <p className="font-semibold">Datos para transferencia:</p>
                  <p className="font-bold text-sm mt-1">Alias: {TICKET_TRANSFER_ALIAS}</p>
                  <p className="font-semibold mt-2">Pedidos por delivery:</p>
                  <p className="font-bold text-sm">{TICKET_DELIVERY_PHONE}</p>
                </div>
              </div>

              <div className="text-center mt-4 pt-4 border-t border-dashed text-xs">
                <p>{businessInfo.ticket_footer_message}</p>
                <p className="mt-2 text-muted-foreground">Diseñado by SiriuS</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button onClick={handleBrowserPrint} className="flex-1">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ticket
              </Button>
              <Button variant="outline" onClick={onAfterPrint} className="flex-1">
                Cerrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


