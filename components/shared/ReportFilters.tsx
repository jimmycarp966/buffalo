"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  User, 
  Package, 
  TrendingUp,
  Download,
  Save,
  RotateCcw
} from "lucide-react";

interface ReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  cashRegister: "all" | "drugstore" | "bar";
  employee?: string;
  category?: string;
  compareWithPrevious: boolean;
}

export function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [filters, setFilters] = useState<ReportFilters>({
    startDate: startOfMonth,
    endDate: endOfMonth,
    cashRegister: "all",
    employee: "all",
    category: "all",
    compareWithPrevious: false,
  });

  const [employees, setEmployees] = useState<Array<{id: string, name: string}>>([]);
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([]);

  // Cargar empleados y categorías (simulado - en producción vendría de API)
  useEffect(() => {
    // Simular carga de empleados
    setEmployees([
      { id: "all", name: "Todos los empleados" },
      { id: "1", name: "Juan Pérez" },
      { id: "2", name: "María García" },
      { id: "3", name: "Carlos López" },
    ]);

    // Simular carga de categorías
    setCategories([
      { id: "all", name: "Todas las categorías" },
      { id: "1", name: "Bebidas" },
      { id: "2", name: "Snacks" },
      { id: "3", name: "Cigarrillos" },
    ]);
  }, []);

  const handleFilterChange = (key: keyof ReportFilters, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    onFilterChange(filters);
  };

  const handleReset = () => {
    const resetFilters = {
      startDate: startOfMonth,
      endDate: endOfMonth,
      cashRegister: "all" as const,
      employee: "all",
      category: "all",
      compareWithPrevious: false,
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  // Presets rápidos
  const applyPreset = (preset: string) => {
    const today = new Date();
    let newFilters = { ...filters };

    switch (preset) {
      case "today":
        newFilters.startDate = today.toISOString().split("T")[0];
        newFilters.endDate = today.toISOString().split("T")[0];
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        newFilters.startDate = yesterday.toISOString().split("T")[0];
        newFilters.endDate = yesterday.toISOString().split("T")[0];
        break;
      case "thisWeek":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        newFilters.startDate = startOfWeek.toISOString().split("T")[0];
        newFilters.endDate = today.toISOString().split("T")[0];
        break;
      case "thisMonth":
        newFilters.startDate = startOfMonth;
        newFilters.endDate = endOfMonth;
        break;
      case "lastMonth":
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        newFilters.startDate = lastMonth.toISOString().split("T")[0];
        newFilters.endDate = endLastMonth.toISOString().split("T")[0];
        break;
    }

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <Card className="border-2 border-buffalo-espresso bg-buffalo-espresso/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-buffalo-caramel flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filtros Avanzados de Reportes
            </CardTitle>
            <CardDescription>
              Personalizá el período, caja y más para análisis detallados
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Presets Rápidos */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Presets Rápidos</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("today")}
              className="text-xs"
            >
              📅 Hoy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("yesterday")}
              className="text-xs"
            >
              📅 Ayer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisWeek")}
              className="text-xs"
            >
              📅 Esta semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisMonth")}
              className="text-xs"
            >
              📅 Este mes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("lastMonth")}
              className="text-xs"
            >
              📅 Último mes
            </Button>
          </div>
        </div>

        {/* Filtros Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Fecha Inicio */}
          <div className="space-y-2">
            <Label htmlFor="start-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Desde
            </Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          {/* Fecha Fin */}
          <div className="space-y-2">
            <Label htmlFor="end-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Hasta
            </Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>

          {/* Caja */}
          <div className="space-y-2">
            <Label htmlFor="cash-register" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Caja
            </Label>
            <select
              id="cash-register"
              value={filters.cashRegister}
              onChange={(e) => handleFilterChange("cashRegister", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">📊 Todas</option>
              <option value="bar">🍺 Bar</option>
            </select>
          </div>
        </div>

        {/* Filtros Avanzados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Empleado */}
          <div className="space-y-2">
            <Label htmlFor="employee" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Empleado
            </Label>
            <select
              id="employee"
              value={filters.employee || "all"}
              onChange={(e) => handleFilterChange("employee", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Categoría
            </Label>
            <select
              id="category"
              value={filters.category || "all"}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Opciones Adicionales */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="compare-previous"
              checked={filters.compareWithPrevious}
              onCheckedChange={(checked) => handleFilterChange("compareWithPrevious", checked as boolean)}
            />
            <Label htmlFor="compare-previous" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Comparar con período anterior
            </Label>
          </div>
          {filters.compareWithPrevious && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              📊 Se mostrarán comparativas automáticas
            </Badge>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleApplyFilters} className="flex-1">
            <TrendingUp className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

