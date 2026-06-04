"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/notificationStore";
import { closeCashRegister, getCashSummaryPreview } from "@/actions/cashActions";
import { Loader2, AlertTriangle, Printer, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { brandFullName } from "@/lib/brand";
import { buildCashCloseHtml } from "@/lib/cashCloseTicket";
import { openBrowserPrintWindow } from "@/lib/browserPrint";
import { EMPLOYEES } from "@/lib/validations";
import { useConfirm } from "@/components/providers/ConfirmProvider";

function formatTicketDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface PaymentSummary {
  [methodName: string]: number;
}

interface CloseCashModalProps {
  open: boolean;
  onClose: () => void;
  session: {
    id: string;
    opening_amount: number;
    area?: string;
    employees?: string[]; // IDs de empleados del turno
    cash_register?: {
      name: string;
      type: string;
    };
  };
}

export function CloseCashModal({ open, onClose, session }: CloseCashModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [cashSummary, setCashSummary] = useState<{
    sales: any[];
    expenses: any[];
    incomes?: any[];
    paymentTotals: PaymentSummary;
    totalSales: number;
    totalExpenses: number;
    totalIncomes?: number;
    expected_amount: number;
    difference: number;
    totalOpeningAmount?: number;
    opened_at?: string;
    opened_by_name?: string;
    closed_by_name?: string;
    cash_register_name?: string;
    arqueo_number?: number | null;
  } | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const _router = useRouter();
  const confirm = useConfirm();
  const [isClosed, setIsClosed] = useState(false);
  const [closedData, setClosedData] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);


  const getEmployeeNames = (employeeIds?: string[]): string => {
    if (!employeeIds || employeeIds.length === 0) return "Sin empleados asignados";

    const names = employeeIds
      .map(id => EMPLOYEES.find(emp => emp.id === id)?.name)
      .filter(Boolean);

    return names.join(", ");
  };

  // Calcular resumen preliminar cuando se abre el modal
  useEffect(() => {
    if (open && session.id) {
      calculateCashSummary();
    } else if (!open) {
      // Limpiar el resumen cuando se cierra el modal
      setCashSummary(null);
    }
  }, [open, session.id]);

  const calculateCashSummary = async () => {
    try {
      const result = await getCashSummaryPreview(session.id);

      if (result.success && result.data) {
        setCashSummary(result.data);
      } else {
        console.error("Error getting cash summary:", result.message);
        // Mostrar al menos el monto inicial si hay error
        setCashSummary({
          sales: [],
          expenses: [],
          incomes: [],
          paymentTotals: {},
          totalSales: 0,
          totalExpenses: 0,
          totalIncomes: 0,
          expected_amount: session.opening_amount,
          difference: 0,
          totalOpeningAmount: session.opening_amount
        });
      }
    } catch (error) {
      console.error("Error calculating cash summary:", error);
      // Mostrar al menos el monto inicial si hay error
      setCashSummary({
        sales: [],
        expenses: [],
        incomes: [],
        paymentTotals: {},
        totalSales: 0,
        totalExpenses: 0,
        totalIncomes: 0,
        expected_amount: session.opening_amount,
        difference: 0,
        totalOpeningAmount: session.opening_amount
      });
    }
  };

  // El efectivo esperado ahora viene calculado desde el backend (incluyendo ambas áreas)
  const efectivoEsperado = cashSummary?.expected_amount || 0;
  const difference = closingAmount
    ? parseFloat(closingAmount) - efectivoEsperado
    : 0;
  const hasDifference = Math.abs(difference) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Confirmar si hay diferencia significativa
    if (hasDifference && Math.abs(difference) > 100) {
      const confirmed = await confirm({
        title: "Diferencia en Caja",
        description: `Hay una diferencia de ${formatCurrency(difference)}. ¿Deseas continuar con el cierre?`,
        confirmText: "Continuar",
        cancelText: "Revisar",
        variant: Math.abs(difference) > 500 ? "destructive" : "default"
      });
      if (!confirmed) return;
    }

    setIsLoading(true);

    try {
      const result = await closeCashRegister({
        session_id: session.id,
        closing_amount: parseFloat(closingAmount),
        closing_notes: notes || undefined,
      });

      if (result.success && result.data) {
        setCashSummary(result.data);
        setClosedData(result.data);
        setIsClosed(true);
        addNotification("success", "Caja cerrada exitosamente");
      } else {
        addNotification("error", result.message || "Error al cerrar la caja");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  // Obtener el nombre de la caja desde la sesión
  const cajaName = session.cash_register?.name || 'CAJA BAR';

  const finalizeAndReload = () => {
    onClose();
    window.location.reload();
  };

  const handlePrintArqueo = async () => {
    if (!closedData) return;
    setIsPrinting(true);
    try {
      const d = closedData;
      const html = buildCashCloseHtml({
        businessName: brandFullName,
        arqueoNumber: d.arqueo_number ?? null,
        cashRegisterName: d.cash_register_name || cajaName,
        openedAt: formatTicketDate(d.opened_at),
        closedAt: formatTicketDate(d.closed_at),
        openedBy: d.opened_by_name || "—",
        closedBy: d.closed_by_name || "—",
        paymentTotals: d.paymentTotals || {},
        totalSales: d.totalSales || 0,
        totalIncomes: d.totalIncomes || 0,
        totalExpenses: d.totalExpenses || 0,
        openingAmount: d.totalOpeningAmount || 0,
        expectedCash: d.expected_amount || 0,
        countedCash: d.closing_amount || 0,
        difference: d.difference || 0,
        notes: d.closing_notes || "",
      });
      await openBrowserPrintWindow({ title: "Arqueo de Caja", html });
    } catch (e) {
      addNotification("error", "No se pudo imprimir el arqueo");
    } finally {
      setIsPrinting(false);
    }
  };

  // Vista previa del arqueo ANTES de cerrar (con los datos del momento)
  const handlePreviewArqueo = async () => {
    if (!cashSummary) return;
    setIsPreviewing(true);
    try {
      const counted = closingAmount ? parseFloat(closingAmount) || 0 : 0;
      const diff = closingAmount ? counted - efectivoEsperado : 0;
      const html = buildCashCloseHtml({
        businessName: brandFullName,
        arqueoNumber: cashSummary.arqueo_number ?? null,
        cashRegisterName: cashSummary.cash_register_name || cajaName,
        openedAt: formatTicketDate(cashSummary.opened_at),
        closedAt: "(vista previa)",
        openedBy: cashSummary.opened_by_name || "—",
        closedBy: cashSummary.closed_by_name || "—",
        paymentTotals: cashSummary.paymentTotals || {},
        totalSales: cashSummary.totalSales || 0,
        totalIncomes: cashSummary.totalIncomes || 0,
        totalExpenses: cashSummary.totalExpenses || 0,
        openingAmount: cashSummary.totalOpeningAmount || 0,
        expectedCash: efectivoEsperado,
        countedCash: counted,
        difference: diff,
        notes: notes || "",
      });
      await openBrowserPrintWindow({ title: "Vista previa — Arqueo de Caja", html });
    } catch (e) {
      addNotification("error", "No se pudo generar la vista previa");
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { isClosed ? finalizeAndReload() : onClose(); } }}>
      <DialogContent className="max-w-5xl overflow-y-auto border border-border p-4 shadow-[0_30px_90px_rgba(0,0,0,0.12)] sm:p-6">
        <DialogHeader className="px-0 pt-0">
          <DialogTitle className="font-brand text-3xl text-foreground">
            {isClosed ? `${cajaName} cerrada` : `Cerrar ${cajaName}`}
          </DialogTitle>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {isClosed
              ? "La caja ya fue cerrada. Podés imprimir el arqueo."
              : "Revisa el arqueo, el efectivo esperado y cualquier diferencia antes de cerrar el turno."}
          </p>
        </DialogHeader>
        {isClosed ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-green-400/30 bg-green-500/10 p-6">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
              <div>
                <p className="text-lg font-semibold text-foreground">Caja cerrada exitosamente</p>
                <p className="text-sm text-muted-foreground">
                  {closedData?.difference > 0.01
                    ? `Sobrante: ${formatCurrency(Math.abs(closedData?.difference || 0))}`
                    : closedData?.difference < -0.01
                      ? `Faltante: ${formatCurrency(Math.abs(closedData?.difference || 0))}`
                      : "Sin diferencia en caja"}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-muted/20 p-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Monto inicial</span><span className="font-medium text-foreground">{formatCurrency(closedData?.totalOpeningAmount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ventas totales</span><span className="font-medium text-foreground">{formatCurrency(closedData?.totalSales || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Efectivo esperado</span><span className="font-medium text-foreground">{formatCurrency(closedData?.expected_amount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Efectivo contado</span><span className="font-medium text-foreground">{formatCurrency(closedData?.closing_amount || 0)}</span></div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={handlePrintArqueo} disabled={isPrinting} className="px-6">
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Imprimir arqueo
              </Button>
              <Button type="button" onClick={finalizeAndReload} className="px-6">
                Finalizar
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECCIÓN DE INFORMACIÓN DEL ARQUEO */}
          <div className="space-y-4">
            <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Información del arqueo</h3>
            <div className="rounded-[1.5rem] border border-border bg-muted/20 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Caja:</span>
                    <span className="font-medium text-foreground">{cajaName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monto inicial:</span>
                    <span className="font-medium text-foreground">{formatCurrency(cashSummary?.totalOpeningAmount || session.opening_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Empleados del turno:</span>
                    <span className="text-sm font-medium text-foreground">{getEmployeeNames(session.employees)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ventas totales:</span>
                    <span className="font-medium text-foreground">{formatCurrency(cashSummary?.totalSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ingresos de dinero:</span>
                    <span className="font-medium text-green-600">{formatCurrency(cashSummary?.totalIncomes || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Gastos:</span>
                    <span className="font-medium text-red-600">{formatCurrency(cashSummary?.totalExpenses || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-foreground">Efectivo esperado (solo efectivo):</span>
                    <span className="text-secondary">{formatCurrency(efectivoEsperado)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE MÉTODOS DE PAGO */}
          {cashSummary && cashSummary.paymentTotals && (() => {
            const nonCashMethods = Object.entries(cashSummary.paymentTotals)
              .filter(([method, amount]) => {
                const isNotCash = !method.toLowerCase().includes("efectivo") && !method.toLowerCase().includes("cash");
                return amount > 0 && isNotCash;
              });

            if (nonCashMethods.length === 0) return null;

            return (
              <div className="space-y-4">
                <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Otros métodos de pago</h3>
                <div className="rounded-[1.5rem] border border-border bg-muted/20 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {nonCashMethods.map(([method, amount]) => (
                      <div key={method} className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{method}:</span>
                        <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* SECCIÓN DE CIERRE DE CAJA */}
          <div className="space-y-4">
            <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cierre de caja</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="closing_amount" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Efectivo contado</Label>
                <Input
                  id="closing_amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  required
                  autoFocus
                  className="h-12 border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Contá solo el efectivo físico en esta caja ({cajaName}).
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Notas</Label>
                <Input
                  id="notes"
                  placeholder="Comentarios sobre el cierre..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-12 border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Los otros métodos de pago (tarjeta, transferencia) y gastos ya están registrados automáticamente.
            </p>

            {closingAmount && hasDifference && (
              <div
                className={`flex items-start gap-3 rounded-[1.25rem] border p-6 ${difference > 0
                  ? "border-green-400/20 bg-green-500/10"
                  : "border-red-400/20 bg-red-500/10"
                  }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 ${difference > 0 ? "text-green-600" : "text-red-600"
                    }`}
                />
                <div>
                  <p className="font-medium text-foreground">
                    {difference > 0 ? "Sobrante" : "Faltante"}
                  </p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(Math.abs(difference))}</p>
                </div>
              </div>
            )}
          </div>

          {/* BOTONES DEL FORMULARIO */}
          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" onClick={onClose} className="border-border bg-muted/30 px-6 text-foreground hover:bg-muted">
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={handlePreviewArqueo} disabled={isPreviewing || !cashSummary} className="px-6">
              {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Vista previa
            </Button>
            <Button type="submit" disabled={isLoading} className="px-6">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar Caja
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

