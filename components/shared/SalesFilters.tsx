"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Filter, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SalesFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  tableNumber: string; // "all" o número de mesa como string
  shift: "morning" | "afternoon" | "night" | "all";
  saleType: "table" | "counter" | "delivery" | "all";
  status: "completed" | "pending" | "cancelled" | "all";
  hasInvoice: "yes" | "no" | "all";
  paymentMethod: string; // ID del método de pago o "all"
}

interface SalesFiltersProps {
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  availablePaymentMethods: Array<{ id: string; name: string }>;
  availableTables: number[];
  defaultFilters: SalesFilters;
}

export function SalesFiltersPanel({
  filters,
  onFiltersChange,
  availablePaymentMethods,
  availableTables,
  defaultFilters,
}: SalesFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof SalesFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({ ...defaultFilters });
  };

  const hasActiveFilters = 
    filters.search !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.tableNumber !== "all" ||
    filters.shift !== "all" ||
    filters.saleType !== "all" ||
    filters.status !== "all" ||
    filters.hasInvoice !== "all" ||
    filters.paymentMethod !== "all";

  const activeFiltersCount = [
    filters.search !== "",
    filters.dateFrom !== "" || filters.dateTo !== "",
    filters.tableNumber !== "all",
    filters.shift !== "all",
    filters.saleType !== "all",
    filters.status !== "all",
    filters.hasInvoice !== "all",
    filters.paymentMethod !== "all",
  ].filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8"
            >
              {isExpanded ? "Ocultar" : "Mostrar"} filtros
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Búsqueda por texto */}
        <div className="space-y-2">
          <Label htmlFor="search">Búsqueda general</Label>
          <Input
            id="search"
            placeholder="Buscar por número, cajero, productos..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>

        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Filtros por fecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha desde
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter("dateFrom", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha hasta
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter("dateTo", e.target.value)}
                />
              </div>
            </div>

            {(filters.dateFrom || filters.dateTo) && (
              <p className="text-xs text-muted-foreground md:col-span-2">
                Cada fecha incluye ventas desde las 06:00 hasta las 03:00 del día siguiente (hora Buenos Aires).
              </p>
            )}

            {/* Filtros por tipo y estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saleType">Tipo de venta</Label>
                <Select
                  value={filters.saleType}
                  onValueChange={(value) => updateFilter("saleType", value)}
                >
                  <SelectTrigger id="saleType">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="table">Mesa</SelectItem>
                    <SelectItem value="counter">Mostrador</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => updateFilter("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtros por mesa y turno */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableNumber">Mesa</Label>
                <Select
                  value={filters.tableNumber}
                  onValueChange={(value) => updateFilter("tableNumber", value)}
                >
                  <SelectTrigger id="tableNumber">
                    <SelectValue placeholder="Todas las mesas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las mesas</SelectItem>
                    {availableTables
                      .sort((a, b) => a - b)
                      .map((table) => (
                        <SelectItem key={table} value={table.toString()}>
                          Mesa {table}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift">Turno</Label>
                <Select
                  value={filters.shift}
                  onValueChange={(value) => updateFilter("shift", value)}
                >
                  <SelectTrigger id="shift">
                    <SelectValue placeholder="Todos los turnos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los turnos</SelectItem>
                    <SelectItem value="morning">🌅 Mañana</SelectItem>
                    <SelectItem value="afternoon">🌆 Tarde</SelectItem>
                    <SelectItem value="night">Noche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtros por facturación y método de pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hasInvoice">Facturación</Label>
                <Select
                  value={filters.hasInvoice}
                  onValueChange={(value) => updateFilter("hasInvoice", value)}
                >
                  <SelectTrigger id="hasInvoice">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="yes">Facturadas</SelectItem>
                    <SelectItem value="no">No facturadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de pago</Label>
                <Select
                  value={filters.paymentMethod}
                  onValueChange={(value) => updateFilter("paymentMethod", value)}
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Todos los métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los métodos</SelectItem>
                    {availablePaymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



