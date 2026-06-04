"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, DollarSign, Eye, Printer, CheckCircle, XCircle, Package, Bike, ShoppingBag, UtensilsCrossed, Beer } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTableRemainingBalance, getAllTablesAndOrders } from "@/actions/barActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useTablesStore } from "@/store/tablesStore";
import { useOpenTables } from "@/hooks/useOpenTables";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { CloseTableModal } from "./CloseTableModal";
import { TableDetailsModal } from "./TableDetailsModal";
import { PartialPaymentModal } from "./PartialPaymentModal";
import { PrintTicket } from "./PrintTicket";
import { SelectedTableDetail } from "./SelectedTableDetail";

interface OpenTable {
  id: string;
  sale_number: string;
  total_amount: number;
  status: "pending" | "completed" | "cancelled";
  table_number: number | null;
  sale_type?: "table" | "counter" | "delivery";
  kitchen_ready?: boolean;
  account_printed_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  created_at: string;
  user?: {
    name: string;
  } | { name: string }[] | null;
  sale_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product: {
      name: string;
      cocina_only?: boolean;
    } | { name: string; cocina_only?: boolean }[] | null;
    paid_quantity?: number;
    remaining_quantity?: number;
    paid_amount?: number;
    remaining_amount?: number;
  }>;
  sale_payments?: Array<{
    id: string;
    amount: number;
    payment_method?: {
      name: string;
    };
  }>;
}

// Helper function to get product name safely
const getProductName = (product: { name: string } | { name: string }[] | null): string => {
  if (!product) return "Producto";
  if (Array.isArray(product)) return product[0]?.name || "Producto";
  return product.name || "Producto";
};

