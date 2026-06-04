"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPriceHistory } from "@/actions/productActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { History, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PriceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sale_price: number;
  } | null;
}

export function PriceHistoryModal({
  open,
  onClose,
  product,
}: PriceHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      loadHistory();
    }
  }, [open, product]);

  const loadHistory = async () => {
    if (!product) return;

    setIsLoading(true);
    const result = await getPriceHistory(product.id);
    if (result.success && result.data) {
      setHistory(result.data);
    }
    setIsLoading(false);
  };

  const getPriceChange = (oldPrice: number, newPrice: number) => {
    const diff = newPrice - oldPrice;
    const percentage = ((diff / oldPrice) * 100).toFixed(2);
    return { diff, percentage };
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <DialogTitle>Historial de Precios</DialogTitle>
          </div>
          {product && (
            <div className="mt-2">
              <p className="text-sm font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                Precio actual: <span className="font-semibold text-primary">
                  {formatCurrency(product.sale_price)}
                </span>
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay cambios de precio registrados</p>
              <p className="text-xs mt-1">
                Los cambios de precio se guardarán automáticamente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item, index) => {
                const change = getPriceChange(item.old_price, item.new_price);
                const isIncrease = change.diff > 0;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {isIncrease ? (
                        <div className="p-2 rounded-full bg-buffalo-espresso/30">
                          <TrendingUp className="h-4 w-4 text-buffalo-caramel" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-buffalo-caramel/20">
                          <TrendingDown className="h-4 w-4 text-buffalo-espresso" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium line-through text-muted-foreground">
                            {formatCurrency(item.old_price)}
                          </span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(item.new_price)}
                          </span>
                        </div>
                        <Badge
                          variant={isIncrease ? "success" : "destructive"}
                          className="whitespace-nowrap"
                        >
                          {isIncrease ? "+" : ""}
                          {change.percentage}%
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>📅 {formatDate(new Date(item.changed_at))}</span>
                          <span>•</span>
                          <span>
                            👤 {item.changed_by_user?.name || "Sistema"}
                          </span>
                        </div>
                        <span className={isIncrease ? "text-green-600" : "text-red-600"}>
                          {isIncrease ? "+" : ""}
                          {formatCurrency(Math.abs(change.diff))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

