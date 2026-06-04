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
import { useNotificationStore } from "@/store/notificationStore";
import { createPromotion, updatePromotion } from "@/actions/promotionActions";
import { getProducts } from "@/actions/productActions";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PromotionModalProps {
  open: boolean;
  onClose: () => void;
  promotion: any | null;
}

export function PromotionModal({ open, onClose, promotion }: PromotionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed" | "2x1",
    discount_value: "",
    product_id: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      loadProducts();
      if (promotion) {
        setFormData({
          name: promotion.name,
          description: promotion.description || "",
          discount_type: promotion.discount_type,
          discount_value: (promotion.discount_value || 0).toString(),
          product_id: promotion.product_id || "",
          start_date: promotion.start_date.split("T")[0],
          end_date: promotion.end_date.split("T")[0],
          is_active: promotion.is_active,
        });
      } else {
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          name: "",
          description: "",
          discount_type: "percentage",
          discount_value: "",
          product_id: "",
          start_date: today,
          end_date: today,
          is_active: true,
        });
      }
    }
  }, [promotion, open]);

  const loadProducts = async () => {
    const result = await getProducts();
    if (result.success && result.data) {
      setProducts(result.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date + "T23:59:59").toISOString(),
        product_id: formData.product_id || undefined,
        discount_value: formData.discount_type === "2x1" ? undefined : (parseFloat(formData.discount_value) || 0),
      };

      const result = promotion
        ? await updatePromotion(promotion.id, dataToSubmit)
        : await createPromotion(dataToSubmit);

      if (result.success) {
        addNotification(
          "success",
          promotion ? "Promoción actualizada" : "Promoción creada exitosamente"
        );
        onClose();
        router.refresh();
      } else {
        addNotification("error", result.message || "Error al guardar la promoción");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>{promotion ? "Editar Promoción" : "Nueva Promoción"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Promoción 2x1 en Gaseosas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Tipo de Descuento *</Label>
              <select
                id="discount_type"
                value={formData.discount_type}
                onChange={(e) =>
                  setFormData({ ...formData, discount_type: e.target.value as any })
                }
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
                <option value="2x1">2x1</option>
              </select>
            </div>

            {formData.discount_type !== "2x1" && (
              <div className="space-y-2">
                <Label htmlFor="discount_value">Valor del Descuento *</Label>
                <Input
                  id="discount_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_value: e.target.value })
                  }
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_id">Producto (opcional)</Label>
            <select
              id="product_id"
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Todos los productos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Si no seleccionas un producto, la promoción se aplicará a todos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha de Inicio *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha de Fin *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Promoción activa
            </Label>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {promotion ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

