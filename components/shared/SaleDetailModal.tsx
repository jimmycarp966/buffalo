"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useReactToPrint } from "react-to-print";
import { getAppSettings } from "@/actions/configActions";
import { generateInvoice, getInvoiceBySaleId } from "@/actions/invoiceActions";
import {
  getPaymentMethods,
  updateSalePayments,
} from "@/actions/saleActions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { InvoiceCustomerInput } from "@/lib/validations";
import { brand, brandTicketThanks } from "@/lib/brand";

interface SaleDetailModalProps {
  open: boolean;
  onClose: () => void;
  sale: any | null;
}

export function SaleDetailModal({ open, onClose, sale }: SaleDetailModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
  const [invoice, setInvoice] = useState<any | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [isEditingPayments, setIsEditingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [currentPayments, setCurrentPayments] = useState(
    sale?.sale_payments || [],
  );
  const [paymentRows, setPaymentRows] = useState<
    Array<{ id: string; payment_method_id: string; amount: number }>
  >([]);
  const createEmptyInvoiceForm = () => ({
    clientType: "consumidor_final" as const,
    cuit: "",
    name: "",
    address: "",
  });

  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<{
    clientType: "consumidor_final" | "responsable_inscripto" | "monotributista" | "exento";
    cuit: string;
    name: string;
    address: string;
  }>(createEmptyInvoiceForm());

  const generateRowId = () =>
    crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

  const getInitialPaymentRows = (
    salePayments = sale?.sale_payments || [],
  ) => {
    if (salePayments.length > 0) {
      return salePayments.map((payment: any) => ({
        id: payment.id || generateRowId(),
        payment_method_id:
          payment.payment_method_id ||
          payment.payment_method?.id ||
          payment.payment_method_id ||
          "",
        amount: Number(payment.amount) || 0,
      }));
    }

    return [
      {
        id: generateRowId(),
        payment_method_id: "",
        amount: Number(sale?.total_amount) || 0,
      },
    ];
  };

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setIsLoadingPaymentMethods(true);
    getPaymentMethods()
      .then((result) => {
        if (!isMounted) return;
        if (result.success && Array.isArray(result.data)) {
          setPaymentMethods(result.data);
        } else {
          toast.error(result.message || "Error al cargar metodos de pago");
        }
      })
      .catch((error) => {
        console.error("Error loading payment methods:", error);
        if (isMounted) {
          toast.error("No se pudieron cargar los metodos de pago");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingPaymentMethods(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    setCurrentPayments(sale?.sale_payments || []);
    setPaymentRows(getInitialPaymentRows(sale?.sale_payments || []));
    setIsEditingPayments(false);
    setPaymentsError(null);
    setIsSavingPayments(false);
    setIsInvoiceFormOpen(false);
    setInvoiceForm(createEmptyInvoiceForm());
  }, [sale?.id]);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!sale?.id) return;
      
      setIsLoadingInvoice(true);
      try {
        const result = await getInvoiceBySaleId(sale.id);
        if (result.success) {
          setInvoice(result.data || null);
        }
      } catch (error) {
        console.error('Error cargando factura:', error);
      } finally {
        setIsLoadingInvoice(false);
      }
    };
    
    if (open && sale?.id) {
      loadInvoice();
    }
  }, [open, sale?.id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintInvoice = async () => {
    if (!invoice?.id) return;
    
    setIsPrintingInvoice(true);
    try {
      // Obtener contenido térmico desde servidor
      const { getThermalInvoiceContent } = await import("@/actions/invoiceActions");
      const result = await getThermalInvoiceContent(invoice.id);
      
      if (!result.success || !result.content) {
        toast.error(result.message || "Error al obtener contenido de factura");
        return;
      }

      const [{ printToLocal }] = await Promise.all([import("@/lib/localPrinter")]);
      const printerSettings = await fetch("/api/settings/printers")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const cashConfig = printerSettings?.data?.config?.cash;
      const printerName =
        cashConfig?.name ||
        cashConfig?.ip ||
        "POS-58";
      const width = cashConfig?.width ?? 32;

      const printResult = await printToLocal(result.content, printerName, "cash", width);

      if (printResult.success) {
        toast.success("Factura enviada a la impresora local");
      } else {
        toast.error(printResult.message || "Error al imprimir factura");
      }
    } catch (error: any) {
      toast.error(error.message || "Error al imprimir factura");
    } finally {
      setIsPrintingInvoice(false);
    }
  };

  const handleInvoiceSuccess = () => {
    // Recargar factura después de generar
    if (sale?.id) {
      getInvoiceBySaleId(sale.id).then(result => {
        if (result.success) {
          setInvoice(result.data || null);
        }
      });
    }
  };

  const paymentsTotal = useMemo(
    () => paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [paymentRows],
  );

  if (!sale) return null;

  const totalItems = sale.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
  const canInvoice = sale.status === "completed" && !invoice;
  const paymentsMatchTotal =
    Math.abs(paymentsTotal - Number(sale.total_amount)) <= 0.01;
  const hasInvalidPaymentRows = paymentRows.some(
    (row) => !row.payment_method_id || Number(row.amount) <= 0,
  );
  const canSavePayments =
    paymentsMatchTotal && !hasInvalidPaymentRows && !isSavingPayments;
  const sanitizeCuit = (value: string) => value.replace(/\D/g, "");
  const buildInvoiceCustomerData = (): InvoiceCustomerInput | undefined => {
    if (invoiceForm.clientType === "consumidor_final") {
      if (!invoiceForm.name && !invoiceForm.address) {
        return undefined;
      }
      return {
        name: invoiceForm.name || undefined,
        address: invoiceForm.address || undefined,
      };
    }

    const cleanedCuit = sanitizeCuit(invoiceForm.cuit);
    if (!cleanedCuit) {
      return undefined;
    }

    return {
      name: invoiceForm.name || undefined,
      cuit: cleanedCuit,
      address: invoiceForm.address || undefined,
    };
  };

  const handleStartEditingPayments = () => {
    if (sale.status !== "completed") {
      toast.error("Solo se pueden editar ventas completadas");
      return;
    }
    setPaymentRows(getInitialPaymentRows(currentPayments));
    setIsEditingPayments(true);
  };

  const handleCancelEditingPayments = () => {
    setPaymentRows(getInitialPaymentRows(currentPayments));
    setIsEditingPayments(false);
    setPaymentsError(null);
  };

  const handleAddPaymentRow = () => {
    setPaymentRows((prev) => [
      ...prev,
      {
        id: generateRowId(),
        payment_method_id:
          prev[0]?.payment_method_id ||
          paymentMethods[0]?.id ||
          currentPayments[0]?.payment_method_id ||
          "",
        amount: 0,
      },
    ]);
  };

  const handleUpdatePaymentRow = (
    index: number,
    field: "payment_method_id" | "amount",
    value: string,
  ) => {
    setPaymentRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]:
                field === "amount" ? Number(value) : (value as string),
            }
          : row,
      ),
    );
  };

  const handleRemovePaymentRow = (index: number) => {
    setPaymentRows((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleSavePayments = async () => {
    if (!sale?.id) return;
    if (paymentRows.length === 0) {
      setPaymentsError("Debe existir al menos un metodo de pago");
      return;
    }

    setIsSavingPayments(true);
    setPaymentsError(null);
    const payload = paymentRows.map((row) => ({
      payment_method_id: row.payment_method_id,
      amount: Number(row.amount) || 0,
    }));

    const result = await updateSalePayments(sale.id, payload);
    setIsSavingPayments(false);

    if (!result.success) {
      setPaymentsError(result.message || "No se pudieron actualizar los pagos");
      toast.error(result.message || "No se pudieron actualizar los pagos");
      return;
    }

    toast.success("Pagos actualizados correctamente");
    const paymentsWithMeta = paymentRows.map((row) => ({
      id: row.id,
      payment_method_id: row.payment_method_id,
      amount: Number(row.amount) || 0,
      payment_method: {
        id: row.payment_method_id,
        name:
          paymentMethods.find((method) => method.id === row.payment_method_id)
            ?.name || "Metodo",
      },
    }));
    setCurrentPayments(paymentsWithMeta);
    setIsEditingPayments(false);
    router.refresh();
  };

  const handleGenerateInvoice = async () => {
    if (!sale?.id) return;

    if (invoiceForm.clientType !== "consumidor_final") {
      const cleanedCuit = sanitizeCuit(invoiceForm.cuit);
      if (!cleanedCuit || cleanedCuit.length < 11) {
        toast.error("El CUIT es obligatorio y debe tener 11 digitos");
        return;
      }
      if (!invoiceForm.name.trim()) {
        toast.error("El nombre o razon social es obligatorio");
        return;
      }
    }

    setIsGeneratingInvoice(true);
    try {
      const customerData = buildInvoiceCustomerData();
      const result = await generateInvoice(sale.id, customerData);

      if (!result.success) {
        toast.error(result.message || "No se pudo generar la factura");
        return;
      }

      toast.success("Factura generada exitosamente");
      handleInvoiceSuccess();
      setIsInvoiceFormOpen(false);
      setInvoiceForm(createEmptyInvoiceForm());
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error(error.message || "Error al generar la factura");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b px-6 pb-4">
          <DialogTitle>Detalle de Venta - {sale.sale_number}</DialogTitle>
        </DialogHeader>

        {/* Contenido para imprimir */}
        <div
          ref={printRef}
          className="space-y-6 px-6 py-4 max-h-[65vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold text-foreground">{businessInfo.business_name}</h2>
            {businessInfo.business_address && (
              <p className="text-xs text-muted-foreground">{businessInfo.business_address}</p>
            )}
            {businessInfo.business_phone && (
              <p className="text-xs text-muted-foreground">Tel: {businessInfo.business_phone}</p>
            )}
            {businessInfo.business_cuit && (
              <p className="text-xs text-muted-foreground">CUIT: {businessInfo.business_cuit}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">Ticket de Venta</p>
          </div>

          {/* Informacion de la venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Nro. de Venta:</p>
              <p className="font-medium">{sale.sale_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha:</p>
              <p className="font-medium">{formatDate(new Date(sale.created_at))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cajero:</p>
              <p className="font-medium">{sale.user?.name || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Estado:</p>
              <Badge
                variant={
                  sale.status === "completed"
                    ? "success"
                    : sale.status === "cancelled"
                      ? "destructive"
                      : "secondary"
                }
              >
                {sale.status === "completed" ? "Completada" : 
                 sale.status === "cancelled" ? "Cancelada" : 
                 "Pendiente"}
              </Badge>
            </div>
          </div>

          {/* Items de la venta */}
          <div>
            <h3 className="font-semibold mb-3 text-foreground">Productos</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Precio Unit.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sale.sale_items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.quantity}x {item.product?.name || "Producto"}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metodos de pago */}
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-foreground">Metodos de Pago</h3>
              {sale.status === "completed" && (
                <div className="flex gap-2">
                  {isEditingPayments ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEditingPayments}
                        disabled={isSavingPayments}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePayments}
                        disabled={!canSavePayments}
                      >
                        {isSavingPayments ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar pagos"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStartEditingPayments}
                      disabled={isLoadingPaymentMethods}
                    >
                      Editar pagos
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isEditingPayments ? (
              <div className="space-y-3 mt-3">
                {paymentRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Metodo
                      </p>
                      <Select
                        value={row.payment_method_id}
                        onValueChange={(value) =>
                          handleUpdatePaymentRow(index, "payment_method_id", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar metodo" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Monto
                      </p>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          handleUpdatePaymentRow(index, "amount", e.target.value)
                        }
                      />
                    </div>

                    {paymentRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-2 md:mt-6"
                        onClick={() => handleRemovePaymentRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                  <div>
                    <p>Total pagos: {formatCurrency(paymentsTotal)}</p>
                    <p>Total venta: {formatCurrency(sale.total_amount)}</p>
                    {!paymentsMatchTotal && (
                      <p className="text-red-600">
                        La suma debe ser igual al total.
                      </p>
                    )}
                    {hasInvalidPaymentRows && (
                      <p className="text-red-600">
                        Cada pago debe tener metodo y monto mayor a 0.
                      </p>
                    )}
                    {paymentsError && (
                      <p className="text-red-600">{paymentsError}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddPaymentRow}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar metodo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {currentPayments?.map((payment: any) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {payment.payment_method?.name || "Metodo"}
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informacion de Factura */}
          {invoice && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-foreground">Factura C</h3>
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Nro. Factura:</span>
                  <span className="text-sm font-bold">
                    {String(invoice.point_of_sale).padStart(4, '0')}-{String(invoice.invoice_number).padStart(8, '0')}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">CAE:</span>
                  <span className="text-sm font-mono">{invoice.cae}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Estado:</span>
                  <Badge variant={invoice.status === 'approved' ? 'success' : 'secondary'}>
                    {invoice.status === 'approved' ? 'Aprobada' : invoice.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Items:</span>
              <span className="font-medium">{totalItems} unidades</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL:</span>
              <span className="text-foreground text-2xl">
                {formatCurrency(sale.total_amount)}
              </span>
            </div>
          </div>

          {/* Formulario de facturacion */}
          {canInvoice && isInvoiceFormOpen && (
            <div className="border rounded-lg p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Facturar venta completada. Complete los datos del cliente si corresponde.
              </p>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={invoiceForm.clientType}
                    onValueChange={(value) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        clientType: value as typeof prev.clientType,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumidor_final">
                        Consumidor Final
                      </SelectItem>
                      <SelectItem value="responsable_inscripto">
                        Responsable Inscripto
                      </SelectItem>
                      <SelectItem value="monotributista">
                        Monotributista
                      </SelectItem>
                      <SelectItem value="exento">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {invoiceForm.clientType !== "consumidor_final" && (
                  <div className="space-y-2">
                    <Label>CUIT</Label>
                    <Input
                      value={invoiceForm.cuit}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({
                          ...prev,
                          cuit: e.target.value,
                        }))
                      }
                      placeholder="20-12345678-9"
                      maxLength={13}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  {invoiceForm.clientType === "consumidor_final"
                    ? "Nombre (opcional)"
                    : "Nombre o Razon Social"}
                </Label>
                <Input
                  value={invoiceForm.name}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={
                    invoiceForm.clientType === "consumidor_final"
                      ? "Nombre para referencia interna"
                      : "Nombre completo o razon social"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Direccion</Label>
                <Input
                  value={invoiceForm.address}
                  onChange={(e) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsInvoiceFormOpen(false);
                    setInvoiceForm(createEmptyInvoiceForm());
                  }}
                  disabled={isGeneratingInvoice}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateInvoice}
                  disabled={isGeneratingInvoice}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isGeneratingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    "Generar Factura"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>{businessInfo.ticket_footer_message}</p>
            <p className="mt-1">Diseñado by SiriuS</p>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 px-6 pb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={handlePrint} variant="shell">
            <Printer className="mr-2 h-4 w-4" />
            Reimprimir Ticket
          </Button>
          {canInvoice && (
            <Button
              type="button"
              variant={isInvoiceFormOpen ? "secondary" : "outline"}
              onClick={() => setIsInvoiceFormOpen((prev) => !prev)}
            >
              {isInvoiceFormOpen ? "Ocultar factura" : "Facturar"}
            </Button>
          )}
          {/* TODO: Implementar facturación para ventas cerradas si es necesario */}
          {invoice && (
            <Button
              type="button"
              onClick={handlePrintInvoice}
              disabled={isPrintingInvoice}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPrintingInvoice ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Imprimiendo...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Factura
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      {/* Modal de Facturación */}
      {/* Nota: InvoiceModal está diseñado para cerrar mesas del bar, no para facturar ventas ya cerradas */}
      {/* TODO: Implementar flujo de facturación para ventas cerradas si es necesario */}
    </Dialog>
  );
}


