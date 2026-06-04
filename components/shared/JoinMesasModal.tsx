"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { joinTables } from "@/actions/barActions";
import { getBarLayout } from "@/actions/barLayoutActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useTablesStore } from "@/store/tablesStore";
import { Merge, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface JoinMesasModalProps {
  open: boolean;
  onClose: () => void;
  currentTableNumber: number;
  onComplete: (saleId: string) => void;
}

export function JoinMesasModal({
  open,
  onClose,
  currentTableNumber,
  onComplete,
}: JoinMesasModalProps) {
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { pendingTables } = useTablesStore();

  useEffect(() => {
    if (open) {
      loadAvailableTables();
      setSelectedTables([]);
    }
  }, [open]);

  const loadAvailableTables = async () => {
    const result = await getBarLayout();
    if (result.success) {
      // Obtener zona de la mesa actual
      const currentTable = result.data.find(t => t.table_number === currentTableNumber);
      const currentZone = currentTable?.zone;

      // Filtrar solo mesas libres de la misma zona (excluyendo delivery y para llevar)
      const occupiedNumbers = pendingTables.map(t => t.table_number);
      const available = result.data
        .filter(t => 
          !occupiedNumbers.includes(t.table_number) && // Libre
          t.table_number !== currentTableNumber && // No la actual
          t.zone === currentZone && // Misma zona
          (t.table_number <= 30 || (t.table_number >= 38 && t.table_number <= 41)) // Solo mesas normales + barra
        )
        .sort((a, b) => a.table_number - b.table_number);
      
      setAvailableTables(available);
    }
  };

  const toggleTable = (tableNumber: number) => {
    if (selectedTables.includes(tableNumber)) {
      setSelectedTables(selectedTables.filter(t => t !== tableNumber));
    } else {
      setSelectedTables([...selectedTables, tableNumber]);
    }
  };

  const handleConfirm = async () => {
    if (selectedTables.length === 0) {
      addNotification("error", "Debes seleccionar al menos una mesa para unir");
      return;
    }

    setIsLoading(true);
    try {
      const result = await joinTables(currentTableNumber, selectedTables);

      if (result.success) {
        addNotification("success", result.message || "Mesas unidas exitosamente");
        if (result.data?.id) {
          onComplete(result.data.id);
        }
        onClose();
      } else {
        addNotification("error", result.message || "Error al unir mesas");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al unir mesas");
    } finally {
      setIsLoading(false);
    }
  };

  const allTableNumbers = [currentTableNumber, ...selectedTables].sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Merge className="h-5 w-5 text-foreground" />
            Unir Mesas
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona las mesas adicionales para crear un grupo
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mesa principal */}
          <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-blue-800">Mesa Principal:</Label>
                <p className="text-2xl font-bold text-blue-900">Mesa {currentTableNumber}</p>
              </div>
              <Badge className="bg-blue-600">Principal</Badge>
            </div>
          </div>

          {/* Mesas disponibles para unir */}
          {availableTables.length > 0 ? (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Selecciona mesas adicionales ({selectedTables.length} seleccionadas):
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[200px] overflow-y-auto p-2">
                {availableTables.map((mesa) => {
                  const isSelected = selectedTables.includes(mesa.table_number);
                  
                  return (
                    <button
                      key={mesa.table_number}
                      onClick={() => toggleTable(mesa.table_number)}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all relative",
                        "hover:scale-105 hover:shadow-lg",
                        isSelected
                          ? "border-green-400 bg-green-50 ring-2 ring-green-400/50"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                      <div className="text-center">
                        <div className="font-bold text-sm">{mesa.table_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {mesa.shape === 'circle' ? '●' : mesa.shape === 'rectangle' ? '▬' : '■'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No hay mesas disponibles para unir</p>
              <p className="text-xs mt-1">Todas las mesas de esta zona están ocupadas</p>
            </div>
          )}

          {/* Preview del grupo */}
          {selectedTables.length > 0 && (
            <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
              <h4 className="font-semibold mb-2 text-purple-800">Preview del Grupo:</h4>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Badge variant="default" className="bg-purple-600 text-white px-4 py-2 text-lg">
                  Mesa {allTableNumbers.join("-")}
                </Badge>
              </div>
              <p className="text-xs text-center text-purple-700 mt-2">
                {allTableNumbers.length} mesas unidas • Una sola cuenta
              </p>
            </div>
          )}

          {/* Motivo (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm">
              Motivo (opcional)
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Grupo familiar grande"
              maxLength={100}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedTables.length === 0 || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? "Uniendo..." : `Unir ${allTableNumbers.length} Mesas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

