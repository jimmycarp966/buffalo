"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useTablesStore } from "@/store/tablesStore";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useOpenTables } from "@/hooks/useOpenTables";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { getUserNavigationPermissions } from "@/actions/permissionActions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MemoizedTableShapeFudo as TableShapeFudo } from "./TableShapeFudo";
import { QuickSalePanel } from "./QuickSalePanel";
import { SelectedTableDetail } from "./SelectedTableDetail";
import { AvailableTableDetail } from "./AvailableTableDetail";
// import { TableConfigModal } from "./TableConfigModal"; // TODO: Crear este componente
import { getTablesByArea, updateTablePosition, addNewTable, getNextTableNumber, updateTableSize, duplicateSalonToVeredaAndNormalize } from "@/actions/barLayoutActions";
import { Edit, X, RefreshCw, Plus, UtensilsCrossed } from "lucide-react";
import { Resizable } from "re-resizable";

import type { getOpenTables } from "@/actions/barActions";

interface BarCanvasViewProps {
  session?: any; // Sesión de caja para poder abrir mesas
  initialOpenTablesResult?: Awaited<ReturnType<typeof getOpenTables>>;
  initialLayouts?: Record<'salon' | 'vereda', Awaited<ReturnType<typeof getTablesByArea>>["data"]>;
}

