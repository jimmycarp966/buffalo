"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn, Wallet } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/notificationStore";
import { openCashRegister } from "@/actions/cashActions";

interface OpenCashModalProps {
  open: boolean;
  onClose: () => void;
  cashRegisterId: string;
  type?: "bar";
}

export function OpenCashModal({ open, onClose, cashRegisterId }: OpenCashModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [notes, setNotes] = useState("");
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();
  const queryClient = useQueryClient();

  const cajaName = "CAJA BAR";

  const handleClose = () => {
    setOpeningAmount("");
    setNotes("");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await openCashRegister({
        cash_register_id: cashRegisterId,
        opening_amount: parseFloat(openingAmount),
        area: "bar",
        opening_notes: notes || undefined,
        shift: "night",
      });

      if (result.success) {
        addNotification("success", `${cajaName} abierta exitosamente con $${openingAmount}`);
        setOpeningAmount("");
        setNotes("");
        onClose();

        queryClient.invalidateQueries({ queryKey: ["cashSessions"] });
        queryClient.invalidateQueries({ queryKey: ["activeCashSession"] });
        queryClient.invalidateQueries({ queryKey: ["openTables"] });

        setTimeout(() => {
          router.push("/caja-bar");
          router.refresh();
        }, 300);
      } else {
        addNotification("error", result.message || `Error al abrir ${cajaName}`);
      }
    } catch {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl overflow-hidden border border-border shadow-[0_30px_90px_rgba(0,0,0,0.12)]">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-3 font-brand text-3xl text-foreground">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary">
              <Wallet className="h-5 w-5" />
            </span>
            Abrir Caja Bar
          </DialogTitle>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Registra el monto inicial que usaras para dar cambio. Este bar opera unicamente en turno noche.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-4">
          <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Caja seleccionada</p>
                <p className="mt-1 font-brand text-2xl text-foreground">{cajaName}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opening_amount" className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Monto inicial
              </Label>
              <Input
                id="opening_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                required
                autoFocus
                className="h-12 border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Turno asignado
              </Label>
              <div className="flex h-12 items-center rounded-xl border border-secondary/20 bg-secondary/10 px-4 text-sm font-semibold text-secondary">
                🌙 Noche
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Notas
            </Label>
            <Input
              id="notes"
              placeholder="Comentarios sobre la apertura..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-12 border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <DialogFooter className="gap-3 border-t border-border px-0 pt-6">
            <Button type="button" variant="outline" onClick={handleClose} className="border-border bg-muted/30 text-foreground hover:bg-muted">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir Caja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
