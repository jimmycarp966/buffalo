"use client";

import { useEffect, useState } from "react";
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
import { useNotificationStore } from "@/store/notificationStore";
import { createExpense, updateExpense } from "@/actions/expenseActions";
import { Landmark, Loader2 } from "lucide-react";
import { getActiveCashSession } from "@/actions/cashActions";

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  expense?: {
    id: string;
    description: string;
    category: "services" | "supplies" | "maintenance" | "other";
    amount: number;
    cash_register_session_id: string;
  } | null;
  onSuccess?: () => void;
}

const EXPENSE_CATEGORIES = [
  { label: "Servicios", value: "services" },
  { label: "Suministros", value: "supplies" },
  { label: "Mantenimiento", value: "maintenance" },
  { label: "Otros", value: "other" },
];

const inputClassName =
  "h-11 rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground";
const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30";
const labelClassName =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";
const sectionTitleClassName =
  "border-b border-border pb-2 font-brand text-lg tracking-[0.08em] text-foreground";

export function ExpenseModal({
  open,
  onClose,
  expense,
  onSuccess,
}: ExpenseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const isEditing = Boolean(expense);

  const [formData, setFormData] = useState<{
    description: string;
    category: "services" | "supplies" | "maintenance" | "other" | "";
    amount: string;
    cash_register_session_id: string;
  }>({
    description: "",
    category: "",
    amount: "",
    cash_register_session_id: "",
  });

  useEffect(() => {
    if (!open) return;

    const fetchActiveSessions = async () => {
      try {
        const { data } = await getActiveCashSession();
        setActiveSessions(data || []);
      } catch (error) {
        console.error("Error fetching active sessions:", error);
        setActiveSessions([]);
      }
    };

    fetchActiveSessions();
  }, [open]);

  useEffect(() => {
    if (open && expense) {
      setFormData({
        description: expense.description,
        category: expense.category,
        amount: expense.amount.toString(),
        cash_register_session_id: expense.cash_register_session_id,
      });
      return;
    }

    if (open) {
      setFormData({
        description: "",
        category: "",
        amount: "",
        cash_register_session_id: "",
      });
    }
  }, [open, expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.description.trim() ||
      !formData.category ||
      !formData.amount ||
      !formData.cash_register_session_id
    ) {
      addNotification("error", "Campos incompletos: completa todos los campos");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      addNotification("error", "Monto invalido: debe ser un numero positivo");
      return;
    }

    const validCategories = ["services", "supplies", "maintenance", "other"];
    if (!validCategories.includes(formData.category)) {
      addNotification("error", "Categoria invalida: selecciona una opcion valida");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        description: formData.description.trim(),
        category: formData.category as
          | "services"
          | "supplies"
          | "maintenance"
          | "other",
        amount,
        cash_register_session_id: formData.cash_register_session_id,
      };

      const result =
        isEditing && expense
          ? await updateExpense(expense.id, payload)
          : await createExpense(payload);

      if (result.success) {
        addNotification(
          "success",
          isEditing ? "Gasto actualizado exitosamente" : "Gasto registrado exitosamente"
        );

        setFormData({
          description: "",
          category: "",
          amount: "",
          cash_register_session_id: "",
        });

        onClose();
        onSuccess?.();
      } else {
        addNotification(
          "error",
          `Error al ${isEditing ? "actualizar" : "registrar"} gasto: ${result.message}`
        );
      }
    } catch (error) {
      addNotification(
        "error",
        `Error inesperado al ${isEditing ? "actualizar" : "registrar"} el gasto`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSession = activeSessions.find(
    (session) => session.id === formData.cash_register_session_id
  );

  const handleClose = () => {
    if (isLoading) return;
    setFormData({
      description: "",
      category: "",
      amount: "",
      cash_register_session_id: "",
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/35 to-secondary/25 text-secondary">
            <Landmark className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {isEditing ? "Editar Gasto" : "Registrar Nuevo Gasto"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Carga egresos con una lectura clara y vinculalos a una caja abierta.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-4 rounded-[24px] border border-border bg-muted/30 p-4">
              <h3 className={sectionTitleClassName}>Configuracion</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="session" className={labelClassName}>
                    Sesion de Caja *
                  </Label>
                  <select
                    id="session"
                    className={selectClassName}
                    value={formData.cash_register_session_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cash_register_session_id: e.target.value,
                      })
                    }
                    disabled={isLoading}
                    required
                  >
                    <option value="">Selecciona una sesion abierta</option>
                    {activeSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.cash_register?.name || "Caja"} - BAR
                      </option>
                    ))}
                  </select>
                  {activeSessions.length === 0 && (
                    <p className="text-xs text-destructive">
                      No hay sesiones de caja abiertas.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className={labelClassName}>
                    Categoria *
                  </Label>
                  <select
                    id="category"
                    className={selectClassName}
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as
                          | "services"
                          | "supplies"
                          | "maintenance"
                          | "other"
                          | "",
                      })
                    }
                    disabled={isLoading}
                    required
                  >
                    <option value="">Selecciona una categoria</option>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-border bg-muted/30 p-4">
              <h3 className={sectionTitleClassName}>Detalle del Gasto</h3>
              <div className="space-y-1.5">
                <Label htmlFor="description" className={labelClassName}>
                  Descripcion *
                </Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Ej: Compra de insumos de limpieza"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  disabled={isLoading}
                  required
                  className={inputClassName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount" className={labelClassName}>
                  Monto *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  disabled={isLoading}
                  required
                  className={inputClassName}
                />
              </div>
            </div>

            {selectedSession && (
              <div className="rounded-[22px] border border-cyan-500/30 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                <span className="font-semibold">Sesion seleccionada:</span>{" "}
                {selectedSession.cash_register?.name} - BAR
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.cash_register_session_id ||
                !formData.category ||
                !formData.description.trim() ||
                !formData.amount
              }
              className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513]"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar Cambios" : "Registrar Gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
