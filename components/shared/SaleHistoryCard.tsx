"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Clock, CheckCircle, CreditCard, Package } from "lucide-react";

export interface SaleHistoryItem {
  id: string;
  sale_number: string;
  total_amount: number;
  status: "pending" | "completed";
  created_at: string;
  user?: {
    name: string;
  };
  sale_items?: Array<{
    id: string;
    quantity: number;
    product: {
      name: string;
    };
  }>;
  sale_payments?: Array<{
    id: string;
    amount: number;
    payment_method: {
      name: string;
    };
  }>;
}

interface SaleHistoryCardProps {
  sale: SaleHistoryItem;
}

export function SaleHistoryCard({ sale }: SaleHistoryCardProps) {
  const isCompleted = sale.status === "completed";
  const totalItems = sale.sale_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Card className={`hover:shadow-md transition-shadow ${
      isCompleted 
        ? "border-green-200 bg-green-50/50" 
        : "border-orange-200 bg-orange-50/50"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{sale.sale_number}</span>
            <Badge 
              variant={isCompleted ? "default" : "secondary"}
              className={isCompleted ? "bg-green-600 text-white" : "bg-orange-500 text-white"}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completa
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  Preparando
                </>
              )}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatDate(new Date(sale.created_at))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total:</span>
          <span className="text-lg font-bold text-buffalo-caramel">
            {formatCurrency(sale.total_amount)}
          </span>
        </div>

        {/* Items */}
        {sale.sale_items && sale.sale_items.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{totalItems} producto{totalItems !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Métodos de pago */}
        {sale.sale_payments && sale.sale_payments.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <CreditCard className="h-4 w-4" />
              <span>Pagos:</span>
            </div>
            {sale.sale_payments.map((payment) => (
              <div 
                key={payment.id} 
                className="flex items-center justify-between text-sm pl-6"
              >
                <span className="text-muted-foreground">
                  {payment.payment_method?.name || "Sin método"}
                </span>
                <span className="font-medium">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Cajero */}
        {sale.user?.name && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Cajero: {sale.user.name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

