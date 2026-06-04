"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { changeTable, mergeTables, getOpenTables } from "@/actions/barActions";
import { getAllAvailableTables } from "@/actions/barLayoutActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useTablesStore } from "@/store/tablesStore";
import { ArrowLeftRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangeMesaModalProps {
  open: boolean;
  onClose: () => void;
  table: {
    id: string;
    table_number: number;
    total_amount: number;
    sale_items: any[];
  };
  onComplete: () => void;
}

export function ChangeMesaModal({ open, onClose, table, onComplete }: ChangeMesaModalProps) {
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMergeConfirmation, setShowMergeConfirmation] = useState(false);
  const [pendingMergeMesa, setPendingMergeMesa] = useState<number | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { pendingTables } = useTablesStore();

  useEffect(() => {
    if (open) {
      loadAvailableTables();
      setSelectedMesa(null);
      setReason("");
      setSearchTerm("");
      setShowMergeConfirmation(false);
      setPendingMergeMesa(null);
    }
  }, [open]);

  const loadAvailableTables = async () => {
    try {
      // Obtener todas las mesas del layout y las mesas ocupadas en paralelo
      const [allTablesResult, occupiedTablesResult] = await Promise.all([
        getAllAvailableTables(),
        getOpenTables() // Obtener todas las mesas ocupadas con información completa
      ]);

      if (!allTablesResult.success) {
        addNotification("error", "Error al cargar mesas");
        return;
      }

      // Crear un mapa de ventas ocupadas por número de mesa (usando número como clave)
      const occupiedSalesMap = new Map<number, any>();
      
      // Obtener mesas ocupadas desde getOpenTables
      if (occupiedTablesResult.success && occupiedTablesResult.data) {
        occupiedTablesResult.data
          .filter((sale: any) => 
            sale.table_number !== null && 
            sale.table_number !== undefined &&
            sale.status === 'pending' &&
            sale.sale_type === 'table' // Solo mesas, no mostrador/delivery
          )
          .forEach((sale: any) => {
            const tableNum = Number(sale.table_number);
            if (!isNaN(tableNum)) {
              occupiedSalesMap.set(tableNum, sale);
            }
          });
      }

      // También usar pendingTables del store como fallback
      pendingTables
        .filter(t => t.table_number !== null && t.table_number !== undefined)
        .forEach(t => {
          const tableNum = Number(t.table_number);
          if (!isNaN(tableNum) && !occupiedSalesMap.has(tableNum)) {
            occupiedSalesMap.set(tableNum, t);
          }
        });

      // Obtener todos los números de mesa ocupados
      const occupiedNumbers = Array.from(occupiedSalesMap.keys()).map(n => Number(n));

      // Incluir TODAS las mesas (ocupadas y libres), excepto la mesa actual
      const allTables = allTablesResult.data
        .filter(t => Number(t.table_number) !== Number(table.table_number))
        .map(t => {
          const tableNumber = Number(t.table_number);
          const isOccupied = occupiedNumbers.includes(tableNumber);
          const occupiedSale = isOccupied ? occupiedSalesMap.get(tableNumber) : null;

          return {
            ...t,
            table_number: tableNumber, // Asegurar que sea número
            isOccupied,
            occupiedSale
          };
        })
        .sort((a, b) => a.table_number - b.table_number);

      setAvailableTables(allTables);
    } catch (error) {
      console.error("Error loading tables:", error);
      addNotification("error", "Error al cargar mesas");
    }
  };

  const handleMesaSelection = (mesaNumber: number, isOccupied: boolean) => {
    if (isOccupied) {
      // Si la mesa está ocupada, mostrar confirmación de fusión
      setPendingMergeMesa(mesaNumber);
      setShowMergeConfirmation(true);
    } else {
      // Si la mesa está libre, seleccionar directamente
      setSelectedMesa(mesaNumber);
      setShowMergeConfirmation(false);
      setPendingMergeMesa(null);
    }
  };

  const handleConfirmMerge = () => {
    if (pendingMergeMesa) {
      setSelectedMesa(pendingMergeMesa);
      setShowMergeConfirmation(false);
    }
  };

  const handleCancelMerge = () => {
    setShowMergeConfirmation(false);
    setPendingMergeMesa(null);
  };

  const handleConfirm = async () => {
    if (!selectedMesa) {
      addNotification("error", "Debes seleccionar una mesa destino");
      return;
    }

    // Verificar si la mesa destino está ocupada
    const targetMesa = availableTables.find(t => t.table_number === selectedMesa);
    const isTargetOccupied = targetMesa?.isOccupied;

    setIsLoading(true);
    try {
      let result;
      
      if (isTargetOccupied) {
        // Fusionar mesas
        const targetSaleId = targetMesa.occupiedSale?.id;
        if (!targetSaleId) {
          addNotification("error", "No se pudo encontrar la venta de la mesa destino");
          setIsLoading(false);
          return;
        }
        result = await mergeTables(table.id, targetSaleId, reason.trim() || undefined);
      } else {
        // Cambiar mesa normalmente
        result = await changeTable(table.id, selectedMesa, reason.trim() || undefined);
      }

      if (result.success) {
        addNotification("success", result.message || (isTargetOccupied ? "Mesas fusionadas exitosamente" : "Mesa cambiada exitosamente"));
        onComplete();
        onClose();
      } else {
        addNotification("error", result.message || "Error al procesar el movimiento");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al procesar el movimiento");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTables = availableTables.filter(t => 
    searchTerm === "" || t.table_number.toString().includes(searchTerm)
  );

  // Agrupar solo por área (salon/vereda) - sin subzonas
  const tablesByArea = filteredTables.reduce((acc, t) => {
    const areaKey = t.area || 'salon'; // Default a 'salon' si no tiene área
    if (!acc[areaKey]) acc[areaKey] = [];
    acc[areaKey].push(t);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] px-4 sm:px-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-foreground" />
            Cambiar Mesa {table.table_number}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Mover esta cuenta a otra mesa disponible
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info de la mesa actual */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <h4 className="font-semibold mb-2">Mesa Actual:</h4>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-bold text-lg">Mesa {table.table_number}</span>
                <p className="text-muted-foreground">{table.sale_items?.length || 0} productos</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{formatCurrency(table.total_amount)}</div>
              </div>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Mesas disponibles */}
          <div className="max-h-[300px] overflow-y-auto space-y-4">
            {Object.entries(tablesByArea).map(([area, tables]) => {
              const areaTables = tables as any[];
              const areaIcon = area === 'salon' ? '🏠' : '🌳';
              const areaName = area === 'salon' ? 'Salón' : 'Vereda';

              return (
                <div key={area} className="space-y-3">
                  {/* Header del área */}
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                    <span className="text-xl">{areaIcon}</span>
                    <div>
                      <h3 className="font-semibold">{areaName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {areaTables.length} mesas
                      </p>
                    </div>
                  </div>

                  {/* Grid de mesas del área */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {areaTables.map((mesa: any) => {
                      const isDelivery = mesa.table_number >= 31 && mesa.table_number <= 32;
                      const isTakeaway = mesa.table_number >= 33 && mesa.table_number <= 37;
                      const isOccupied = mesa.isOccupied === true; // Verificar explícitamente

                      return (
                        <button
                          key={mesa.table_number}
                          onClick={() => handleMesaSelection(mesa.table_number, isOccupied)}
                          className={cn(
                            "p-3 rounded-lg border-2 transition-all relative",
                            "hover:scale-105 hover:shadow-lg",
                            selectedMesa === mesa.table_number
                              ? "border-buffalo-espresso bg-buffalo-espresso/20 ring-2 ring-buffalo-espresso/50"
                              : isOccupied
                                ? "border-red-500 bg-red-100 hover:border-red-600 hover:bg-red-200 shadow-md"
                                : "border-border bg-card hover:border-primary/40"
                          )}
                          title={isOccupied ? `Mesa ${mesa.table_number} OCUPADA - Se fusionarán las cuentas` : `Mesa ${mesa.table_number} libre`}
                        >
                          <div className="text-center relative">
                            {isDelivery && <div className="text-lg">🏍️</div>}
                            {isTakeaway && <div className="text-lg">📦</div>}
                            {isOccupied && (
                              <>
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                                <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                              </>
                            )}
                            <div className={cn(
                              "font-bold text-sm font-semibold",
                              isOccupied 
                                ? "text-red-700 font-extrabold" 
                                : "text-foreground"
                            )}>
                              {mesa.table_number}
                            </div>
                            {isOccupied && (
                              <div className="text-[8px] text-red-600 font-bold mt-0.5 leading-tight">
                                OCUPADA
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredTables.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay mesas disponibles</p>
                <p className="text-xs mt-1">Todas las mesas están ocupadas o no coinciden con la búsqueda</p>
              </div>
            )}
          </div>

          {/* Razón del cambio (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm">
              Motivo del cambio (opcional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente pidió cambiar de ubicación"
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Confirmación de fusión */}
          {showMergeConfirmation && pendingMergeMesa && (
            <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-orange-800 text-center">
                ⚠️ Esta mesa está ocupada
              </p>
              <p className="text-xs text-orange-700 text-center">
                ¿Deseas fusionar las cuentas? Se combinarán todos los productos y totales en la mesa {pendingMergeMesa}.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelMerge}
                  className="text-orange-700 border-orange-300"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmMerge}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Sí, fusionar
                </Button>
              </div>
            </div>
          )}

          {/* Preview del cambio */}
          {selectedMesa && !showMergeConfirmation && (
            <div className={cn(
              "p-4 border-2 rounded-lg",
              availableTables.find(t => t.table_number === selectedMesa)?.isOccupied
                ? "bg-orange-50 border-orange-300"
                : "bg-green-50 border-green-200"
            )}>
              <p className={cn(
                "text-sm font-semibold text-center",
                availableTables.find(t => t.table_number === selectedMesa)?.isOccupied
                  ? "text-orange-800"
                  : "text-green-800"
              )}>
                {availableTables.find(t => t.table_number === selectedMesa)?.isOccupied
                  ? `Fusionar: Mesa ${table.table_number} → Mesa ${selectedMesa}`
                  : `Mesa ${table.table_number} → Mesa ${selectedMesa}`}
              </p>
              <p className={cn(
                "text-xs text-center mt-1",
                availableTables.find(t => t.table_number === selectedMesa)?.isOccupied
                  ? "text-orange-700"
                  : "text-green-700"
              )}>
                {availableTables.find(t => t.table_number === selectedMesa)?.isOccupied
                  ? "Se combinarán todos los productos y pagos de ambas mesas"
                  : "Se mantendrán todos los productos y pagos parciales"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMesa || isLoading}
            className="bg-buffalo-caramel hover:bg-buffalo-caramel/90"
          >
            {isLoading ? "Cambiando..." : "Confirmar Cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

