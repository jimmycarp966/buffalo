"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNotificationStore } from "@/store/notificationStore";
import { getPaymentMethods } from "@/actions/saleActions";
import { Loader2, CreditCard, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { isOverPayment, isPaymentCovered, isWithinTolerance, sumPayments, PAYMENT_TOLERANCE } from "@/lib/payments";

interface SimplePaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payments: Array<{ payment_method_id: string; amount: number }>) => void;
  total: number;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface Payment {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
}

export function SimplePaymentModal({
  open,
  onClose,
  onConfirm,
  total,
}: SimplePaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const totalPaid = sumPayments(payments);
  const remaining = total - totalPaid;
  const changeAmount = Math.max(0, totalPaid - total);
  // Permitir cierre si:
  // 1. Está completamente pagado (sin saldo restante), O
  // 2. Hay métodos de pago y el monto pagado es suficiente (puede ser mayor para dar vuelto)
  const isPaymentSufficient = isWithinTolerance(remaining) || 
    (payments.length > 0 && totalPaid >= total - PAYMENT_TOLERANCE);
  const canFinish = isPaymentSufficient;

  useEffect(() => {
    if (open) {
      loadPaymentMethods();
      setPayments([]);
      setAmount("");
      setIsLoading(false); // Resetear loading cuando se abre el modal
    }
  }, [open]);

  const loadPaymentMethods = async () => {
    const result = await getPaymentMethods();
    if (result.success && result.data) {
      setPaymentMethods(result.data);
      if (result.data.length > 0) {
        setSelectedMethodId(result.data[0].id);
      }
    }
  };

  const addPayment = () => {
    if (!selectedMethodId || !amount || parseFloat(amount) <= 0) {
      addNotification("error", "Ingresá un monto válido");
      return;
    }

    const paymentAmount = parseFloat(amount);
    // Permitir pagos mayores (vuelto) - solo validar que sea un monto válido

    const method = paymentMethods.find((m) => m.id === selectedMethodId);
    if (!method) return;

    setPayments([
      ...payments,
      {
        payment_method_id: selectedMethodId,
        payment_method_name: method.name,
        amount: paymentAmount,
      },
    ]);

    setAmount("");
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const quickPay = (methodName: string) => {
    const method = paymentMethods.find((m) => m.name === methodName);
    if (!method) return;

    setPayments([
      {
        payment_method_id: method.id,
        payment_method_name: method.name,
        amount: total,
      },
    ]);
  };

  const handleConfirm = async () => {
    if (!isPaymentSufficient) {
      if (payments.length === 0) {
        addNotification("error", "Debes seleccionar al menos un método de pago");
        return;
      }
      const totalPaidCalc = sumPayments(payments);
      addNotification("error", `El monto pagado (${formatCurrency(totalPaidCalc)}) debe ser al menos igual al total (${formatCurrency(total)})`);
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(payments.map((p) => ({
        payment_method_id: p.payment_method_id,
        amount: p.amount,
      })));
      // Resetear loading después de que onConfirm termine exitosamente
      // El modal se cerrará desde el componente padre
      setIsLoading(false);
    } catch (error) {
      addNotification("error", "Error al procesar el pago");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Completar Pago</DialogTitle>
      </DialogHeader>
      <DialogContent className="max-w-md w-[95vw] sm:w-[90vw] md:w-[85vw] space-y-4 max-h-[80vh] overflow-y-auto px-4 sm:px-6">
        {/* Resumen */}
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total del pedido:</span>
            <span className="font-bold text-lg">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total pagado:</span>
            <span className={totalPaid > 0 ? "font-medium text-green-600" : ""}>
              {formatCurrency(totalPaid)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Restante:</span>
            <span
              className={
                remaining > 0.01 ? "text-red-600" : remaining < -0.01 ? "text-red-600" : "text-green-600"
              }
            >
              {formatCurrency(remaining)}
            </span>
          </div>
          {changeAmount > 0 && (
            <div className="flex justify-between text-sm font-medium pt-2 border-t">
              <span>Vuelto:</span>
              <span className="text-green-600 font-bold">
                {formatCurrency(changeAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Botones de pago rápido */}
        <div>
          <Label className="mb-2 block">Pago Rápido:</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => quickPay("Efectivo")}
              disabled={payments.length > 0}
            >
              💵 Efectivo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => quickPay("Transferencia")}
              disabled={payments.length > 0}
            >
              🏦 Transferencia
            </Button>
          </div>
        </div>

        {/* Agregar pago manual */}
        <div className="border-t pt-4">
          <Label className="mb-2 block">Pago Múltiple:</Label>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Método</Label>
                <select
                  id="payment_method"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={addPayment}
            >
              Agregar Pago
            </Button>
          </div>
        </div>

        {/* Lista de pagos agregados */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <Label>Pagos Agregados:</Label>
            {payments.map((payment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{payment.payment_method_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePayment(index)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canFinish || isLoading}
          className="min-w-[150px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Completar
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

