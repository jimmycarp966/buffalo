"use client";

import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { PrintInvoiceTicket } from "./PrintInvoiceTicket";
import { closeTable } from "@/actions/barActions";
import { completeCounter, completeDelivery } from "@/actions/saleActions";
import { generateInvoice } from "@/actions/invoiceActions";
import type { InvoiceCustomerInput } from "@/lib/validations";

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: number;
  saleType?: "table" | "counter" | "delivery";
  totalAmount: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  paymentItems: Array<{
    paymentMethodId: string;
    paymentMethodName: string;
    amount: number;
  }>;
  onSuccess?: () => void;
}

interface InvoiceFormData {
  clientType: "consumidor_final" | "responsable_inscripto" | "monotributista" | "exento";
  cuit: string;
  name: string;
  address: string;
}

export function InvoiceModal({
  open,
  onClose,
  tableId,
  tableNumber,
  saleType = "table",
  totalAmount,
  items,
  paymentItems,
  onSuccess,
}: InvoiceModalProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    clientType: "consumidor_final",
    cuit: "",
    name: "",
    address: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [showPrintTicket, setShowPrintTicket] = useState(false);
  const [fullInvoiceData, setFullInvoiceData] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const sanitizeCuit = (value: string) => value.replace(/\D/g, "");

  const isAlreadyClosedMessage = (message?: string) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return normalized.includes("ya fue completada") || normalized.includes("no está pendiente");
  };

  const buildCustomerData = (): InvoiceCustomerInput | undefined => {
    const sanitizedCuit = formData.cuit ? sanitizeCuit(formData.cuit) : undefined;

    if (formData.clientType === "consumidor_final") {
      if (!formData.name && !formData.address) {
        return undefined;
      }

      return {
        name: formData.name || undefined,
        address: formData.address || undefined,
      };
    }

    return {
      name: formData.name || undefined,
      cuit: sanitizedCuit,
      address: formData.address || undefined,
    };
  };

  const closeSaleBeforeInvoice = async () => {
    const paymentsForTable = paymentItems.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      amount: payment.amount,
    }));

    const paymentsForOther = paymentItems.map((payment) => ({
      payment_method_id: payment.paymentMethodId,
      amount: payment.amount,
    }));

    if (saleType === "counter") {
      return completeCounter(tableId, paymentsForOther);
    }

    if (saleType === "delivery") {
      return completeDelivery(tableId, paymentsForOther);
    }

    return closeTable(tableId, paymentsForTable);
  };

  const printInvoiceLocally = async (invoiceId: string, thermalContent?: string | null) => {
    setIsPrinting(true);
    try {
      let content = thermalContent || null;

      if (!content) {
        const { getThermalInvoiceContent } = await import("@/actions/invoiceActions");
        const thermalResult = await getThermalInvoiceContent(invoiceId);

        if (!thermalResult.success || !thermalResult.content) {
          throw new Error(thermalResult.message || "No se pudo obtener el contenido térmico de la factura");
        }

        content = thermalResult.content;
      }

      const [{ printToLocal }, { getPrinterConfig }] = await Promise.all([
        import("@/lib/localPrinter"),
        import("@/actions/configActions"),
      ]);

      const decodeThermalContent = (payload: string) => {
        if (!payload.startsWith("base64:")) return payload;
        try {
          const base64 = payload.slice("base64:".length);
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          return new TextDecoder().decode(bytes);
        } catch (error) {
          console.error("Error decodificando thermal_content:", error);
          return payload;
        }
      };

      if (content && content.startsWith("base64:")) {
        content = decodeThermalContent(content);
      }

      let printerName = "Caja";
      let width = 48;

      try {
        const configResult = await getPrinterConfig();
        if (configResult.success && configResult.data?.cash) {
          printerName = configResult.data.cash.name || "Caja";
          width = configResult.data.cash.width || 48;
        }
      } catch (error) {
        console.warn("No se pudo obtener configuración de impresora, usando fallback 'Caja'", error);
      }

      const printResult = await printToLocal(content, printerName, "cash", width);

      if (!printResult.success) {
        throw new Error(printResult.message || "Error al enviar la factura a la impresora");
      }

      addNotification("success", "Factura enviada a la impresora");
      return true;
    } catch (error: any) {
      console.error("Error al imprimir factura:", error);
      addNotification(
        "error",
        error.message || "No pudimos imprimir automáticamente. Podés reimprimir desde Ventas → Detalle → Reimprimir."
      );
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  const handleGenerate = async () => {
    // Validaciones
    if (formData.clientType !== "consumidor_final") {
      if (!formData.cuit || formData.cuit.length < 11) {
        addNotification("error", "El CUIT es obligatorio y debe ser válido");
        return;
      }
      if (!formData.name.trim()) {
        addNotification("error", "El nombre o razón social es obligatorio");
        return;
      }
    }

    setIsGenerating(true);
    try {
      const closeResult = await closeSaleBeforeInvoice();

      if (!closeResult.success && !isAlreadyClosedMessage(closeResult.message)) {
        addNotification("error", closeResult.message || "Error al cerrar la venta antes de facturar");
        return;
      }

      const invoiceResult = await generateInvoice(tableId, buildCustomerData());

      if (invoiceResult.success && invoiceResult.data) {
        const normalizedInvoice = {
          id: invoiceResult.data.id,
          invoiceNumber: invoiceResult.data.invoice_number,
          cae: invoiceResult.data.cae,
          caeExpirationDate: invoiceResult.data.cae_expiration,
          invoiceType: invoiceResult.data.invoice_type,
          thermalContent: invoiceResult.data.thermal_content || null,
        };

        setInvoiceGenerated(true);
        setInvoiceData(normalizedInvoice);
        
        // Obtener información del negocio para el ticket
        const businessInfoResponse = await fetch("/api/settings/business-info");
        const businessInfo = await businessInfoResponse.json();

        // Preparar datos completos para impresión
        setFullInvoiceData({
          invoice: {
            ...normalizedInvoice,
            clientType: formData.clientType,
            clientName: formData.name || "Consumidor Final",
            clientCuit: sanitizeCuit(formData.cuit),
            clientAddress: formData.address,
            totalAmount: totalAmount,
          },
          items: items,
          payments: paymentItems.map(p => ({
            payment_method_name: p.paymentMethodName,
            amount: p.amount,
          })),
          businessInfo: businessInfo.data || {},
          tableNumber: tableNumber,
        });
        
        addNotification("success", `Mesa ${tableNumber} cerrada y factura ${normalizedInvoice.invoiceNumber} generada`);
        
        const printed = await printInvoiceLocally(normalizedInvoice.id, normalizedInvoice.thermalContent);
        
        // Activar impresión manual solo si falla la automática
        if (!printed) {
          setTimeout(() => {
            setShowPrintTicket(true);
          }, 500);
        }
        
        // Llamar a onSuccess para actualizar la UI
        if (onSuccess) {
          onSuccess();
        }
      } else {
        addNotification("error", invoiceResult.message || "Error al generar la factura");
      }
    } catch (error) {
      console.error("Error generando factura:", error);
      addNotification("error", "Error al procesar la operación");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setFormData({
      clientType: "consumidor_final",
      cuit: "",
      name: "",
      address: "",
    });
    setIsGenerating(false);
    setInvoiceGenerated(false);
    setInvoiceData(null);
    setShowPrintTicket(false);
    setFullInvoiceData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-[90vw] md:w-[85vw] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-border bg-card pr-14">
          <h2 className="text-lg font-semibold text-foreground">Generar Factura</h2>
        </div>

        {/* Contenido */}
        <div className="px-6 py-6">
          {!invoiceGenerated ? (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Total a facturar:</span> ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Tipo de Cliente */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Tipo de Cliente</Label>
                <Select
                  value={formData.clientType}
                  onValueChange={(value: any) => setFormData({ ...formData, clientType: value })}
                  disabled={isGenerating}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                    <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                    <SelectItem value="monotributista">Monotributista</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campo nombre para consumidor final (opcional, solo para registro interno) */}
              {formData.clientType === 'consumidor_final' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Nombre (Opcional)</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Para identificación interna"
                    className="h-10"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Este dato no se envía a AFIP</p>
                </div>
              )}

              {/* Campos adicionales si no es consumidor final */}
              {formData.clientType !== 'consumidor_final' && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">CUIT *</Label>
                    <Input
                      value={formData.cuit}
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                      placeholder="20-12345678-9"
                      className="h-10"
                      disabled={isGenerating}
                      maxLength={13}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Nombre / Razón Social *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nombre completo o razón social"
                      className="h-10"
                      disabled={isGenerating}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Dirección</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Dirección completa"
                      className="h-10"
                      disabled={isGenerating}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            // Factura generada exitosamente
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-foreground">¡Factura Generada!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Número: <span className="font-semibold">{invoiceData?.invoiceNumber}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  CAE: <span className="font-semibold">{invoiceData?.cae}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Vto. CAE: {invoiceData?.caeExpirationDate}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!invoiceGenerated && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPrinting ? "Generando e imprimiendo..." : "Generando..."}
                </>
              ) : (
                'Generar Factura'
              )}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Componente de impresión del ticket fiscal */}
      {showPrintTicket && fullInvoiceData && (
        <PrintInvoiceTicket
          sale={fullInvoiceData}
          onClose={() => {
            setShowPrintTicket(false);
            // Cerrar el modal de facturación después de imprimir
            setTimeout(() => {
              handleClose();
            }, 500);
          }}
        />
      )}
    </Dialog>
  );
}
