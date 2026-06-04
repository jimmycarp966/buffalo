"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/notificationStore";
import { createSupplier, updateSupplier } from "@/actions/supplierActions";
import { Loader2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  supplier: any | null;
}

const inputClassName =
  "h-11 rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground";
const labelClassName =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";
const sectionTitleClassName =
  "border-b border-border pb-2 font-brand text-lg tracking-[0.08em] text-foreground";

export function SupplierModal({ open, onClose, supplier }: SupplierModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        contact_name: supplier.contact_name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
      });
      return;
    }

    setFormData({
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
    });
  }, [supplier, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = supplier
        ? await updateSupplier(supplier.id, formData)
        : await createSupplier(formData);

      if (result.success) {
        addNotification(
          "success",
          supplier ? "Proveedor actualizado" : "Proveedor creado exitosamente"
        );
        onClose();
        router.refresh();
      } else {
        addNotification("error", result.message || "Error al guardar el proveedor");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/35 to-secondary/25 text-secondary">
            <Truck className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {supplier ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ordena la informacion comercial del proveedor sin perder legibilidad.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-4 rounded-[24px] border border-border bg-muted/30 p-4">
              <h3 className={sectionTitleClassName}>Informacion Basica</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className={labelClassName}>
                    Nombre del Proveedor *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Distribuidora XYZ"
                    required
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact_name" className={labelClassName}>
                    Persona de Contacto
                  </Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_name: e.target.value })
                    }
                    placeholder="Ej: Juan Perez"
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-border bg-muted/30 p-4">
              <h3 className={sectionTitleClassName}>Informacion de Contacto</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className={labelClassName}>
                    Telefono
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej: +54 11 1234 5678"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className={labelClassName}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@proveedor.com"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className={labelClassName}>
                  Direccion
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className={inputClassName}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513]"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supplier ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
