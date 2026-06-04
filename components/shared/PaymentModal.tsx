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
import { useRouter } from "next/navigation";
import { PrintTicket } from "./PrintTicket";
import { isOverPayment, isPaymentCovered, isWithinTolerance, sumPayments, PAYMENT_TOLERANCE } from "@/lib/payments";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onCreateSale: (payments: Array<{ payment_method_id: string; amount: number }>) => void;
  total: number;
  items: Array<{
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
  }>;
  sessionId: string;
  cashRegisterId: string;
  tableNumber?: number | null;
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

export function PaymentModal({
  open,
  onClose,
  onComplete,
  onCreateSale,
  total,
  items,
  sessionId,
  cashRegisterId,
  tableNumber,
}: PaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const totalPaid = sumPayments(payments);
  const remaining = total - totalPaid;
  const canFinish = isWithinTolerance(remaining);

  useEffect(() => {
    if (open) {
      loadPaymentMethods();
      setPayments([]);
      setAmount("");
      setSaleData(null);
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
    if (paymentAmount - remaining > PAYMENT_TOLERANCE) {
      addNotification("error", "El monto excede lo que falta pagar");
      return;
    }

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

  const handleFinalizeSale = async () => {
    if (!canFinish) {
      addNotification("error", "El total de pagos debe ser igual al total de la venta");
      return;
    }

    setIsLoading(true);

    try {
      // Usar la función externa para crear la venta
      await onCreateSale(payments.map((p) => ({
        payment_method_id: p.payment_method_id,
        amount: p.amount,
      })));
      // El SaleView manejará el resto del flujo
    } catch (error) {
      addNotification("error", "Error inesperado al procesar la venta");
      setIsLoading(false);
    }
  };

  const handleAfterPrint = () => {
    setIsLoading(false);
    onComplete();
    // Forzar refresh de la página para actualizar todas las cards
    window.location.reload();
  };

  if (saleData) {
    return (
      <PrintTicket
        sale={saleData}
        items={items}
        payments={payments}
        onAfterPrint={handleAfterPrint}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Finalizar Venta</DialogTitle>
      </DialogHeader>
      <DialogContent className="max-w-md w-[95vw] sm:w-[90vw] md:w-[85vw] space-y-6 max-h-[90vh] overflow-y-auto px-4 sm:px-6">
        {/* Resumen de la venta */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3 border">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Resumen de Pago
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de la venta:</span>
              <span className="font-bold text-lg">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total pagado:</span>
              <span className={`font-medium ${totalPaid > 0 ? "text-green-600" : ""}`}>
                {formatCurrency(totalPaid)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium">Restante:</span>
              <span
                className={`font-bold ${
                  remaining > 0.01 ? "text-red-600" : remaining < -0.01 ? "text-red-600" : "text-green-600"
                }`}
              >
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de pago rápido */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Pago Rápido:</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => quickPay("Efectivo")}
              disabled={payments.length > 0}
              className="h-12 text-sm font-medium"
            >
              💵 Efectivo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => quickPay("Transferencia")}
              disabled={payments.length > 0}
              className="h-12 text-sm font-medium"
            >
              🏦 Transferencia
            </Button>
          </div>
        </div>

        {/* Pago múltiple (split payment) */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium">Pago Múltiple (Split):</Label>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment_method" className="text-xs">Método de Pago</Label>
                <select
                  id="payment_method"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-xs">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full h-10"
              onClick={addPayment}
              disabled={remaining <= 0}
            >
              Agregar Pago
            </Button>
          </div>
        </div>

        {/* Lista de pagos agregados */}
        {payments.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-medium">Pagos Agregados:</Label>
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{payment.payment_method_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{formatCurrency(payment.amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(index)}
                      className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleFinalizeSale}
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
              Finalizar Venta
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

