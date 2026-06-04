"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, CheckCircle2, MapPin, Phone, User, CheckCircle, XCircle, Package, Clock, Search, ArrowUpDown, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { completeDelivery, getPaymentMethods } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { PaymentModal } from "./PaymentModal";
import { SimplePaymentModal } from "./SimplePaymentModal";
import { PrintTicket } from "./PrintTicket";
import { DeliverySaleView } from "./DeliverySaleView";
import { SelectedTableDetail } from "./SelectedTableDetail";
import { DeliverySaleForm } from "./DeliverySaleForm";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

interface DeliveryOrder {
  id: string;
  sale_number: string;
  total_amount: number;
  status: "pending" | "completed" | "cancelled";
  kitchen_ready?: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  created_at: string;
  user?: {
    name: string;
  } | { name: string }[] | null;
  sale_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    customization?: string | null;
    product?: {
      name: string;
      unlimited_stock?: boolean;
    } | { name: string; unlimited_stock?: boolean }[] | null;
  }>;
  sale_payments?: Array<{
    id: string;
    amount: number;
    payment_method?: {
      name: string;
    };
  }>;
}

interface DeliveryOrdersListProps {
  cashRegister: any;
  session: any;
  initialOrders?: DeliveryOrder[];
  selectedOrderId?: string;
}

type SortOption = "newest" | "oldest" | "amount_high" | "amount_low" | "name";
type StatusFilter = "all" | "pending" | "completed" | "cancelled";

