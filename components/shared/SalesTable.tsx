"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, ChevronLeft, ChevronRight, Trash2, Printer, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SaleDetailModal } from "./SaleDetailModal";
import { brand } from "@/lib/brand";
import { SalesFiltersPanel, type SalesFilters } from "./SalesFilters";
import { useAuthStore } from "@/store/authStore";
import { deleteSale } from "@/actions/saleActions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBusinessDateString, getBusinessDayRange, formatBusinessRange } from "@/lib/businessDay";

interface Sale {
  id: string;
  sale_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  table_number?: number;
  sale_type?: "table" | "counter" | "delivery";
  customer_name?: string;
  user?: { name: string };
  cash_register_sessions?: {
    id: string;
    shift: "morning" | "afternoon" | "night";
    area: string;
    opened_at: string;
  } | null;
  sale_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product: { name: string };
  }>;
  sale_payments?: Array<{
    id: string;
    amount: number;
    payment_method: { name: string; id?: string };
  }>;
  invoice?: {
    id: string;
    invoice_number: string;
    status: string;
    thermal_content?: string | null;
  } | null;
}

interface SalesTableProps {
  sales: Sale[];
  paymentMethods?: Array<{ id: string; name: string }>;
}

const createDefaultFilters = (): SalesFilters => {
  const businessDate = getBusinessDateString();
  return {
    search: "",
    dateFrom: businessDate,
    dateTo: businessDate,
    tableNumber: "all",
    shift: "all",
    saleType: "all",
    status: "all",
    hasInvoice: "all",
    paymentMethod: "all",
  };
};

const getBusinessBounds = (dateFrom?: string, dateTo?: string) => {
  // Si ambas fechas son iguales, usar el rango completo de ese día
  if (dateFrom && dateTo && dateFrom === dateTo) {
    const range = getBusinessDayRange(dateFrom);
    // Verificar que start < end (start debería ser 06:00 del día, end 03:00 del día siguiente)
    if (range.start && range.end && range.start < range.end) {
      return { start: range.start, end: range.end };
    }
    // Si están invertidos, corregirlos
    return { start: range.end, end: range.start };
  }

  // Si solo hay una fecha, usar su rango completo
  if (dateFrom && !dateTo) {
    const range = getBusinessDayRange(dateFrom);
    if (range.start && range.end && range.start < range.end) {
      return { start: range.start, end: range.end };
    }
    return { start: range.end, end: range.start };
  }

  if (!dateFrom && dateTo) {
    const range = getBusinessDayRange(dateTo);
    if (range.start && range.end && range.start < range.end) {
      return { start: range.start, end: range.end };
    }
    return { start: range.end, end: range.start };
  }

  // Si hay dos fechas diferentes, usar el inicio de la primera y el final de la última
  const fromRange = dateFrom ? getBusinessDayRange(dateFrom) : null;
  const toRange = dateTo ? getBusinessDayRange(dateTo) : null;

  const start = fromRange?.start ?? toRange?.start ?? null;
  const end = toRange?.end ?? fromRange?.end ?? null;

  // Asegurar que start sea menor que end
  if (start && end && start > end) {
    return { start: end, end: start };
  }

  return { start, end };
};

function generateSaleDescription(sale: Sale): string {
  // Si tiene mesa, es del bar
  if (sale.table_number) {
    return `BAR - Mesa ${sale.table_number}`;
  }
  
  // Si no tiene mesa, identificar por tipo de venta
  if (sale.sale_type === "counter") {
    // Mostrador
    if (sale.customer_name) {
      return `MOSTRADOR - ${sale.customer_name}`;
    }
    return "MOSTRADOR";
  }
  
  if (sale.sale_type === "delivery") {
    // Delivery
    if (sale.customer_name) {
      return `DELIVERY - ${sale.customer_name}`;
    }
    return "DELIVERY";
  }
  
  // Si es tipo "table" pero no tiene mesa, mostrar productos como antes
  if (sale.sale_items && sale.sale_items.length > 0) {
    const firstProduct = sale.sale_items[0].product.name;
    const itemsCount = sale.sale_items.length;
    
    if (itemsCount === 1) {
      return firstProduct;
    } else if (itemsCount === 2) {
      const secondProduct = sale.sale_items[1].product.name;
      return `${firstProduct}, ${secondProduct}`;
    } else {
      return `${firstProduct} (+${itemsCount - 1} más)`;
    }
  }
  
  return `VENTA - ${sale.sale_number}`;
}

