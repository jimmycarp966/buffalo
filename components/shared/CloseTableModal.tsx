"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, CreditCard, Banknote, Smartphone, Loader2, X, Plus, FileText } from "lucide-react";
import { closeTable, getTableRemainingBalance, getTablePartialPayments } from "@/actions/barActions";
import { completeCounter, completeDelivery } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { getPaymentMethods } from "@/actions/saleActions";
import { generateInvoice } from "@/actions/invoiceActions";
import { PrintFinalTicket } from "./PrintFinalTicket";
import { InvoiceModal } from "./InvoiceModal";
import { useQueryClient } from "@tanstack/react-query";
import { PartialItemSelector, PartialSelectionResult } from "./PartialItemSelector";
import { calculateRemaining, isPaymentCovered, isOverPayment, isWithinTolerance, sumPayments, PAYMENT_TOLERANCE } from "@/lib/payments";

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface PaymentItem {
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
}

interface InvoiceData {
  clientType: string;
  cuit: string;
  name: string;
  address: string;
}

interface CloseTableModalProps {
  open: boolean;
  onClose: () => void;
  table: {
    id: string;
    table_number?: number | null;
    sale_type?: "table" | "counter" | "delivery";
    kitchen_ready?: boolean;
    total_amount: number;
    customer_name?: string | null;
    delivery_address?: string | null;
    sale_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      product: {
        name: string;
        unlimited_stock?: boolean;
      } | {
        name: string;
        unlimited_stock?: boolean;
      }[] | null;
      paid_quantity?: number;
      remaining_quantity?: number;
    }>;
  };
  onComplete?: () => void;
}

const getProductName = (product: { name: string } | { name: string }[] | null): string => {
  if (!product) return "Producto";
  if (Array.isArray(product)) return product[0]?.name || "Producto";
  return product.name || "Producto";
};

// Cache global de métodos de pago (fuera del componente)
let cachedPaymentMethods: PaymentMethod[] | null = null;
let cachePromise: Promise<void> | null = null;

