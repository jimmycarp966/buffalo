"use client";

import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useTablesStore } from "@/store/tablesStore";
import { useAuthStore } from "@/store/authStore";
import { useOpenTables } from "@/hooks/useOpenTables";
import { getUserNavigationPermissions } from "@/actions/permissionActions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TableShapeModern } from "./TableShapeModern";
import { SelectedTableDetail } from "./SelectedTableDetail";
import { getBarLayout, updateTablePosition } from "@/actions/barLayoutActions";
import { useNotificationStore } from "@/store/notificationStore";
import { Edit, X, RefreshCw, UtensilsCrossed } from "lucide-react";

export function BarMapView() {
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<any[]>([]);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const { refreshTables } = useTablesStore();
  const { data: tablesData, isLoading: tablesLoading, refetch: refetchOpenTables } = useOpenTables();
  const user = useAuthStore((state) => state.user);

  // Verificar permisos usando el sistema granular
  const hasLoadedPermissions = Object.keys(userPermissions).length > 0;
  const fallbackPermission = user?.role === 'waiter' || user?.role === 'admin';
  const canEditLayout = hasLoadedPermissions
    ? userPermissions['tables.edit'] === true
    : fallbackPermission;
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Usar datos de React Query
  const pendingTables = tablesData?.data || [];

  // Configurar sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Solo activar después de mover 8px (evita clicks accidentales)
      },
    })
  );

  // Cargar layout al montar - React Query maneja las mesas automáticamente
  useEffect(() => {
    loadLayout();

    // Solo invalidar manualmente si estamos en modo edición y necesitamos datos frescos
    if (isEditMode) {
      refreshTables(); // Fallback al store si es necesario
    }
  }, [isEditMode, refreshTables]);

  // Cargar permisos del usuario al inicio
  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        if (user?.id) {
          console.log("🔍 BarMapView: Loading permissions for user", user.id);
          const { data: permissionsData } = await getUserNavigationPermissions(user.id);
          if (permissionsData) {
            setUserPermissions(permissionsData);
            console.log("✅ BarMapView: Permissions loaded", permissionsData['tables.edit']);
          }
        }
      } catch (error) {
        console.error("❌ BarMapView: Could not load permissions", error);
      }
    };

    loadUserPermissions();
  }, [user?.id]);

  const loadLayout = async () => {
    setIsLoadingLayout(true);
    const result = await getBarLayout();
    if (result.success) {
      setLayout(result.data);
    } else {
      addNotification("error", "Error al cargar el layout del bar");
    }
    setIsLoadingLayout(false);
  };

  // Manejar cuando se suelta una mesa después de arrastrarla
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;

    if (!isEditMode || !delta) return;

    const tableNumber = active.id as number;
    const movedTable = layout.find(t => t.table_number === tableNumber);

    if (!movedTable) return;

    // Calcular nueva posición basada en el delta del drag
    // Cada 100px = 1 unidad en el grid
    const gridSize = 100;
    const newX = Math.max(0, Math.round(movedTable.position_x + delta.x / gridSize));
    const newY = Math.max(0, Math.round(movedTable.position_y + delta.y / gridSize));

    // Actualizar localmente primero (optimistic update)
    setLayout((prev) =>
      prev.map((table) =>
        table.table_number === tableNumber
          ? { ...table, position_x: newX, position_y: newY }
          : table
      )
    );

    // Guardar en backend
    const result = await updateTablePosition(tableNumber, {
      x: newX,
      y: newY,
      zone: movedTable.zone,
    });

    if (!result.success) {
      addNotification("error", result.message || "Error al mover mesa");
      // Revertir cambio
      loadLayout();
    } else {
      addNotification("success", `Mesa ${tableNumber} movida exitosamente`);
    }
  };

  // Obtener estado de la mesa
  const getTableStatus = (tableNumber: number): { status: "available" | "occupied" | "partial"; data: any } => {
    const tableData = pendingTables.find((t: any) => t.table_number === tableNumber);
    if (!tableData) return { status: "available" as const, data: null };

    // TODO: Implementar detección de pagos parciales
    const hasPartialPayment = false;

    return {
      status: hasPartialPayment ? ("partial" as const) : ("occupied" as const),
      data: tableData,
    };
  };

  const selectedTable = pendingTables.find(
    (t: any) => t.table_number === selectedTableNumber
  );

  // Agrupar mesas por zona
  const groupedLayout = layout.reduce((acc, table: any) => {
    if (!acc[table.zone]) acc[table.zone] = [];
    acc[table.zone].push(table);
    return acc;
  }, {} as Record<string, any[]>);

  // Configuración de zonas
  const zoneConfig = {
    principal: {
      title: "🏠 Zona Principal",
      description: "Mesas del salón interior",
      color: "bg-blue-500",
      colorLight: "bg-blue-50",
      borderColor: "border-blue-300",
    },
    exterior: {
      title: "🌿 Zona Exterior",
      description: "Mesas de la terraza/patio",
      color: "bg-green-500",
      colorLight: "bg-green-50",
      borderColor: "border-green-300",
    },
  };

  const occupiedCount = pendingTables.length;
  const totalCount = layout.filter(t => t.is_active !== false).length;
  const availableCount = totalCount - occupiedCount;

  // Filtrar mesas por tipo para organización visual
  const normalTables = layout.filter(t => t.table_number <= 30);
  const deliveryTables = layout.filter(t => t.table_number >= 31 && t.table_number <= 32);
  const takeawayTables = layout.filter(t => t.table_number >= 33 && t.table_number <= 37);

  if (isLoadingLayout) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-foreground mx-auto" />
          <p className="text-muted-foreground">Cargando mapa del bar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra superior: solo botones a la derecha */}
      <div className="flex items-center justify-end gap-2">
        {canEditLayout && (
          <>
            <Button
              variant="outline"
              onClick={async () => {
                addNotification("info", "Actualizando mesas...");
                await refetchOpenTables();
                addNotification("success", "Mesas actualizadas");
              }}
              className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
              size="lg"
              title="Forzar actualización de mesas abiertas"
            >
              <RefreshCw className="h-5 w-5" />
              <span className="hidden sm:inline">Actualizar Mesas</span>
            </Button>
            <Button
              variant={isEditMode ? "destructive" : "default"}
              onClick={() => {
                if (isEditMode) {
                  loadLayout();
                }
                setIsEditMode(!isEditMode);
              }}
              className="gap-2 shadow-lg"
              size="lg"
            >
              {isEditMode ? (
                <>
                  <X className="h-5 w-5" />
                  Salir de Edición
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  Editar Layout
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* MAPA DEL BAR */}
        <div className="xl:col-span-2 space-y-6">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {/* Zona Principal */}
            {groupedLayout.principal && (
              <Card className={cn(
                "p-6 border-2",
                zoneConfig.principal.borderColor,
                zoneConfig.principal.colorLight
              )}>
                <div className="space-y-4">
                  {/* Título de zona */}
                  <div className="flex items-center gap-4">
                    <div className={cn("h-1 w-12 rounded-full", zoneConfig.principal.color)} />
                    <div>
                      <h3 className="text-xl font-bold">{zoneConfig.principal.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {zoneConfig.principal.description}
                      </p>
                    </div>
                    <div className={cn("h-1 flex-1 rounded-full", zoneConfig.principal.color)} />
                  </div>

                  {/* Grid de mesas principales (1-20) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {groupedLayout.principal
                      .filter((t: any) => t.table_number <= 20)
                      .map((tableLayout: any) => {
                        const { status, data } = getTableStatus(tableLayout.table_number);
                        return (
                          <TableShapeModern
                            key={tableLayout.table_number}
                            tableNumber={tableLayout.table_number}
                            status={status}
                            isSelected={selectedTableNumber === tableLayout.table_number}
                            isEditMode={isEditMode}
                            onClick={() => {
                              if (!isEditMode && (status === "occupied" || status === "partial")) {
                                setSelectedTableNumber(tableLayout.table_number);
                              }
                            }}
                            data={data}
                            layout={tableLayout}
                          />
                        );
                      })}
                  </div>

                  {/* Separador para delivery y para llevar */}
                  {(deliveryTables.length > 0 || takeawayTables.length > 0) && (
                    <Separator className="my-6" />
                  )}

                  {/* Delivery y Para Llevar */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Delivery */}
                    {deliveryTables.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3 text-blue-600 flex items-center gap-2">
                          <span>🏍️</span> Delivery
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {deliveryTables.map((tableLayout: any) => {
                            const { status, data } = getTableStatus(tableLayout.table_number);
                            return (
                              <TableShapeModern
                                key={tableLayout.table_number}
                                tableNumber={tableLayout.table_number}
                                status={status}
                                isSelected={selectedTableNumber === tableLayout.table_number}
                                isEditMode={isEditMode}
                                onClick={() => {
                                  if (!isEditMode && (status === "occupied" || status === "partial")) {
                                    setSelectedTableNumber(tableLayout.table_number);
                                  }
                                }}
                                data={data}
                                layout={tableLayout}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Para Llevar */}
                    {takeawayTables.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3 text-green-600 flex items-center gap-2">
                          <span>📦</span> Para Llevar
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          {takeawayTables.map((tableLayout: any) => {
                            const { status, data } = getTableStatus(tableLayout.table_number);
                            return (
                              <TableShapeModern
                                key={tableLayout.table_number}
                                tableNumber={tableLayout.table_number}
                                status={status}
                                isSelected={selectedTableNumber === tableLayout.table_number}
                                isEditMode={isEditMode}
                                onClick={() => {
                                  if (!isEditMode && (status === "occupied" || status === "partial")) {
                                    setSelectedTableNumber(tableLayout.table_number);
                                  }
                                }}
                                data={data}
                                layout={tableLayout}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Zona Exterior */}
            {groupedLayout.exterior && groupedLayout.exterior.length > 0 && (
              <Card className={cn(
                "p-6 border-2",
                zoneConfig.exterior.borderColor,
                zoneConfig.exterior.colorLight
              )}>
                <div className="space-y-4">
                  {/* Título de zona */}
                  <div className="flex items-center gap-4">
                    <div className={cn("h-1 w-12 rounded-full", zoneConfig.exterior.color)} />
                    <div>
                      <h3 className="text-xl font-bold">{zoneConfig.exterior.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {zoneConfig.exterior.description}
                      </p>
                    </div>
                    <div className={cn("h-1 flex-1 rounded-full", zoneConfig.exterior.color)} />
                  </div>

                  {/* Grid de mesas */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {groupedLayout.exterior.map((tableLayout: any) => {
                      const { status, data } = getTableStatus(tableLayout.table_number);
                      return (
                        <TableShapeModern
                          key={tableLayout.table_number}
                          tableNumber={tableLayout.table_number}
                          status={status}
                          isSelected={selectedTableNumber === tableLayout.table_number}
                          isEditMode={isEditMode}
                          onClick={() => {
                            if (!isEditMode && (status === "occupied" || status === "partial")) {
                              setSelectedTableNumber(tableLayout.table_number);
                            }
                          }}
                          data={data}
                          layout={tableLayout}
                        />
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </DndContext>
        </div>

        {/* PANEL LATERAL */}
        <div className="xl:col-span-1">
          {selectedTable ? (
            <SelectedTableDetail
              table={selectedTable}
              onClose={() => setSelectedTableNumber(null)}
              onUpdate={refreshTables}
            />
          ) : (
            <Card className="p-6 sticky top-6">
              <div className="text-center py-12 space-y-4">
                <div className="text-muted-foreground/20">
                  <UtensilsCrossed className="h-24 w-24 mx-auto" strokeWidth={1} />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Selecciona una mesa
                </h3>
                <p className="text-sm text-muted-foreground">
                  Haz clic en una mesa ocupada (🔴) del mapa para ver sus detalles y gestionarla
                </p>

                {canEditLayout && !isEditMode && (
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Edit className="h-4 w-4" />
                      Editar Layout del Bar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper para cn (por si no está importado)
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

