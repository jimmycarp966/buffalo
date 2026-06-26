"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { Clock, X, Eye, Plus, DollarSign, Printer, Check, ArrowLeftRight, Merge, Trash2, Pencil } from "lucide-react";
import { TableDetailsModal } from "./TableDetailsModal";
import { PartialPaymentModal } from "./PartialPaymentModal";
import { CloseTableModal } from "./CloseTableModal";
import { ChangeMesaModal } from "./ChangeMesaModal";
import { JoinMesasModal } from "./JoinMesasModal";
import { TableSelectorView } from "./TableSelectorView";
import { getTableRemainingBalance, reduceItemQuantity, removeItemFromTable, cancelTable, clearAccountPrinted, closeTable, getTablePartialPayments, setSaleCustomer } from "@/actions/barActions";
import { getCustomers } from "@/actions/customerActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle } from "lucide-react";
import { PrintAccountTicket } from "./PrintAccountTicket";
import { EditCustomerDataModal } from "./EditCustomerDataModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { brand } from "@/lib/brand";

interface SelectedTableDetailProps {
  table: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function SelectedTableDetail({ table, onClose, onUpdate }: SelectedTableDetailProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showChangeMesaModal, setShowChangeMesaModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const confirm = useConfirm();
  const computedPaidFromPayments = useMemo(
    () => table.sale_payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0,
    [table.sale_payments]
  );
  const [paidAmount, setPaidAmount] = useState(
    table.paid_amount ?? computedPaidFromPayments
  );
  const [remainingBalance, setRemainingBalance] = useState(
    table.remaining_amount ?? table.total_amount - (table.paid_amount ?? computedPaidFromPayments)
  );
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [assigningCustomer, setAssigningCustomer] = useState(false);
  const NONE_CUSTOMER = "__none__";

  useEffect(() => {
    if (table.sale_type === "table") {
      getCustomers().then((res) => {
        if (res.success) setCustomers(res.data || []);
      });
    }
  }, [table.sale_type]);

  const handleAssignCustomer = async (value: string) => {
    if (table.id.startsWith("temp-")) {
      addNotification("info", "Espere a que la mesa se sincronice");
      return;
    }
    const customerId = value === NONE_CUSTOMER ? null : value;
    setAssigningCustomer(true);
    const res = await setSaleCustomer(table.id, customerId);
    if (res.success) {
      addNotification("success", customerId ? "Cliente asignado a la mesa" : "Cliente quitado");
      onUpdate();
    } else {
      addNotification("error", res.message || "Error al asignar el cliente");
    }
    setAssigningCustomer(false);
  };

  useEffect(() => {
    const nextPaid = table.paid_amount ?? computedPaidFromPayments;
    const nextRemaining = table.remaining_amount ?? table.total_amount - nextPaid;
    setPaidAmount(nextPaid);
    setRemainingBalance(Math.max(nextRemaining, 0));

    if (table.status === "pending" && table.remaining_amount === undefined) {
      loadBalance();
    }
  }, [
    table.id,
    table.status,
    table.paid_amount,
    table.remaining_amount,
    table.total_amount,
    computedPaidFromPayments,
  ]);

  const loadBalance = async () => {
    setIsLoadingBalance(true);
    const result = await getTableRemainingBalance(table.id);
    if (result.success && result.data) {
      setRemainingBalance(Math.max(result.data.remainingBalance, 0));
      setPaidAmount(result.data.paidAmount);
    }
    setIsLoadingBalance(false);
  };

  const getTimeOpen = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}min`;
    }
  };

  const getTableLabel = () => {
    if (table.sale_type === 'delivery') {
      return `Delivery`;
    }
    if (table.sale_type === 'counter') {
      return `Mostrador`;
    }
    return `Mesa ${table.table_number || 'N/A'}`;
  };

  const getTicketData = () => ({
    id: table.id,
    sale_number: table.sale_type === 'delivery'
      ? `DEL-${table.sale_number || table.id.slice(0, 8)}`
      : table.sale_type === 'counter'
        ? `MOST-${table.sale_number || table.id.slice(0, 8)}`
        : `MESA-${table.table_number}`,
    total_amount: table.total_amount,
    created_at: table.created_at,
    table_number: table.table_number,
    sale_type: table.sale_type,
    customer_name: table.customer_name,
    customer_phone: table.customer_phone,
    delivery_address: table.delivery_address,
    delivery_notes: table.delivery_notes,
    user: { name: "Cajero" },
    items: table.sale_items?.map((item: any) => ({
      name: item.product?.name || "Producto",
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })) || [],
    payments: [],
  });

  const getPendingItemsCount = () => {
    return table.sale_items?.filter((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) > 0)
      .length ?? 0;
  };

  const handleDeleteItem = async (itemId: string, quantityToRemove: number) => {
    if (table.id.startsWith('temp-')) {
      addNotification("info", "Espere a que la mesa se sincronice");
      return;
    }

    if (!itemId) {
      addNotification("error", "ID de item no valido");
      return;
    }

    const pendingItemsCount = getPendingItemsCount();
    const targetItem = table.sale_items?.find((item: any) => item.id === itemId);

    if (!targetItem) {
      addNotification("error", "Artículo no encontrado");
      return;
    }

    const remainingQty = Math.max(targetItem.remaining_quantity ?? targetItem.quantity ?? 0, 0);

    if (remainingQty === 0) {
      addNotification("error", "El artículo ya no tiene unidades pendientes");
      return;
    }

    const removingAll = quantityToRemove >= remainingQty;

    if (removingAll) {
      await handleRemoveEntireItem(itemId, pendingItemsCount);
    } else {
      await handlePartialRemoval(itemId, quantityToRemove);
    }
  };

  const handlePartialRemoval = async (itemId: string, quantityToRemove: number) => {
    setDeletingItemId(itemId);
    try {
      const result = await reduceItemQuantity(itemId, table.id, quantityToRemove);
      if (result.success) {
        addNotification("success", quantityToRemove === 1 ? "1 unidad eliminada" : `${quantityToRemove} unidades eliminadas`);
        onUpdate();
        loadBalance();
      } else {
        addNotification("error", result.message || "Error al eliminar unidades");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al eliminar unidades");
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleRemoveEntireItem = async (itemId: string, pendingItemsCount: number) => {
    const isLastItem = pendingItemsCount <= 1;
    const targetItem = table.sale_items?.find((item: any) => item.id === itemId);
    const itemSubtotal = targetItem?.subtotal || (targetItem?.quantity * targetItem?.unit_price) || 0;

    if (isLastItem) {
      // Verificar si hay pagos parciales
      const paymentsResult = await getTablePartialPayments(table.id);
      const payments = paymentsResult.success ? paymentsResult.data : [];
      const totalPaidFromPayments = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const hasPartialPayments = payments.length > 0;

      if (hasPartialPayments) {
        // Calcular nuevo saldo después de eliminar
        const newTotal = table.total_amount - itemSubtotal;
        const newBalance = newTotal - totalPaidFromPayments;

        // Mostrar opciones al usuario
      const message = `Estas eliminando el ultimo producto.\n\n` +
          `💰 Total actual: $${table.total_amount.toFixed(2)}\n` +
          `✅ Ya pagado: $${totalPaidFromPayments.toFixed(2)}\n` +
        `Despues de eliminar: $${newTotal.toFixed(2)}\n` +
          `💵 Saldo restante: $${Math.max(0, newBalance).toFixed(2)}${newBalance <= 0 ? ' ✓ (PAGADO)' : ''}`;

        const confirmed = await confirm({
          title: "⚠️ Eliminar Último Producto",
        description: message + `\n\n${newBalance <= 0 ? 'Se CERRARA LA MESA conservando los pagos.' : 'Se eliminara el item y la mesa seguira abierta.'}`,
          confirmText: newBalance <= 0 ? "Cerrar Mesa" : "Eliminar Item",
          cancelText: "Cancelar",
          variant: "destructive"
        });
        if (!confirmed) return;

        setDeletingItemId(itemId);
        try {
          // Eliminar el item primero
          const deleteResult = await removeItemFromTable(itemId, table.id);
          if (!deleteResult.success) {
            addNotification("error", deleteResult.message || "Error al eliminar producto");
            return;
          }

          // Si el saldo restante es <= 0, cerrar la mesa automáticamente
          if (newBalance <= 0) {
            const closeResult = await closeTable(table.id, []);
            if (closeResult.success) {
              addNotification("success", "Mesa cerrada correctamente con los pagos registrados");
              onUpdate();
              onClose();
            } else {
              addNotification("error", closeResult.message || "Error al cerrar mesa");
            }
          } else {
            addNotification("success", "Producto eliminado. La mesa sigue abierta con saldo pendiente.");
            onUpdate();
            loadBalance();
          }
        } catch (error) {
          addNotification("error", "Error inesperado al eliminar producto");
        } finally {
          setDeletingItemId(null);
        }
        return;
      }

      // Sin pagos parciales: comportamiento original (cancelar mesa)
      const confirmed = await confirm({
        title: "⚠️ Cancelar Mesa",
        description: "Estas eliminando el ultimo producto de la mesa.\n\nSe CANCELARA la mesa (sin registrar como venta). Confirmas?",
        confirmText: "Sí, Cancelar Mesa",
        cancelText: "No, Mantener",
        variant: "destructive"
      });
      if (!confirmed) return;
    }

    setDeletingItemId(itemId);
    try {
      if (isLastItem) {
        const result = await cancelTable(table.id);
        if (result.success) {
          addNotification("success", "Mesa cancelada correctamente");
          onUpdate();
          onClose();
        } else {
          addNotification("error", result.message || "No se pudo cancelar la mesa");
        }
      } else {
        const result = await removeItemFromTable(itemId, table.id);
        if (result.success) {
          addNotification("success", "Producto eliminado correctamente");
          onUpdate();
          loadBalance();
        } else {
          addNotification("error", result.message || "Error al eliminar producto");
        }
      }
    } catch (error) {
      addNotification("error", "Error inesperado al eliminar producto");
    } finally {
      setDeletingItemId(null);
    }
  };

  if (showTableSelector) {
    return (
      <TableSelectorView
        currentTable={table}
        onCancel={() => setShowTableSelector(false)}
        onComplete={(newTableNumber) => {
          onUpdate();
          onClose();
        }}
      />
    );
  }

  return (
    <>
      <Card className="sticky top-6 overflow-hidden border border-border bg-card shadow-[0_24px_70px_rgba(0,0,0,0.08)]">
        <CardHeader className="border-b border-border bg-transparent pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-brand mb-2 text-3xl tracking-[0.08em] text-foreground">
                {getTableLabel()}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Abierta desde hace {getTimeOpen(table.created_at)}</span>
              </div>
              {table.sale_type && (table.sale_type === 'counter' || table.sale_type === 'delivery') && (
                <div className="mt-2">
                  <Badge
                    variant={table.kitchen_ready ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {table.kitchen_ready ? "Listo en cocina" : "Esperando cocina"}
                  </Badge>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Información específica para counter/delivery */}
          {(table.sale_type === 'counter' || table.sale_type === 'delivery') && (
            <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4 text-foreground">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  {table.sale_type === 'delivery' && (
                    <>
                      {table.customer_name && (
                        <div className="text-sm">
                          <span className="font-medium">Cliente: </span>
                          <span>{table.customer_name}</span>
                        </div>
                      )}
                      {table.customer_phone && (
                        <div className="text-sm">
                          <span className="font-medium">Teléfono: </span>
                          <span>{table.customer_phone}</span>
                        </div>
                      )}
                      {table.delivery_address && (
                        <div className="text-sm">
                          <span className="font-medium">Dirección: </span>
                          <span>{table.delivery_address}</span>
                        </div>
                      )}
                      {table.delivery_notes && (
                        <div className="text-sm italic text-muted-foreground">
                          <span className="font-medium">Notas: </span>
                          <span>{table.delivery_notes}</span>
                        </div>
                      )}
                    </>
                  )}
                  {table.sale_type === 'counter' && table.customer_name && (
                    <div className="text-sm">
                      <span className="font-medium">Cliente: </span>
                      <span>{table.customer_name}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditCustomerModal(true)}
                  className="h-8 w-8 p-0 ml-2 flex-shrink-0"
                  title="Editar datos del cliente"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Resumen financiero */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4 text-foreground shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total:</span>
              <span className="font-semibold">{formatCurrency(table.total_amount)}</span>
            </div>
            {paidAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pagado:</span>
                  <span className="font-semibold">-{formatCurrency(paidAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Restante:</span>
                  <span className="text-secondary">{formatCurrency(remainingBalance)}</span>
                </div>
              </>
            )}
          </div>

          {/* Cliente / cuenta corriente (solo mesas) */}
          {table.sale_type === 'table' && table.status === 'pending' && (
            <div className="space-y-1.5 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserCircle className="h-4 w-4 text-secondary" />
                <span>Cliente (cuenta corriente)</span>
              </div>
              <Select
                value={table.customer_id || NONE_CUSTOMER}
                onValueChange={handleAssignCustomer}
                disabled={assigningCustomer || table.id.startsWith('temp-')}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CUSTOMER}>Sin asignar</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. Si asignás un cliente, al cerrar la mesa vas a poder cobrarla a su cuenta corriente.
              </p>
            </div>
          )}

          {/* Lista de productos */}
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center justify-between">
                <span>Productos pendientes ({(table.sale_items?.filter((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) > 0).length) || 0})</span>
              </h4>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
                {table.sale_items && table.sale_items.some((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) > 0) ? (
                  table.sale_items
                    .filter((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) > 0)
                    .map((item: any, index: number) => {
                      const remainingQty = Math.max(item.remaining_quantity ?? item.quantity ?? 0, 0);
                      const totalQty = item.quantity ?? remainingQty;
                      const paidQty = Math.max(item.paid_quantity ?? totalQty - remainingQty, 0);
                      const remainingAmount =
                        item.remaining_amount ??
                        remainingQty * (item.unit_price || 0);
                      return (
                        <div key={`${item.id}-${index}`} className="flex justify-between items-center p-3 bg-background border rounded-lg text-sm hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="font-medium">{item.product?.name || "Producto"}</div>
                            <div className="text-xs text-muted-foreground">
                              Pendiente: {remainingQty} / {totalQty}
                              {paidQty > 0 && ` · Pagado: ${paidQty}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-orange-600">
                              {formatCurrency(remainingAmount)}
                            </span>
                            {table.status === 'pending' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-gray-400 hover:text-red-600"
                                    disabled={deletingItemId === item.id || table.id.startsWith('temp-')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {remainingQty > 1 ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteItem(item.id, 1)}
                                        disabled={deletingItemId === item.id}
                                      >
                                        Eliminar 1
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteItem(item.id, remainingQty)}
                                        disabled={deletingItemId === item.id}
                                        className="text-red-600"
                                      >
                                        Eliminar restantes ({remainingQty})
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteItem(item.id, 1)}
                                      disabled={deletingItemId === item.id}
                                      className="text-red-600"
                                    >
                                      Eliminar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No quedan productos pendientes
                  </p>
                )}
              </div>
            </div>

            {table.sale_items && table.sale_items.some((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) <= 0 && (item.paid_quantity ?? 0) > 0) && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center justify-between">
                  <span>Productos pagados</span>
                </h4>
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
                  {table.sale_items
                    .filter((item: any) => (item.remaining_quantity ?? item.quantity ?? 0) <= 0 && (item.paid_quantity ?? 0) > 0)
                    .map((item: any, index: number) => {
                      const paidQty = Math.max(item.paid_quantity ?? item.quantity ?? 0, 0);
                      const paidAmount = item.paid_amount ?? paidQty * (item.unit_price || 0);
                      return (
                        <div key={`paid-${item.id}-${index}`} className="flex justify-between items-center p-3 bg-muted/40 border rounded-lg text-sm">
                          <div>
                            <div className="font-medium text-green-700 flex items-center gap-2">
                              <Check className="h-4 w-4" />
                              {item.product?.name || "Producto pagado"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Pagado: {paidQty}x {formatCurrency(item.unit_price)}
                            </div>
                          </div>
                          <span className="font-semibold text-green-700">{formatCurrency(paidAmount)}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Botones de acción - Solo mostrar para ventas pendientes */}
          {table.status === 'pending' && (
            <div className="space-y-2">
              {table.id.startsWith('temp-') && (
                <div className="p-2 mb-2 bg-blue-50 border border-blue-100 rounded-md flex items-center gap-2 text-blue-600 text-xs animate-pulse">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  Sincronizando con servidor...
                </div>
              )}

              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300"
                onClick={() => setShowDetailsModal(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalles Completos
              </Button>

              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-neutral-100 hover:border-neutral-300"
                onClick={() => {
                  if (table.id.startsWith('temp-')) {
                    addNotification("info", "Espere a que la mesa se sincronice");
                    return;
                  }
                  console.log('🖱️ DEBUG: Click en AGREGAR PRODUCTOS - Abriendo modal');
                  setShowDetailsModal(true);
                }}
                disabled={table.id.startsWith('temp-')}
              >
                <Plus className="mr-2 h-4 w-4" />
                {table.id.startsWith('temp-') ? 'Sincronizando...' : 'Agregar Productos'}
              </Button>

              <Separator className="my-2" />

              {/* Solo mostrar para mesas */}
              {table.sale_type === 'table' && (
                <>
                  <Button
                    variant="outlineNeutral"
                    className="w-full justify-start hover:bg-blue-50 hover:border-blue-300"
                    onClick={() => setShowTableSelector(true)}
                    disabled={table.id.startsWith('temp-')}
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Cambiar Mesa
                  </Button>

                  <Separator className="my-2" />
                </>
              )}

              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-orange-50 hover:border-orange-300"
                onClick={() => setShowPaymentModal(true)}
                disabled={table.id.startsWith('temp-')}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Pago Parcial
              </Button>

              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-purple-50 hover:border-purple-300"
                disabled={table.id.startsWith('temp-')}
                onClick={async () => {
                  // Si la cuenta ya fue impresa, solo limpiar el campo (volver a rojo sin imprimir)
                  if (table.account_printed_at) {
                    const result = await clearAccountPrinted(table.id);
                    if (result.success) {
                      addNotification("success", "Cuenta desmarcada como impresa");
                      onUpdate(); // Actualizar para reflejar el cambio de color
                    } else {
                      addNotification("error", result.message || "Error al desmarcar cuenta");
                    }
                  } else {
                    // Si no fue impresa, imprimir y marcar como impresa (azul)
                    setShowPrint(true);
                  }
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                {table.account_printed_at ? "Quitar impresión" : "Imprimir cuenta"}
              </Button>

              {/* Botón WhatsApp para delivery con teléfono */}
              {table.sale_type === 'delivery' && table.customer_phone && (
                <Button
                  variant="outlineNeutral"
                  className="w-full justify-start hover:bg-green-50 hover:border-green-300 text-green-700"
                  disabled={table.id.startsWith('temp-')}
                  onClick={() => {
                    // Formatear número de teléfono (quitar espacios y guiones)
                    const phone = table.customer_phone.replace(/[\s\-\(\)]/g, '');
                    // Agregar código de país si no lo tiene
                    const formattedPhone = phone.startsWith('+') ? phone : `+54${phone.replace(/^0/, '')}`;

                    // Mensaje prellenado
                    const message = encodeURIComponent(
                      `¡Hola ${table.customer_name || ""}! 👋\n\n` +
                      `Tu pedido #${table.sale_number || table.id.slice(0, 8).toUpperCase()} está ${table.kitchen_ready ? "listo para entregar" : "siendo preparado"}.\n\n` +
                      `Total: ${formatCurrency(table.total_amount)}\n\n` +
                      `¡Gracias por pedir en ${brand.name}!`
                    );

                    // Abrir WhatsApp
                    window.open(`https://wa.me/${formattedPhone.replace('+', '')}?text=${message}`, '_blank');
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Avisar por WhatsApp
                </Button>
              )}

              <Separator className="my-2" />

              <Button
                className="w-full bg-foreground hover:bg-foreground/80 text-background shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowCloseModal(true)}
                disabled={table.id.startsWith('temp-')}
              >
                <Check className="mr-2 h-4 w-4" />
                {table.id.startsWith('temp-') ? 'Sincronizando...' : (table.sale_type === 'table' ? 'CERRAR MESA' : table.sale_type === 'counter' ? 'CERRAR MOSTRADOR' : 'CERRAR DELIVERY')}
              </Button>
            </div>
          )}

          {/* Para ventas completadas o canceladas, solo mostrar botones de visualización */}
          {(table.status === 'completed' || table.status === 'cancelled') && (
            <div className="space-y-2">
              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300"
                onClick={() => setShowDetailsModal(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalles Completos
              </Button>

              <Button
                variant="outlineNeutral"
                className="w-full justify-start hover:bg-purple-50 hover:border-purple-300"
                onClick={() => setShowPrint(true)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Reimprimir Ticket
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      {showDetailsModal && (
        <TableDetailsModal
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          table={table}
          onComplete={() => {
            onUpdate();
            loadBalance();
          }}
        />
      )}

      {showPaymentModal && (
        <PartialPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          table={{
            id: table.id,
            table_number: table.table_number,
            total_amount: table.total_amount,
            created_at: table.created_at,
            sale_items: (table.sale_items || []).map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal ?? item.quantity * item.unit_price,
              product: Array.isArray(item.product)
                ? { name: item.product[0]?.name || "Producto" }
                : item.product
                  ? { name: item.product.name || "Producto" }
                  : null,
              paid_quantity: item.paid_quantity ?? 0,
              remaining_quantity: item.remaining_quantity ?? Math.max(item.quantity - (item.paid_quantity ?? 0), 0),
            })),
          }}
          onComplete={() => {
            onUpdate();
            loadBalance();
          }}
        />
      )}

      {showCloseModal && (
        <CloseTableModal
          open={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          table={table}
          onComplete={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {showChangeMesaModal && (
        <ChangeMesaModal
          open={showChangeMesaModal}
          onClose={() => setShowChangeMesaModal(false)}
          table={table}
          onComplete={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {showJoinModal && (
        <JoinMesasModal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          currentTableNumber={table.table_number}
          onComplete={(saleId) => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {showPrint && (
        <PrintAccountTicket
          tableNumber={table.table_number}
          saleType={table.sale_type}
          saleId={table.id}
          saleNumber={table.sale_number}
          customerName={table.customer_name}
          deliveryAddress={table.delivery_address}
          items={
            // ✅ Filtrar solo items pendientes de pago (remaining_quantity > 0)
            table.sale_items
              ?.filter((item: any) => {
                const remainingQty = item.remaining_quantity ?? item.quantity ?? 0;
                return remainingQty > 0;
              })
              .map((item: any) => {
                const remainingQty = Math.max(item.remaining_quantity ?? item.quantity ?? 0, 0);
                return {
                  name: item.product?.name || item.name,
                  unit_price: item.unit_price,
                  quantity: remainingQty, // Solo mostrar la cantidad pendiente
                  customization: item.customization
                };
              }) || []
          }
          total={
            // ✅ Usar remainingBalance (saldo restante) en lugar del total completo
            // Esto asegura que el ticket muestre el monto pendiente después de pagos parciales
            remainingBalance > 0 ? remainingBalance : 0
          }
          paidAmount={paidAmount > 0 ? paidAmount : undefined}
          onAfterPrint={() => {
            setShowPrint(false);
            onUpdate(); // Actualizar para reflejar el cambio de color
          }}
        />
      )}

      {showEditCustomerModal && (
        <EditCustomerDataModal
          open={showEditCustomerModal}
          onClose={() => setShowEditCustomerModal(false)}
          sale={{
            id: table.id,
            sale_type: table.sale_type,
            customer_name: table.customer_name,
            customer_phone: table.customer_phone,
            delivery_address: table.delivery_address,
          }}
          onComplete={() => {
            onUpdate();
          }}
        />
      )}
    </>
  );
}


