"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, CheckCircle, CreditCard, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getRecentCounterSales, getRecentDeliverySales } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { getErrorMessage } from "@/lib/types";

interface SaleHistoryItem {
  id: string;
  sale_number: string;
  total_amount: number;
  status: "pending" | "completed";
  created_at: string;
  customer_name?: string | null;
  user?: {
    name: string;
  };
  sale_items?: Array<{
    id: string;
    quantity: number;
    product: {
      name: string;
    };
  }>;
  sale_payments?: Array<{
    id: string;
    amount: number;
    payment_method: {
      name: string;
    };
  }>;
}

interface SalesHistorySectionProps {
  saleType: "counter" | "delivery";
  sessionId: string;
}

const ITEMS_PER_PAGE = 20;

export function SalesHistorySection({ saleType, sessionId }: SalesHistorySectionProps) {
  const [sales, setSales] = useState<SaleHistoryItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const loadSales = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = saleType === "counter"
        ? await getRecentCounterSales(sessionId, ITEMS_PER_PAGE, offset)
        : await getRecentDeliverySales(sessionId, ITEMS_PER_PAGE, offset);

      if (result.success) {
        // Transformar los datos para que coincidan con la interfaz
        const transformedSales: SaleHistoryItem[] = (result.data || []).map((sale: any) => ({
          id: sale.id,
          sale_number: sale.sale_number,
          total_amount: sale.total_amount,
          status: sale.status,
          created_at: sale.created_at,
          customer_name: sale.customer_name,
          user: Array.isArray(sale.user) ? sale.user[0] : sale.user,
          sale_items: sale.sale_items?.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            product: Array.isArray(item.product) ? item.product[0] : item.product,
          })) || [],
          sale_payments: sale.sale_payments?.map((payment: any) => ({
            id: payment.id,
            amount: payment.amount,
            payment_method: Array.isArray(payment.payment_method)
              ? payment.payment_method[0]
              : payment.payment_method,
          })) || [],
        }));
        setSales(transformedSales);
        setTotalItems(result.total || 0);
      } else {
        addNotification("error", result.message || "Error al cargar ventas");
      }
    } catch (error: unknown) {
      addNotification("error", "Error al cargar historial de ventas");
      console.error("Error loading sales:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos iniciales y cuando cambian las dependencias
  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentPage, saleType]);

  // Polling automático cada 30 segundos (reducido de 5s para optimizar CPU)
  // Solo actualizar si la pestaña está visible y hay sesión
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      // Solo actualizar si la pestaña está visible
      if (!document.hidden) {
        loadSales();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentPage, saleType]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {saleType === "counter" ? "🛒 Historial de Ventas de Mostrador" : "🚴 Historial de Pedidos de Delivery"}
          </CardTitle>
          {totalItems > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalItems} venta{totalItems !== 1 ? 's' : ''} total{totalItems !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">
              {saleType === "counter" ? "🛒" : "🚴"}
            </div>
            <h3 className="text-lg font-medium mb-2">No hay ventas registradas</h3>
            <p className="text-muted-foreground text-sm">
              Las ventas aparecerán aquí una vez que se realicen
            </p>
          </div>
        ) : (
          <>
            {/* Tabla de ventas */}
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {saleType === "counter" ? "Nombre" : "Número"}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Fecha</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
                      <th className="px-4 py-3 text-center text-sm font-medium hidden sm:table-cell">Items</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                      <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Métodos de Pago</th>
                      <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Cajero</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sales.map((sale) => {
                      const isCompleted = sale.status === "completed";
                      const totalItems = sale.sale_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                      return (
                        <tr
                          key={sale.id}
                          className={`hover:bg-muted/50 transition-colors ${isCompleted
                              ? "bg-green-50/30"
                              : "bg-orange-50/30"
                            }`}
                        >
                          <td className="px-4 py-3">
                            {saleType === "counter" ? (
                              <span className="font-semibold">
                                {sale.customer_name || sale.sale_number}
                              </span>
                            ) : (
                              <span className="font-semibold">{sale.sale_number}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                            {formatDate(new Date(sale.created_at))}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={isCompleted ? "default" : "secondary"}
                              className={isCompleted ? "bg-green-600 text-white" : "bg-orange-500 text-white"}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1 inline" />
                                  Completa
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3 mr-1 inline" />
                                  Preparando
                                </>
                              )}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <Package className="h-4 w-4" />
                              <span>{totalItems}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-buffalo-caramel">
                              {formatCurrency(sale.total_amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex flex-col gap-1">
                              {sale.sale_payments && sale.sale_payments.length > 0 ? (
                                sale.sale_payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                      {payment.payment_method?.name || "Sin método"}
                                    </span>
                                    <span className="font-medium">
                                      {formatCurrency(payment.amount)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin pagos</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                            {sale.user?.name || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || isLoading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