export function DeliveryOrdersList({ cashRegister, session, initialOrders = [], selectedOrderId }: DeliveryOrdersListProps) {
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders);
  const [isLoading, setIsLoading] = useState(initialOrders.length === 0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [selectedOrderForPanel, setSelectedOrderForPanel] = useState<DeliveryOrder | null>(null);
  const [saleData, setSaleData] = useState<any>(null);
  const [paymentsForPrint, setPaymentsForPrint] = useState<Array<{ payment_method_name: string; amount: number }>>([]);
  const [cartItemsForPrint, setCartItemsForPrint] = useState<any[]>([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  // Estados para filtrado y ordenamiento
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Filtrar y ordenar pedidos
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    // Filtrar por estado
    if (statusFilter !== "all") {
      result = result.filter(order => order.status === statusFilter);
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(order =>
        (order.customer_name?.toLowerCase().includes(query)) ||
        (order.customer_phone?.includes(query)) ||
        (order.delivery_address?.toLowerCase().includes(query)) ||
        (order.sale_number?.toLowerCase().includes(query))
      );
    }

    // Ordenar
    result.sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_high":
          return b.total_amount - a.total_amount;
        case "amount_low":
          return a.total_amount - b.total_amount;
        case "name":
          const nameA = a.customer_name || "";
          const nameB = b.customer_name || "";
          return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
        default:
          return 0;
      }
    });

    return result;
  }, [orders, searchQuery, sortOption, statusFilter]);

  const fetchDeliveryOrders = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        sale_type,
        kitchen_ready,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_notes,
        cash_register_session_id,
        created_at,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          unit_price,
          subtotal,
          customization,
          product:products!sale_items_product_id_fkey(
            name,
            unlimited_stock
          )
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("sale_type", "delivery")
      .order("created_at", { ascending: false });

    if (session?.id) {
      query = query.eq("cash_register_session_id", session.id);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data || []).map((order: any) => {
      const normalized = {
        ...order,
        session_id: order.cash_register_session_id,
        user: Array.isArray(order.user) ? order.user[0] : order.user,
        sale_items:
          order.sale_items?.map((item: any) => ({
            ...item,
            product: Array.isArray(item.product) ? item.product[0] : item.product,
          })) || [],
        sale_payments:
          order.sale_payments?.map((payment: any) => ({
            ...payment,
            payment_method: Array.isArray(payment.payment_method)
              ? payment.payment_method[0]
              : payment.payment_method,
          })) || [],
      };

      const paid =
        normalized.sale_payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;

      // ✅ SIEMPRE calcular el total desde los items si hay items (fuente de verdad)
      const hasItems = normalized.sale_items && normalized.sale_items.length > 0;
      const itemsTotal = hasItems
        ? normalized.sale_items.reduce(
          (sum: number, item: any) => {
            const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null
              ? Number(item.subtotal)
              : (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
            return sum + itemSubtotal;
          },
          0,
        )
        : 0;

      const baseTotal = Number(normalized.total_amount ?? 0);
      // ✅ Si hay items, SIEMPRE usar itemsTotal (fuente de verdad)
      // Solo usar baseTotal si NO hay items
      const finalTotal = hasItems ? itemsTotal : baseTotal;

      return {
        ...normalized,
        total_amount: finalTotal,
        paid_amount: normalized.paid_amount ?? paid,
        remaining_amount:
          normalized.remaining_amount ?? Math.max(finalTotal - paid, 0),
      };
    });
  }, [session?.id]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshedOrders = await fetchDeliveryOrders();
      setOrders(refreshedOrders);
    } catch (error: any) {
      addNotification("error", error.message || "Error al cargar pedidos de delivery");
    } finally {
      setIsLoading(false);
    }
  }, [fetchDeliveryOrders, addNotification]);

  useEffect(() => {
    if (initialOrders.length > 0) {
      setOrders(initialOrders);
      setIsLoading(false);
    }
  }, [initialOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Efecto para abrir el pedido seleccionado desde la notificación de WhatsApp
  useEffect(() => {
    if (selectedOrderId && orders.length > 0) {
      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        setSelectedOrderForPanel(order);
      }
    }
  }, [selectedOrderId, orders]);

  // 🚀 SUPABASE REALTIME - Actualizaciones instantáneas para delivery
  // Hook unificado con throttling y visibilidad de pestaña
  // NOTA: El hook maneja los cambios de datos internamente, no necesita recargar aquí
  const { isConnected: realtimeConnected, lastEventAt } = useRealtimeData(
    'sales',
    orders,
    { column: 'sale_type', value: 'delivery' },
    2000 // throttle 2 segundos
  );

  useEffect(() => {
    if (!lastEventAt) return;
    void loadOrders();
  }, [lastEventAt, loadOrders]);

  const handleCompleteOrder = async (order: DeliveryOrder) => {
    // Verificar si tiene productos de cocina
    const hasKitchenProducts = order.sale_items?.some((item: any) => {
      const product = getProduct(item.product);
      return product?.unlimited_stock === true;
    }) || false;

    // Si tiene productos de cocina, verificar que esté listo
    if (hasKitchenProducts && !order.kitchen_ready) {
      addNotification("error", "El pedido debe estar listo en cocina antes de cerrarse");
      return;
    }

    setSelectedOrder(order);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (payments: Array<{ payment_method_id: string; amount: number }>) => {
    if (!selectedOrder) return;

    setIsLoading(true);
    try {
      // Obtener nombres de métodos de pago
      const paymentMethodsResult = await getPaymentMethods();
      const paymentMethodsMap = new Map<string, string>();
      if (paymentMethodsResult.success && paymentMethodsResult.data) {
        paymentMethodsResult.data.forEach((method: any) => {
          paymentMethodsMap.set(method.id, method.name);
        });
      }

      const result = await completeDelivery(selectedOrder.id, payments);
      if (result.success) {
        addNotification("success", "Pedido completado exitosamente");

        // Preparar datos para impresión
        const saleDataTemp = {
          id: selectedOrder.id,
          sale_number: selectedOrder.sale_number,
          total_amount: selectedOrder.total_amount,
          created_at: selectedOrder.created_at,
          customer_name: selectedOrder.customer_name,
          delivery_address: selectedOrder.delivery_address,
          user: { name: "Cajero" },
        };
        const paymentsDataTemp = payments.map(p => ({
          payment_method_name: paymentMethodsMap.get(p.payment_method_id) || "Método de pago",
          amount: p.amount
        }));
        const cartItemsTemp = selectedOrder.sale_items?.map((item: any) => {
          const product = getProduct(item.product);
          return {
            name: product?.name || "Producto",
            unit_price: item.unit_price,
            quantity: item.quantity,
            subtotal: item.subtotal,
            customization: item.customization,
          };
        }) || [];

        setSaleData(saleDataTemp);
        setPaymentsForPrint(paymentsDataTemp);
        setCartItemsForPrint(cartItemsTemp);

        // Recargar lista
        await loadOrders();
        setIsPaymentModalOpen(false);
        setSelectedOrder(null);
      } else {
        addNotification("error", result.message || "Error al completar pedido");
        setIsLoading(false);
      }
    } catch (error: any) {
      addNotification("error", error.message || "Error al procesar el pago");
      setIsLoading(false);
    }
  };

  const handleNewOrderComplete = async () => {
    setShowNewOrder(false);
    await loadOrders();
  };

  if (!session || session.status !== "open") {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Caja Cerrada</h3>
          <p className="text-muted-foreground">
            Necesitás abrir la caja antes de poder gestionar pedidos de delivery.
          </p>
        </div>
      </Card>
    );
  }

  const getProduct = (product: any) => {
    if (!product) return null;
    if (Array.isArray(product)) return product[0];
    return product;
  };

  const getStatusBadge = (order: DeliveryOrder) => {
    if (order.status === 'cancelled') {
      return (
        <Badge variant="destructive" className="bg-red-600 text-white">
          <XCircle className="h-3 w-3 mr-1 inline" />
          Cancelado
        </Badge>
      );
    }
    if (order.status === 'completed') {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <CheckCircle className="h-3 w-3 mr-1 inline" />
          Completo
        </Badge>
      );
    }
    // Pending
    const hasKitchenProducts = order.sale_items?.some((item: any) => {
      const product = getProduct(item.product);
      return product?.unlimited_stock === true;
    }) || false;

    if (hasKitchenProducts) {
      if (order.kitchen_ready) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">🚴 Pedidos de Delivery</h2>
          <p className="text-muted-foreground">
            {filteredAndSortedOrders.length} de {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
        <Button onClick={() => setShowNewOrder(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Barra de filtros y búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, dirección o número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="completed">Completados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="amount_high">Mayor monto</SelectItem>
              <SelectItem value="amount_low">Menor monto</SelectItem>
              <SelectItem value="name">Por nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {isLoading && orders.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Lista de pedidos (2/3 del ancho en lg) */}
          <div className="lg:col-span-2">
            <Card className="bg-transparent border-0 shadow-none">
              <CardContent className="px-0 pt-0">
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
                    <div className="text-6xl mb-4 grayscale opacity-50">🚴</div>
                    <h3 className="text-lg font-medium mb-2">No hay pedidos</h3>
                    <p className="text-muted-foreground mb-4">
                      Todavía no hay pedidos de delivery registrados
                    </p>
                    <Button onClick={() => setShowNewOrder(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Nuevo Pedido
                    </Button>
                  </div>
                ) : filteredAndSortedOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
                    <div className="text-6xl mb-4 grayscale opacity-50">🔍</div>
                    <h3 className="text-lg font-medium mb-2">Sin resultados</h3>
                    <p className="text-muted-foreground mb-4">
                      No se encontraron pedidos con los filtros seleccionados
                    </p>
                    <Button variant="outline" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>
                      Limpiar filtros
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredAndSortedOrders.map((order, index) => {
                      const totalItems = order.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                      const isSelected = selectedOrderForPanel?.id === order.id;

                      return (
                        <div
                          key={order.id}
                          style={{ animationDelay: `${index * 50}ms` }}
                          className={`
                            relative group cursor-pointer transition-all duration-200
                            animate-in fade-in slide-in-from-bottom-2 fill-mode-both
                          `}
                          onClick={() => setSelectedOrderForPanel(order)}
                        >
                          <div className={`
                            absolute inset-0 rounded-xl transition-all duration-200
                            ${isSelected ? 'bg-foreground/5 ring-1 ring-foreground' : 'hover:bg-foreground/5'}
                          `} />

                          <div className={`
                            relative bg-card rounded-xl border shadow-sm p-4 h-full flex flex-col justify-between
                            transition-all duration-200
                            ${isSelected ? 'border-foreground ring-1 ring-foreground/10' : 'border-border group-hover:border-border/60'}
                          `}>
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-col">
                                <span className={`font-bold text-lg leading-tight ${order.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {order.customer_name || `Pedido #${order.sale_number?.slice(-4) || '???'}`}
                                </span>
                                {order.customer_name && (
                                  <span className="text-xs font-mono text-muted-foreground mt-0.5">
                                    #{order.sale_number || order.id.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <div className="ml-2 flex-shrink-0">
                                {getStatusBadge(order)}
                              </div>
                            </div>

                            {/* Body Information */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-start text-sm text-muted-foreground gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                <span className="line-clamp-2">
                                  {order.delivery_address || 'Sin dirección (Retira en local)'}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Package className="h-3.5 w-3.5" />
                                  <span>{totalItems} items</span>
                                </div>
                                {order.customer_phone && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{order.customer_phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="pt-3 border-t border-dashed border-border flex items-end justify-between mt-auto">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatDate(new Date(order.created_at))}</span>
                              </div>
                              <span className={`text-xl font-bold font-mono tracking-tight ${order.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {formatCurrency(order.total_amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel lateral (1/3 del ancho en xl) */}
          <div className="lg:col-span-1 lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
            {showNewOrder ? (
              <div className="xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
                <DeliverySaleForm
                  session={session}
                  cashRegister={cashRegister}
                  onClose={() => setShowNewOrder(false)}
                  onComplete={handleNewOrderComplete}
                />
              </div>
            ) : selectedOrderForPanel ? (
              <div className="xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
                <SelectedTableDetail
                  table={{
                    ...selectedOrderForPanel,
                    table_number: null,
                    sale_type: 'delivery',
                  }}
                  onClose={() => setSelectedOrderForPanel(null)}
                  onUpdate={async () => {
                    await loadOrders();
                    const refreshedOrders = await fetchDeliveryOrders();
                    const updatedOrder = refreshedOrders.find((o: any) => o.id === selectedOrderForPanel.id);
                    setSelectedOrderForPanel(updatedOrder || null);
                  }}
                />
              </div>
            ) : (
              <Card className="p-6">
                <div className="text-center py-12 space-y-4">
                  <div className="text-7xl">🚴</div>
                  <h3 className="text-xl font-bold text-foreground">
                    Selecciona un pedido
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Hacé clic en un pedido de la lista para ver sus detalles y gestionarlo
                  </p>
                  <Button onClick={() => setShowNewOrder(true)} size="lg" className="mt-4">
                    <Plus className="mr-2 h-5 w-5" />
                    Nuevo Pedido
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Modal de pago */}
      {isPaymentModalOpen && selectedOrder && (
        <SimplePaymentModal
          open={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedOrder(null);
          }}
          total={selectedOrder.total_amount}
          onConfirm={handlePaymentConfirm}
        />
      )}

      {/* Ticket de impresión */}
      {saleData && cartItemsForPrint.length > 0 && (
        <PrintTicket
          sale={saleData}
          items={cartItemsForPrint}
          payments={paymentsForPrint}
          onAfterPrint={() => {
            setSaleData(null);
            setCartItemsForPrint([]);
            setPaymentsForPrint([]);
          }}
        />
      )}

    </div>
  );
}

