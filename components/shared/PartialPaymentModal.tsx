"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, CreditCard, Banknote, Smartphone, Plus, X } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { makePartialPayment, getTableRemainingBalance } from "@/actions/barActions";
import { getPaymentMethods } from "@/actions/saleActions";
import { useQueryClient } from "@tanstack/react-query";
import { PartialItemSelector, PartialSelectionResult } from "./PartialItemSelector";
import { calculateRemaining, isOverPayment, isWithinTolerance, sumPayments, PAYMENT_TOLERANCE } from "@/lib/payments";

interface PartialPaymentModalProps {
  open: boolean;
  onClose: () => void;
  table: {
    id: string;
    table_number?: number | null;
    total_amount: number;
    created_at: string;
    sale_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      subtotal?: number;
      product: { name: string } | { name: string }[] | null;
      paid_quantity?: number;
      remaining_quantity?: number;
    }>;
  };
  onComplete: () => void;
}

// Helper function to get product name safely
const getProductName = (product: { name: string } | { name: string }[] | null): string => {
  if (!product) return "Producto";
  if (Array.isArray(product)) return product[0]?.name || "Producto";
  return product.name || "Producto";
};

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  "Efectivo": <Banknote className="h-4 w-4" />,
  "Transferencia": <Smartphone className="h-4 w-4" />,
};

interface PaymentItem {
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
}