export function SalesTable({ sales, paymentMethods = [] }: SalesTableProps) {
  // Siempre calcular los filtros por defecto con el día actual
  // Esto asegura que siempre se muestren las ventas del día actual por defecto
  const defaultFiltersRef = useRef<SalesFilters>(createDefaultFilters());
  
  const [filters, setFilters] = useState<SalesFilters>(() => {
    // Siempre usar el día actual al inicializar el componente
    // Esto garantiza que cada vez que se carga la página, se muestren las ventas del día actual
    return createDefaultFilters();
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const itemsPerPage = 20;
  
  const { user } = useAuthStore();
  const router = useRouter();

  // Obtener mesas únicas disponibles
  const availableTables = useMemo(() => {
    const tables = new Set<number>();
    sales.forEach((sale) => {
      if (sale.table_number) {
        tables.add(sale.table_number);
      }
    });
    return Array.from(tables).sort((a, b) => a - b);
  }, [sales]);

  const handleDeleteSale = async (sale: Sale) => {
    console.log("🔍 DEBUG SalesTable: Iniciando eliminación", { 
      saleId: sale.id, 
      saleNumber: sale.sale_number,
      status: sale.status,
      userRole: user?.role 
    });
    
    const statusText = sale.status === "completed" ? "completada" : sale.status === "pending" ? "pendiente" : "cancelada";
    const warningText = sale.status === "completed" 
      ? "⚠️ Esta venta ya está completada. Al eliminarla se restará del arqueo del turno correspondiente."
      : "Esta acción no se puede deshacer.";
    
    if (!confirm(`¿Estás seguro de eliminar la venta ${generateSaleDescription(sale)}?\n\nEstado: ${statusText}\n\n${warningText}`)) {
      console.log("🔍 DEBUG SalesTable: Usuario canceló eliminación");
      return;
    }
    
    console.log("🔍 DEBUG SalesTable: Usuario confirmó eliminación");
    setDeletingId(sale.id);
    
    try {
      console.log("🔍 DEBUG SalesTable: Llamando a deleteSale");
      const result = await deleteSale(sale.id);
      
      console.log("🔍 DEBUG SalesTable: Resultado de deleteSale", result);
      
      if (result.success) {
        console.log("🔍 DEBUG SalesTable: Eliminación exitosa, mostrando toast");
        toast.success("Venta eliminada exitosamente");
        console.log("🔍 DEBUG SalesTable: Refrescando router");
        router.refresh();
      } else {
        console.log("🔍 DEBUG SalesTable: Error en eliminación", result.message);
        toast.error(result.message || "Error al eliminar la venta");
      }
    } catch (error) {
      console.error("🔍 DEBUG SalesTable: Error en handleDeleteSale", error);
      toast.error("Error al eliminar la venta");
    } finally {
      console.log("🔍 DEBUG SalesTable: Finalizando eliminación");
      setDeletingId(null);
    }
  };

  const dateBounds = useMemo(
    () => getBusinessBounds(filters.dateFrom, filters.dateTo),
    [filters.dateFrom, filters.dateTo],
  );

  const businessRangeLabel = useMemo(() => {
    if (dateBounds.start && dateBounds.end) {
      return formatBusinessRange(dateBounds.start, dateBounds.end);
    }
    return null;
  }, [dateBounds.start, dateBounds.end]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Búsqueda por texto
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const description = generateSaleDescription(sale).toLowerCase();
        const matchesSearch =
          sale.sale_number.toLowerCase().includes(searchLower) ||
          sale.user?.name?.toLowerCase().includes(searchLower) ||
          description.includes(searchLower) ||
          sale.sale_items?.some((item) =>
            item.product?.name?.toLowerCase().includes(searchLower)
          );
        if (!matchesSearch) return false;
      }

      // Filtro por fecha (usando zona horaria Argentina GMT-3)
      if (dateBounds.start || dateBounds.end) {
        const saleDate = new Date(sale.created_at);
        if (dateBounds.start && saleDate < dateBounds.start) return false;
        if (dateBounds.end && saleDate > dateBounds.end) return false;
      }

      // Filtro por mesa
      if (filters.tableNumber && filters.tableNumber !== "all") {
        if (sale.table_number?.toString() !== filters.tableNumber) return false;
      }

      // Filtro por turno
      if (filters.shift !== "all") {
        const session = Array.isArray(sale.cash_register_sessions) 
          ? sale.cash_register_sessions[0] 
          : sale.cash_register_sessions;
        if (session?.shift !== filters.shift) return false;
      }

      // Filtro por tipo de venta
      if (filters.saleType !== "all") {
        if (sale.sale_type !== filters.saleType) return false;
      }

      // Filtro por estado
      if (filters.status !== "all") {
        if (sale.status !== filters.status) return false;
      }

      // Filtro por facturación
      if (filters.hasInvoice !== "all") {
        const hasInvoice = !!sale.invoice?.id;
        if (filters.hasInvoice === "yes" && !hasInvoice) return false;
        if (filters.hasInvoice === "no" && hasInvoice) return false;
      }

      // Filtro por método de pago
      if (filters.paymentMethod !== "all") {
        const hasPaymentMethod = sale.sale_payments?.some(
          (payment) => payment.payment_method?.id === filters.paymentMethod
        );
        if (!hasPaymentMethod) return false;
      }

      return true;
    });
  }, [sales, filters]);

  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedSale(null);
  };

  const getCashPrinterConfig = async () => {
    const [{ getPrinterConfig }] = await Promise.all([import("@/actions/configActions")]);
    const configResult = await getPrinterConfig();

    if (configResult.success && configResult.data?.cash) {
      const cashConfig = configResult.data.cash;
      return {
        printerName: cashConfig.name || "Caja",
        width: cashConfig.width || 32,
      };
    }

    return {
      printerName: "Caja",
      width: 32,
    };
  };

  const handleReprintSale = async (sale: Sale) => {
    setPrintingId(sale.id);
    try {
      if (sale.invoice?.id) {
        const [{ getThermalInvoiceContent }] = await Promise.all([import("@/actions/invoiceActions")]);
        const thermalResult = await getThermalInvoiceContent(sale.invoice.id);

        if (!thermalResult.success || !thermalResult.content) {
          throw new Error(thermalResult.message || "No se pudo obtener la factura para reimprimir");
        }

        const { printToLocal } = await import("@/lib/localPrinter");
        const { printerName, width } = await getCashPrinterConfig();
        const printResult = await printToLocal(thermalResult.content, printerName, "cash", width);

        if (!printResult.success) {
          throw new Error(printResult.message || "Error al enviar la factura a la impresora");
        }

        toast.success("Factura enviada nuevamente a la impresora");
        return;
      }

      const [{ generateCashierTicket, printToLocal }] = await Promise.all([import("@/lib/localPrinter")]);
      const { printerName, width } = await getCashPrinterConfig();

      const ticketContent = generateCashierTicket({
        header: brand.name,
        businessInfo: {
          address: "Leandro Araoz 95",
          phone: "",
          cuit: "",
        },
        saleType: sale.sale_type,
        tableNumber: sale.table_number,
        lines: [
          { label: "Fecha", value: new Date(sale.created_at).toLocaleDateString("es-AR") },
          { label: "Ticket", value: sale.sale_number || sale.id },
        ],
        items: (sale.sale_items || []).map((item) => ({
          quantity: item.quantity,
          name: item.product?.name || "Producto",
          unit_price: item.unit_price,
        })),
        total: sale.total_amount,
        payments: (sale.sale_payments || []).map((payment) => ({
          method: payment.payment_method?.name || "Pago",
          amount: payment.amount,
        })),
        footer: "Gracias por su compra",
      });

      const printResult = await printToLocal(ticketContent, printerName, "cash", width);

      if (!printResult.success) {
        throw new Error(printResult.message || "Error al reenviar el ticket");
      }

      toast.success("Ticket reenviado a la impresora");
    } catch (error: any) {
      console.error("Error reimprimiendo ticket:", error);
      toast.error(error.message || "No se pudo reimprimir esta venta");
    } finally {
      setPrintingId(null);
    }
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  return (
    <div className="space-y-4">
      <SalesFiltersPanel
        filters={filters}
        onFiltersChange={(updatedFilters) => setFilters(updatedFilters)}
        availablePaymentMethods={paymentMethods}
        availableTables={availableTables}
        defaultFilters={defaultFiltersRef.current}
      />

      {businessRangeLabel && (
        <p className="text-xs text-muted-foreground">
          Ventas mostradas entre {businessRangeLabel}. Cada fecha cubre de 06:00 a 03:00 del día siguiente (hora Buenos Aires).
        </p>
      )}

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Identificación</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Cajero</th>
                <th className="px-4 py-3 text-center text-sm font-medium hidden sm:table-cell">Items</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                      <p>No se encontraron ventas</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => (
                  <tr key={sale.id} className={`hover:bg-muted/50 ${sale.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className={`font-medium ${sale.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                          {generateSaleDescription(sale)}
                        </div>
                        <div className={`text-xs ${sale.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                          {sale.sale_number}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm hidden sm:table-cell ${sale.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                      {formatDate(new Date(sale.created_at))}
                    </td>
                    <td className={`px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell ${sale.status === 'cancelled' ? 'line-through' : ''}`}>
                      {sale.user?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <Badge variant="secondary" className={sale.status === 'cancelled' ? 'opacity-60' : ''}>
                        {sale.sale_items?.length || 0} items
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${sale.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      <div className="flex items-center justify-end gap-2">
                        {sale.invoice && (
                          <Badge variant="outline" className="text-[10px] font-semibold text-blue-700 border-blue-200 bg-blue-50">
                            F
                          </Badge>
                        )}
                        <span>{formatCurrency(sale.total_amount)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          sale.status === "completed"
                            ? "success"
                            : sale.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                        }
                        className={sale.status === 'cancelled' ? 'opacity-60' : ''}
                      >
                        {sale.status === "completed" ? "Completada" : 
                         sale.status === "cancelled" ? "Cancelada" : 
                         "Pendiente"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(sale)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReprintSale(sale)}
                          disabled={printingId === sale.id}
                          title={sale.invoice ? "Reimprimir factura" : "Reimprimir ticket"}
                        >
                          {printingId === sale.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        {user?.role === 'admin' && sale.status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSale(sale)}
                            disabled={deletingId === sale.id}
                            title="Eliminar venta"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, filteredSales.length)} de{" "}
            {filteredSales.length} ventas
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <SaleDetailModal
        open={isDetailModalOpen}
        onClose={handleCloseModal}
        sale={selectedSale}
      />
    </div>
  );
}



