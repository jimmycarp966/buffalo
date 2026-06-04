"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getDailySales, 
  getTopSellingProducts, 
  getSalesByPaymentMethod,
  getSalesByCashRegister,
  getHourlySalesDistribution,
  getIncomeVsExpenses
} from "@/actions/reportActions";
import { formatCurrency } from "@/lib/utils";
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  AreaChart, 
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell,
  Area
} from "recharts";

interface ChartData {
  dailySales: any[];
  topProducts: any[];
  paymentMethods: any[];
  cashRegisters: any[];
  hourlyDistribution: any[];
  incomeExpenses: any;
}

export function ReportsCharts() {
  const [data, setData] = useState<ChartData>({
    dailySales: [],
    topProducts: [],
    paymentMethods: [],
    cashRegisters: [],
    hourlyDistribution: [],
    incomeExpenses: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    setIsLoading(true);
    console.log("🔄 Cargando datos de gráficos...");
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      console.log("📅 Fechas:", startOfMonth, "a", endOfMonth);

      // Cargar datos uno por uno para mejor debugging
      console.log("📊 Cargando ventas diarias...");
      const dailySales = await getDailySales(startOfMonth, endOfMonth);
      console.log("✅ Ventas diarias:", dailySales.data?.length || 0, "registros");

      console.log("📈 Cargando top productos...");
      const topProducts = await getTopSellingProducts(startOfMonth, endOfMonth, 10);
      console.log("✅ Top productos:", topProducts.data?.length || 0, "productos");

      console.log("💳 Cargando métodos de pago...");
      const paymentMethods = await getSalesByPaymentMethod(startOfMonth, endOfMonth);
      console.log("✅ Métodos de pago:", paymentMethods.data?.length || 0, "métodos");

      console.log("🏪 Cargando cajas...");
      const cashRegisters = await getSalesByCashRegister(startOfMonth, endOfMonth);
      console.log("✅ Cajas:", cashRegisters.data?.length || 0, "cajas");

      console.log("📊 Cargando distribución horaria...");
      const hourlyDistribution = await getHourlySalesDistribution(startOfMonth, endOfMonth);
      console.log("✅ Distribución horaria:", hourlyDistribution.data?.length || 0, "horas");

      console.log("💰 Cargando ingresos vs gastos...");
      const incomeExpenses = await getIncomeVsExpenses(startOfMonth, endOfMonth);
      console.log("✅ Ingresos vs gastos:", incomeExpenses.data ? "OK" : "Sin datos");

      setData({
        dailySales: dailySales.data || [],
        topProducts: topProducts.data || [],
        paymentMethods: paymentMethods.data || [],
        cashRegisters: cashRegisters.data || [],
        hourlyDistribution: hourlyDistribution.data || [],
        incomeExpenses: incomeExpenses.data
      });

      console.log("✅ Todos los datos cargados exitosamente");
    } catch (error) {
      console.error("❌ Error loading chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Colores Shell
  const shellColors = {
    red: "#DC2626",
    yellow: "#FCD34D",
    darkRed: "#991B1B",
    lightYellow: "#FEF3C7"
  };

  const pieColors = [shellColors.red, shellColors.yellow, shellColors.darkRed, shellColors.lightYellow, "#F59E0B", "#EF4444"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gráficos de Reportes</CardTitle>
          <CardDescription>Análisis visual de datos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>Cargando gráficos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráficos de Reportes</CardTitle>
        <CardDescription>Análisis visual interactivo de datos</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="daily">Ventas Diarias</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="analysis">Análisis</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            {/* Gráfico 1: Ventas Diarias */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas Diarias (Últimos 30 días)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke={shellColors.red} 
                    strokeWidth={3}
                    dot={{ fill: shellColors.yellow, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: shellColors.red }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico 2: Distribución Horaria */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Distribución Horaria de Ventas</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_sales" fill={shellColors.yellow} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            {/* Gráfico 3: Top Productos */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Top 10 Productos Más Vendidos</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.topProducts} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis dataKey="product_name" type="category" width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_revenue" fill={shellColors.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico 4: Métodos de Pago */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por Método de Pago</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={data.paymentMethods}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="total_amount"
                  >
                    {data.paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {/* Gráfico: Ventas por Área */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por Área</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.cashRegisters}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cash_register" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="total_sales" 
                    stackId="1" 
                    stroke={shellColors.red} 
                    fill={shellColors.yellow} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico 7: Ingresos vs Gastos */}
            {data.incomeExpenses && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ingresos vs Gastos</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={[
                    {
                      name: "Ingresos",
                      ingresos: data.incomeExpenses.total_income,
                      gastos: data.incomeExpenses.total_expenses,
                      neto: data.incomeExpenses.net_profit
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="ingresos" fill={shellColors.yellow} name="Ingresos" />
                    <Bar dataKey="gastos" fill={shellColors.red} name="Gastos" />
                    <Line type="monotone" dataKey="neto" stroke={shellColors.darkRed} strokeWidth={3} name="Neto" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

