"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";
import { changeTable, getOccupiedTables, getOpenTables, mergeTables } from "@/actions/barActions";
import { getAllAvailableTables } from "@/actions/barLayoutActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useTablesStore } from "@/store/tablesStore";
import { ArrowLeftRight, ArrowLeft } from "lucide-react";

interface TableSelectorViewProps {
  currentTable: {
    id: string;
    table_number: number;
    total_amount: number;
    sale_items: any[];
  };
  onCancel: () => void;
  onComplete: (newTableNumber: number) => void;
}

export function TableSelectorView({ currentTable, onCancel, onComplete }: TableSelectorViewProps) {
  const [selectedMesa, setSelectedMesa] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [showMergeConfirmation, setShowMergeConfirmation] = useState(false);
  const [pendingMergeMesa, setPendingMergeMesa] = useState<number | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { pendingTables } = useTablesStore();

  useEffect(() => {
    loadAvailableTables();
    setSelectedMesa("");
    setReason("");
    setShowMergeConfirmation(false);
    setPendingMergeMesa(null);
  }, []);

  const loadAvailableTables = async () => {
    try {
      // Ejecutar ambas consultas en paralelo para mayor velocidad
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
        .filter(t => Number(t.table_number) !== Number(currentTable.table_number))
        .map(t => {
          const tableNumber = Number(t.table_number);
          const isOccupied = occupiedNumbers.includes(tableNumber);
          const occupiedSale = isOccupied ? occupiedSalesMap.get(tableNumber) : null;

          return {
            ...t,
            table_number: tableNumber,
            isOccupied,
            occupiedSale
          };
        })
        .sort((a, b) => a.table_number - b.table_number);

      setAvailableTables(allTables);
    } catch (error) {
      console.error("Error loading available tables:", error);
      addNotification("error", "Error al cargar mesas");
    }
  };

  const handleMesaSelection = (mesaValue: string) => {
    const mesaNumber = parseInt(mesaValue);
    const targetMesa = availableTables.find(t => t.table_number === mesaNumber);
    const isOccupied = targetMesa?.isOccupied === true;

    if (isOccupied) {
      // Si la mesa está ocupada, mostrar confirmación de fusión
      setPendingMergeMesa(mesaNumber);
      setShowMergeConfirmation(true);
      setSelectedMesa(mesaValue); // Aún seleccionar para mostrar en el select
    } else {
      // Si la mesa está libre, seleccionar directamente
      setSelectedMesa(mesaValue);
      setShowMergeConfirmation(false);
      setPendingMergeMesa(null);
    }
  };

  const handleConfirmMerge = () => {
    setShowMergeConfirmation(false);
    // selectedMesa ya está configurado, solo confirmar
  };

  const handleCancelMerge = () => {
    setShowMergeConfirmation(false);
    setPendingMergeMesa(null);
    setSelectedMesa("");
  };

  const handleConfirm = async () => {
    if (!selectedMesa) {
      addNotification("error", "Debes seleccionar una mesa destino");
      return;
    }

    const tableNumber = parseInt(selectedMesa);
    const targetMesa = availableTables.find(t => t.table_number === tableNumber);
    const isTargetOccupied = targetMesa?.isOccupied === true;

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
        result = await mergeTables(currentTable.id, targetSaleId, reason.trim() || undefined);
      } else {
        // Cambiar mesa normalmente
        result = await changeTable(currentTable.id, tableNumber, reason.trim() || undefined);
      }

      if (result.success) {
        addNotification("success", result.message || (isTargetOccupied ? "Mesas fusionadas exitosamente" : "Mesa cambiada exitosamente"));
        onComplete(tableNumber);
      } else {
        addNotification("error", result.message || "Error al procesar el movimiento");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al procesar el movimiento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="sticky top-6 shadow-xl">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl mb-2 text-blue-700 flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Cambiar Mesa {currentTable.table_number}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecciona una mesa disponible
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Info de la mesa actual */}
        <div className="p-3 bg-muted/50 rounded-lg border">
          <h4 className="font-semibold mb-2 text-sm">Mesa Actual:</h4>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-bold">Mesa {currentTable.table_number}</span>
              <p className="text-muted-foreground text-xs">{currentTable.sale_items?.length || 0} productos</p>
            </div>
            <div className="text-right">
              <div className="font-bold">{formatCurrency(currentTable.total_amount)}</div>
            </div>
          </div>
        </div>

        {/* Selector de mesa */}
        <div className="space-y-2">
          <Label htmlFor="mesa-select" className="text-sm font-medium">
            Seleccionar Mesa Destino
          </Label>
          <Select value={selectedMesa} onValueChange={handleMesaSelection} disabled={availableTables.length === 0}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={availableTables.length === 0 ? "No hay mesas" : "Elige una mesa..."} />
            </SelectTrigger>
            <SelectContent>
              {availableTables.map((mesa: any) => {
                // Mostrar etiqueta con área (salón o vereda) y estado
                const areaIcon = mesa.area === 'salon' ? '🏠' : '🌳';
                const areaName = mesa.area === 'salon' ? 'Salón' : 'Vereda';
                const isOccupied = mesa.isOccupied === true;
                const label = `${areaIcon} Mesa ${mesa.table_number} - ${areaName}${isOccupied ? ' 🔴 OCUPADA' : ''}`;

                return (
                  <SelectItem 
                    key={mesa.table_number} 
                    value={mesa.table_number.toString()}
                    className={isOccupied ? "text-red-700 font-semibold bg-red-50" : ""}
                  >
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {availableTables.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay mesas disponibles
            </p>
          )}
        </div>

        {/* Razón del cambio (opcional) */}
        {selectedMesa && (
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
        )}

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
          <div className={availableTables.find(t => t.table_number === parseInt(selectedMesa))?.isOccupied
            ? "p-3 bg-orange-50 border-2 border-orange-300 rounded-lg"
            : "p-3 bg-green-50 border-2 border-green-200 rounded-lg"
          }>
            <p className={cn(
              "text-sm font-semibold text-center",
              availableTables.find(t => t.table_number === parseInt(selectedMesa))?.isOccupied
                ? "text-orange-800"
                : "text-green-800"
            )}>
              {availableTables.find(t => t.table_number === parseInt(selectedMesa))?.isOccupied
                ? `Fusionar: Mesa ${currentTable.table_number} → Mesa ${selectedMesa}`
                : `Mesa ${currentTable.table_number} → Mesa ${selectedMesa}`}
            </p>
            <p className={cn(
              "text-xs text-center mt-1",
              availableTables.find(t => t.table_number === parseInt(selectedMesa))?.isOccupied
                ? "text-orange-700"
                : "text-green-700"
            )}>
              {availableTables.find(t => t.table_number === parseInt(selectedMesa))?.isOccupied
                ? "Se combinarán todos los productos y pagos de ambas mesas"
                : "Se mantendrán todos los productos y pagos parciales"}
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-2 pt-4">
          <Button
            onClick={handleConfirm}
            disabled={!selectedMesa || isLoading}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? "Cambiando..." : "Confirmar Cambio"}
          </Button>

          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