export function OpenTablesPanel() {
  const { refreshTables } = useTablesStore();
  const [remainingBalances, setRemainingBalances] = useState<Record<string, number>>({});
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [tableToClose, setTableToClose] = useState<OpenTable | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [tableToView, setTableToView] = useState<OpenTable | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [tableToPay, setTableToPay] = useState<OpenTable | null>(null);
  const [tableToPrint, setTableToPrint] = useState<OpenTable | null>(null);
  const [selectedTable, setSelectedTable] = useState<OpenTable | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Usar el hook useOpenTables para obtener datos con React Query
  const { data: tablesResult, isLoading, refetch: refreshTablesQuery } = useOpenTables();

  // Transformar los datos de la query para mantener compatibilidad
  const tables = tablesResult?.success && tablesResult.data ? tablesResult.data.map((table: any) => ({
    ...table,
    user: Array.isArray(table.user) ? table.user[0] : table.user,
    sale_items: table.sale_items?.map((item: any) => ({
      ...item,
      product: Array.isArray(item.product) ? item.product[0] : item.product,
    })) || [],
    sale_payments: table.sale_payments?.map((payment: any) => ({
      ...payment,
      payment_method: Array.isArray(payment.payment_method) ? payment.payment_method[0] : payment.payment_method,
    })) || [],
  })) : [];

  // 🚀 SUPABASE REALTIME - Sincronizar mesas entre dispositivos
  // Cuando un mozo abre/cierra una mesa, otros dispositivos lo ven al instante
  const { isConnected: realtimeConnected, lastEventAt } = useRealtimeData(
    'sales',
    tables,
    { column: 'sale_type', value: 'table' },
    1000 // throttle 1 segundo para mesas - más rápido
  );

  // Efecto inicial: cuando el canal queda conectado
  useEffect(() => {
    if (realtimeConnected) {
      refreshTablesQuery();
    }
  }, [realtimeConnected, refreshTablesQuery]);

  // Refrescar cuando realmente entra un cambio en la tabla
  useEffect(() => {
    if (!lastEventAt) return;
    refreshTablesQuery();
  }, [lastEventAt, refreshTablesQuery]);

  // Cargar saldos restantes cuando cambian las mesas
  useEffect(() => {
    if (tables.length > 0) {
      loadRemainingBalances();
    }
  }, [tables]);

  const loadRemainingBalances = async () => {
    const balances: Record<string, number> = {};
    // Procesar en lotes más pequeños para evitar bloqueos
    const batchSize = 8; // Procesar 8 mesas simultáneamente
    for (let i = 0; i < tables.length; i += batchSize) {
      const batch = tables.slice(i, i + batchSize);
      const balancePromises = batch.map(async (table: OpenTable) => {
        try {
          const balanceResult = await getTableRemainingBalance(table.id);
          return { id: table.id, balance: balanceResult.success && balanceResult.data ? balanceResult.data.remainingBalance : table.total_amount };
        } catch {
          return { id: table.id, balance: table.total_amount };
        }
      });

      const batchResults = await Promise.all(balancePromises);
      batchResults.forEach(({ id, balance }) => {
        balances[id] = balance;
      });
    }
    setRemainingBalances(balances);
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



  const handleViewDetails = (table: OpenTable) => {
    // Seleccionar la mesa para mostrar el panel lateral
    setSelectedTable(table);
    // También mantener el modal para compatibilidad
    setTableToView(table);
    setDetailsModalOpen(true);
  };

  const loadTables = async () => {
    // Ahora usa React Query para refrescar los datos
    await refreshTablesQuery();
  };

  const handleSelectTable = (table: OpenTable) => {
    setSelectedTable(table);
  };

  const handlePartialPayment = async (table: OpenTable) => {
    setTableToPay(table);
    setPaymentModalOpen(true);
  };

  const handleCloseTable = async (table: OpenTable) => {
    setTableToClose(table);
    setCloseModalOpen(true);
  };

  const handlePrintTable = (table: OpenTable) => {
    setTableToPrint(table);
  };

  // Preparar datos del ticket cuando se selecciona una mesa para imprimir
  const getTicketData = (table: OpenTable) => {
    if (!table) return null;

    return {
      id: table.id,
      sale_number: `MESA-${table.table_number}`,
      total_amount: table.total_amount,
      created_at: table.created_at,
      table_number: table.table_number,
      user: { name: "Cajero" },
      items: table.sale_items?.map((item: any) => ({
        name: item.product?.name || "Producto",
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })) || [],
      payments: [], // Sin pagos en el ticket de mesa abierta
    };
  };

  const getTableLabel = (table: OpenTable) => {
    if (table.sale_type === 'delivery') {
      return (
        <span className="flex items-center gap-1.5">
          <Bike className="h-4 w-4 text-blue-600" />
          Delivery
        </span>
      );
    }
    if (table.sale_type === 'counter') {
      return (
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4 text-orange-600" />
          Mostrador
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
        Mesa {table.table_number || 'N/A'}
      </span>
    );
  };

  const getStatusBadge = (table: OpenTable) => {
    if (table.status === 'cancelled') {
      return (
        <Badge variant="destructive" className="bg-red-600 text-white">
          <XCircle className="h-3 w-3 mr-1 inline" />
          Cancelado
        </Badge>
      );
    }
    if (table.status === 'completed') {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <CheckCircle className="h-3 w-3 mr-1 inline" />
          Completo
        </Badge>
      );
    }
    // Pending
    const hasKitchenProducts = table.sale_items?.some((item: any) =>
      item.product?.cocina_only === true
    ) || false;

    if (hasKitchenProducts && (table.sale_type === 'counter' || table.sale_type === 'delivery')) {
      if (table.kitchen_ready) {
        return (
          <Badge variant="default" className="bg-blue-600 text-white">
            ✅ Listo en cocina
          </Badge>
        );
      } else {
        return (
          <Badge variant="secondary" className="bg-orange-500 text-white">
            <Clock className="h-3 w-3 mr-1 inline" />
            Preparando
          </Badge>
        );
      }
    }

    return (
      <Badge variant="secondary" className="bg-orange-500 text-white">
        <Clock className="h-3 w-3 mr-1 inline" />
        Pendiente
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Lista de pedidos (2/3 del ancho en xl) */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Beer className="h-6 w-6 text-amber-500" />
              Mesas y Pedidos
            </CardTitle>
            <CardDescription>
              {tables.length} {tables.length === 1 ? "pedido" : "pedidos"} total{tables.length > 1 ? "es" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 text-muted-foreground/30">
                  <Beer className="h-16 w-16" />
                </div>
                <h3 className="text-lg font-medium mb-2">No hay pedidos</h3>
                <p className="text-muted-foreground">
                  Todavía no hay mesas o pedidos registrados
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Pedido</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Fecha</th>
                        <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
                        <th className="px-4 py-3 text-center text-sm font-medium">Items</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Restante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tables.map((table: OpenTable) => {
                        const totalItems = table.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                        const remaining = remainingBalances[table.id] !== undefined ? remainingBalances[table.id] : table.total_amount;

                        return (
                          <tr
                            key={table.id}
                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedTable?.id === table.id ? 'bg-black/5 ring-2 ring-black/20' : ''
                              } ${table.status === 'cancelled' ? 'opacity-60' : ''
                              } ${table.status === 'completed' ? 'bg-green-50/30' :
                                table.account_printed_at ? 'bg-blue-50/30' :
                                  table.status === 'pending' ? 'bg-orange-50/30' : ''
                              }`}
                            onClick={() => handleSelectTable(table)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`font-medium ${table.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                                  {getTableLabel(table)}
                                </span>
                                <span className={`text-xs ${table.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                                  {table.sale_number}
                                  {table.customer_name && ` - ${table.customer_name}`}
                                </span>
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-sm ${table.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                              {formatDate(new Date(table.created_at))}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getStatusBadge(table)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                                <Package className="h-4 w-4" />
                                <span>{totalItems}</span>
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-right ${table.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                              <span className="font-bold text-foreground">
                                {formatCurrency(table.total_amount)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {table.status === 'pending' && remaining > 0 ? (
                                <span className="text-sm font-medium text-orange-600">
                                  {formatCurrency(remaining)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panel lateral (1/3 del ancho en xl) */}
      <div className="lg:col-span-1">
        {selectedTable ? (
          <SelectedTableDetail
            table={selectedTable}
            onClose={() => setSelectedTable(null)}
            onUpdate={async () => {
              await loadTables();
              // Actualizar la mesa seleccionada con datos frescos
              const result = await getAllTablesAndOrders();
              if (result.success) {
                const updatedTableRaw = result.data.find((t: any) => t.id === selectedTable.id);
                if (updatedTableRaw) {
                  // Transformar los datos para normalizar arrays/objetos
                  const updatedTable = {
                    ...updatedTableRaw,
                    user: Array.isArray(updatedTableRaw.user) ? updatedTableRaw.user[0] : updatedTableRaw.user,
                    sale_items: updatedTableRaw.sale_items?.map((item: any) => ({
                      ...item,
                      product: Array.isArray(item.product) ? item.product[0] : item.product,
                    })) || [],
                    sale_payments: updatedTableRaw.sale_payments?.map((payment: any) => ({
                      ...payment,
                      payment_method: Array.isArray(payment.payment_method) ? payment.payment_method[0] : payment.payment_method,
                    })) || [],
                  };
                  setSelectedTable(updatedTable);
                } else {
                  // Si la mesa ya no existe, deseleccionar
                  setSelectedTable(null);
                }
              }
            }}
          />
        ) : (
          <Card className="p-6 sticky top-6">
            <div className="text-center py-12 space-y-4">
              <div className="text-muted-foreground/20">
                <UtensilsCrossed className="h-24 w-24 mx-auto" strokeWidth={1} />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Selecciona un pedido
              </h3>
              <p className="text-sm text-muted-foreground">
                Hacé clic en un pedido de la lista para ver sus detalles y gestionarlo
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Modales */}
      {tableToView && (
        <TableDetailsModal
          open={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setTableToView(null);
          }}
          table={tableToView}
          onComplete={async () => {
            console.log("🔍 DEBUG onComplete - Iniciando actualización de datos...");
            await loadTables();
            console.log("🔍 DEBUG onComplete - Tablas refrescadas, obteniendo datos frescos...");

            // Obtener datos frescos directamente
            const result = await getAllTablesAndOrders();
            console.log("🔍 DEBUG onComplete - Datos frescos obtenidos:", result);

            if (result.success) {
              const updatedTableRaw = result.data.find((t: any) => t.id === tableToView.id);
              console.log("🔍 DEBUG onComplete - Mesa actualizada encontrada:", updatedTableRaw);

              if (updatedTableRaw) {
                // Transformar los datos para normalizar arrays/objetos
                const updatedTable = {
                  ...updatedTableRaw,
                  user: Array.isArray(updatedTableRaw.user) ? updatedTableRaw.user[0] : updatedTableRaw.user,
                  sale_items: updatedTableRaw.sale_items?.map((item: any) => ({
                    ...item,
                    product: Array.isArray(item.product) ? item.product[0] : item.product,
                  })) || [],
                  sale_payments: updatedTableRaw.sale_payments?.map((payment: any) => ({
                    ...payment,
                    payment_method: Array.isArray(payment.payment_method) ? payment.payment_method[0] : payment.payment_method,
                  })) || [],
                };
                console.log("✅ DEBUG onComplete - Actualizando tableToView con datos frescos");
                console.log("🔍 DEBUG onComplete - Items antes:", tableToView.sale_items?.length);
                console.log("🔍 DEBUG onComplete - Items después:", updatedTable.sale_items?.length);
                // Forzar re-render creando un nuevo objeto
                setTableToView(updatedTable);
                // También actualizar selectedTable
                if (selectedTable?.id === updatedTable.id) {
                  setSelectedTable(updatedTable);
                }
              } else {
                console.log("⚠️ DEBUG onComplete - Mesa no encontrada, puede que se haya cancelado");
                // Si no se encuentra la mesa, puede que se haya cancelado
                setDetailsModalOpen(false);
                setTableToView(null);
                setSelectedTable(null);
              }
            } else {
              console.log("❌ DEBUG onComplete - Error al obtener datos frescos:", result.message);
            }
          }}
        />
      )}

      {tableToClose && (
        <CloseTableModal
          open={closeModalOpen}
          onClose={() => {
            setCloseModalOpen(false);
            setTableToClose(null);
          }}
          table={tableToClose}
          onComplete={async () => {
            await loadTables();
            // Si el pedido cerrado es el seleccionado, deseleccionarlo
            if (selectedTable?.id === tableToClose.id) {
              setSelectedTable(null);
            }
          }}
        />
      )}

      {tableToPay && (
        <PartialPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setTableToPay(null);
          }}
          table={tableToPay}
          onComplete={async () => {
            await loadTables();
            // Actualizar la mesa seleccionada con datos frescos
            if (selectedTable?.id === tableToPay.id) {
              const result = await getAllTablesAndOrders();
              if (result.success) {
                const updatedTableRaw = result.data.find((t: any) => t.id === selectedTable.id);
                if (updatedTableRaw) {
                  // Transformar los datos para normalizar arrays/objetos
                  const updatedTable = {
                    ...updatedTableRaw,
                    user: Array.isArray(updatedTableRaw.user) ? updatedTableRaw.user[0] : updatedTableRaw.user,
                    sale_items: updatedTableRaw.sale_items?.map((item: any) => ({
                      ...item,
                      product: Array.isArray(item.product) ? item.product[0] : item.product,
                    })) || [],
                    sale_payments: updatedTableRaw.sale_payments?.map((payment: any) => ({
                      ...payment,
                      payment_method: Array.isArray(payment.payment_method) ? payment.payment_method[0] : payment.payment_method,
                    })) || [],
                  };
                  setSelectedTable(updatedTable);
                }
              }
            }
          }}
        />
      )}

      {/* Mostrar PrintTicket cuando se selecciona imprimir una mesa */}
      {tableToPrint && getTicketData(tableToPrint) && (
        <PrintTicket
          sale={getTicketData(tableToPrint)!}
          items={getTicketData(tableToPrint)!.items}
          payments={getTicketData(tableToPrint)!.payments}
          onAfterPrint={() => {
            setTableToPrint(null);
          }}
        />
      )}
    </div>
  );
}
