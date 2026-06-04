"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNotificationStore } from "@/store/notificationStore";
import { createIncome } from "@/actions/cashActions";
import { Loader2, DollarSign, FileText } from "lucide-react";

interface IncomeModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionArea: string; // Para mostrar en el modal
}

export function IncomeModal({ open, onClose, sessionId, sessionArea }: IncomeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState<{
    description: string;
    amount: string;
  }>({
    description: "",
    amount: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || formData.description.trim().length < 5) {
      addNotification("error", "La descripción debe tener al menos 5 caracteres");
      return;
    }

    if (!formData.amount) {
      addNotification("error", "El monto es requerido");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      addNotification("error", "El monto debe ser un número positivo");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createIncome({
        description: formData.description.trim(),
        amount: amount,
        cash_register_session_id: sessionId,
      });

      if (result.success) {
        addNotification("success", "Ingreso registrado exitosamente");

        // Limpiar formulario y cerrar modal
        setFormData({
          description: "",
          amount: "",
        });
        onClose();
      } else {
        addNotification("error", `Error al registrar ingreso: ${result.message}`);
      }
    } catch (error) {
      addNotification("error", "Error inesperado al registrar el ingreso");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        description: "",
        amount: "",
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] border border-border shadow-[0_30px_90px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-brand text-3xl text-foreground">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-400/20 bg-green-500/10 text-green-200">
              <DollarSign className="h-5 w-5" />
            </span>
            Registrar Ingreso de Dinero
          </DialogTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Registra entradas de efectivo externas a la caja (aportes del dueño, préstamos, etc.)
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información de la sesión */}
          <div className="rounded-[1.25rem] border border-primary/20 bg-primary/10 p-4">
            <p className="text-sm text-foreground">
              <strong>Caja:</strong> CAJA BAR
            </p>
          </div>

          {/* Campo de monto */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="flex items-center gap-2 text-foreground">
              <DollarSign className="h-4 w-4" />
              Monto del ingreso
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              disabled={isLoading}
              required
              autoFocus
              className="border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el monto en efectivo que se está añadiendo a la caja
            </p>
          </div>

          {/* Campo de descripción */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4" />
              Descripción del ingreso
            </Label>
            <Textarea
              id="description"
              placeholder="Ejemplo: Aporte del dueño para cubrir gastos del día"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={isLoading}
              required
              rows={3}
              minLength={5}
              className="border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Explica claramente de dónde proviene el dinero y el motivo del ingreso (mínimo 5 caracteres)
            </p>
          </div>

          {/* Validación en tiempo real */}
          {formData.description.trim().length > 0 && formData.description.trim().length < 5 && (
            <div className="rounded-[1.25rem] border border-yellow-300/20 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-700">
                La descripción debe tener al menos 5 caracteres ({formData.description.trim().length}/5)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="border-border bg-muted/30 text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.description.trim() ||
                formData.description.trim().length < 5 ||
                !formData.amount ||
                parseFloat(formData.amount) <= 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Ingreso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



