"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, CheckCircle, Printer, MapPin, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface KitchenOrderItem {
  id: string;
  quantity: number;
  customization?: string; // ✅ Personalización del producto
  product: {
    name: string;
  };
}

interface KitchenOrderCardProps {
  saleId: string;
  tableNumber?: number | null;
  saleType?: "table" | "counter" | "delivery";
  status?: "pending" | "completed";
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  items: KitchenOrderItem[];
  waiterName?: string;
  createdAt: string;
  onMarkReady?: (saleId: string) => void;
  onReprint?: (saleId: string) => void;
}

export function KitchenOrderCard({
  saleId,
  tableNumber,
  saleType,
  status,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryNotes,
  items,
  waiterName,
  createdAt,
  onMarkReady,
  onReprint
}: KitchenOrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("");
  const [urgencyLevel, setUrgencyLevel] = useState<"normal" | "warning" | "urgent">("normal");

  // Actualizar tiempo transcurrido cada 30 segundos
  useEffect(() => {
    const updateTime = () => {
      const time = formatDistanceToNow(new Date(createdAt), { 
        addSuffix: true, 
        locale: es 
      });
      setElapsedTime(time);

      // Calcular urgencia
      const minutesElapsed = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60;
      if (minutesElapsed > 20) {
        setUrgencyLevel("urgent");
      } else if (minutesElapsed > 10) {
        setUrgencyLevel("warning");
      } else {
        setUrgencyLevel("normal");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [createdAt]);

  // Determinar colores según urgencia
  const getBorderColor = () => {
    switch (urgencyLevel) {
      case "urgent":
        return "border-red-500 border-4";
      case "warning":
        return "border-yellow-500 border-4";
      default:
        return "border-green-500 border-2";
    }
  };

  const getTimeColor = () => {
    switch (urgencyLevel) {
      case "urgent":
        return "text-red-600 font-bold animate-pulse";
      case "warning":
        return "text-yellow-600 font-semibold";
      default:
        return "text-green-600";
    }
  };

  return (
    <Card className={`${getBorderColor()} shadow-lg hover:shadow-xl transition-shadow overflow-hidden w-full max-w-md`}>
      <CardHeader className={`pb-3 bg-gradient-to-r ${
        saleType === 'delivery' 
          ? 'from-orange-50 to-orange-100' 
          : saleType === 'counter'
          ? 'from-blue-50 to-blue-100'
          : 'from-muted/30 to-muted/50'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl font-bold text-foreground">
            {saleType === 'delivery' ? (
              <>🚴 Delivery</>
            ) : saleType === 'counter' ? (
              <>🛒 Mostrador</>
            ) : (
              <>🍽️ Mesa {tableNumber}</>
            )}
          </CardTitle>
          <Badge 
            variant={urgencyLevel === "urgent" ? "destructive" : urgencyLevel === "warning" ? "default" : "secondary"}
            className="text-sm px-3 py-1 whitespace-nowrap"
          >
            <Clock className="h-4 w-4 mr-1" />
            {elapsedTime}
          </Badge>
        </div>
        
        {/* Información de delivery */}
        {saleType === 'delivery' && (
          <div className="space-y-1 pt-2 border-t border-orange-200">
            {customerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-orange-900">{customerName}</span>
              </div>
            )}
            {customerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-orange-600" />
                <span className="text-orange-800">{customerPhone}</span>
              </div>
            )}
            {deliveryAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <span className="text-orange-800">{deliveryAddress}</span>
              </div>
            )}
            {deliveryNotes && (
              <div className="text-xs text-orange-700 italic pt-1 border-t border-orange-200">
                📝 {deliveryNotes}
              </div>
            )}
          </div>
        )}
        
        {waiterName && saleType !== 'delivery' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{waiterName}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4 px-4 pb-4">
        {/* Lista de productos */}
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border hover:border-border/80 transition-colors"
            >
              <Badge 
                variant="outline" 
                className="text-lg font-bold px-3 py-1 bg-blue-50 border-blue-300 text-blue-700 flex-shrink-0"
              >
                {item.quantity}x
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="text-lg font-semibold text-foreground block" translate="no">
                  {item.product.name}
                </span>
                {/* ✅ Mostrar personalización si existe */}
                {item.customization && (
                  <span className="text-sm text-orange-600 font-medium italic block mt-1 bg-orange-50 px-2 py-1 rounded border border-orange-200" translate="no">
                    📝 {item.customization}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {onMarkReady && (
            <Button
              onClick={() => onMarkReady(saleId)}
              className="h-12 text-base font-semibold bg-green-600 hover:bg-green-700 w-full"
              size="lg"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Marcar Listo
            </Button>
          )}
          
          {onReprint && (
            <Button
              onClick={() => onReprint(saleId)}
              variant="outline"
              className="h-12 w-12 flex-shrink-0"
              size="icon"
            >
              <Printer className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


