"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  Loader2,
  Users,
  Clock,
  Target,
  TrendingDown,
  Award,
  Calendar
} from "lucide-react";
import {
  getSalesStats,
  getTopSellingProducts,
  getSalesByPaymentMethod,
  getSalesByCashRegister,
  getIncomeVsExpenses,
  getSalesByEmployee,
  getProfitabilityReport,
  getCategoryPerformance,
  getSalesComparison
} from "@/actions/reportActions";
import { formatCurrency } from "@/lib/utils";
import { getBusinessDateString, argDayToUtcRange } from "@/lib/businessDay";
import { ReportsCharts, ExportButtons } from "./LazyComponents";
import { ReportFilters, type ReportFilters as ReportFiltersType } from "./ReportFilters";

// Formatea un "YYYY-MM-DD" a texto legible en es-AR sin corrimiento de zona
const fmtDayLabel = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

interface ReportData {
  stats: any;
  topProducts: any[];
  paymentMethods: any[];
  cashRegisters: any[];
  incomeExpenses: any;
  salesByEmployee: any[];
  profitabilityReport: any[];
  categoryPerformance: any[];
  salesComparison: any;
}

export function ReportsContent() {
  // Mes en curso en hora Argentina (no UTC): del día 1 hasta hoy
  const todayArg = getBusinessDateString();
  const startOfMonth = `${todayArg.slice(0, 7)}-01`;
  const endOfMonth = todayArg;

  const [filters, setFilters] = useState<ReportFiltersType>({
    startDate: startOfMonth,
    endDate: endOfMonth,
    cashRegister: "all",
    compareWithPrevious: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    stats: null,
    topProducts: [],
    paymentMethods: [],
    cashRegisters: [],
    incomeExpenses: null,
    salesByEmployee: [],
    profitabilityReport: [],
    categoryPerformance: [],
    salesComparison: null,
  });

  useEffect(() => {
    loadReports();
  }, [filters]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      // Rango anclado a hora Argentina (00:00 a 23:59:59 ARG), no a UTC
      const { startISO: startDateISO, endISO: endDateISO } = argDayToUtcRange(
        filters.startDate,
        filters.endDate
      );

      // Llamadas secuenciales para mayor robustez
      const stats = await getSalesStats(
        startDateISO,
        endDateISO,
        filters.cashRegister === "all" ? undefined : filters.cashRegister
      );
      const topProducts = await getTopSellingProducts(startDateISO, endDateISO, 10);
      const paymentMethods = await getSalesByPaymentMethod(startDateISO, endDateISO);
      const cashRegisters = await getSalesByCashRegister(startDateISO, endDateISO);
      const incomeExpenses = await getIncomeVsExpenses(startDateISO, endDateISO);
      const salesByEmployee = await getSalesByEmployee(startDateISO, endDateISO);
      const profitabilityReport = await getProfitabilityReport(startDateISO, endDateISO);
      const categoryPerformance = await getCategoryPerformance(startDateISO, endDateISO);
      const salesComparison = await getSalesComparison('monthly', endDateISO);

      setReportData({
        stats: stats.data,
        topProducts: topProducts.data || [],
        paymentMethods: paymentMethods.data || [],
        cashRegisters: cashRegisters.data || [],
        incomeExpenses: incomeExpenses.data,
        salesByEmployee: salesByEmployee.data || [],
        profitabilityReport: profitabilityReport.data || [],
        categoryPerformance: categoryPerformance.data || [],
        salesComparison: salesComparison.data,
      });
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: ReportFiltersType) => {
    setFilters(newFilters);
  };

  // Calcular KPIs mejorados
  const getBestEmployee = () => {
    if (!reportData.salesByEmployee || !reportData.salesByEmployee.length) return "N/A";
    try {
      const best = reportData.salesByEmployee.reduce((prev, current) =>
        (prev?.total_sales || 0) > (current?.total_sales || 0) ? prev : current
      );
      return best?.employee_name || "N/A";
    } catch (error) {
      console.error("Error calculating best employee:", error);
      return "N/A";
    }
  };

  const getGrowthPercentage = () => {
    if (!reportData.salesComparison) return 0;
    return reportData.salesComparison.sales_growth_percentage || 0;
  };

  const getMostSoldProduct = () => {
    if (!reportData.topProducts || !reportData.topProducts.length) return "N/A";
    return reportData.topProducts[0]?.product_name || "N/A";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Período: {fmtDayLabel(filters.startDate)} – {fmtDayLabel(filters.endDate)} · hora Argentina
          </p>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-febrero-caramel" />
          <span className="text-sm">Cargando reportes del período…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Período:{" "}
            <span className="font-medium text-foreground">
              {fmtDayLabel(filters.startDate)} – {fmtDayLabel(filters.endDate)}
            </span>{" "}
            · hora Argentina
          </p>
        </div>
        <ExportButtons
          data={reportData}
          filename="reporte-febrero"
        />
      </div>

      {/* Filtros */}
      <ReportFilters onFilterChange={handleFilterChange} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="operations">Operativo</TabsTrigger>
          <TabsTrigger value="financial">Financiero</TabsTrigger>
        </TabsList>

        {/* TAB 1: RESUMEN GENERAL */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs Mejorados */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventas del Periodo</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(parseFloat(reportData.stats?.total_sales || "0"))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {getGrowthPercentage() > 0 ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{getGrowthPercentage().toFixed(1)}%
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      {getGrowthPercentage().toFixed(1)}%
                    </Badge>
                  )}
                  <span className="text-muted-foreground">vs periodo anterior</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(parseFloat(reportData.stats?.average_ticket || "0"))}
                </div>
                <p className="text-xs text-muted-foreground">Por transaccion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.stats?.total_products ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">Unidades totales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Margen Neto</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.incomeExpenses?.net_profit || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Ventas − gastos − compras</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mejor Cajero</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-febrero-espresso">
                  {getBestEmployee()}
                </div>
                <p className="text-xs text-muted-foreground">Mayor ventas</p>
              </CardContent>
            </Card>
          </div>

        {/* Graficos principales (respetan el filtro de período) */}
          <ReportsCharts
            startDate={filters.startDate}
            endDate={filters.endDate}
            cashRegister={filters.cashRegister}
          />
        </TabsContent>

        {/* TAB 2: ANALISIS DE PRODUCTOS */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Productos Mas Vendidos</CardTitle>
                <CardDescription>
                  Productos con mayor volumen de ventas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.topProducts && reportData.topProducts.length > 0 ? (
                    reportData.topProducts.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-febrero-espresso/20 text-febrero-caramel font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{product.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.total_quantity} unidades
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(product.total_revenue || "0"))}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No hay datos para el periodo seleccionado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Productos Mas Rentables */}
            <Card>
              <CardHeader>
                <CardTitle>Productos Mas Rentables</CardTitle>
                <CardDescription>
                  Mayor margen de ganancia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.profitabilityReport && reportData.profitabilityReport.length > 0 ? (
                    reportData.profitabilityReport.slice(0, 5).map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{product.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.units_sold} unidades vendidas
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {product.margin_percentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Margen</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Sin datos de rentabilidad
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rendimiento por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Categoria</CardTitle>
              <CardDescription>
                Analisis de ventas por categoria de productos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportData.categoryPerformance && reportData.categoryPerformance.length > 0 ? (
                  reportData.categoryPerformance.map((category: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{category.category_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.product_count} productos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(parseFloat(category.total_revenue || "0"))}</p>
                        <p className="text-xs text-muted-foreground">{category.units_sold} unidades</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Sin datos de categorías
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ANÁLISIS OPERATIVO */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            {/* Ventas por Empleado */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Empleado</CardTitle>
                <CardDescription>
                  Rendimiento individual de cajeros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.salesByEmployee && reportData.salesByEmployee.length > 0 ? (
                    reportData.salesByEmployee.map((employee: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{employee.employee_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.areas_worked.join(", ")} - {employee.transaction_count} ventas
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(employee.total_sales || "0"))}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(parseFloat(employee.avg_ticket || "0"))} promedio
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Sin datos de empleados
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ventas por Caja */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Área</CardTitle>
              <CardDescription>
                Rendimiento por area de venta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportData.cashRegisters && reportData.cashRegisters.length > 0 ? (
                  reportData.cashRegisters.map((register: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{register.cash_register}</p>
                        <p className="text-sm text-muted-foreground">
                          {register.transaction_count} transacciones
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(parseFloat(register.total_sales || "0"))}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(parseFloat(register.avg_ticket || "0"))} promedio
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Sin datos de cajas
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ANALISIS FINANCIERO */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Ingresos vs Gastos */}
            <Card>
              <CardHeader>
                <CardTitle>Ingresos vs Gastos</CardTitle>
                <CardDescription>
                  Analisis financiero del periodo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.incomeExpenses ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div>
                        <p className="font-medium text-green-700">Ingresos</p>
                        <p className="text-sm text-green-600">Ventas totales (incluye crédito)</p>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(parseFloat(reportData.incomeExpenses.total_income || "0"))}
                      </p>
                    </div>
                    {(reportData.incomeExpenses.cuenta_corriente || 0) > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <div>
                          <p className="font-medium text-emerald-700">Cobrado en caja</p>
                          <p className="text-sm text-emerald-600">Ingresos sin la deuda en cuenta corriente</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700">
                          {formatCurrency(reportData.incomeExpenses.collected_income || 0)}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div>
                        <p className="font-medium text-red-700">Gastos</p>
                        <p className="text-sm text-red-600">Gastos de caja</p>
                      </div>
                      <p className="text-2xl font-bold text-red-700">
                        {formatCurrency(parseFloat(reportData.incomeExpenses.total_expenses || "0"))}
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div>
                        <p className="font-medium text-orange-700">Compras</p>
                        <p className="text-sm text-orange-600">Compras a proveedores</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-700">
                        {formatCurrency(parseFloat(reportData.incomeExpenses.total_purchases || "0"))}
                      </p>
                    </div>
                    {(reportData.incomeExpenses.cuenta_corriente || 0) > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div>
                          <p className="font-medium text-amber-700">Por cobrar (Cuenta Corriente)</p>
                          <p className="text-sm text-amber-600">Ventas a crédito, todavía no entraron a la caja</p>
                        </div>
                        <p className="text-2xl font-bold text-amber-700">
                          {formatCurrency(reportData.incomeExpenses.cuenta_corriente || 0)}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div>
                        <p className="font-medium text-blue-700">Margen Neto</p>
                        <p className="text-sm text-blue-600">Ventas − gastos − compras</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(parseFloat(reportData.incomeExpenses.net_profit || "0"))}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Sin datos financieros
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Metodos de Pago */}
            <Card>
              <CardHeader>
                <CardTitle>Metodos de Pago</CardTitle>
                <CardDescription>
                  Distribucion de ventas por forma de pago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.paymentMethods && reportData.paymentMethods.length > 0 ? (
                    reportData.paymentMethods.map((method: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{method.payment_method}</p>
                          <p className="text-sm text-muted-foreground">
                            {method.transaction_count} transacciones
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(method.total_amount || "0"))}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Sin datos de metodos de pago
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


