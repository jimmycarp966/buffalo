"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/notificationStore";
import { createCustomer, updateCustomer } from "@/actions/customerActions";
import { Loader2, UserCircle } from "lucide-react";

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  customer: any | null;
  onSaved?: () => void;
}

const label = "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";

export function CustomerModal({ open, onClose, customer, onSaved }: CustomerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cuit: "", credit_limit: "" });

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        cuit: customer.cuit || "",
        credit_limit: (customer.credit_limit ?? "").toString(),
      });
    } else {
      setForm({ name: "", phone: "", email: "", cuit: "", credit_limit: "" });
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        cuit: form.cuit || null,
        credit_limit: parseFloat(form.credit_limit) || 0,
      };
      const res = customer ? await updateCustomer(customer.id, payload) : await createCustomer(payload);
      if (res.success) {
        addNotification("success", customer ? "Cliente actualizado" : "Cliente creado");
        onClose();
        onSaved?.();
      } else {
        addNotification("error", res.message || "Error al guardar el cliente");
      }
    } catch {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/35 to-secondary/25 text-secondary">
            <UserCircle className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {customer ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            El límite de crédito es cuánto puede deber como máximo en la cuenta corriente.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label className={label}>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Juan Pérez" required className="h-11 rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={label}>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Opcional" className="h-11 rounded-2xl" />
              </div>
              <div className="space-y-1.5">
                <Label className={label}>CUIT/DNI</Label>
                <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} placeholder="Opcional" className="h-11 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={label}>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Opcional" className="h-11 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label className={label}>Límite de crédito</Label>
              <Input type="number" step="0.01" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} placeholder="0.00" className="h-11 rounded-2xl" />
              <p className="text-xs text-muted-foreground">0 = sin límite definido (igual te deja cargar).</p>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl">Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513]">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {customer ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
