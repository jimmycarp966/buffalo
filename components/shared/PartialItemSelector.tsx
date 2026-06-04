"use client";

import { useState, useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

interface SaleItem {
  id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: { name: string } | { name: string }[] | null;
  paid_quantity?: number;
  remaining_quantity?: number;
}

export interface PartialSelectionItem {
  sale_item_id: string;
  quantity: number;
  unit_price: number;
  name: string;
}

export interface PartialSelectionResult {
  total: number;
  items: PartialSelectionItem[];
}

interface PartialItemSelectorProps {
  items: SaleItem[];
  onSelectionChange: (selection: PartialSelectionResult) => void;
}

// Helper function to get product name safely
const getProductName = (product: { name: string } | { name: string }[] | null): string => {
  if (!product) return "Producto";
  if (Array.isArray(product)) return product[0]?.name || "Producto";
  return product.name || "Producto";
};

const getItemKey = (item: SaleItem, index: number) => {
  return item.id || `${item.product ? getProductName(item.product) : "item"}-${index}`;
};

const getMaxSelectableQuantity = (item: SaleItem) => {
  if (typeof item.remaining_quantity === "number") {
    return Math.max(item.remaining_quantity, 0);
  }
  if (typeof item.paid_quantity === "number") {
    return Math.max(item.quantity - item.paid_quantity, 0);
  }
  return item.quantity;
};

const getPaidQuantity = (item: SaleItem) => {
  if (typeof item.paid_quantity === "number") {
    return Math.max(item.paid_quantity, 0);
  }
  const remaining = getMaxSelectableQuantity(item);
  return Math.max(item.quantity - remaining, 0);
};

export function PartialItemSelector({ items, onSelectionChange }: PartialItemSelectorProps) {
  // Estado para rastrear cuántas unidades de cada producto están seleccionadas
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const lastNotifiedRef = useRef<string>(''); // Para evitar notificaciones duplicadas

  // Calcular cantidades iniciales de manera síncrona para evitar recargas
  const initialQuantities = useMemo(() => {
    const next: Record<string, number> = {};
    items.forEach((item, index) => {
      const key = getItemKey(item, index);
      next[key] = 0; // Inicializar en 0 para evitar recargas
    });
    return next;
  }, [items.length]); // Solo recalcular cuando cambia el número de items

  // Inicializar cantidades solo cuando sea necesario
  useEffect(() => {
    setSelectedQuantities((prev) => {
      // Si ya tenemos cantidades para todos los items, mantener el estado
      if (Object.keys(prev).length === items.length) {
        return prev;
      }
      // Caso contrario, usar las cantidades iniciales calculadas
      return initialQuantities;
    });
  }, [initialQuantities]); // Depender de initialQuantities en lugar de items.length

  // Calcular el total seleccionado cuando cambian las cantidades
  const selectedTotal = useMemo(() => {
    return items.reduce((sum, item, index) => {
      const key = getItemKey(item, index);
      const maxQuantity = getMaxSelectableQuantity(item);
      const selectedQty = Math.min(selectedQuantities[key] || 0, maxQuantity);
      return sum + item.unit_price * selectedQty;
    }, 0);
  }, [items, selectedQuantities]);

  const selectionResult = useMemo<PartialSelectionResult>(() => {
    const selectedItems: PartialSelectionItem[] = [];
    items.forEach((item, index) => {
      const key = getItemKey(item, index);
      const maxQuantity = getMaxSelectableQuantity(item);
      const selectedQty = Math.min(selectedQuantities[key] || 0, maxQuantity);
      if (selectedQty > 0 && item.id) {
        selectedItems.push({
          sale_item_id: item.id,
          quantity: selectedQty,
          unit_price: item.unit_price,
          name: getProductName(item.product),
        });
      }
    });
    return {
      total: selectedTotal,
      items: selectedItems,
    };
  }, [items, selectedQuantities, selectedTotal]);

  // Notificar cambios al componente padre usando useLayoutEffect
  useLayoutEffect(() => {
    onSelectionChange(selectionResult);
  }, [selectionResult]); // Solo depender de selectionResult, no de onSelectionChange

  const incrementQuantity = (index: number) => {
    const maxQuantity = getMaxSelectableQuantity(items[index]);
    setSelectedQuantities((prev) => {
      const key = getItemKey(items[index], index);
      const current = prev[key] || 0;
      if (current < maxQuantity) {
        return { ...prev, [key]: current + 1 };
      }
      return prev;
    });
  };

  const decrementQuantity = (index: number) => {
    setSelectedQuantities((prev) => {
      const key = getItemKey(items[index], index);
      const current = prev[key] || 0;
      if (current > 0) {
        return { ...prev, [key]: current - 1 };
      }
      return prev;
    });
  };

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
        <span>Selecciona productos a pagar</span>
        <span className="font-semibold text-foreground">{items.length} ítems</span>
      </div>

      <div className="flex-1 space-y-1.5 rounded-lg border border-border bg-card/80 p-2 overflow-y-auto min-h-0">
        {items.map((item, index) => {
          const key = getItemKey(item, index);
          const maxQty = getMaxSelectableQuantity(item);
          const paidQty = getPaidQuantity(item);
          const selectedQty = Math.min(selectedQuantities[key] || 0, maxQty);
          const itemSubtotal = item.unit_price * selectedQty;

          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-md border bg-muted/30 px-2 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{getProductName(item.product)}</div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                  <span>{formatCurrency(item.unit_price)} c/u</span>
                  <span>Pendiente: {maxQty}/{item.quantity}</span>
                  <span>Pagado: {paidQty}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => decrementQuantity(index)}
                  disabled={selectedQty === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-semibold w-12 text-center">
                  {selectedQty}/{maxQty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => incrementQuantity(index)}
                  disabled={selectedQty >= maxQty}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {selectedQty > 0 && (
                <div className="text-xs font-semibold text-blue-600 min-w-[72px] text-right">
                  {formatCurrency(itemSubtotal)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedTotal > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold flex items-center justify-between shrink-0">
          <span>Total seleccionado</span>
          <span className="text-base text-blue-700">{formatCurrency(selectedTotal)}</span>
        </div>
      )}
    </div>
  );
}

