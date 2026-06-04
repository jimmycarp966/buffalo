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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackageSearch } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { updateSaleCustomerData } from "@/actions/saleActions";

interface EditCustomerDataModalProps {
  open: boolean;
  onClose: () => void;
  sale: {
    id: string;
    sale_type: "counter" | "delivery";
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_address?: string | null;
  };
  onComplete: () => void;
}

const inputClassName =
  "h-11 rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground";
const textareaClassName =
  "min-h-[92px] rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground";
const labelClassName =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";

export function EditCustomerDataModal({
  open,
  onClose,
  sale,
  onComplete,
}: EditCustomerDataModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (open) {
      setCustomerName(sale.customer_name || "");
      setCustomerPhone(sale.customer_phone || "");
      setDeliveryAddress(sale.delivery_address || "");
    }
  }, [open, sale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updateSaleCustomerData(sale.id, {
        customer_name: customerName.trim() || null,
        customer_phone:
          sale.sale_type === "delivery" ? customerPhone.trim() || null : undefined,
        delivery_address:
          sale.sale_type === "delivery"
            ? deliveryAddress.trim() || null
            : undefined,
      });

      if (result.success) {
        addNotification("success", "Datos del cliente actualizados correctamente");
        onComplete();
        onClose();
      } else {
        addNotification(
          "error",
          result.message || "Error al actualizar los datos del cliente"
        );
      }
    } catch (error: any) {
      console.error("Error updating customer data:", error);
      addNotification("error", "Error inesperado al actualizar los datos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/35 to-secondary/25 text-secondary">
            <PackageSearch className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {sale.sale_type === "delivery"
              ? "Editar Cliente Delivery"
              : "Editar Cliente Mostrador"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ajusta los datos visibles del pedido sin salir del flujo operativo.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-4 rounded-[24px] border border-border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="customerName" className={labelClassName}>
                  Nombre del Cliente
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre completo"
                  className={inputClassName}
                />
              </div>

              {sale.sale_type === "delivery" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="customerPhone" className={labelClassName}>
                      Telefono
                    </Label>
                    <Input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Numero de contacto"
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deliveryAddress" className={labelClassName}>
                      Direccion de Entrega
                    </Label>
                    <Textarea
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Direccion completa"
                      rows={3}
                      className={textareaClassName}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
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
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
