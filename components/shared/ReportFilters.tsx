"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, TrendingUp, RotateCcw } from "lucide-react";
import { getBusinessDateString, getArgWeekday } from "@/lib/businessDay";

interface ReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  cashRegister: "all" | "drugstore" | "bar";
  compareWithPrevious: boolean;
}

// Helpers de fecha en hora Argentina (no UTC)
const argToday = () => getBusinessDateString();
const shiftDay = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T12:00:00-03:00`);
  d.setDate(d.getDate() + days);
  return getBusinessDateString(d);
};
const firstOfMonth = (dateStr: string) => `${dateStr.slice(0, 7)}-01`;
const lastOfMonth = (dateStr: string) => {
  const [y, m] = dateStr.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${dateStr.slice(0, 7)}-${String(last).padStart(2, "0")}`;
};
const fmt = (dateStr: string) =>
  dateStr
    ? new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    : "";

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "thisWeek", label: "Esta semana" },
  { key: "thisMonth", label: "Este mes" },
  { key: "lastMonth", label: "Mes pasado" },
] as const;

export function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const today = argToday();
  const defaults: ReportFilters = {
    startDate: firstOfMonth(today),
    endDate: today,
    cashRegister: "all",
    compareWithPrevious: false,
  };

  const [filters, setFilters] = useState<ReportFilters>(defaults);
  const [activePreset, setActivePreset] = useState<string>("thisMonth");

  const apply = (next: ReportFilters, preset?: string) => {
    setFilters(next);
    setActivePreset(preset ?? "");
    onFilterChange(next);
  };

  const applyPreset = (preset: string) => {
    const t = argToday();
    let startDate = filters.startDate;
    let endDate = filters.endDate;

    switch (preset) {
      case "today":
        startDate = t; endDate = t; break;
      case "yesterday": {
        const y = shiftDay(t, -1);
        startDate = y; endDate = y; break;
      }
      case "thisWeek":
        startDate = shiftDay(t, -getArgWeekday(new Date()));
        endDate = t; break;
      case "thisMonth":
        startDate = firstOfMonth(t); endDate = t; break;
      case "lastMonth": {
        const lm = shiftDay(firstOfMonth(t), -1);
        startDate = firstOfMonth(lm); endDate = lastOfMonth(lm); break;
      }
    }
    apply({ ...filters, startDate, endDate }, preset);
  };

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-4 p-4">
        {/* Presets rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Rango manual + caja */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-date" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Desde
            </Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              max={filters.endDate}
              onChange={(e) => apply({ ...filters, startDate: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Hasta
            </Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              onChange={(e) => apply({ ...filters, endDate: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-register" className="text-xs text-muted-foreground">Caja</Label>
            <select
              id="cash-register"
              value={filters.cashRegister}
              onChange={(e) => apply({ ...filters, cashRegister: e.target.value as ReportFilters["cashRegister"] })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todas</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="h-10 w-full" onClick={() => apply(defaults, "thisMonth")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
            </Button>
          </div>
        </div>

        {/* Período activo + comparar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Mostrando:{" "}
            <span className="font-medium text-foreground">
              {fmt(filters.startDate)} – {fmt(filters.endDate)}
            </span>{" "}
            <span className="text-xs">(hora Argentina)</span>
          </p>
          <label htmlFor="compare-previous" className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              id="compare-previous"
              checked={filters.compareWithPrevious}
              onCheckedChange={(checked) => apply({ ...filters, compareWithPrevious: checked as boolean }, activePreset)}
            />
            <TrendingUp className="h-4 w-4" />
            Comparar con período anterior
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
