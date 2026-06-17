"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getIngredients, deleteIngredient } from "@/actions/ingredientActions";
import { IngredientModal } from "./IngredientModal";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { formatCurrency } from "@/lib/utils";
import { purchaseUnitLabel } from "@/lib/recipeCost";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

export function IngredientsTable() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getIngredients();
    if (res.success) setIngredients(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (ing: any) => {
    const ok = await confirm({
      title: "Eliminar insumo",
      description: `¿Eliminar "${ing.name}"? Dejará de aparecer al armar recetas.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await deleteIngredient(ing.id);
    if (res.success) {
      addNotification("success", "Insumo eliminado");
      load();
    } else {
      addNotification("error", res.message || "Error al eliminar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ingredients.length} insumo(s)</p>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo insumo
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : ingredients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Todavía no cargaste insumos</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Cargá tus insumos (jamón, pan, queso…) con su costo. Después, al editar un producto,
            armás su receta y el sistema calcula el costo de producción.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Insumo</th>
                <th className="px-4 py-2.5">Se compra por</th>
                <th className="px-4 py-2.5 text-right">Costo</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{ing.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{purchaseUnitLabel(ing.unit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCurrency(ing.cost)} <span className="text-muted-foreground">/ {purchaseUnitLabel(ing.unit)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(ing); setModalOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(ing)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IngredientModal open={modalOpen} onClose={() => setModalOpen(false)} ingredient={editing} onSaved={load} />
    </div>
  );
}