export function PartialPaymentModal({ open, onClose, table, onComplete }: PartialPaymentModalProps) {
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  // Calcular valores optimistas iniciales desde el table prop para mostrar UI inmediatamente
  const computedPaidFromItems = useMemo(() => {
    return table.sale_items.reduce((sum, item) => {
      const paidQty = item.paid_quantity ?? 0;
      return sum + (paidQty * item.unit_price);
    }, 0);
  }, [table.sale_items]);
  const initialPaidAmount = computedPaidFromItems;
  const initialRemainingBalance = Math.max(table.total_amount - initialPaidAmount, 0);
  const [remainingBalance, setRemainingBalance] = useState<number>(initialRemainingBalance);
  const [paidAmount, setPaidAmount] = useState<number>(initialPaidAmount);
  // Usar useRef para selectionDetail para evitar re-renders innecesarios
  const selectionDetailRef = useRef<PartialSelectionResult>({ total: 0, items: [] });
  // Estado para el total seleccionado que React puede detectar
  const [selectedItemsTotal, setSelectedItemsTotal] = useState<number>(0);
  // Estado para rastrear si el usuario editó manualmente el monto
  const [isManualEdit, setIsManualEdit] = useState<boolean>(false);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setPaymentItems([]);
      setSelectedItemsTotal(0);
      setIsManualEdit(false); // Resetear flag de edición manual
      selectionDetailRef.current = { total: 0, items: [] };
      // Resetear a valores optimistas iniciales
      setRemainingBalance(initialRemainingBalance);
      setPaidAmount(initialPaidAmount);
      // Cargar métodos de pago y balance en paralelo para mejor performance
      Promise.all([
        loadPaymentMethods(),
        loadRemainingBalance()
      ]).catch(error => {
        console.error("Error loading modal data:", error);
      });
    }
  }, [open]);

  // Inicializar métodos de pago cuando se abre el modal
  useEffect(() => {
    if (open && paymentMethods.length > 0 && paymentItems.length === 0) {
      const efectivoMethod = paymentMethods.find((m) => m.name === "Efectivo") || paymentMethods[0];
      if (efectivoMethod) {
        setPaymentItems([
          {
            paymentMethodId: efectivoMethod.id,
            paymentMethodName: efectivoMethod.name,
            amount: 0, // Empezar en 0
          },
        ]);
      }
    }
  }, [open, paymentMethods]); // Solo depender de open y paymentMethods

  // Actualizar el monto de pago cuando cambian las selecciones (solo si no fue edición manual)
  useEffect(() => {
    if (paymentItems.length === 1 && !isManualEdit) {
      setPaymentItems(prev => [{
        ...prev[0],
        amount: selectedItemsTotal
      }]);
    }
  }, [selectedItemsTotal, isManualEdit, paymentItems.length]);

  const loadPaymentMethods = async () => {
    try {
      const result = await getPaymentMethods();
      if (result.success && result.data) {
        const methods = result.data.map(method => ({
          id: method.id,
          name: method.name,
          icon: paymentMethodIcons[method.name] || <DollarSign className="h-4 w-4" />
        }));
        setPaymentMethods(methods);
      } else {
        // Si result.success es false, mostrar el mensaje de error específico
        const errorMessage = result.message || "Error al cargar métodos de pago";
        addNotification("error", errorMessage);
        console.error("Error loading payment methods:", result);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Error al cargar métodos de pago";
      addNotification("error", errorMessage);
      console.error("Exception loading payment methods:", error);
    }
  };

  const loadRemainingBalance = async () => {
    // No mostrar loader que bloquea la UI - cargar en background
    try {
      const result = await getTableRemainingBalance(table.id);
      if (result.success && result.data) {
        const balanceData = result.data;
        const balance = balanceData.remainingBalance || table.total_amount;
        const paid = balanceData.paidAmount || 0;
        // Actualizar valores cuando lleguen los datos reales
        setRemainingBalance(balance);
        setPaidAmount(paid);
      }
    } catch (error) {
      // En caso de error, mantener los valores optimistas
      console.error("Error loading balance:", error);
      // No mostrar notificación para no interrumpir la UX
    }
  };

  const getTotalPaymentAmount = useCallback(() => {
    return sumPayments(paymentItems);
  }, [paymentItems]);

  // Función que actualiza el ref y el estado para sincronización reactiva
  const handleSelectionChange = useCallback((selection: PartialSelectionResult) => {
    selectionDetailRef.current = selection;
    // Actualizar el estado para que React detecte el cambio y actualice el monto
    setSelectedItemsTotal(selection.total);
  }, []);

  const handleClose = () => {
    setPaymentItems([]);
    setRemainingBalance(table.total_amount);
    setPaidAmount(0);
    setSelectedItemsTotal(0);
    selectionDetailRef.current = { total: 0, items: [] };
    onClose();
  };

  const addPaymentMethod = () => {
    if (paymentMethods.length > 0) {
      const method = paymentMethods[0];
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
    setIsManualEdit(true); // Marcar como edición manual
    const newItems = [...paymentItems];
    newItems[index] = { ...newItems[index], amount: Math.max(0, amount) };
    setPaymentItems(newItems);
  };

  const removePaymentMethod = (index: number) => {
    setPaymentItems(paymentItems.filter((_, i) => i !== index));
  };

  const handleConfirmPayment = async () => {
    if (paymentItems.length === 0) {
      addNotification("error", "Debes seleccionar al menos un método de pago");
      return;
    }

    const totalPaymentAmount = getTotalPaymentAmount();
    const payingFullBalance = isWithinTolerance(remainingBalance - totalPaymentAmount);

    if (totalPaymentAmount <= PAYMENT_TOLERANCE) {
      addNotification("error", "El monto total debe ser mayor a 0");
      return;
    }

    if (isOverPayment(remainingBalance, paymentItems)) {
      addNotification("error", `El monto total no puede ser mayor al saldo restante (${formatCurrency(remainingBalance)})`);
      return;
    }

    // Validar coincidencia solo si hay productos seleccionados Y no fue edición manual
    // Si el usuario editó manualmente, asumimos que quiere pagar ese monto específico
    if (!isManualEdit && selectionDetailRef.current.items.length > 0 && Math.abs(totalPaymentAmount - selectedItemsTotal) > PAYMENT_TOLERANCE) {
      addNotification(
        "error",
        `El monto a cobrar (${formatCurrency(totalPaymentAmount)}) debe coincidir con los productos seleccionados (${formatCurrency(
          selectedItemsTotal,
        )})`,
      );
      return;
    }

    const paymentsPayload = paymentItems
      .filter((paymentItem) => paymentItem.amount > 0)
      .map((paymentItem) => ({
        payment_method_id: paymentItem.paymentMethodId,
        amount: paymentItem.amount,
      }));

    if (paymentsPayload.length === 0) {
      addNotification("error", "Cada método de pago debe tener un monto mayor a 0");
      return;
    }

    setIsLoading(true);
    try {
      const result = await makePartialPayment({
        sale_id: table.id,
        payments: paymentsPayload,
        items:
          selectionDetailRef.current.items.length > 0
            ? selectionDetailRef.current.items.map((item) => ({
              sale_item_id: item.sale_item_id,
              quantity: item.quantity,
            }))
            : undefined,
      });

      if (!result.success) {
        addNotification("error", result.message || "Error al procesar pago parcial");
        setIsLoading(false);
        return;
      }

      addNotification("success", `Pago parcial de ${formatCurrency(totalPaymentAmount)} registrado exitosamente`);
      // INVALIDAR QUERY para actualizar la lista de mesas
      queryClient.invalidateQueries({ queryKey: ['openTables'] });
      onComplete();
      handleClose();
    } catch (error) {
      addNotification("error", "Error inesperado al procesar pago");
    } finally {
      setIsLoading(false);
    }
  };

  const totalPaymentAmount = getTotalPaymentAmount();
  const newRemainingAmount = calculateRemaining(remainingBalance, paymentItems);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent manualScroll className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] p-0">
        <div className="flex flex-col h-full min-h-0">
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0">
            <DialogTitle className="text-lg sm:text-xl">
              💳 Pago Parcial{table.table_number
                ? ` - Mesa ${table.table_number}`
                : ' - Pedido'
              }
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Registra un pago parcial para esta mesa
            </p>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-4 px-4 pb-4 flex-1 overflow-hidden min-h-0">
            {/* Resumen de la mesa - Izquierda */}
            <div className="w-full md:w-1/2 overflow-y-auto pr-0 md:pr-2">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen de la Mesa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Selector de productos - Mostrar inmediatamente */}
                  <PartialItemSelector
                    items={table.sale_items.map((item, index) => ({
                      id: item.id || `item-${index}`,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      subtotal: item.subtotal ?? item.quantity * item.unit_price,
                      product: item.product,
                      paid_quantity: item.paid_quantity ?? 0,
                      remaining_quantity:
                        item.remaining_quantity ?? Math.max(item.quantity - (item.paid_quantity ?? 0), 0),
                    }))}
                    onSelectionChange={handleSelectionChange}
                  />

                  <Separator className="my-3" />

                  {/* Resumen financiero - Mostrar inmediatamente con valores optimistas */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span>Total de la Mesa:</span>
                      <span className="font-semibold">{formatCurrency(table.total_amount)}</span>
                    </div>
                    {paidAmount > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-green-600">
                          <span>Ya pagado:</span>
                          <span className="font-semibold">-{formatCurrency(paidAmount)}</span>
                        </div>
                        <Separator className="my-1.5" />
                        <div className="flex justify-between font-semibold text-base">
                          <span>Saldo Restante:</span>
                          <span className="text-blue-600">{formatCurrency(remainingBalance)}</span>
                        </div>
                      </>
                    )}
                    {paidAmount === 0 && (
                      <div className="flex justify-between font-semibold text-base">
                        <span>Total a Pagar:</span>
                        <span>{formatCurrency(table.total_amount)}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground pt-1">
                      Mesa abierta desde: {formatDate(table.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Métodos de pago - Derecha */}
            <div className="w-full md:w-1/2 overflow-y-auto pl-0 md:pl-2">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Métodos de Pago</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Lista de formas de pago */}
                  <div className="space-y-1.5">
                    {paymentItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border border-border rounded-lg bg-card">
                        <Select
                          value={item.paymentMethodId}
                          onValueChange={(value) => updatePaymentMethod(index, value)}
                        >
                          <SelectTrigger className="flex-1 h-8 text-xs">
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

                        <div className="flex items-center gap-1 px-1.5">
                          <span className="text-base font-bold text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={item.amount || ""}
                            onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                            className="w-24 h-7 text-right font-semibold text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>

                        {paymentItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePaymentMethod(index)}
                            className="h-7 w-7 text-gray-400 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {/* Botón agregar forma de pago */}
                    <Button
                      variant="outline"
                      onClick={addPaymentMethod}
                      className="w-full h-8 border-dashed text-muted-foreground text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Agregar forma de pago
                    </Button>
                  </div>

                  {/* Resumen del pago */}
                  <div className="space-y-1.5 p-3 bg-muted rounded-lg border-t">
                    {paidAmount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Ya pagado anteriormente:</span>
                        <span>{formatCurrency(paidAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span>Saldo Actual:</span>
                      <span>{formatCurrency(remainingBalance)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Monto a Pagar Ahora:</span>
                      <span className="text-green-600 font-semibold">{formatCurrency(getTotalPaymentAmount())}</span>
                    </div>
                    <Separator className="my-1.5" />
                    <div className="flex justify-between font-semibold text-sm">
                      <span>Quedará por Pagar:</span>
                      <span className={newRemainingAmount > 0 ? "text-orange-600" : "text-green-600"}>
                        {formatCurrency(newRemainingAmount)}
                      </span>
                    </div>
                    {newRemainingAmount === 0 && (
                      <Badge variant="secondary" className="w-full justify-center text-xs py-0.5">
                        ¡Mesa completamente pagada!
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 px-4 pb-4 pt-3 border-t shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={isLoading} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={isLoading || paymentItems.length === 0 || getTotalPaymentAmount() <= 0 || table.id.startsWith('temp-')}
              className="h-8 text-xs"
            >
              <DollarSign className="mr-1.5 h-3.5 w-3.5" />
              {isLoading ? "Procesando..." : (table.id.startsWith('temp-') ? "Sincronizando..." : "Registrar Pago")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
