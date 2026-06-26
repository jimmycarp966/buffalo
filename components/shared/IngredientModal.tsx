"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotificationStore } from "@/store/notificationStore";
import { createIngredient, updateIngredient } from "@/actions/ingredientActions";
import { INGREDIENT_UNITS } from "@/lib/recipeCost";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Package } from "lucide-react";

interface IngredientModalProps {
  open: boolean;
  onClose: () => void;
  ingredient: any | null;
  onSaved?: () => void;
}

const labelClassName = "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground";

export function IngredientModal({ open, onClose, ingredient, onSaved }: IngredientModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [formData, setFormData] = useState({ name: "", unit: "kg", cost: "", purchase_price: "", yield_units: "" });
  const [useYield, setUseYield] = useState(false);

  useEffect(() => {
    if (ingredient) {
      setUseYield(Number(ingredient.yield_units) > 0);
      setFormData({
        name: ingredient.name,
        unit: ingredient.unit || "kg",
        cost: (ingredient.cost ?? "").toString(),
        purchase_price: (ingredient.purchase_price ?? "").toString(),
        yield_units: (ingredient.yield_units ?? "").toString(),
      });
    } else {
      setUseYield(false);
      setFormData({ name: "", unit: "kg", cost: "", purchase_price: "", yield_units: "" });
    }
  }, [ingredient, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useYield) {
      const price = parseFloat(formData.purchase_price) || 0;
      const units = parseFloat(formData.yield_units) || 0;
      if (price <= 0 || units <= 0) {
        addNotification("error", "Cargá el precio del entero y cuántas porciones rinde");
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = useYield
        ? {
            name: formData.name,
            unit: "unidad",
            cost: 0, // el costo por porción lo deriva el sistema
            purchase_price: parseFloat(formData.purchase_price) || 0,
            yield_units: parseFloat(formData.yield_units) || 0,
          }
        : { name: formData.name, unit: formData.unit, cost: parseFloat(formData.cost) || 0 };

      const result = ingredient
        ? await updateIngredient(ingredient.id, payload)
        : await createIngredient(payload);
      if (result.success) {
        addNotification("success", ingredient ? "Insumo actualizado" : "Insumo creado");
        onClose();
        onSaved?.();
      } else {
        addNotification("error", result.message || "Error al guardar el insumo");
      }
    } catch {
      addNotification("error", "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUnit = INGREDIENT_UNITS.find((u) => u.value === formData.unit);
  const yieldUnits = parseFloat(formData.yield_units) || 0;
  const purchasePrice = parseFloat(formData.purchase_price) || 0;
  const perPortion = useYield && yieldUnits > 0 ? purchasePrice / yieldUnits : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/35 to-secondary/25 text-secondary">
            <Package className="h-5 w-5" />
          </div>
          <DialogTitle className="font-brand text-2xl tracking-[0.08em]">
            {ingredient ? "Editar Insumo" : "Nuevo Insumo"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cargá el costo del insumo. Después lo usás en la receta de cada producto.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label className={labelClassName}>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={useYield ? "Ej: Pan de campo" : "Ej: Jamón cocido"}
                required
                className="h-11 rounded-2xl"
              />
            </div>

            {/* Modo "rinde": se compra entero pero se usa por porciones */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-muted/20 p-3">
              <Checkbox
                checked={useYield}
                onCheckedChange={(c) => setUseYield(c as boolean)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Se compra entero y se usa por porciones</p>
                <p className="text-xs text-muted-foreground">Ej: el pan de campo se compra entero y rinde ~10 rodajas.</p>
              </div>
            </label>

            {useYield ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClassName}>Precio del entero</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      placeholder="0.00"
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClassName}>¿Cuántas porciones rinde?</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.yield_units}
                      onChange={(e) => setFormData({ ...formData, yield_units: e.target.value })}
                      placeholder="Ej: 10"
                      className="h-11 rounded-2xl"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Costo por porción</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {perPortion > 0 ? formatCurrency(perPortion) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    En la receta cargás cuántas porciones usa cada producto. Se recalcula solo al cambiar el precio.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClassName}>Se compra por</Label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
                    >
                      {INGREDIENT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClassName}>
                      Costo por {selectedUnit?.value === "unidad" ? "unidad" : selectedUnit?.value}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      placeholder="0.00"
                      required={!useYield}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  En la receta cargás la cantidad en <b>{selectedUnit?.sub}</b> y el sistema calcula el costo automáticamente.
                </p>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#250513]"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ingredient ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
