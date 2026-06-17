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
import { createPurchase, getSuppliers } from "@/actions/supplierActions";
import { getProducts } from "@/actions/productActions";
import { getIngredients } from "@/actions/ingredientActions";
import { getPaymentMethods } from "@/actions/saleActions";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function PurchaseModal({ open, onClose }: PurchaseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const router = useRouter();

  const [formData, setFormData] = useState({
    supplier_id: "",
    items: [] as Array<{ ref: string; description: string; quantity: string; unit_cost: string }>,
    payment_status: "pending" as "paid" | "pending",
    payment_method_id: "",
  });

  useEffect(() => {
    if (open) {
      loadData();
      setFormData({
        supplier_id: "",
        items: [],
        payment_status: "pending",
        payment_method_id: "",
      });
    }
  }, [open]);

  const loadData = async () => {
    const [suppliersResult, productsResult, ingredientsResult, paymentMethodsResult] = await Promise.all([
      getSuppliers(),
      getProducts(),
      getIngredients(),
      getPaymentMethods(),
    ]);

    if (suppliersResult.success && suppliersResult.data) {
      setSuppliers(suppliersResult.data);
      if (suppliersResult.data.length > 0) {
        setFormData((prev) => ({ ...prev, supplier_id: suppliersResult.data[0].id }));
      }
    }

    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data);
    }

    if (ingredientsResult.success && ingredientsResult.data) {
      setIngredients(ingredientsResult.data);
    }

    if (paymentMethodsResult.success && paymentMethodsResult.data) {
      setPaymentMethods(paymentMethodsResult.data);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { ref: "", description: "", quantity: "1", unit_cost: "0" },
      ],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Al elegir el ítem, sugerir un costo por defecto
    if (field === "ref") {
      if (value.startsWith("prod:")) {
        const product = products.find((p) => p.id === value.slice(5));
        if (product) newItems[index].unit_cost = (product.cost_price ?? 0).toString();
        newItems[index].description = "";
      } else if (value.startsWith("ing:")) {
        const ing = ingredients.find((i) => i.id === value.slice(4));
        if (ing) newItems[index].unit_cost = (ing.cost ?? 0).toString();
        newItems[index].description = "";
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  const totalPurchase = formData.items.reduce(
    (sum, item) => sum + (parseFloat(item.unit_cost) || 0) * (parseFloat(item.quantity) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (formData.items.some((it) => !it.ref || (it.ref === "free" && !it.description.trim()))) {
        addNotification("error", "Completá qué compraste en cada ítem.");
        setIsLoading(false);
        return;
      }

      const items = formData.items.map((item) => {
        const base = {
          product_id: null as string | null,
          ingredient_id: null as string | null,
          description: null as string | null,
          quantity: parseFloat(item.quantity) || 1,
          unit_cost: parseFloat(item.unit_cost) || 0,
        };
        if (item.ref.startsWith("prod:")) {
          base.product_id = item.ref.slice(5);
          base.description = products.find((p) => p.id === base.product_id)?.name || null;
        } else if (item.ref.startsWith("ing:")) {
          base.ingredient_id = item.ref.slice(4);
          base.description = ingredients.find((i) => i.id === base.ingredient_id)?.name || null;
        } else {
          base.description = item.description?.trim() || "Ítem";
        }
        return base;
      });

      const dataToSubmit = {
        supplier_id: formData.supplier_id,
        items,
        payment_status: formData.payment_status,
        payment_method_id:
          formData.payment_status === "paid" && formData.payment_method_id
            ? formData.payment_method_id
            : null,
      };

      const result = await createPurchase(dataToSubmit);

      if (result.success) {
        addNotification("success", "Compra registrada exitosamente.");
        onClose();
        router.refresh();
      } else {
        addNotification("error", result.message || "Error al registrar la compra");
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
        <DialogTitle>Nueva Compra a Proveedor</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] space-y-4 max-h-[70vh] overflow-y-auto px-4 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="supplier">Proveedor *</Label>
            <select
              id="supplier"
              value={formData.supplier_id}
              onChange={(e) =>
                setFormData({ ...formData, supplier_id: e.target.value })
              }
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              required
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Detalle de la compra *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formData.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Agregá lo que compraste (insumos, productos de la carta, o escribí el detalle)
              </p>
            ) : (
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">¿Qué compraste?</Label>
                      <select
                        value={item.ref}
                        onChange={(e) => updateItem(index, "ref", e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="">Elegí…</option>
                        <option value="free">✏️ Escribir otro…</option>
                        {ingredients.length > 0 && (
                          <optgroup label="Insumos">
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={`ing:${ing.id}`}>{ing.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {products.length > 0 && (
                          <optgroup label="Productos (carta)">
                            {products.map((product) => (
                              <option key={product.id} value={`prod:${product.id}`}>{product.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {item.ref === "free" && (
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Ej: Queso crema"
                          className="mt-1 h-9"
                        />
                      )}
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">Costo Unit.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_cost}
                        onChange={(e) =>
                          updateItem(index, "unit_cost", e.target.value)
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Estado de pago</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.payment_status === "pending" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() =>
                  setFormData({ ...formData, payment_status: "pending", payment_method_id: "" })
                }
              >
                Pendiente
              </Button>
              <Button
                type="button"
                variant={formData.payment_status === "paid" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setFormData({ ...formData, payment_status: "paid" })}
              >
                Pagada
              </Button>
            </div>
            {formData.payment_status === "paid" && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="payment_method" className="text-xs">
                  Método de pago (opcional)
                </Label>
                <select
                  id="payment_method"
                  value={formData.payment_method_id}
                  onChange={(e) =>
                    setFormData({ ...formData, payment_method_id: e.target.value })
                  }
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Sin especificar</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {formData.items.length > 0 && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total de la Compra:</span>
                <span className="text-2xl font-bold">{formatCurrency(totalPurchase)}</span>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading || formData.items.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Compra
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