export function CloseTableModal({ open, onClose, table, onComplete }: CloseTableModalProps) {
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [showTicket, setShowTicket] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(cachedPaymentMethods || []);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [remainingBalance, setRemainingBalance] = useState<number>(table.total_amount);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'discount' | 'surcharge'>('discount');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [closedSaleId, setClosedSaleId] = useState<string | null>(null);
  const [selectedItemsTotal, setSelectedItemsTotal] = useState<number>(0);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const loadPaymentMethods = async () => {
    // Si ya están en cache, usar inmediatamente
    if (cachedPaymentMethods && cachedPaymentMethods.length > 0) {
      setPaymentMethods(cachedPaymentMethods);
      loadRemainingBalance(cachedPaymentMethods);
      return;
    }

    // Si ya hay una carga en progreso, esperar
    if (cachePromise) {
      await cachePromise;
      if (cachedPaymentMethods) {
        setPaymentMethods(cachedPaymentMethods);
        loadRemainingBalance(cachedPaymentMethods);
      }
      return;
    }

    // Cargar por primera vez
    cachePromise = (async () => {
      try {
        const result = await getPaymentMethods();
        if (result.success && result.data) {
          const paymentMethodIcons: Record<string, React.ReactNode> = {
            "Efectivo": <Banknote className="h-4 w-4" />,
            "Transferencia": <Smartphone className="h-4 w-4" />,
          };

          const methods = result.data.map((method: any) => ({
            id: method.id,
            name: method.name,
            icon: paymentMethodIcons[method.name] || <DollarSign className="h-4 w-4" />
          }));

          cachedPaymentMethods = methods;
          setPaymentMethods(methods);
          loadRemainingBalance(methods);
        }
      } catch (error) {
        addNotification("error", "Error al cargar métodos de pago");
      } finally {
        cachePromise = null;
      }
    })();

    await cachePromise;
  };

  const loadRemainingBalance = async (methods: PaymentMethod[]) => {
    // Configurar inmediatamente con el total de la mesa (sin esperar)
    const balance = table.total_amount;
    setRemainingBalance(balance);
    setPaidAmount(0);

    // Configurar efectivo por defecto inmediatamente
    if (!isWithinTolerance(balance) && methods.length > 0) {
      const efectivoMethod = methods.find(m => m.name === "Efectivo");
      if (efectivoMethod) {
        setPaymentItems([{
          paymentMethodId: efectivoMethod.id,
          paymentMethodName: efectivoMethod.name,
          amount: balance
        }]);
      }
    }

    setLoadingBalance(false);

    // Intentar obtener el balance real en segundo plano (por si hay pagos parciales)
    try {
      const result = await getTableRemainingBalance(table.id);
      if (result.success && result.data) {
        const balanceData = result.data;
        const realBalance = balanceData.remainingBalance || table.total_amount;
        const paid = balanceData.paidAmount || 0;

        // Solo actualizar si hay diferencia
        if (realBalance !== balance || paid > 0) {
          setRemainingBalance(realBalance);
          setPaidAmount(paid);

          // Actualizar el monto en efectivo si cambió
          const efectivoMethod = methods.find(m => m.name === "Efectivo");
          if (efectivoMethod) {
            setPaymentItems([{
              paymentMethodId: efectivoMethod.id,
              paymentMethodName: efectivoMethod.name,
              amount: realBalance
            }]);
          }
        }
      }
    } catch (error) {
      // Silenciosamente ignorar errores ya que ya tenemos el valor por defecto
    }
  };

  useEffect(() => {
    if (open) {
      setPaymentItems([]);
      setSelectedItemsTotal(0);
      setDiscountPercent(0);
      setAdjustmentType('discount');
      loadPaymentMethods();
    }
  }, [open]);

  // Actualizar el monto de pago cuando cambia la selección de productos
  useEffect(() => {
    if (selectedItemsTotal <= 0) {
      return;
    }

    if (paymentItems.length === 0 && paymentMethods.length > 0) {
      const efectivoMethod = paymentMethods.find((m) => m.name === "Efectivo") || paymentMethods[0];
      if (efectivoMethod) {
        setPaymentItems([
          {
            paymentMethodId: efectivoMethod.id,
            paymentMethodName: efectivoMethod.name,
            amount: selectedItemsTotal,
          },
        ]);
      }
      return;
    }

    if (paymentItems.length === 1) {
      setPaymentItems((prev) => {
        if (prev.length !== 1) return prev;
        if (isWithinTolerance(prev[0].amount - selectedItemsTotal)) {
          return prev;
        }
        const updated = [...prev];
        updated[0] = { ...updated[0], amount: selectedItemsTotal };
        return updated;
      });
    }
  }, [selectedItemsTotal, paymentItems.length, paymentMethods]);

  // Al cambiar el % o el tipo de ajuste, ajustar el monto del único pago al total efectivo
  // (solo si hay exactamente un método de pago, para no pisar pagos parciales/divididos)
  useEffect(() => {
    const amount = Math.round((remainingBalance * (discountPercent || 0) / 100) * 100) / 100;
    const effective = adjustmentType === 'surcharge'
      ? remainingBalance + amount
      : Math.max(0, remainingBalance - amount);
    setPaymentItems((prev) => {
      if (prev.length !== 1) return prev;
      if (isWithinTolerance(prev[0].amount - effective)) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], amount: effective };
      return updated;
    });
  }, [discountPercent, adjustmentType, remainingBalance]);

  const getTotalPaymentAmount = useCallback(() => {
    return sumPayments(paymentItems);
  }, [paymentItems]);

  const handleSelectionChange = useCallback((selection: PartialSelectionResult) => {
    setSelectedItemsTotal(selection.total);
  }, []);

  // Ajuste global por porcentaje sobre el saldo a cobrar (remainingBalance).
  // Puede ser un descuento (resta) o un recargo (suma) según adjustmentType.
  const adjustmentAmount = Math.round((remainingBalance * (discountPercent || 0) / 100) * 100) / 100;
  const isSurcharge = adjustmentType === 'surcharge';
  const discountAmount = isSurcharge ? 0 : adjustmentAmount;
  const surchargeAmount = isSurcharge ? adjustmentAmount : 0;
  const effectiveTotal = isSurcharge
    ? remainingBalance + surchargeAmount
    : Math.max(0, remainingBalance - discountAmount);

  const handleSubmit = useCallback(async () => {
    if (!table) return;

    if (table.id.startsWith('temp-')) {
      addNotification("info", "Sincronizando mesa... Espere un momento.");
      return;
    }

    // Verificar si tiene productos de cocina
    const hasKitchenProducts = table.sale_items?.some((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      return product?.unlimited_stock === true;
    }) || false;

    // Para counter/delivery con productos de cocina, verificar kitchen_ready
    if ((table.sale_type === 'counter' || table.sale_type === 'delivery') && hasKitchenProducts) {
      if (!table.kitchen_ready) {
        addNotification("error", "El pedido debe estar listo en cocina antes de cerrarse");
        return;
      }
    }

    const isFullyPaid = isWithinTolerance(effectiveTotal);

    if (!isFullyPaid) {
      if (paymentItems.length === 0) {
        addNotification("error", "Debes seleccionar al menos un método de pago");
        return;
      }

      const totalPaymentAmount = getTotalPaymentAmount();
      const shortageAmount = Math.max(0, effectiveTotal - totalPaymentAmount);

      // Validar que el pago sea suficiente (puede ser mayor para dar vuelto)
      if (shortageAmount > PAYMENT_TOLERANCE) {
        addNotification("error", `El pago es insuficiente. Faltante: ${formatCurrency(shortageAmount)}. El monto pagado (${formatCurrency(totalPaymentAmount)}) debe ser al menos igual al total a cobrar (${formatCurrency(effectiveTotal)})`);
        return;
      }

      // Permitir sobrepago - el vuelto se calculará y mostrará automáticamente
      // No bloqueamos el cierre si hay vuelto, ya que saldrá de caja
    }

    setIsLoading(true);
    try {
      let result;

      // Usar la función apropiada según el tipo de venta
      if (table.sale_type === 'counter') {
        const payments = paymentItems.map(item => ({
          payment_method_id: item.paymentMethodId,
          amount: item.amount,
        }));
        result = await completeCounter(table.id, payments, discountAmount, surchargeAmount);
      } else if (table.sale_type === 'delivery') {
        const payments = paymentItems.map(item => ({
          payment_method_id: item.paymentMethodId,
          amount: item.amount,
        }));
        result = await completeDelivery(table.id, payments, discountAmount, surchargeAmount);
      } else {
        // Para mesas, usar closeTable
        result = await closeTable(table.id, paymentItems, discountAmount, surchargeAmount);
      }

      if (result.success) {
        // Guardar el ID de la venta cerrada para facturación
        setClosedSaleId(table.id);

        // Nota: El registro en caja para facturaciones se hace automáticamente
        // en el flujo de facturación (/api/bar/close-table-with-invoice)

        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        queryClient.invalidateQueries({ queryKey: ['cashRegister'] });

        // 🔍 DEBUG TOTAL: Verificar el total_amount antes de construir ticketData
        const calculatedTotal = table.sale_items?.reduce((sum: number, item: any) => {
          return sum + (item.subtotal || item.quantity * item.unit_price || 0);
        }, 0) || 0;
        console.log('🔍 [DEBUG TOTAL] CloseTableModal - Verificación del total:');
        console.log('  - table.total_amount:', table.total_amount);
        console.log('  - typeof table.total_amount:', typeof table.total_amount);
        console.log('  - calculatedTotal (desde items):', calculatedTotal);
        console.log('  - ¿Coinciden?:', table.total_amount === calculatedTotal);
        console.log('  - sale_items:', table.sale_items?.map((i: any) => ({
          name: i.product?.name,
          qty: i.quantity,
          price: i.unit_price,
          subtotal: i.subtotal
        })));

        // 🔍 DEBUG DELIVERY: Verificar datos de la tabla antes de construir ticketData
        console.log('🔍 [DEBUG DELIVERY] CloseTableModal - Datos de la tabla:');
        console.log('  - table object completo:', table);
        console.log('  - table.sale_type:', table.sale_type);
        console.log('  - table.delivery_address:', table.delivery_address);
        console.log('  - Tipo de table.delivery_address:', typeof table.delivery_address);
        console.log('  - Es null?:', table.delivery_address === null);
        console.log('  - Es undefined?:', table.delivery_address === undefined);
        console.log('  - Es string vacío?:', table.delivery_address === '');
        console.log('  - Valor truthy?:', !!table.delivery_address);
        console.log('  - table.customer_name:', table.customer_name);
        console.log('  - table.id:', table.id);

        // Usar el total calculado desde los items para garantizar consistencia
        // Si hay discrepancia, preferir el calculado ya que refleja los items actuales del ticket
        const ticketTotal = calculatedTotal > 0 ? calculatedTotal : table.total_amount;
        if (calculatedTotal !== table.total_amount) {
          console.warn('⚠️ [DEBUG TOTAL] Discrepancia detectada! Usando total calculado:', ticketTotal);
        }

        // Total cobrado (con ajuste): descuento resta, recargo suma sobre el bruto del ticket
        const ticketTotalWithAdjustment = Math.max(0, ticketTotal - discountAmount) + surchargeAmount;

        const ticketData = {
          id: table.id,
          sale_number: table.sale_type === 'counter'
            ? `MOSTRADOR-${table.id.slice(0, 8)}`
            : table.sale_type === 'delivery'
              ? `DELIVERY-${table.id.slice(0, 8)}`
              : `MESA-${table.table_number}`,
          // total_amount = lo efectivamente cobrado (con ajuste aplicado)
          total_amount: ticketTotalWithAdjustment,
          // Desglose del ajuste para el ticket (se imprime solo si hay descuento o recargo)
          subtotal: ticketTotal,
          discount: discountAmount,
          surcharge: surchargeAmount,
          discount_percent: discountAmount > 0 ? discountPercent : 0,
          surcharge_percent: surchargeAmount > 0 ? discountPercent : 0,
          created_at: new Date().toISOString(),
          table_number: table.table_number,
          sale_type: table.sale_type,
          customer_name: table.customer_name,
          delivery_address: table.delivery_address,
          user: { name: "Cajero" },
        };

        // 🔍 DEBUG DELIVERY: Verificar ticketData construido
        console.log('🔍 [DEBUG DELIVERY] CloseTableModal - ticketData construido:');
        console.log('  - ticketData.delivery_address:', ticketData.delivery_address);
        console.log('  - ticketData.customer_name:', ticketData.customer_name);
        console.log('  - ticketData.sale_type:', ticketData.sale_type);

        const ticketItems = table.sale_items.map((item: any) => ({
          name: getProductName(item.product),
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          customization: (item as any).customization,
        }));

        const partialPaymentsResult = await getTablePartialPayments(table.id);
        const partialPayments = partialPaymentsResult.success && partialPaymentsResult.data
          ? partialPaymentsResult.data.map((payment: any) => ({
            payment_method_name: payment.payment_method?.name || "Desconocido",
            amount: payment.amount,
          }))
          : [];

        const currentPayments = paymentItems.map((payment: PaymentItem) => ({
          payment_method_name: payment.paymentMethodName,
          amount: payment.amount,
        }));

        const ticketPayments = [...partialPayments, ...currentPayments];

        const finalSaleData = {
          ...ticketData,
          items: ticketItems,
          payments: ticketPayments,
        };

        // 🔍 DEBUG DELIVERY: Verificar saleData final antes de pasar a PrintFinalTicket
        console.log('🔍 [DEBUG DELIVERY] CloseTableModal - saleData final que se pasa a PrintFinalTicket:');
        console.log('  - finalSaleData.delivery_address:', finalSaleData.delivery_address);
        console.log('  - finalSaleData.customer_name:', finalSaleData.customer_name);
        console.log('  - finalSaleData.sale_type:', finalSaleData.sale_type);
        console.log('  - finalSaleData completo:', finalSaleData);

        setSaleData(finalSaleData);

        setShowTicket(true);
        addNotification("success", `Mesa ${table.table_number} cerrada exitosamente`);
      } else {
        addNotification("error", result.message || "Error al cerrar mesa");
      }
    } catch (error) {
      console.error("Error:", error);
      addNotification("error", "Error al cerrar mesa");
    } finally {
      setIsLoading(false);
    }
  }, [table, remainingBalance, effectiveTotal, discountAmount, surchargeAmount, discountPercent, paymentItems, paymentMethods, getTotalPaymentAmount, addNotification, queryClient]);

  const addPaymentMethod = () => {
    const method = paymentMethods[0];
    if (method) {
      setPaymentItems([...paymentItems, {
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        amount: 0
      }]);
    }
  };

  const updatePaymentMethod = (index: number, paymentMethodId: string) => {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (method) {
      const newItems = [...paymentItems];
      newItems[index] = { ...newItems[index], paymentMethodId: method.id, paymentMethodName: method.name };
      setPaymentItems(newItems);
    }
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    const newItems = [...paymentItems];
    newItems[index] = { ...newItems[index], amount: Math.max(0, amount) };
    setPaymentItems(newItems);
  };

  const removePaymentMethod = (index: number) => {
    setPaymentItems(paymentItems.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setPaymentItems([]);
    setShowTicket(false);
    setSaleData(null);
    setShowInvoiceModal(false);
    setRemainingBalance(table.total_amount);
    setPaidAmount(0);
    setDiscountPercent(0);
    setAdjustmentType('discount');
    onClose();
  };

  const totalPaymentAmount = getTotalPaymentAmount();
  const changeAmount = Math.max(0, totalPaymentAmount - effectiveTotal);
  const shortageAmount = Math.max(0, effectiveTotal - totalPaymentAmount);
  const hasShortage = shortageAmount > PAYMENT_TOLERANCE; // Considerar tolerancia para decimales

  // Permitir cierre si:
  // 1. Está completamente pagado (sin saldo restante), O
  // 2. Hay métodos de pago y el monto pagado es suficiente (puede ser mayor para dar vuelto)
  // 3. NO debe haber faltante
  const isPaymentSufficient = isWithinTolerance(effectiveTotal) ||
    (paymentItems.length > 0 && totalPaymentAmount >= effectiveTotal - PAYMENT_TOLERANCE);
  const disableSubmit = (!isPaymentSufficient) || hasShortage || isLoading || loadingBalance || table.id.startsWith('temp-');

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent manualScroll className="max-w-6xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-card shrink-0 pr-14">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">MESA {table.table_number}</h2>
          </div>

          {/* Contenido en dos columnas */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            {/* Columna izquierda: Productos */}
            <div className="w-full md:w-[45%] border-b md:border-b-0 md:border-r border-border px-4 sm:px-8 py-4 sm:py-6 bg-card flex flex-col">
              <h3 className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide">Productos</h3>

              {loadingBalance ? (
                <div className="flex items-center justify-center flex-1">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0">
                    <PartialItemSelector
                      items={table.sale_items.map((item, index) => ({
                        id: item.id || `item-${index}`,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        subtotal: item.subtotal ?? item.quantity * item.unit_price,
                        product: item.product,
                        paid_quantity: (item as any).paid_quantity ?? 0,
                        remaining_quantity:
                          (item as any).remaining_quantity ??
                          Math.max(item.quantity - ((item as any).paid_quantity ?? 0), 0),
                      }))}
                      onSelectionChange={handleSelectionChange}
                    />
                  </div>

                  {/* Totales */}
                  <div className="mt-auto pt-6 space-y-4 border-t border-border shrink-0">
                    {paidAmount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Ya pagado:</span>
                        <span className="font-semibold">-{formatCurrency(paidAmount)}</span>
                      </div>
                    )}

                    {/* Control de ajuste por porcentaje (descuento o recargo) */}
                    <div className="space-y-2">
                      {/* Toggle Descuento / Recargo */}
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          type="button"
                          variant={adjustmentType === 'discount' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAdjustmentType('discount')}
                          className="h-8 text-xs"
                        >
                          Descuento
                        </Button>
                        <Button
                          type="button"
                          variant={adjustmentType === 'surcharge' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAdjustmentType('surcharge')}
                          className="h-8 text-xs"
                        >
                          Recargo
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {adjustmentType === 'surcharge' ? 'Recargo' : 'Descuento'}
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={discountPercent || ""}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setDiscountPercent(Math.min(100, Math.max(0, value)));
                            }}
                            className="w-20 h-8 text-right font-semibold"
                            min="0"
                            max="100"
                            step="1"
                            placeholder="0"
                          />
                          <span className="text-base font-semibold text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[10, 15, 20, 0].map((pct) => (
                          <Button
                            key={pct}
                            type="button"
                            variant={discountPercent === pct ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDiscountPercent(pct)}
                            className="flex-1 h-7 text-xs"
                          >
                            {pct === 0
                              ? (adjustmentType === 'surcharge' ? "Sin rec." : "Sin desc.")
                              : `${pct}%`}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {discountPercent > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Subtotal:</span>
                          <span className="font-semibold">{formatCurrency(remainingBalance)}</span>
                        </div>
                        {isSurcharge ? (
                          <div className="flex justify-between text-sm text-amber-600">
                            <span>Recargo ({discountPercent}%):</span>
                            <span className="font-semibold">+{formatCurrency(surchargeAmount)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-sm text-destructive">
                            <span>Descuento ({discountPercent}%):</span>
                            <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xl font-bold text-foreground">Total:</span>
                          <span className="text-2xl font-bold text-primary">{formatCurrency(effectiveTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-foreground">Total:</span>
                        <span className="text-2xl font-bold text-foreground">{formatCurrency(remainingBalance)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* Columna derecha: Pagos */}
            <div className="w-full md:w-[55%] px-4 sm:px-6 py-4 sm:py-5 bg-muted/30 flex flex-col">
              <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Formas de Pago</h3>

              {/* Lista de formas de pago */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {paymentItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border border-border rounded bg-card">
                    <Select
                      value={item.paymentMethodId}
                      onValueChange={(value) => updatePaymentMethod(index, value)}
                    >
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1 px-2">
                      <span className="text-lg font-bold text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={item.amount || ""}
                        onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                        className="w-28 h-8 text-right font-semibold text-base border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {paymentItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentMethod(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Botón agregar forma de pago */}
                <Button
                  variant="outline"
                  onClick={addPaymentMethod}
                  className="w-full h-9 border-dashed text-muted-foreground text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar forma de pago
                </Button>
              </div>

              {/* Resumen de pagos */}
              <div className="mt-auto pt-4 space-y-2 border-t border-border shrink-0">
                {changeAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-base text-muted-foreground">Vuelto:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(changeAmount)}
                    </span>
                  </div>
                )}
                {hasShortage && (
                  <div className="flex justify-between items-center">
                    <span className="text-base text-red-600 font-semibold">Faltante:</span>
                    <span className="text-xl font-bold text-red-600">
                      {formatCurrency(shortageAmount)}
                    </span>
                  </div>
                )}
                {hasShortage && (
                  <p className="text-xs text-red-600 mt-1">
                    No se puede cerrar la mesa. El pago es insuficiente.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer con botones */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-5 border-t border-border bg-card shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                // El flujo de facturación AFIP no contempla ajustes: bloquear si hay descuento o recargo
                if (discountPercent > 0) {
                  addNotification("error", `No se puede facturar con ${isSurcharge ? 'recargo' : 'descuento'} aplicado. Quítalo para facturar.`);
                  return;
                }

                // Validar que haya pagos configurados
                if (paymentItems.length === 0) {
                  addNotification("error", "Debes seleccionar al menos una forma de pago");
                  return;
                }

                if (!isPaymentCovered(remainingBalance, paymentItems)) {
                  const totalPaymentAmount = getTotalPaymentAmount();
                  addNotification("error", `La suma de pagos debe ser igual al total: ${formatCurrency(remainingBalance)}`);
                  return;
                }

                setShowInvoiceModal(true);
              }}
              disabled={isLoading}
              className="h-10 px-4 sm:px-6 text-green-600 border-green-600 hover:bg-green-50 text-sm sm:text-base"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Facturar y cerrar mesa</span>
              <span className="sm:hidden">Facturar</span>
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={disableSubmit}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 sm:px-10 h-10 font-semibold text-sm sm:text-base flex-1 sm:flex-initial"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Cerrando...
                </>
              ) : (
                `Cerrar mesa ${table.table_number}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Final Ticket */}
      {showTicket && saleData && (
        <PrintFinalTicket
          sale={saleData}
          items={saleData.items}
          payments={saleData.payments}
          onAfterPrint={() => {
            setShowTicket(false);
            setSaleData(null);
            onComplete?.();
            handleClose();
          }}
        />
      )}

      {/* Invoice Modal */}
      <InvoiceModal
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        tableId={table.id}
        tableNumber={table.table_number || 0}
        saleType={table.sale_type || "table"}
        totalAmount={remainingBalance}
        items={table.sale_items.map((item: any) => ({
          description: getProductName(item.product),
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.subtotal,
        }))}
        paymentItems={paymentItems}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['openTables'] });
          queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
          onComplete?.();
          handleClose();
        }}
      />
    </>
  );
}

