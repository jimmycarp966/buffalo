import { getSales, getPaymentMethods } from "@/actions/saleActions";
import { SalesTable } from "@/components/shared/SalesTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AfipTestButton } from "@/components/shared/AfipTestButton";
import { getBusinessDateString, getBusinessDayRange } from "@/lib/businessDay";

export default async function VentasPage() {
  const [salesResult, paymentMethodsResult] = await Promise.all([
    getSales(),
    getPaymentMethods(),
  ]);

  const sales = salesResult.data || [];
  const paymentMethods = paymentMethodsResult.success ? (paymentMethodsResult.data || []) : [];

  // Calcular estadísticas
  const totalSales = sales.length || 0;
  const totalAmount = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

  const currentBusinessDate = getBusinessDateString();
  const { start: businessStart, end: businessEnd } = getBusinessDayRange(currentBusinessDate);
  
  const todaySales = sales.filter((sale) => {
    const saleDate = new Date(sale.created_at);
    return saleDate >= businessStart && saleDate <= businessEnd;
  }) || [];
  const todayAmount = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

  // Calcular promedio
  const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-secondary/85">Dashboard</p>
        <h1 className="font-brand text-4xl tracking-tight text-white">Ventas</h1>
        <p className="text-white/58">Historial completo de todas las ventas</p>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalSales}</div>
            <p className="text-xs text-muted-foreground">Todas las ventas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Ingresos totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <TrendingUp className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{todaySales.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(todayAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <CreditCard className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">Por venta</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de ventas */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Historial de Ventas</CardTitle>
              <CardDescription>
                {sales.length || 0} ventas registradas
              </CardDescription>
            </div>
            <AfipTestButton />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <SalesTable sales={sales} paymentMethods={paymentMethods} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

