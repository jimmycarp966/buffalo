import React, { useState, useEffect } from "react";
import { getPendingSales, closePendingSale, cancelPendingSale, getPaymentMethods, type Sale } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { Clock, DollarSign, X, Eye, Trash2 } from "lucide-react";

interface PendingSale extends Sale {
  user?: {
    name: string;
  };
  sale_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product?: {
      name: string;
    };
  }>;
}

export default function PendingAccountsPanel() {
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<PendingSale | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const addNotification = useNotificationStore((state) => state.addNotification);

  const fetchPendingSales = async () => {
    const result = await getPendingSales();
    if (result.success) {
      setPendingSales(result.data || []);
    } else {
      addNotification("error", result.message || "Error al cargar cuentas pendientes");
    }
  };

  useEffect(() => {
    fetchPendingSales();
  }, []);

  const handleCloseSale = async (sale: PendingSale) => {
    setSelectedSale(sale);
    setShowCloseDialog(true);
  };

  const handleCancelSale = async (sale: PendingSale) => {
    setSelectedSale(sale);
    setShowCancelDialog(true);
  };

  const handleViewDetails = async (sale: PendingSale) => {
    setSelectedSale(sale);
    setShowDetailDialog(true);
  };

  const confirmCloseSale = async () => {
    if (!selectedSale) return;

    setIsLoading(true);
    
    // Obtener métodos de pago para usar el UUID correcto
    let paymentMethodId: string | null = null;
    const paymentMethodsResult = await getPaymentMethods();
    if (paymentMethodsResult.success && paymentMethodsResult.data) {
      // Buscar el método de pago "Efectivo"
      const efectivoMethod = paymentMethodsResult.data.find(
        (method: any) => method.name === "Efectivo" || method.name.toLowerCase() === "efectivo"
      );
      if (efectivoMethod) {
        paymentMethodId = efectivoMethod.id;
      } else {
        // Si no encuentra "Efectivo", usar el primer método disponible
        paymentMethodId = paymentMethodsResult.data[0]?.id || null;
      }
    }
    
    if (!paymentMethodId) {
      addNotification("error", "No se encontró un método de pago válido");
      setIsLoading(false);
      return;
    }

    const result = await closePendingSale(selectedSale.id, [
      {
        payment_method_id: paymentMethodId,
        amount: selectedSale.total_amount,
      },
    ]);

    if (result.success) {
      addNotification("success", "Cuenta pendiente cerrada exitosamente");
      setShowCloseDialog(false);
      setSelectedSale(null);
      fetchPendingSales();
    } else {
      addNotification("error", result.message || "Error al cerrar cuenta pendiente");
    }
    setIsLoading(false);
  };

  const confirmCancelSale = async () => {
    if (!selectedSale || !cancelReason.trim()) return;

    setIsLoading(true);
    const result = await cancelPendingSale(selectedSale.id, cancelReason.trim());

    if (result.success) {
      addNotification("success", "Cuenta pendiente cancelada exitosamente");
      setShowCancelDialog(false);
      setSelectedSale(null);
      setCancelReason("");
      fetchPendingSales();
    } else {
      addNotification("error", result.message || "Error al cancelar cuenta pendiente");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-orange-500" />
            Cuentas Pendientes ({pendingSales.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay cuentas pendientes</p>
              <p className="text-sm">Las mesas abiertas aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pendingSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`${
                          sale.table_number && sale.table_number >= 31 && sale.table_number <= 32 
                            ? 'text-blue-600 border-blue-200' 
                            : sale.table_number && sale.table_number >= 33 && sale.table_number <= 37 
                            ? 'text-green-600 border-green-200' 
                            : 'text-orange-600 border-orange-200'
                        }`}
                      >
                        {sale.table_number && sale.table_number >= 31 && sale.table_number <= 32 
                          ? `🏍️ Mesa ${sale.table_number} - Delivery`
                          : sale.table_number && sale.table_number >= 33 && sale.table_number <= 37 
                          ? `📦 Mesa ${sale.table_number} - Para llevar`
                          : `Mesa ${sale.table_number}`
                        }
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {sale.user?.name || "Usuario"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
                      <span className="text-muted-foreground">
                        {sale.sale_items?.length || 0} producto{sale.sale_items?.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(sale)}
                      className="h-8"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleCloseSale(sale)}
                      className="h-8 bg-green-600 hover:bg-green-700"
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      Cobrar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelSale(sale)}
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para cerrar cuenta pendiente */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Cuenta Pendiente</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">
                    {selectedSale.table_number && selectedSale.table_number >= 31 && selectedSale.table_number <= 32 
                      ? `🏍️ Mesa ${selectedSale.table_number} - Delivery`
                      : selectedSale.table_number && selectedSale.table_number >= 33 && selectedSale.table_number <= 37 
                      ? `📦 Mesa ${selectedSale.table_number} - Para llevar`
                      : `Mesa ${selectedSale.table_number}`
                    }
                  </span>
                  <Badge variant="outline">Pendiente</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Total: {formatCurrency(selectedSale.total_amount)}</p>
                  <p>Productos: {selectedSale.sale_items?.length || 0}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Confirmas que deseas cerrar esta cuenta pendiente? Se registrará como venta completada.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmCloseSale}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Cerrando..." : "Confirmar Cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para cancelar cuenta pendiente */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Cuenta Pendiente</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">
                    {selectedSale.table_number && selectedSale.table_number >= 31 && selectedSale.table_number <= 32 
                      ? `🏍️ Mesa ${selectedSale.table_number} - Delivery`
                      : selectedSale.table_number && selectedSale.table_number >= 33 && selectedSale.table_number <= 37 
                      ? `📦 Mesa ${selectedSale.table_number} - Para llevar`
                      : `Mesa ${selectedSale.table_number}`
                    }
                  </span>
                  <Badge variant="outline" className="text-red-600">Pendiente</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Total: {formatCurrency(selectedSale.total_amount)}</p>
                  <p>Productos: {selectedSale.sale_items?.length || 0}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Motivo de cancelación *</Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Cliente se fue sin pagar, pedido incorrecto, etc."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmCancelSale}
              disabled={isLoading || !cancelReason.trim()}
              variant="destructive"
            >
              {isLoading ? "Cancelando..." : "Confirmar Cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver detalles */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de Cuenta Pendiente</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {selectedSale.table_number && selectedSale.table_number >= 31 && selectedSale.table_number <= 32 
                      ? `🏍️ Mesa ${selectedSale.table_number} - Delivery`
                      : selectedSale.table_number && selectedSale.table_number >= 33 && selectedSale.table_number <= 37 
                      ? `📦 Mesa ${selectedSale.table_number} - Para llevar`
                      : `Mesa ${selectedSale.table_number}`
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Creada: {new Date(selectedSale.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Por: {selectedSale.user?.name || "Usuario"}
                  </p>
                </div>
                <Badge variant="outline" className="text-orange-600">
                  Pendiente
                </Badge>
              </div>

              <div className="border rounded-lg">
                <div className="p-4">
                  <h4 className="font-medium mb-3">Productos</h4>
                  <div className="space-y-2">
                    {selectedSale.sale_items?.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                        <div>
                          <span className="font-medium">{item.product?.name || "Producto"}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            x{item.quantity}
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    )) || (
                      <p className="text-muted-foreground">No hay items</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t mt-3">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-lg">{formatCurrency(selectedSale.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
