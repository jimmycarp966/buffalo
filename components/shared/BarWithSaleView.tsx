"use client";

import { useState, useEffect, useMemo } from "react";
import { useTablesStore } from "@/store/tablesStore";
import { BarCanvasView, SaleView } from "./LazyComponents";
import { useCashSession } from "@/hooks/useCashSession";
import { useNotificationStore } from "@/store/notificationStore";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { getActiveCashSession } from "@/actions/cashActions";
import type { getOpenTables } from "@/actions/barActions";
import type { getTablesByArea } from "@/actions/barLayoutActions";
import type { getProductsForSearch } from "@/actions/productActions";
import { Button } from "@/components/ui/button";

interface BarWithSaleViewProps {
  cashRegister: any;
  initialSession: any;
  initialCashSessionResult?: Awaited<ReturnType<typeof getActiveCashSession>>;
  initialOpenTablesResult?: Awaited<ReturnType<typeof getOpenTables>>;
  initialLayouts?: Record<'salon' | 'vereda', Awaited<ReturnType<typeof getTablesByArea>>["data"]>;
  initialProductSearchIndex?: Awaited<ReturnType<typeof getProductsForSearch>>["data"];
}

export function BarWithSaleView({
  cashRegister,
  initialSession,
  initialCashSessionResult,
  initialOpenTablesResult,
  initialLayouts,
  initialProductSearchIndex,
}: BarWithSaleViewProps) {
  // Hooks PRIMERO (siempre deben llamarse en el mismo orden)
  const [mounted, setMounted] = useState(false);
  const activeTableNumber = useTablesStore((state) => state.activeTableNumber);
  const isCreatingNewSale = useTablesStore((state) => state.isCreatingNewSale);
  const setActiveTable = useTablesStore((state) => state.setActiveTable);
  const setIsCreatingNewSale = useTablesStore((state) => state.setIsCreatingNewSale);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Efecto para marcar como montado
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: cashSessionResult,
    isLoading: isLoadingSession,
    refetch: refetchCashSession,
  } = useCashSession({
    cashRegisterId: cashRegister?.id,
    initialData: initialCashSessionResult,
  });

  const session = useMemo(() => {
    if (!cashSessionResult?.success) {
      return initialSession ?? null;
    }
    const sessions = cashSessionResult.data || [];
    return sessions.find((s: any) => s.area === "bar") || null;
  }, [cashSessionResult, initialSession]);

  const isSessionError = cashSessionResult ? !cashSessionResult.success : false;
  const hasActiveSession = session?.status === "open";
  const isCheckingSession = (isLoadingSession && !cashSessionResult) || !mounted;

  // Prevenir navegación accidental cuando hay una venta activa
  useEffect(() => {
    if (isCreatingNewSale) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "Hay un pedido sin guardar. ¿Estás seguro de salir?";
        return e.returnValue;
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [isCreatingNewSale]);

  // Validación defensiva: verificar que cashRegister existe (DESPUÉS de todos los hooks)
  if (!cashRegister) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
          <h3 className="text-xl font-semibold">Error de Configuración</h3>
          <p className="text-muted-foreground">
            No se pudo cargar la información de la caja registradora.
            <br />
            Por favor, recarga la página o contacta al administrador.
          </p>
        </div>
      </Card>
    );
  }

  // Manejar cierre de SaleView
  const handleBackFromSale = () => {
    // Confirmar si hay productos en el carrito (esto se manejará en SaleView)
    setActiveTable(null);
    setIsCreatingNewSale(false);
  };

  // Manejar completación de venta
  const handleSaleComplete = () => {
    setActiveTable(null);
    setIsCreatingNewSale(false);
    addNotification("success", "¡Venta registrada! La mesa aparecerá en el mapa");
    // React Query se encarga automáticamente de actualizar los datos
  };

  if (isCheckingSession) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          <div>
            <p className="font-semibold">Verificando estado de la caja…</p>
            <p className="text-sm text-muted-foreground">
              Esto puede tardar unos segundos si la conexión es lenta.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isSessionError) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold">No pudimos verificar la caja</h3>
            <p className="text-sm text-muted-foreground">
              Reintentá en unos segundos o recargá la página.
            </p>
          </div>
          <Button onClick={() => refetchCashSession()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  if (!hasActiveSession) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-yellow-600 mx-auto" />
          <h3 className="text-xl font-semibold">Caja Cerrada</h3>
          <p className="text-muted-foreground">
            Necesitás abrir la caja bar antes de poder tomar pedidos.
          </p>
          <p className="text-sm text-muted-foreground">
            Usá el botón "Abrir Caja" en la sección superior de esta página.
          </p>
        </div>
      </Card>
    );
  }

  // Si hay una venta activa, mostrar SaleView
  if (isCreatingNewSale && activeTableNumber && session) {
    return (
      <div className="space-y-4">
        <SaleView
          cashRegister={cashRegister}
          session={session}
          onBack={handleBackFromSale}
          onSaleComplete={handleSaleComplete}
          type="bar"
          preSelectedTable={activeTableNumber}
          initialProductSearchIndex={initialProductSearchIndex}
        />
      </div>
    );
  }

  // Por defecto, mostrar el mapa de mesas con la sesión activa
  return (
    <BarCanvasView
      session={session}
      initialOpenTablesResult={initialOpenTablesResult}
      initialLayouts={initialLayouts}
    />
  );
}

