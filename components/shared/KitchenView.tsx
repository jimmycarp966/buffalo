"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { KitchenOrderCard } from "./KitchenOrderCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Trash2, Wifi, WifiOff } from "lucide-react";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { useNotificationStore } from "@/store/notificationStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Sale {
  id: string;
  table_number?: number | null;
  sale_type?: "table" | "counter" | "delivery";
  status?: "pending" | "completed";
  kitchen_ready?: boolean;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  created_at: string;
  user?: {
    name: string;
  };
  sale_items: Array<{
    id: string;
    quantity: number;
    customization?: string;
    product: {
      name: string;
    };
  }>;
}

export function KitchenView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioContextReady, setAudioContextReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const previousCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const retryCountRef = useRef(0);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Cargar pedidos con productos de cocina (en cualquier estado) con items y personalizaciones
  // CRÍTICO: Filtro de fecha para reducir egress y evitar throttling de Supabase
  const loadPendingSales = async (retryAttempt = 0): Promise<void> => {
    const startTime = performance.now();
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Filtro de fecha: solo últimas 24 horas para reducir egress drásticamente
      // Esto evita traer miles de ventas históricas y reduce el consumo de 7GB+ a menos de 1GB
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

      console.log("🔍 COCINA - Iniciando consulta con filtro de fecha (últimas 24h):", {
        fechaDesde: twentyFourHoursAgoISO,
        retryAttempt,
        timestamp: new Date().toISOString()
      });

      // Obtener ventas con productos de cocina (table, delivery, counter en cualquier estado)
      // CRÍTICO: Agregar filtro de fecha para reducir egress
      const { data: pendingData, error: pendingError } = await supabase
        .from("sales")
        .select(`
          id,
          table_number,
          sale_type,
          status,
          kitchen_ready,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_notes,
          created_at,
          user:users!sales_user_id_fkey(name),
          sale_items(
            id,
            quantity,
            customization,
            product:products(
              name,
              cocina_only
            )
          )
        `)
        .in("sale_type", ["table", "delivery", "counter"])
        .gte("created_at", twentyFourHoursAgoISO); // ✅ FILTRO DE FECHA CRÍTICO

      const queryTime = performance.now() - startTime;
      console.log(`🔍 COCINA - Consulta completada en ${queryTime.toFixed(2)}ms`);

      if (pendingError) {
        console.error("❌ COCINA - Error en consulta:", {
          error: pendingError,
          message: pendingError.message,
          code: pendingError.code,
          retryAttempt,
          timestamp: new Date().toISOString()
        });
        throw pendingError;
      }

      setConnectionError(false);
      retryCountRef.current = 0;

      // Filtrar solo las que tienen productos de cocina (cocina_only)
      // Y que NO estén marcadas como listas (kitchen_ready)
      const filteredData = (pendingData || []).filter(sale => {
        // Verificar si tiene productos de cocina
        const hasKitchenProducts = sale.sale_items?.some((item: any) =>
          item.product?.cocina_only === true
        ) || false;

        // Logging detallado solo en desarrollo (comentado para producción)
        // if (!hasKitchenProducts && sale.sale_items && sale.sale_items.length > 0) {
        //   console.log("🔍 FILTRO - Venta sin productos de cocina:", {
        //     id: sale.id,
        //     sale_type: sale.sale_type,
        //     table_number: sale.table_number,
        //     items_count: sale.sale_items.length
        //   });
        // }

        // Retry logic: si una venta no tiene sale_items pero fue creada recientemente (últimos 2 minutos),
        // podría ser una race condition. Reintentaremos en el siguiente poll.
        const saleCreatedAt = new Date(sale.created_at);
        const twoMinutesAgo = new Date();
        twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
        const isRecentSale = saleCreatedAt > twoMinutesAgo;

        if (!sale.sale_items || sale.sale_items.length === 0) {
          if (isRecentSale) {
            console.warn("⚠️ COCINA - Venta reciente sin sale_items (posible race condition):", {
              id: sale.id,
              sale_type: sale.sale_type,
              created_at: sale.created_at,
              age_minutes: Math.round((Date.now() - saleCreatedAt.getTime()) / 60000)
            });
            // No incluir por ahora, pero el siguiente poll debería tener los items
          }
          return false;
        }

        // Solo incluir si tiene productos de cocina
        if (!hasKitchenProducts) {
          return false;
        }

        // Excluir TODOS los pedidos que ya estén marcados como listos
        if (sale.kitchen_ready === true) {
          // Log comentado para reducir ruido en consola
          // console.log("🔍 FILTRO - Excluyendo pedido listo:", { id: sale.id, sale_type: sale.sale_type });
          return false;
        }

        return true;
      });

      const filterTime = performance.now() - startTime;
      console.log("🔍 COCINA - Filtrado completado:", {
        total_ventas: pendingData?.length || 0,
        ventas_filtradas: filteredData.length,
        tiempo_total_ms: filterTime.toFixed(2),
        ventas_en_vista: filteredData.map(s => ({
          id: s.id,
          type: s.sale_type,
          table: s.table_number,
          ready: s.kitchen_ready,
          items_count: s.sale_items?.length || 0
        }))
      });

      // Usar solo los datos filtrados
      const allData = filteredData
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (allData.length > 0) {
        // Filtrar los items de cada venta para mostrar solo los de cocina
        const salesWithKitchenItemsOnly = allData.map(sale => ({
          ...sale,
          sale_items: sale.sale_items.filter((item: any) => item.product?.cocina_only === true)
        }));

        setSales(salesWithKitchenItemsOnly as any);

        // Reproducir sonido si hay nuevos pedidos
        if (soundEnabled && allData.length > previousCountRef.current) {
          playNotificationSound();
        }

        previousCountRef.current = allData.length;
      } else {
        setSales([]);
        previousCountRef.current = 0;
      }
    } catch (error: any) {
      const errorTime = performance.now() - startTime;
      console.error("❌ COCINA - Error loading pending sales:", {
        error,
        message: error?.message,
        code: error?.code,
        retryAttempt,
        tiempo_ms: errorTime.toFixed(2),
        timestamp: new Date().toISOString()
      });

      setConnectionError(true);

      // Retry logic con exponential backoff
      if (retryAttempt < 3) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryAttempt), 10000); // Max 10 segundos
        console.log(`🔄 COCINA - Reintentando en ${backoffDelay}ms (intento ${retryAttempt + 1}/3)`);

        setTimeout(() => {
          loadPendingSales(retryAttempt + 1);
        }, backoffDelay);
      } else {
        console.error("❌ COCINA - Máximo de reintentos alcanzado, mostrando error al usuario");
        addNotification("error", "Error de conexión con la base de datos. Verifica tu conexión.");
        // No limpiar el estado si hay un error temporal - mantener los datos anteriores
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadPendingSales();
  }, []);

  // Handler para actualizaciones de Realtime
  const handleRealtimeUpdate = useCallback((payload: any) => {
    console.log("🔔 REALTIME - Actualización recibida en cocina:", {
      eventType: payload.eventType,
      table: payload.table,
      new: payload.new?.id,
      old: payload.old?.id,
      timestamp: new Date().toISOString()
    });
    // Recargar pedidos cuando hay cambios
    loadPendingSales();
  }, []);

  // 🚀 SUPABASE REALTIME - Actualizaciones instantáneas
  // Hook unificado con throttling y visibilidad de pestaña
  const { isConnected: realtimeIsConnected, lastEventAt } = useRealtimeData(
    'sales',
    sales,
    undefined, // Sin filtro específico, cocina ve todo
    1000 // throttle 1 segundo
  );

  // Actualizar estado de conexión y recargar datos cuando se conecta
  useEffect(() => {
    setRealtimeConnected(realtimeIsConnected);
    if (realtimeIsConnected) {
      console.log("✅ REALTIME - Conectado a actualizaciones en tiempo real");
      // Recargar datos cuando se reconecta
      loadPendingSales();
    }
  }, [realtimeIsConnected]);

  useEffect(() => {
    if (!lastEventAt) return;
    void loadPendingSales();
  }, [lastEventAt, loadPendingSales]);

  // Inicializar AudioContext (debe hacerse con interacción del usuario)
  const initAudioContext = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resumir el contexto si está suspendido
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setAudioContextReady(true);
      console.log("✅ AudioContext activado:", audioContextRef.current.state);
    } catch (error) {
      console.error("❌ Error al inicializar AudioContext:", error);
    }
  };

  // Reproducir sonido de notificación (más fuerte tipo alarma)
  const playNotificationSound = async () => {
    try {
      // Inicializar AudioContext si no está listo
      if (!audioContextRef.current || audioContextRef.current.state === 'suspended') {
        await initAudioContext();
      }

      const audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state !== 'running') {
        console.warn("⚠️ AudioContext no está listo, estado:", audioContext?.state);
        return;
      }

      // Crear tres beeps consecutivos más fuertes
      const times = [0, 0.15, 0.3];

      times.forEach((time) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Configuración para sonido más fuerte y audible
        oscillator.frequency.value = 1200; // Frecuencia más alta (más aguda)
        oscillator.type = 'square'; // Onda cuadrada (más fuerte que 'sine')

        // Volumen más alto
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + time);
        gainNode.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + time + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.1);

        oscillator.start(audioContext.currentTime + time);
        oscillator.stop(audioContext.currentTime + time + 0.12);
      });

      console.log("🔊 Sonido reproducido exitosamente");
    } catch (error) {
      console.error("❌ Error al reproducir sonido:", error);
    }
  };

  // Manejar pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error al entrar en pantalla completa:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Manejar marcar como listo - Solo desaparece de la vista de cocina
  const handleMarkReady = async (saleId: string) => {
    try {
      const { markKitchenReady } = await import("@/actions/saleActions");
      const result = await markKitchenReady({ saleId });

      if (result.success) {
        // Remover inmediatamente de la vista (optimista)
        setSales((prev) => {
          const nextSales = prev.filter((sale) => sale.id !== saleId);
          previousCountRef.current = nextSales.length;
          return nextSales;
        });
        addNotification("success", "Pedido marcado como listo");

        // Recargar después de un momento para asegurar sincronización
        setTimeout(async () => {
          await loadPendingSales();
        }, 500);
      } else {
        addNotification("error", result.message || "Error al marcar pedido como listo");
      }
    } catch (error: any) {
      console.error("Error al marcar pedido como listo:", error);
      addNotification("error", "Error al marcar pedido como listo");
    }
  };

  // Limpiar todos los pedidos (marcar todos como listos)
  const handleClearAll = async () => {
    try {
      const { markAllKitchenReady } = await import("@/actions/saleActions");
      const result = await markAllKitchenReady();

      if (result.success) {
        // Limpiar la vista inmediatamente
        setSales([]);
        previousCountRef.current = 0;
        addNotification("success", result.message || "Todos los pedidos fueron marcados como listos");

        // Recargar después de un momento
        setTimeout(async () => {
          await loadPendingSales(0);
        }, 500);
      } else {
        addNotification("error", result.message || "Error al limpiar pedidos");
      }
    } catch (error: any) {
      console.error("Error al limpiar pedidos:", error);
      addNotification("error", "Error al limpiar pedidos");
    }
  };

  // Reimprimir ticket
  const handleReprint = async (saleId: string) => {
    try {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) {
        addNotification("error", "No se encontró la venta para reimprimir");
        return;
      }

      const [{ generateKitchenTicket }, { printToLocal }] = await Promise.all([
        import("@/lib/kitchenPrinter"),
        import("@/lib/localPrinter"),
      ]);

      const ticketContent = generateKitchenTicket({
        tableNumber: sale.table_number ?? null,
        items: sale.sale_items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          customization: item.customization,
        })),
        waiterName: sale.user?.name,
        timestamp: sale.created_at,
        saleType: sale.sale_type || "table",
        customerName: sale.customer_name || undefined,
        deliveryAddress: sale.delivery_address || undefined,
      });

      const printerSettings = await fetch("/api/settings/printers")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const width = printerSettings?.data?.config?.kitchen?.width ?? 48;
      const printerName =
        printerSettings?.data?.kitchenPrinterString ??
        printerSettings?.data?.config?.kitchen?.ip ??
        undefined;

      const result = await printToLocal(ticketContent, printerName, "kitchen", width);

      if (result.success) {
        addNotification("success", "Ticket reimpreso vía servidor local");
        return;
      }

      console.error("❌ Error de impresión local:", result.message);
      addNotification("error", result.message || "No se pudo imprimir el ticket en cocina");
    } catch (error) {
      console.error("Error al reimprimir:", error);
      addNotification("error", "Error al reimprimir ticket");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 to-muted/50 p-4">
      {/* Header */}
      <div className="mb-6">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-bold text-foreground">
                🔥 Cocina - Pedidos Activos
              </h1>
              <Badge
                variant={sales.length > 0 ? "destructive" : "secondary"}
                className="text-2xl px-4 py-2"
              >
                {sales.length} {sales.length === 1 ? "Pedido" : "Pedidos"}
              </Badge>
              {connectionError && (
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  ⚠️ Error de conexión
                </Badge>
              )}
              {/* Indicador de Realtime */}
              <Badge
                variant={realtimeConnected ? "default" : "secondary"}
                className={`text-sm px-3 py-1 ${realtimeConnected ? 'bg-green-600' : 'bg-muted-foreground'}`}
              >
                {realtimeConnected ? (
                  <><Wifi className="h-4 w-4 mr-1 inline" /> Realtime</>
                ) : (
                  <><WifiOff className="h-4 w-4 mr-1 inline" /> Conectando...</>
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Botón para limpiar todos los pedidos */}
              {sales.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="lg"
                      title="Limpiar todos los pedidos (marcar como listos)"
                    >
                      <Trash2 className="h-5 w-5 mr-2" />
                      Limpiar Todo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Limpiar todos los pedidos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se marcarán todos los {sales.length} pedido(s) actuales como listos y desaparecerán de la vista de cocina.
                        <br />
                        <br />
                        <strong>Esta acción no se puede deshacer.</strong> Solo afecta la visualización en cocina, no cambia el estado de las ventas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">
                        Sí, limpiar todo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Botón de refresh manual */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => loadPendingSales(0)}
                disabled={isLoading}
                title="Actualizar manualmente"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Toggle sonido */}
              <Button
                variant={audioContextReady ? "outline" : "default"}
                size="lg"
                onClick={async () => {
                  if (!audioContextReady) {
                    await initAudioContext();
                    addNotification("success", "🔊 Sonido activado correctamente");
                  }
                  setSoundEnabled(!soundEnabled);
                }}
                title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
                className={!audioContextReady ? "animate-pulse bg-orange-500 hover:bg-orange-600" : ""}
              >
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                {!audioContextReady && <span className="ml-2 text-xs">¡Click para activar!</span>}
              </Button>

              {/* Pantalla completa */}
              <Button
                variant="outline"
                size="lg"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>

              {/* Refrescar */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.location.reload()}
                title="Refrescar"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Lista de pedidos */}
      {sales.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="text-8xl">✨</div>
            <h2 className="text-3xl font-bold text-muted-foreground">
              No hay pedidos pendientes
            </h2>
            <p className="text-xl text-muted-foreground">
              Los nuevos pedidos aparecerán aquí automáticamente
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" translate="no">
          {sales.map((sale) => (
            <KitchenOrderCard
              key={sale.id}
              saleId={sale.id}
              tableNumber={sale.table_number}
              saleType={sale.sale_type}
              status={sale.status}
              customerName={sale.customer_name}
              customerPhone={sale.customer_phone}
              deliveryAddress={sale.delivery_address}
              deliveryNotes={sale.delivery_notes}
              items={sale.sale_items}
              waiterName={sale.user?.name}
              createdAt={sale.created_at}
              onMarkReady={handleMarkReady}
              onReprint={handleReprint}
            />
          ))}
        </div>
      )}
    </div>
  );
}


