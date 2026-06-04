"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CashRegisterView = dynamic(
  () => import("./CashRegisterView").then((mod) => ({ default: mod.CashRegisterView })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] bg-muted/30 rounded-lg">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-foreground mx-auto" />
          <p className="text-muted-foreground">Cargando caja registradora...</p>
        </div>
      </div>
    )
  }
);

interface CashRegisterViewWrapperProps {
  cashRegister: any;
  initialSession: any;
  type: "bar";
}

export function CashRegisterViewWrapper({ 
  cashRegister, 
  initialSession, 
  type 
}: CashRegisterViewWrapperProps) {
  // Estado para asegurar que el componente esté montado en el cliente
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Asegurar que estamos en el cliente y que tenemos los datos
    if (typeof window !== 'undefined') {
      setIsReady(true);
    }
  }, []);

  // Validación 1: Aún no montado en el cliente
  if (!isReady) {
    return (
      <Card className="p-8">
        <CardContent className="text-center space-y-4 pt-6">
          <div className="flex justify-center">
            <RefreshCw className="h-12 w-12 animate-spin text-foreground" />
          </div>
          <p className="text-muted-foreground">Inicializando caja...</p>
        </CardContent>
      </Card>
    );
  }

  // Validación 2: No hay datos de cashRegister
  if (!cashRegister || !cashRegister.id || !cashRegister.name) {
    return (
      <Card className="p-8">
        <CardContent className="text-center space-y-4 pt-6">
          <div className="flex justify-center">
            <RefreshCw className="h-12 w-12 animate-spin text-foreground" />
          </div>
          <p className="text-muted-foreground">Cargando información de la caja...</p>
        </CardContent>
      </Card>
    );
  }

  // Validación 3: Todo listo, renderizar componente
  return (
    <CashRegisterView
      cashRegister={cashRegister}
      initialSession={initialSession}
      type={type}
    />
  );
}
