"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mesa, MesaFilter, MESA_ESTADOS, MESA_FORMAS } from "@/types/mesa";

interface MesaFiltersProps {
  mesas: Mesa[];
  onFilterChange: (filteredMesas: Mesa[]) => void;
  className?: string;
}

export function MesaFilters({ mesas, onFilterChange, className }: MesaFiltersProps) {
  const [filters, setFilters] = useState<MesaFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Aplicar filtros
  const applyFilters = (newFilters: MesaFilter) => {
    let filteredMesas = [...mesas];

    if (newFilters.estado) {
      filteredMesas = filteredMesas.filter(mesa => mesa.estado === newFilters.estado);
    }

    if (newFilters.zona) {
      filteredMesas = filteredMesas.filter(mesa => mesa.zona === newFilters.zona);
    }

    if (newFilters.forma) {
      filteredMesas = filteredMesas.filter(mesa => mesa.forma === newFilters.forma);
    }

    if (newFilters.capacidadMin !== undefined) {
      filteredMesas = filteredMesas.filter(mesa => mesa.capacidad >= newFilters.capacidadMin!);
    }

    if (newFilters.capacidadMax !== undefined) {
      filteredMesas = filteredMesas.filter(mesa => mesa.capacidad <= newFilters.capacidadMax!);
    }

    onFilterChange(filteredMesas);
  };

  const handleFilterChange = (key: keyof MesaFilter, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange(mesas);
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== undefined && value !== "").length;
  };

  const getFilterSummary = () => {
    const activeFilters = [];
    
    if (filters.estado) {
      activeFilters.push(`Estado: ${MESA_ESTADOS[filters.estado].label}`);
    }
    if (filters.zona) {
      activeFilters.push(`Zona: ${filters.zona === 'principal' ? 'Principal' : 'Exterior'}`);
    }
    if (filters.forma) {
      activeFilters.push(`Forma: ${MESA_FORMAS[filters.forma].label}`);
    }
    if (filters.capacidadMin !== undefined) {
      activeFilters.push(`Cap. mín: ${filters.capacidadMin}`);
    }
    if (filters.capacidadMax !== undefined) {
      activeFilters.push(`Cap. máx: ${filters.capacidadMax}`);
    }

    return activeFilters;
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Filtros</h3>
          {getActiveFiltersCount() > 0 && (
            <Badge variant="secondary">
              {getActiveFiltersCount()} activos
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? "Ocultar" : "Mostrar"}
          </Button>
          {getActiveFiltersCount() > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Resumen de filtros activos */}
      {getActiveFiltersCount() > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-2">Filtros activos:</p>
          <div className="flex flex-wrap gap-2">
            {getFilterSummary().map((filter, index) => (
              <Badge key={index} variant="outline" className="text-blue-700">
                {filter}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Estado */}
          <div>
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={filters.estado || ""}
              onValueChange={(value) => handleFilterChange('estado', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los estados</SelectItem>
                {Object.entries(MESA_ESTADOS).map(([key, estado]) => (
                  <SelectItem key={key} value={key}>
                    {estado.icon} {estado.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zona */}
          <div>
            <Label htmlFor="zona">Zona</Label>
            <Select
              value={filters.zona || ""}
              onValueChange={(value) => handleFilterChange('zona', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las zonas</SelectItem>
                <SelectItem value="principal">🏠 Principal</SelectItem>
                <SelectItem value="exterior">🌿 Exterior</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Forma */}
          <div>
            <Label htmlFor="forma">Forma</Label>
            <Select
              value={filters.forma || ""}
              onValueChange={(value) => handleFilterChange('forma', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las formas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las formas</SelectItem>
                {Object.entries(MESA_FORMAS).map(([key, forma]) => (
                  <SelectItem key={key} value={key}>
                    {forma.icon} {forma.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacidad mínima */}
          <div>
            <Label htmlFor="capacidadMin">Capacidad mínima</Label>
            <Input
              id="capacidadMin"
              type="number"
              min="1"
              max="20"
              value={filters.capacidadMin || ""}
              onChange={(e) => handleFilterChange('capacidadMin', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 2"
            />
          </div>

          {/* Capacidad máxima */}
          <div>
            <Label htmlFor="capacidadMax">Capacidad máxima</Label>
            <Input
              id="capacidadMax"
              type="number"
              min="1"
              max="20"
              value={filters.capacidadMax || ""}
              onChange={(e) => handleFilterChange('capacidadMax', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 8"
            />
          </div>

          {/* Botón de búsqueda rápida */}
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Filtros rápidos predefinidos
                const quickFilters = [
                  { label: "Mesas ocupadas", filter: { estado: 'ocupada' as const } },
                  { label: "Mesas disponibles", filter: { estado: 'disponible' as const } },
                  { label: "Mesas grandes (6+)", filter: { capacidadMin: 6 } },
                  { label: "Zona principal", filter: { zona: 'principal' as const } },
                ];
                
                // Por ahora, aplicar el primer filtro como ejemplo
                const firstFilter = quickFilters[0];
                const newFilters = { ...filters, ...firstFilter.filter };
                setFilters(newFilters);
                applyFilters(newFilters);
              }}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtro rápido
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// Hook para usar filtros
export function useMesaFilters(mesas: Mesa[]) {
  const [filteredMesas, setFilteredMesas] = useState<Mesa[]>(mesas);

  useEffect(() => {
    setFilteredMesas(mesas);
  }, [mesas]);

  const applyFilters = (filters: MesaFilter) => {
    let filtered = [...mesas];

    if (filters.estado) {
      filtered = filtered.filter(mesa => mesa.estado === filters.estado);
    }

    if (filters.zona) {
      filtered = filtered.filter(mesa => mesa.zona === filters.zona);
    }

    if (filters.forma) {
      filtered = filtered.filter(mesa => mesa.forma === filters.forma);
    }

    if (filters.capacidadMin !== undefined) {
      filtered = filtered.filter(mesa => mesa.capacidad >= filters.capacidadMin!);
    }

    if (filters.capacidadMax !== undefined) {
      filtered = filtered.filter(mesa => mesa.capacidad <= filters.capacidadMax!);
    }

    setFilteredMesas(filtered);
  };

  return {
    filteredMesas,
    applyFilters,
    clearFilters: () => setFilteredMesas(mesas)
  };
}