export function BarCanvasView({ session, initialOpenTablesResult, initialLayouts }: BarCanvasViewProps = {}) {
  const TABLE_BASE_SIZE = 56;
  const DESKTOP_CANVAS_SCALE = 0.48;
  const queryClient = useQueryClient();
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
  const [optimisticSelectedTable, setOptimisticSelectedTable] = useState<any | null>(null);
  const [isInSaleMode, setIsInSaleMode] = useState(false); // Nuevo estado para venta rápida
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayoutState] = useState<any[]>([]);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [selectedArea, setSelectedArea] = useState<'salon' | 'vereda'>('salon');
  const [hasInitializedVereda, setHasInitializedVereda] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [tableToConfig, setTableToConfig] = useState<number | null>(null);
  const [canvasScale, setCanvasScale] = useState(DESKTOP_CANVAS_SCALE); // Factor de escala para escritorio
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // Hook para obtener las mesas ocupadas
  const {
    data: pendingTablesResult,
    isLoading: isLoadingTables,
    refetch: refreshTables,
  } = useOpenTables(initialOpenTablesResult);
  const pendingTables = pendingTablesResult?.data || [];
  const { lastEventAt: lastTablesEventAt } = useRealtimeData(
    "sales",
    pendingTables,
    { column: "sale_type", value: "table" },
    1000
  );

  const setActiveTable = useTablesStore((state) => state.setActiveTable);
  const setIsCreatingNewSale = useTablesStore((state) => state.setIsCreatingNewSale);
  const isCreatingNewSale = useTablesStore((state) => state.isCreatingNewSale);
  const user = useAuthStore((state) => state.user);

  // Verificar permisos usando el sistema granular
  const hasLoadedPermissions = Object.keys(userPermissions).length > 0;
  const fallbackPermission = user?.role === 'waiter' || user?.role === 'admin';
  const canEditLayout = hasLoadedPermissions
    ? userPermissions['tables.edit'] === true
    : fallbackPermission;
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Función para manejar click en mesa
  const handleTableClick = useCallback((tableNumber: number, status: string) => {
    console.log("🖱️ [DEBUG][BarCanvasView] handleTableClick", {
      clickedTable: tableNumber,
      status,
      isEditMode,
      isCreatingNewSale,
      selectedArea,
      currentSelectedTableNumber: selectedTableNumber,
    });

    if (isEditMode) return; // No hacer nada en modo edición

    // Prevenir abrir otra mesa si ya hay una venta activa
    if (isCreatingNewSale && status === "available") {
      addNotification("error", "Ya tenés un pedido abierto. Guardalo o cancelalo antes de abrir otra mesa.");
      return;
    }

    // Para CUALQUIER mesa (libre u ocupada), mostrar el panel lateral
    setSelectedTableNumber(tableNumber);
  }, [isEditMode, isCreatingNewSale, addNotification]);

  // Configurar sensores para drag & drop más sensible
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px para activar drag
      },
    })
  );

  // Calcular escala dinámica del canvas
  useEffect(() => {
    const calculateScale = () => {
      if (canvasRef.current) {
        const availableWidth = canvasRef.current.parentElement?.getBoundingClientRect().width;
        const actualWidth = availableWidth || canvasRef.current.getBoundingClientRect().width;
        const scale = actualWidth > 0
          ? Math.min(DESKTOP_CANVAS_SCALE, actualWidth / CANVAS_WIDTH)
          : DESKTOP_CANVAS_SCALE;
        setCanvasScale(scale);
      }
    };

    // Calcular escala inicial con un pequeño delay para asegurar que el DOM esté listo
    const timeoutId = setTimeout(calculateScale, 100);

    // Observar cambios de tamaño
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(calculateScale);
      if (canvasRef.current) {
        resizeObserver.observe(canvasRef.current);
        if (canvasRef.current.parentElement) {
          resizeObserver.observe(canvasRef.current.parentElement);
        }
      }
    }

    // También escuchar eventos de resize de ventana
    window.addEventListener('resize', calculateScale);

    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', calculateScale);
    };
  }, [DESKTOP_CANVAS_SCALE]);

  const setLayoutStore = useTablesStore((state) => state.setLayout);
  const layouts = useTablesStore((state) => state.layouts);

  // DEBUG: rastrear cambios de mesa seleccionada y contexto
  useEffect(() => {
    console.log("🪑 [DEBUG][BarCanvasView] selectedTableNumber changed", {
      selectedTableNumber,
      isInSaleMode,
      isEditMode,
      isCreatingNewSale,
      selectedArea,
      pendingTablesCount: pendingTables.length,
    });
  }, [selectedTableNumber, isInSaleMode, isEditMode, isCreatingNewSale, selectedArea, pendingTables.length]);

  // Hidratar layouts iniciales provenientes del servidor
  useEffect(() => {
    if (!initialLayouts) return;
    if (initialLayouts.salon) {
      setLayoutStore("salon", initialLayouts.salon);
    }
    if (initialLayouts.vereda) {
      setLayoutStore("vereda", initialLayouts.vereda);
      if (initialLayouts.vereda.length > 0) {
        setHasInitializedVereda(true);
      }
    }
  }, [initialLayouts, setLayoutStore, setHasInitializedVereda]);

  const loadLayout = useCallback(
    async (area: "salon" | "vereda") => {
      setIsLoadingLayout(true);
      const result = await getTablesByArea(area);
      if (result.success) {
        setLayoutState(result.data);
        setLayoutStore(area, result.data);
      } else {
        addNotification("error", `Error al cargar el layout del área ${area}`);
      }
      setIsLoadingLayout(false);
    },
    [addNotification, setLayoutStore]
  );

  // Cargar layout según el área seleccionada, reutilizando el caché cuando exista
  useEffect(() => {
    const cachedLayout = layouts[selectedArea];
    if (cachedLayout && cachedLayout.length > 0) {
      setLayoutState(cachedLayout);
      setIsLoadingLayout(false);
    } else {
      loadLayout(selectedArea);
    }
  }, [selectedArea, layouts, loadLayout]);

  // Inicializar Vereda si es la primera vez que se visita
  useEffect(() => {
    if (selectedArea === 'vereda' && !hasInitializedVereda) {
      initializeVereda();
    }
  }, [selectedArea, hasInitializedVereda]);

  // Solo invalidar manualmente si estamos en modo edición y necesitamos datos frescos
  useEffect(() => {
    if (isEditMode) {
      refreshTables(); // Fallback al store si es necesario
    }
  }, [isEditMode, refreshTables]);

  useEffect(() => {
    if (!lastTablesEventAt) return;
    refreshTables();
  }, [lastTablesEventAt, refreshTables]);

  // Recargar layout al ENTRAR en modo edición para tener datos frescos
  useEffect(() => {
    if (isEditMode) {
      loadLayout(selectedArea);
      addNotification("info", "Modo edición activado. Los cambios se guardan automáticamente al mover las mesas.");
    }
  }, [isEditMode, loadLayout, addNotification, selectedArea]);

  // Cargar permisos del usuario al inicio
  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        if (user?.id) {
          console.log("🔍 BarCanvasView: Loading permissions for user", user.id);
          const { data: permissionsData } = await getUserNavigationPermissions(user.id);
          if (permissionsData) {
            setUserPermissions(permissionsData);
            console.log("✅ BarCanvasView: Permissions loaded", permissionsData['tables.edit']);
          }
        }
      } catch (error) {
        console.error("❌ BarCanvasView: Could not load permissions", error);
      }
    };

    loadUserPermissions();
  }, [user?.id]);

  const initializeVereda = async () => {
    setIsLoadingLayout(true);
    const result = await duplicateSalonToVeredaAndNormalize();
    if (result.success) {
      setHasInitializedVereda(true);
      addNotification("success", result.message || "Vereda inicializada correctamente");
      await loadLayout('vereda');
    } else {
      // Si ya tiene mesas, simplemente cargar
      if (result.message?.includes("ya tiene mesas")) {
        setHasInitializedVereda(true);
        await loadLayout('vereda');
      } else {
        addNotification("error", result.message || "Error al inicializar Vereda");
        setIsLoadingLayout(false);
      }
    }
  };

  // Dimensiones del canvas - SIN ESCALADO CSS (causa problemas de posicionamiento)
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 700;
  const MESA_SIZE = TABLE_BASE_SIZE;

  // Manejar resize de mesa
  const handleResizeStop = async (tableNumber: number, size: { width: number; height: number }) => {
    const BASE_SIZE = TABLE_BASE_SIZE;
    const widthMultiplier = size.width / BASE_SIZE;
    const heightMultiplier = size.height / BASE_SIZE;

    // Validar límites (0.5 - 4)
    const clampedWidth = Math.max(0.5, Math.min(4, Math.round(widthMultiplier * 10) / 10));
    const clampedHeight = Math.max(0.5, Math.min(4, Math.round(heightMultiplier * 10) / 10));

    // Actualizar localmente primero (optimistic update)
    setLayoutState((prev) => {
      const updated = prev.map((table) =>
        table.table_number === tableNumber
          ? { ...table, width: clampedWidth, height: clampedHeight }
          : table
      );
      setLayoutStore(selectedArea, updated);
      return updated;
    });

    // Guardar en backend
    const result = await updateTableSize(tableNumber, {
      width: clampedWidth,
      height: clampedHeight,
    });

    if (!result.success) {
      addNotification("error", result.message || "Error al cambiar tamaño de mesa");
      // Revertir cambio
      loadLayout(selectedArea);
    }
  };

  // Manejar drag & drop libre (píxeles exactos)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;

    if (!isEditMode || !delta) return;

    const tableNumber = parseInt(active.id.toString());
    const movedTable = layout.find(t => t.table_number === tableNumber);

    if (!movedTable) return;

    // El delta viene en coordenadas de pantalla, necesitamos convertirlo a coordenadas del canvas original
    // Primero calculamos la nueva posición en coordenadas escaladas
    const scaledNewX = movedTable.position_x * canvasScale + delta.x;
    const scaledNewY = movedTable.position_y * canvasScale + delta.y;

    // Luego convertimos a coordenadas originales del canvas
    let newX = scaledNewX / canvasScale;
    let newY = scaledNewY / canvasScale;

    // Límites del canvas (que no se salga)
    newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - MESA_SIZE));
    newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - MESA_SIZE));

    // Actualizar localmente primero (optimistic update)
    setLayoutState((prev) => {
      const updated = prev.map((table) =>
        table.table_number === tableNumber
          ? { ...table, position_x: newX, position_y: newY }
          : table
      );
      setLayoutStore(selectedArea, updated);
      return updated;
    });

    // Guardar en backend - mantener zona existente
    const result = await updateTablePosition(tableNumber, {
      x: newX,
      y: newY,
      zone: movedTable.zone || 'principal', // Mantener zona existente o usar 'principal' por defecto
    });

    if (!result.success) {
      addNotification("error", result.message || "Error al mover mesa");
      // Revertir cambio
      loadLayout(selectedArea);
    } else {
      addNotification("success", `Mesa ${tableNumber} movida correctamente`);
    }
  };

  // Obtener estado de la mesa
  const getTableStatus = (tableNumber: number): { status: "available" | "occupied" | "partial" | "printed"; data: any } => {
    const tableData = pendingTables.find((t: any) => t.table_number === tableNumber);
    if (!tableData) return { status: "available" as const, data: null };

    // Si la cuenta fue impresa, mostrar en azul
    if (tableData.account_printed_at) {
      return {
        status: "printed" as const,
        data: tableData,
      };
    }

    // TODO: Implementar detección de pagos parciales
    const hasPartialPayment = false;

    return {
      status: hasPartialPayment ? ("partial" as const) : ("occupied" as const),
      data: tableData,
    };
  };

  // Función para obtener siguiente número de mesa disponible
  const getNextTableNumberLocal = useCallback(async () => {
    const result = await getNextTableNumber();
    if (result.success) {
      return result.data;
    }
    // Fallback: calcular desde layout local
    if (layout.length === 0) return 1;
    const maxTableNumber = Math.max(...layout.map((t: any) => t.table_number));
    return maxTableNumber + 1;
  }, [layout]);

  // Función para agregar nueva mesa
  const handleAddNewTable = useCallback(async () => {
    try {
      const nextTableNumber = await getNextTableNumberLocal();
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      const result = await addNewTable({
        table_number: nextTableNumber,
        zone: 'principal', // Valor por defecto
        position_x: centerX,
        position_y: centerY,
        width: 1,
        height: 1,
        shape: 'square',
        size_variant: 'normal',
        area: selectedArea, // Usar área seleccionada
        order_index: nextTableNumber,
      });

      if (result.success) {
        addNotification("success", `Mesa ${nextTableNumber} agregada exitosamente`);
        await loadLayout(selectedArea);
      } else {
        addNotification("error", result.message || "Error al agregar mesa");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al agregar mesa");
      console.error("Error adding table:", error);
    }
  }, [getNextTableNumberLocal, selectedArea, addNotification, loadLayout]);

  const querySelectedTable =
    selectedTableNumber === null
      ? null
      : pendingTables.find(
        (t: any) => Number(t.table_number) === Number(selectedTableNumber)
      );
  const selectedTable = querySelectedTable ?? optimisticSelectedTable;

  useEffect(() => {
    if (!optimisticSelectedTable) return;
    const exists = pendingTables.some(
      (table: any) =>
        table.id === optimisticSelectedTable.id ||
        Number(table.table_number) === Number(optimisticSelectedTable.table_number)
    );
    if (exists) {
      setOptimisticSelectedTable(null);
    }
  }, [optimisticSelectedTable, pendingTables]);

  const occupiedCount = pendingTables.length;
  const totalCount = layout.filter((t: any) => t.is_active !== false).length;
  const availableCount = totalCount - occupiedCount;

  const handleTableRightClick = useCallback((e: React.MouseEvent, tableNumber: number) => {
    if (isEditMode && canEditLayout) {
      e.preventDefault();
      setTableToConfig(tableNumber);
      setConfigModalOpen(true);
    }
  }, [isEditMode, canEditLayout]);

  // Centrar y ajustar todas las mesas para que queden dentro del canvas visible
  const centerAllTables = useCallback(async () => {
    if (!isEditMode) {
      addNotification("warning", "Debes estar en modo edición para centrar las mesas");
      return;
    }

    try {
      const PADDING = 10; // Espacio de seguridad desde los bordes
      const GRID_SIZE = MESA_SIZE + 10; // Espacio entre mesas

      // Obtener todas las mesas normales
      const normalTables = layout.filter(t =>
        t.is_active !== false &&
        (t.table_number <= 30 || (t.table_number >= 38 && t.table_number <= 41)) // Mesas normales + barra
      );

      console.log("🎯 [DEBUG] Centrando mesas:", {
        total: normalTables.length
      });

      const availableWidth = CANVAS_WIDTH - PADDING * 2;
      const perRow = Math.max(1, Math.floor(availableWidth / GRID_SIZE));

      const updates: Promise<any>[] = [];

      // Organizar todas las mesas en grid
      normalTables.forEach((table, index) => {
        const row = Math.floor(index / perRow);
        const col = index % perRow;

        const newX = PADDING + col * GRID_SIZE;
        const newY = PADDING + row * GRID_SIZE;

        // Asegurarse de que no se salga del canvas
        const clampedX = Math.max(PADDING, Math.min(newX, CANVAS_WIDTH - MESA_SIZE - PADDING));
        const clampedY = Math.max(PADDING, Math.min(newY, CANVAS_HEIGHT - MESA_SIZE - PADDING));

        updates.push(
          updateTablePosition(table.table_number, {
            x: clampedX,
            y: clampedY,
            zone: table.zone || 'principal', // Mantener zona existente
          })
        );
      });

      // Ejecutar todas las actualizaciones
      await Promise.all(updates);
      await loadLayout(selectedArea);

      addNotification("success", `¡${normalTables.length} mesas centradas correctamente!`);
    } catch (error) {
      console.error("❌ [ERROR] Error al centrar mesas:", error);
      addNotification("error", "Error al centrar las mesas. Intenta de nuevo.");
    }
  }, [isEditMode, addNotification, layout, loadLayout, selectedArea]);

  if (isLoadingLayout) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-secondary mx-auto" />
          <p className="text-muted-foreground">Cargando mapa del bar...</p>
        </div>
      </div>
    );
  }

  if (layout.length === 0) {
    return (
      <Card className="border border-border bg-card p-10 text-foreground shadow-xl">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-secondary/25 bg-secondary/10 text-secondary">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-brand text-3xl text-foreground">Todavia no hay mesas configuradas</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              El layout del bar esta vacio. Reintenta la carga o agrega la primera mesa para empezar a operar.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => loadLayout(selectedArea)}
              className="border-border bg-muted/50 text-foreground hover:bg-muted"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
            {canEditLayout && (
              <Button onClick={handleAddNewTable}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera mesa
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Barra superior ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={selectedArea} onValueChange={(value) => setSelectedArea(value as 'salon' | 'vereda')}>
          <TabsList className="rounded-2xl border border-border bg-muted/50 p-1 backdrop-blur-md">
            <TabsTrigger value="salon" className="rounded-xl px-4 text-sm text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-[0_10px_28px_rgba(181, 116, 58,0.32)]">
              Salón
            </TabsTrigger>
            <TabsTrigger value="vereda" className="rounded-xl px-4 text-sm text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-[0_10px_28px_rgba(181, 116, 58,0.32)]">
              Vereda
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Contador + botones */}
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {availableCount} libres · {occupiedCount} ocupadas
          </span>
          {canEditLayout && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  addNotification("info", "Actualizando mesas...");
                  await queryClient.invalidateQueries({ queryKey: ['openTables'] });
                  addNotification("success", "Mesas actualizadas");
                }}
                className="gap-1.5 rounded-xl"
                title="Actualizar mesas"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
              <Button
                variant={isEditMode ? "destructive" : "default"}
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "gap-1.5 rounded-xl shadow-md",
                  !isEditMode && "bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#240413] hover:opacity-95"
                )}
              >
                {isEditMode ? (
                  <><X className="h-4 w-4" /><span className="hidden sm:inline">Salir</span></>
                ) : (
                  <><Edit className="h-4 w-4" /><span className="hidden sm:inline">Editar Layout</span></>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          VISTA MÓVIL: grilla de tarjetas de mesas
          (oculta en lg+, donde se usa el canvas)
      ══════════════════════════════════════════ */}
      <div className="block lg:hidden">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {layout
            .filter((t) => t.is_active !== false)
            .sort((a, b) => a.table_number - b.table_number)
            .map((tableLayout) => {
              const { status, data } = getTableStatus(tableLayout.table_number);
              const isSelected = selectedTableNumber === tableLayout.table_number;
              const isOccupied = status === "occupied" || status === "partial" || status === "printed";

              const statusColor = {
                available: "border-green-400/60 bg-green-50",
                occupied: "border-primary/60 bg-primary/5",
                partial: "border-yellow-400/60 bg-yellow-50",
                printed: "border-blue-400/60 bg-blue-50",
              }[status];

              const dotColor = {
                available: "bg-green-500",
                occupied: "bg-primary",
                partial: "bg-yellow-500",
                printed: "bg-blue-500",
              }[status];

              return (
                <button
                  key={tableLayout.table_number}
                  onClick={() => handleTableClick(tableLayout.table_number, status)}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-2xl border-2 p-2 pt-3 pb-2 transition-all active:scale-95",
                    statusColor,
                    isSelected && "ring-2 ring-primary ring-offset-1 scale-[0.97]"
                  )}
                >
                  {/* Dot de estado */}
                  <div className={cn("absolute top-1.5 right-1.5 h-2 w-2 rounded-full", dotColor)} />

                  {/* Número de mesa */}
                  <span className={cn(
                    "text-xl font-bold leading-none",
                    isOccupied ? "text-foreground" : "text-green-700"
                  )}>
                    {tableLayout.custom_name || tableLayout.table_number}
                  </span>

                  {/* Total si está ocupada */}
                  {isOccupied && data?.total_amount != null && (
                    <span className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      ${Math.round(data.total_amount).toLocaleString("es-AR")}
                    </span>
                  )}

                  {/* Label de libre */}
                  {!isOccupied && (
                    <span className="mt-0.5 text-[10px] text-green-600">libre</span>
                  )}
                </button>
              );
            })}
        </div>

        {/* Bottom sheet móvil para el detalle de mesa */}
        {selectedTableNumber !== null && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
              onClick={() => {
                setSelectedTableNumber(null);
                setOptimisticSelectedTable(null);
              }}
            />
            {/* Sheet */}
            <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-background shadow-[0_-8px_40px_rgba(0,0,0,0.14)]">
              {/* Handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {isInSaleMode && session ? (
                  <QuickSalePanel
                    tableNumber={selectedTableNumber}
                    session={session}
                    onClose={() => {
                      setIsInSaleMode(false);
                      setSelectedTableNumber(null);
                      setOptimisticSelectedTable(null);
                    }}
                    onComplete={(tableNumber, optimisticTableData) => {
                      setIsInSaleMode(false);
                      setSelectedTableNumber(tableNumber);
                      setActiveTable(tableNumber);
                      if (optimisticTableData) setOptimisticSelectedTable(optimisticTableData);
                    }}
                  />
                ) : selectedTable ? (
                  <SelectedTableDetail
                    table={selectedTable}
                    onClose={() => {
                      setSelectedTableNumber(null);
                      setOptimisticSelectedTable(null);
                    }}
                    onUpdate={refreshTables}
                  />
                ) : (
                  <AvailableTableDetail
                    tableNumber={selectedTableNumber}
                    onClose={() => {
                      setSelectedTableNumber(null);
                      setOptimisticSelectedTable(null);
                    }}
                    onOpenForSale={() => setIsInSaleMode(true)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          VISTA DESKTOP: canvas + panel lateral
          (oculta en móvil, visible en lg+)
      ══════════════════════════════════════════ */}

      {/* Grid Principal: Canvas + Panel Lateral (solo desktop) */}
      <div className="hidden lg:grid lg:grid-cols-10 gap-6">
        {/* CANVAS DEL BAR (70%) */}
        <div className="lg:col-span-7">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Card className="brand-panel overflow-hidden p-0 shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                <div>
                  <p className="font-brand text-xl tracking-[0.08em] text-foreground">Mapa de mesas</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {selectedArea === "salon" ? "Operacion interior" : "Operacion exterior"}
                  </p>
                </div>
                <div className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                  {availableCount} libres / {occupiedCount} ocupadas
                </div>
              </div>
              {!isEditMode ? (
                <div className="grid grid-cols-7 gap-1 p-2">
                  {layout
                    .filter((t) => t.is_active !== false)
                    .sort((a, b) => a.table_number - b.table_number)
                    .map((tableLayout) => {
                      const { status, data } = getTableStatus(tableLayout.table_number);
                      const isSelected = selectedTableNumber === tableLayout.table_number;
                      const isOccupied = status === "occupied" || status === "partial" || status === "printed";

                      const statusColor = {
                        available: "border-green-400/60 bg-green-50",
                        occupied: "border-primary/60 bg-primary/5",
                        partial: "border-yellow-400/60 bg-yellow-50",
                        printed: "border-blue-400/60 bg-blue-50",
                      }[status];

                      const dotColor = {
                        available: "bg-green-500",
                        occupied: "bg-primary",
                        partial: "bg-yellow-500",
                        printed: "bg-blue-500",
                      }[status];

                      return (
                        <button
                          key={tableLayout.table_number}
                          onClick={() => handleTableClick(tableLayout.table_number, status)}
                          className={cn(
                            "relative flex h-10 flex-col items-center justify-center rounded-lg border-2 px-1 py-1 transition-all hover:scale-[0.98] active:scale-95",
                            statusColor,
                            isSelected && "ring-2 ring-primary ring-offset-1 scale-[0.97]"
                          )}
                          data-table-number={tableLayout.table_number}
                          type="button"
                        >
                          <div className={cn("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", dotColor)} />
                          <span className={cn(
                            "text-base font-bold leading-none",
                            isOccupied ? "text-foreground" : "text-green-700"
                          )}>
                            {tableLayout.custom_name || tableLayout.table_number}
                          </span>
                          {isOccupied && data?.total_amount != null ? (
                            <span className="mt-0.5 max-w-full truncate text-[9px] font-semibold text-muted-foreground">
                              ${Math.round(data.total_amount).toLocaleString("es-AR")}
                            </span>
                          ) : (
                            <span className="text-[9px] text-green-600">libre</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div
                  ref={canvasRef}
                  className="relative mx-auto overflow-hidden rounded-[28px] border border-border shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]"
                  style={{
                    width: `${CANVAS_WIDTH}px`,
                    height: `${CANVAS_HEIGHT * canvasScale}px`,
                    maxWidth: '100%',
                    aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                    zIndex: 10
                  }}
                >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,84,0.06),transparent_28%),linear-gradient(180deg,#FBF4E6_0%,#F4EAD7_100%)]" />
                <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(168, 52, 28,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(168, 52, 28,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168, 52, 28,0.03),transparent_55%)]" />

                {/* Mesas flotando libremente con posicionamiento absoluto */}
                {layout
                  .filter((t) => t.is_active !== false)
                  .map((tableLayout) => {
                    const { status, data } = getTableStatus(tableLayout.table_number);
                    const BASE_SIZE = TABLE_BASE_SIZE;
                    const tableWidth = (tableLayout.width || 1) * BASE_SIZE;
                    const tableHeight = (tableLayout.height || 1) * BASE_SIZE;

                    const tableContent = (
                      <>
                        <TableShapeFudo
                          tableNumber={tableLayout.table_number}
                          status={status}
                          isSelected={selectedTableNumber === tableLayout.table_number}
                          isEditMode={isEditMode}
                          onClick={() => handleTableClick(tableLayout.table_number, status)}
                          data={data}
                          shape={tableLayout.shape || "square"}
                          customName={tableLayout.custom_name}
                          scale={canvasScale}
                          baseSize={TABLE_BASE_SIZE}
                          width={tableLayout.width || 1}
                          height={tableLayout.height || 1}
                        />

                        {/* Indicador de mesa agrupada */}
                        {data?.is_table_group && (
                          <div className="absolute -top-1 -right-1 rounded-full border border-border bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-lg">
                            Grupo
                          </div>
                        )}

                        {/* Mostrar números de mesas agrupadas */}
                        {data?.grouped_tables && data.grouped_tables.length > 1 && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-lg">
                            {data.grouped_tables.join("-")}
                          </div>
                        )}
                      </>
                    );

                    return (
                      <div
                        key={tableLayout.table_number}
                        className="absolute"
                        style={{
                          left: `${tableLayout.position_x * canvasScale}px`,
                          top: `${tableLayout.position_y * canvasScale}px`,
                        }}
                        onContextMenu={(e) => handleTableRightClick(e, tableLayout.table_number)}
                        data-table-number={tableLayout.table_number}
                      >
                        {isEditMode ? (
                          <Resizable
                            size={{
                              width: tableWidth * canvasScale,
                              height: tableHeight * canvasScale,
                            }}
                            minWidth={BASE_SIZE * 0.5 * canvasScale}
                            minHeight={BASE_SIZE * 0.5 * canvasScale}
                            maxWidth={BASE_SIZE * 4 * canvasScale}
                            maxHeight={BASE_SIZE * 4 * canvasScale}
                            lockAspectRatio={false}
                            enable={{
                              top: true,
                              right: true,
                              bottom: true,
                              left: true,
                              topRight: true,
                              bottomRight: true,
                              bottomLeft: true,
                              topLeft: true,
                            }}
                            handleStyles={{
                              top: { cursor: 'n-resize', backgroundColor: 'rgba(168, 52, 28, 0.18)', height: '8px' },
                              right: { cursor: 'e-resize', backgroundColor: 'rgba(168, 52, 28, 0.18)', width: '8px' },
                              bottom: { cursor: 's-resize', backgroundColor: 'rgba(168, 52, 28, 0.18)', height: '8px' },
                              left: { cursor: 'w-resize', backgroundColor: 'rgba(168, 52, 28, 0.18)', width: '8px' },
                              topRight: { cursor: 'ne-resize', backgroundColor: 'rgba(181, 116, 58, 0.28)', width: '12px', height: '12px', right: '-4px', top: '-4px' },
                              bottomRight: { cursor: 'se-resize', backgroundColor: 'rgba(181, 116, 58, 0.28)', width: '12px', height: '12px', right: '-4px', bottom: '-4px' },
                              bottomLeft: { cursor: 'sw-resize', backgroundColor: 'rgba(181, 116, 58, 0.28)', width: '12px', height: '12px', left: '-4px', bottom: '-4px' },
                              topLeft: { cursor: 'nw-resize', backgroundColor: 'rgba(181, 116, 58, 0.28)', width: '12px', height: '12px', left: '-4px', top: '-4px' },
                            }}
                            handleClasses={{
                              top: 'resize-handle-top',
                              right: 'resize-handle-right',
                              bottom: 'resize-handle-bottom',
                              left: 'resize-handle-left',
                              topRight: 'resize-handle-corner',
                              bottomRight: 'resize-handle-corner',
                              bottomLeft: 'resize-handle-corner',
                              topLeft: 'resize-handle-corner',
                            }}
                            onResizeStop={(e, direction, ref, d) => {
                              handleResizeStop(tableLayout.table_number, {
                                width: tableWidth + d.width / canvasScale,
                                height: tableHeight + d.height / canvasScale,
                              });
                            }}
                          >
                            {tableContent}
                          </Resizable>
                        ) : (
                          tableContent
                        )}
                      </div>
                    );
                  })}

                {/* Botón para agregar nueva mesa (solo en modo edición) */}
                {isEditMode && canEditLayout && (
                  <button
                    onClick={handleAddNewTable}
                    className="absolute right-4 top-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary via-pink-500 to-secondary text-[#240413] shadow-[0_18px_40px_rgba(168, 52, 28,0.3)] transition-all hover:scale-110"
                    title="Agregar nueva mesa"
                    type="button"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                )}

                {/* Indicador de modo edición flotante */}
                {isEditMode && (
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-foreground shadow-lg">
                    <Edit className="h-4 w-4" />
                    <span className="text-sm font-semibold">Modo Edición Activo</span>
                  </div>
                )}

                {/* Grid de referencia en modo edición (opcional, sutil) */}
                {isEditMode && (
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <svg width="100%" height="100%">
                      <defs>
                        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#8f6c4e" strokeWidth="0.45" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                  </div>
                )}
                </div>
              )}
            </Card>
          </DndContext>
        </div>

        {/* PANEL LATERAL (30%) */}
        <div className="lg:col-span-3">
          {selectedTableNumber !== null ? (
            // Si hay una mesa seleccionada, verificar si está en modo venta o no
            isInSaleMode && session ? (
              // Modo venta rápida: mostrar panel de búsqueda y carrito
              <>
                {console.log("📦 [DEBUG][BarCanvasView] Render QuickSalePanel", {
                  selectedTableNumber,
                  hasSelectedTable: !!selectedTable,
                })}
                <QuickSalePanel
                  tableNumber={selectedTableNumber}
                  session={session}
                  onClose={() => {
                    setIsInSaleMode(false);
                    setSelectedTableNumber(null);
                    setOptimisticSelectedTable(null);
                  }}
                  onComplete={(tableNumber, optimisticTableData) => {
                    setIsInSaleMode(false);
                    setSelectedTableNumber(tableNumber);
                    setActiveTable(tableNumber);
                    if (optimisticTableData) {
                      setOptimisticSelectedTable(optimisticTableData);
                    }
                  }}
                />
              </>
            ) : selectedTable ? (
              // Mesa ocupada: mostrar detalles con opciones de gestión
              <>
                <SelectedTableDetail
                  table={selectedTable}
                  onClose={() => {
                    setSelectedTableNumber(null);
                    setOptimisticSelectedTable(null);
                  }}
                  onUpdate={refreshTables} // Mantener para actualizaciones manuales (fallback)
                />
              </>
            ) : (
              // Mesa libre: mostrar panel de apertura estilo Fudo
              <>
                <AvailableTableDetail
                  tableNumber={selectedTableNumber}
                  onClose={() => {
                    setSelectedTableNumber(null);
                    setOptimisticSelectedTable(null);
                  }}
                  onOpenForSale={() => setIsInSaleMode(true)}
                />
              </>
            )
          ) : (
            <Card className="brand-panel sticky top-6 overflow-hidden p-6">
              <div className="text-center py-12 space-y-4">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-border bg-muted/30 text-muted-foreground/40 shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]">
                  <UtensilsCrossed className="h-24 w-24 mx-auto" strokeWidth={1} />
                </div>
                <h3 className="font-brand text-3xl tracking-[0.08em] text-foreground">
                  Selecciona una mesa
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Hacé clic en una mesa del mapa para abrirla o ver sus detalles
                </p>

                {canEditLayout && !isEditMode && (
                  <div className="pt-4 space-y-2">
                    <Button
                      variant="outline"
                      className="w-full gap-2 rounded-2xl border-border bg-muted/30 text-foreground hover:bg-muted"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Edit className="h-4 w-4" />
                      Editar Layout del Bar
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Reorganiza las mesas según la distribución real de tu local
                    </p>
                    <p className="text-xs font-medium text-secondary">
                      ✨ Disponible para Administradores y Cajeros
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de configuración de mesa - TODO: Descomentar cuando se cree TableConfigModal */}
    </div>
  );
}
