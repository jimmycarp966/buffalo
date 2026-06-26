"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/notificationStore";
import { registerCustomerPayment, getCustomerMovements } from "@/actions/customerActions";
import { formatCurrency } from "@/lib/utils";
import { Loader2, DollarSign } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  customer: any | null;
  onSaved?: () => void;
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function CustomerPaymentModal({ open, onClose, customer, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (open && customer) {
      setAmount("");
      setDesc("");
      loadMovements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  const loadMovements = async () => {
    if (!customer) return;
    setLoadingMov(true);
    const res = await getCustomerMovements(customer.id);
    if (res.success) setMovements(res.data);
    setLoadingMov(false);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      addNotification("error", "Ingresá un monto válido");
      return;
    }
    setIsLoading(true);
    const res = await registerCustomerPayment(customer.id, amt, desc);
    if (res.success) {
      addNotification("success", "Pago registrado");
      setAmount("");
      setDesc("");
      await loadMovements();
      onSaved?.();
    } else {
      addNotification("error", res.message || "Error al registrar el pago");
    }
    setIsLoading(false);
  };

  const saldo = Number(customer?.current_balance) || 0;
  const limite = Number(customer?.credit_limit) || 0;
  const disponible = limite > 0 ? limite - saldo : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">Cuenta corriente</DialogTitle>
          <p className="text-sm text-muted-foreground">{customer?.name}</p>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo (debe)</p>
              <p className={`text-lg font-bold tabular-nums ${saldo > 0 ? "text-red-600" : "text-foreground"}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Límite</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {limite > 0 ? formatCurrency(limite) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Disponible</p>
              <p className={`text-lg font-bold tabular-nums ${disponible !== null && disponible < 0 ? "text-red-600" : "text-green-600"}`}>
                {disponible !== null ? formatCurrency(disponible) : "—"}
              </p>
            </div>
          </div>

          {/* Registrar pago */}
          <form onSubmit={handlePay} className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4">
            <p className="text-sm font-semibold text-foreground">Registrar pago</p>
            <p className="text-xs text-muted-foreground">El pago baja el saldo del cliente. No suma a la caja del día.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Monto</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-10 rounded-xl" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Detalle (opcional)</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: efectivo" className="h-10 rounded-xl" />
              </div>
              <Button type="submit" disabled={isLoading} className="h-10 rounded-xl">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                Pagar
              </Button>
            </div>
          </form>

          {/* Movimientos */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Movimientos</p>
            {loadingMov ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : movements.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border">
                {movements.map((m) => {
                  const isPayment = m.type === "payment";
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {isPayment ? "Pago" : "Consumo"}
                          {m.description ? <span className="font-normal text-muted-foreground"> · {m.description}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</p>
                      </div>
                      <span className={`shrink-0 font-bold tabular-nums ${isPayment ? "text-green-600" : "text-red-600"}`}>
                        {isPayment ? "−" : "+"}{formatCurrency(Number(m.amount) || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl">Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
