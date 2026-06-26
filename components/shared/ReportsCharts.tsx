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
  getIncomeVsExpenses,
} from "@/actions/reportActions";
import { formatCurrency } from "@/lib/utils";
import { argDayToUtcRange } from "@/lib/businessDay";
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
  Area,
} from "recharts";

interface ChartData {
  dailySales: any[];
  topProducts: any[];
  paymentMethods: any[];
  cashRegisters: any[];
  hourlyDistribution: any[];
  incomeExpenses: any;
}

interface ReportsChartsProps {
  startDate?: string; // YYYY-MM-DD (hora ARG)
  endDate?: string;   // YYYY-MM-DD (hora ARG)
  cashRegister?: string;
}

// Paleta Febrero (terracota / caramelo / arena / espresso)
const brand = {
  terracotta: "#A8341C",
  caramel: "#B5743A",
  sand: "#E8D5B0",
  espresso: "#2B1B12",
  olive: "#7C6F4E",
};
const pieColors = [brand.terracotta, brand.caramel, brand.sand, brand.olive, brand.espresso, "#C77D3A"];

const fmtDay = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : value;

export function ReportsCharts({ startDate, endDate }: ReportsChartsProps) {
  const [data, setData] = useState<ChartData>({
    dailySales: [],
    topProducts: [],
    paymentMethods: [],
    cashRegisters: [],
    hourlyDistribution: [],
    incomeExpenses: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        // Mismo rango que el resto de la pantalla (anclado a hora Argentina)
        const today = new Date();
        const fallbackStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        const fallbackEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-28`;
        const { startISO, endISO } = argDayToUtcRange(startDate || fallbackStart, endDate || fallbackEnd);

        const [dailySales, topProducts, paymentMethods, cashRegisters, hourlyDistribution, incomeExpenses] =
          await Promise.all([
            getDailySales(startISO, endISO),
            getTopSellingProducts(startISO, endISO, 10),
            getSalesByPaymentMethod(startISO, endISO),
            getSalesByCashRegister(startISO, endISO),
            getHourlySalesDistribution(startISO, endISO),
            getIncomeVsExpenses(startISO, endISO),
          ]);

        if (cancelled) return;
        setData({
          dailySales: dailySales.data || [],
          topProducts: topProducts.data || [],
          paymentMethods: paymentMethods.data || [],
          cashRegisters: cashRegisters.data || [],
          hourlyDistribution: hourlyDistribution.data || [],
          incomeExpenses: incomeExpenses.data,
        });
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

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
          <CardTitle>Gráficos</CardTitle>
          <CardDescription>Análisis visual del período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráficos</CardTitle>
        <CardDescription>Análisis visual del período seleccionado</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="daily">Ventas Diarias</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="analysis">Análisis</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            {/* Ventas Diarias */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por día</h3>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={data.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={fmtDay} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="Ventas"
                    stroke={brand.terracotta}
                    strokeWidth={3}
                    dot={{ fill: brand.caramel, strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 6, fill: brand.terracotta }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución Horaria (hora Argentina) */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por hora (hora Argentina)</h3>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={data.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}h`} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_sales" name="Ventas" fill={brand.caramel} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            {/* Top Productos (barras horizontales) */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Top 10 productos más vendidos</h3>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis dataKey="product_name" type="category" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_revenue" name="Ingresos" fill={brand.terracotta} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Métodos de Pago */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por método de pago</h3>
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={data.paymentMethods}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={120}
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
            {/* Ventas por Área */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Ventas por área</h3>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={data.cashRegisters}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cash_register" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total_sales" name="Ventas" stackId="1" stroke={brand.terracotta} fill={brand.sand} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Ingresos vs Gastos */}
            {data.incomeExpenses && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ingresos vs costos</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart
                    data={[
                      {
                        name: "Período",
                        ingresos: data.incomeExpenses.total_income,
                        costos: data.incomeExpenses.total_costs,
                        neto: data.incomeExpenses.net_profit,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="ingresos" fill={brand.caramel} name="Ingresos" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costos" fill={brand.terracotta} name="Costos" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="neto" stroke={brand.espresso} strokeWidth={3} name="Neto" />
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
