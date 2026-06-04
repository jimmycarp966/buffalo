"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { splitTableAccount } from "@/actions/barActions";
import { useNotificationStore } from "@/store/notificationStore";
import { Split, Users, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SplitAccountModalProps {
  open: boolean;
  onClose: () => void;
  table: {
    id: string;
    table_number: number;
    total_amount: number;
    sale_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      product: { name: string };
    }>;
  };
  onComplete: () => void;
}

export function SplitAccountModal({ open, onClose, table, onComplete }: SplitAccountModalProps) {
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [equalParts, setEqualParts] = useState(2);
  const [customDivisions, setCustomDivisions] = useState<Array<{
    name: string;
    items: Map<string, number>; // sale_item_id -> quantity
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Inicializar divisiones personalizadas
  useEffect(() => {
    if (open && splitMode === "custom" && customDivisions.length === 0) {
      // Crear 2 divisiones vacías por defecto
      setCustomDivisions([
        { name: "División A", items: new Map() },
        { name: "División B", items: new Map() },
      ]);
    }
  }, [open, splitMode]);

  const handleConfirmEqual = async () => {
    if (equalParts < 2 || equalParts > 10) {
      addNotification("error", "El número de partes debe estar entre 2 y 10");
      return;
    }

    setIsLoading(true);
    try {
      // Dividir items proporcionalmente
      const divisions = [];
      const itemsPerDivision = Math.floor(table.sale_items.length / equalParts);
      
      for (let i = 0; i < equalParts; i++) {
        const startIdx = i * itemsPerDivision;
        const endIdx = i === equalParts - 1 ? table.sale_items.length : (i + 1) * itemsPerDivision;
        const divisionItems = table.sale_items.slice(startIdx, endIdx);
        
        divisions.push({
          name: `División ${String.fromCharCode(65 + i)}`,
          items: divisionItems.map(item => ({
            sale_item_id: item.id,
            quantity: item.quantity,
          })),
        });
      }

      const result = await splitTableAccount(table.id, divisions);

      if (result.success) {
        addNotification("success", result.message || "Cuenta dividida exitosamente");
        onComplete();
        onClose();
      } else {
        addNotification("error", result.message || "Error al dividir cuenta");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al dividir cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCustom = async () => {
    // TODO: Implementar división personalizada
    addNotification("info", "División personalizada en desarrollo");
  };

  const amountPerPart = table.total_amount / equalParts;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] px-4 sm:px-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Split className="h-5 w-5 text-foreground" />
            Dividir Cuenta - Mesa {table.table_number}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Separa esta cuenta en múltiples partes
          </p>
        </DialogHeader>

        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as "equal" | "custom")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equal" className="gap-2">
              <Users className="h-4 w-4" />
              Partes Iguales
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Package className="h-4 w-4" />
              Por Productos
            </TabsTrigger>
          </TabsList>

          {/* Dividir en partes iguales */}
          <TabsContent value="equal" className="space-y-4 mt-4">
            {/* Advertencia sobre pagos parciales */}
            <Card className="p-3 bg-yellow-50 border-yellow-200">
              <p className="text-xs text-yellow-800">
                ⚠️ <strong>Importante:</strong> No se puede dividir una cuenta que tenga pagos parciales registrados.
                Si hay pagos parciales, cierra la mesa completa primero.
              </p>
            </Card>

            {/* Info de la cuenta actual */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de la Cuenta:</p>
                  <p className="text-2xl font-bold">{formatCurrency(table.total_amount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {table.sale_items.length} productos
                  </p>
                </div>
              </div>
            </Card>

            {/* Selector de partes */}
            <div className="space-y-3">
              <Label htmlFor="parts">Dividir en cuántas partes:</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="parts"
                  type="number"
                  min={2}
                  max={10}
                  value={equalParts}
                  onChange={(e) => setEqualParts(parseInt(e.target.value) || 2)}
                  className="w-24 text-center text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">partes</span>
              </div>

              {/* Botones rápidos */}
              <div className="flex gap-2">
                {[2, 3, 4, 5].map((num) => (
                  <Button
                    key={num}
                    variant={equalParts === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEqualParts(num)}
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Preview de las divisiones */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Vista Previa:</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {Array.from({ length: equalParts }, (_, i) => (
                  <Card key={i} className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
                    <div className="text-center">
                      <Badge className="mb-2 bg-green-600">
                        División {String.fromCharCode(65 + i)}
                      </Badge>
                      <p className="text-lg font-bold text-green-800">
                        {formatCurrency(amountPerPart)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mesa {table.table_number}-{String.fromCharCode(65 + i)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  ℹ️ Los productos se distribuirán automáticamente entre las {equalParts} divisiones.
                  Cada división será una cuenta independiente que se puede pagar por separado.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Dividir por productos (personalizado) */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <p className="text-xs text-yellow-800">
                ℹ️ <strong>División por Productos:</strong> Asigna cada producto a una división diferente. 
                Arrastra productos de la lista a cada división.
              </p>
            </Card>

            {/* Lista de productos disponibles */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Productos de la Mesa:
              </Label>
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2 max-h-[200px] overflow-y-auto">
                {table.sale_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-background border rounded text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{item.product?.name || "Producto"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity}x {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                    <Badge variant="secondary">{formatCurrency(item.subtotal)}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Divisiones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Divisiones ({customDivisions.length}):
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (customDivisions.length < 10) {
                        setCustomDivisions([
                          ...customDivisions,
                          { 
                            name: `División ${String.fromCharCode(65 + customDivisions.length)}`, 
                            items: new Map() 
                          }
                        ]);
                      }
                    }}
                    disabled={customDivisions.length >= 10}
                  >
                    + Agregar División
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {customDivisions.map((division, divIndex) => {
                  const divisionTotal = Array.from(division.items.entries()).reduce((sum, [itemId, qty]) => {
                    const item = table.sale_items.find((i: any) => i.id === itemId);
                    return sum + (item ? item.unit_price * qty : 0);
                  }, 0);

                  const itemCount = Array.from(division.items.values()).reduce((sum, qty) => sum + qty, 0);

                  return (
                    <Card key={divIndex} className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300">
                      <div className="flex items-center justify-between mb-2">
                        <Input
                          value={division.name}
                          onChange={(e) => {
                            const newDivisions = [...customDivisions];
                            newDivisions[divIndex].name = e.target.value;
                            setCustomDivisions(newDivisions);
                          }}
                          className="h-7 text-sm font-semibold bg-card"
                          maxLength={20}
                        />
                        {customDivisions.length > 2 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCustomDivisions(customDivisions.filter((_, i) => i !== divIndex));
                            }}
                            className="h-7 w-7 p-0 ml-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold text-purple-900">
                          <span>{itemCount} items</span>
                          <span>{formatCurrency(divisionTotal)}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-800">
                <strong>Nota:</strong> La división personalizada por productos requiere interfaz más compleja.
                Por ahora, usa "Partes Iguales" que distribuye automáticamente los productos.
              </p>
              <p className="text-xs text-red-700 mt-1">
                💡 <strong>Tip:</strong> Si necesitas dividir específicamente quién paga qué, cierra la mesa completa 
                y luego crea ventas individuales para cada persona.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={splitMode === "equal" ? handleConfirmEqual : handleConfirmCustom}
            disabled={isLoading || (splitMode === "equal" && equalParts < 2)}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Dividiendo..." : `Dividir en ${equalParts} Partes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

