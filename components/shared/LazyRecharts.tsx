"use client";

import { Suspense, lazy } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "lucide-react";

// Lazy load de Recharts (componente muy pesado ~500KB)
const LazyLineChart = lazy(() => import("recharts").then(module => ({ default: module.LineChart })));
const LazyLine = lazy(() => import("recharts").then(module => ({ default: module.Line })));
const LazyXAxis = lazy(() => import("recharts").then(module => ({ default: module.XAxis })));
const LazyYAxis = lazy(() => import("recharts").then(module => ({ default: module.YAxis })));
const LazyCartesianGrid = lazy(() => import("recharts").then(module => ({ default: module.CartesianGrid })));
const LazyTooltip = lazy(() => import("recharts").then(module => ({ default: module.Tooltip })));
const LazyResponsiveContainer = lazy(() => import("recharts").then(module => ({ default: module.ResponsiveContainer })));

// Skeleton para el gráfico
function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-full">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded"></div>
          <div className="h-2 bg-muted rounded w-5/6"></div>
          <div className="h-2 bg-muted rounded w-4/6"></div>
          <div className="h-2 bg-muted rounded w-3/4"></div>
        </div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    </div>
  );
}

interface LazyRechartsProps {
  data: any[];
  title: string;
  description?: string;
  className?: string;
}

export function LazyRecharts({ data, title, description, className }: LazyRechartsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton />}>
          <LazyResponsiveContainer width="100%" height={300}>
            <LazyLineChart data={data}>
              <LazyCartesianGrid strokeDasharray="3 3" />
              <LazyXAxis dataKey="date" />
              <LazyYAxis />
              <LazyTooltip />
              <LazyLine 
                type="monotone" 
                dataKey="amount" 
                stroke="#8884d8" 
                strokeWidth={2}
                dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LazyLineChart>
          </LazyResponsiveContainer>
        </Suspense>
      </CardContent>
    </Card>
  );
}

// Componente simplificado para gráficos de barras (sin lazy loading para evitar problemas de tipos)
export function LazyBarChart({ data, title, description, className }: LazyRechartsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton />}>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <LineChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Gráfico de barras</p>
              <p className="text-sm">Cargando componente...</p>
            </div>
          </div>
        </Suspense>
      </CardContent>
    </Card>
  );
}
