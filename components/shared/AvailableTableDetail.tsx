"use client";

import { useState, type ReactNode } from "react";
import { Bike, CheckCircle2, Loader2, Martini, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotificationStore } from "@/store/notificationStore";

interface AvailableTableDetailProps {
  tableNumber: number;
  onClose: () => void;
  onOpenForSale: () => void;
}

interface TableInfo {
  icon: ReactNode;
  label: string;
  subtitle: string;
  accent: string;
  glow: string;
  borderColor: string;
  iconBig: ReactNode;
}

export function AvailableTableDetail({
  tableNumber,
  onClose,
  onOpenForSale,
}: AvailableTableDetailProps) {
  const [isOpening, setIsOpening] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const getTableInfo = (): TableInfo => {
    if (tableNumber >= 31 && tableNumber <= 32) {
      return {
        icon: <Bike className="h-6 w-6 text-sky-300" />,
        label: `Delivery ${tableNumber}`,
        subtitle: "Pedido a domicilio",
        accent: "from-sky-300 via-cyan-300 to-blue-500",
        glow: "from-sky-500/18 via-cyan-400/10 to-transparent",
        borderColor: "border-sky-300/20",
        iconBig: <Bike className="h-20 w-20 text-sky-400/60" strokeWidth={1} />,
      };
    }

    if (tableNumber >= 33 && tableNumber <= 37) {
      return {
        icon: <ShoppingBag className="h-6 w-6 text-orange-300" />,
        label: `Para llevar ${tableNumber}`,
        subtitle: "Take away / Mostrador",
        accent: "from-orange-300 via-amber-300 to-orange-500",
        glow: "from-orange-500/18 via-amber-400/12 to-transparent",
        borderColor: "border-orange-300/20",
        iconBig: <ShoppingBag className="h-20 w-20 text-orange-400/60" strokeWidth={1} />,
      };
    }

    if (tableNumber >= 38 && tableNumber <= 41) {
      return {
        icon: <Martini className="h-6 w-6 text-fuchsia-300" />,
        label: `Barra ${tableNumber}`,
        subtitle: "Zona de barra",
        accent: "from-fuchsia-300 via-pink-300 to-fuchsia-500",
        glow: "from-fuchsia-500/18 via-pink-400/10 to-transparent",
        borderColor: "border-fuchsia-300/20",
        iconBig: <Martini className="h-20 w-20 text-fuchsia-400/60" strokeWidth={1} />,
      };
    }

    return {
      icon: <UtensilsCrossed className="h-6 w-6 text-emerald-500" />,
      label: `Mesa ${tableNumber}`,
      subtitle: "Salon principal",
      accent: "from-emerald-300 via-teal-300 to-emerald-500",
      glow: "from-emerald-500/18 via-teal-400/10 to-transparent",
      borderColor: "border-emerald-300/20",
      iconBig: <UtensilsCrossed className="h-20 w-20 text-emerald-400/60" strokeWidth={1} />,
    };
  };

  const tableInfo = getTableInfo();

  const handleOpenTable = () => {
    setIsOpening(true);

    setTimeout(() => {
      addNotification("success", `Mesa ${tableNumber} lista para tomar pedido`);
      onOpenForSale();
    }, 300);
  };

  return (
    <Card
      className={`sticky top-6 overflow-hidden border border-border bg-card shadow-[0_24px_70px_rgba(0,0,0,0.08)] ${tableInfo.borderColor}`}
    >
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tableInfo.accent}`} />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tableInfo.glow} opacity-70`} />

      <CardHeader className="relative border-b border-border bg-transparent pb-5 pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-2xl border border-border bg-gradient-to-br p-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.10)] ${tableInfo.accent}`}
            >
              {tableInfo.icon}
            </div>

            <div>
              <CardTitle className="font-brand text-3xl tracking-[0.08em] text-foreground">
                {tableInfo.label}
              </CardTitle>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {tableInfo.subtitle}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6 pt-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-border bg-muted/30 p-8 shadow-[inset_0_1px_0_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-border hover:bg-muted/50">
          {tableInfo.iconBig}

          <Badge
            variant="outline"
            className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-700 shadow-sm"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
            Disponible
          </Badge>
        </div>

        <div className="space-y-2 px-4 text-center">
          <h3 className="font-brand text-2xl tracking-[0.07em] text-foreground">
            Comenzar nuevo pedido
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            La mesa esta libre. Abrila para empezar a cargar productos con el flujo rapido del salon.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className={`h-14 w-full rounded-2xl border-0 bg-gradient-to-r text-base font-semibold text-[#250513] shadow-[0_18px_40px_rgba(168, 52, 28,0.24)] transition-all hover:scale-[1.01] hover:shadow-[0_20px_48px_rgba(168, 52, 28,0.34)] active:scale-[0.99] ${tableInfo.accent}`}
            onClick={handleOpenTable}
            disabled={isOpening}
          >
            {isOpening ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Abriendo mesa...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Abrir Mesa
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            className="h-11 w-full rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
