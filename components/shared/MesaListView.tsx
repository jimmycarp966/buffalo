"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  List, 
  Grid3x3, 
  Search, 
  Clock, 
  Users, 
  Calendar,
  AlertTriangle,
  Edit3,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Mesa, MESA_ESTADOS, MESA_FORMAS } from "@/types/mesa";
import { MesaCard } from "./MesaCard";

interface MesaListViewProps {
  mesas: Mesa[];
  onMesaClick?: (mesa: Mesa) => void;
  onMesaEdit?: (mesa: Mesa) => void;
  className?: string;
}

export function MesaListView({ 
  mesas, 
  onMesaClick, 
  onMesaEdit,
  className 
}: MesaListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"numero" | "estado" | "capacidad" | "tiempo">("numero");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtrar mesas por término de búsqueda
  const filteredMesas = mesas.filter(mesa => 
    mesa.numero.toString().includes(searchTerm) ||
    mesa.customName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mesa.estado.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar mesas
  const sortedMesas = [...filteredMesas].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "numero":
        comparison = a.numero - b.numero;
        break;
      case "estado":
        comparison = a.estado.localeCompare(b.estado);
        break;
      case "capacidad":
        comparison = a.capacidad - b.capacidad;
        break;
      case "tiempo":
        const tiempoA = a.horaOcupacion ? new Date().getTime() - a.horaOcupacion.getTime() : 0;
        const tiempoB = b.horaOcupacion ? new Date().getTime() - b.horaOcupacion.getTime() : 0;
        comparison = tiempoA - tiempoB;
        break;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const getTiempoTranscurrido = (mesa: Mesa) => {
    if (!mesa.horaOcupacion) return null;
    const ahora = new Date();
    const diferencia = ahora.getTime() - mesa.horaOcupacion.getTime();
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutosRestantes}m`;
    }
    return `${minutos}m`;
  };

  const getTiempoHastaReserva = (mesa: Mesa) => {
    if (!mesa.horaReserva) return null;
    const ahora = new Date();
    const diferencia = mesa.horaReserva.getTime() - ahora.getTime();
    
    if (diferencia <= 0) return "¡Ya llegó!";
    
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (horas > 0) {
      return `En ${horas}h ${minutosRestantes}m`;
    }
    return `En ${minutos}m`;
  };

  const mostrarAlerta = (mesa: Mesa) => {
    if (mesa.estado === 'ocupada' && mesa.horaOcupacion) {
      const minutos = Math.floor((new Date().getTime() - mesa.horaOcupacion.getTime()) / (1000 * 60));
      return minutos > 120; // Más de 2 horas
    }
    if (mesa.estado === 'limpieza' && mesa.horaInicioLimpieza) {
      const minutos = Math.floor((new Date().getTime() - mesa.horaInicioLimpieza.getTime()) / (1000 * 60));
      return minutos > 30; // Más de 30 minutos
    }
    return false;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controles */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Vista de Lista</h3>
            <Badge variant="outline">
              {sortedMesas.length} mesas
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar mesa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="numero">Número</option>
              <option value="estado">Estado</option>
              <option value="capacidad">Capacidad</option>
              <option value="tiempo">Tiempo</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de mesas */}
      <div className="space-y-2">
        {sortedMesas.map(mesa => {
          const estado = MESA_ESTADOS[mesa.estado];
          const forma = MESA_FORMAS[mesa.forma];
          const tiempoTranscurrido = getTiempoTranscurrido(mesa);
          const tiempoHastaReserva = getTiempoHastaReserva(mesa);
          const tieneAlerta = mostrarAlerta(mesa);

          return (
            <Card key={mesa.numero} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Información principal */}
                <div className="flex items-center gap-4">
                  {/* Mesa visual */}
                  <div className="flex-shrink-0">
                    <MesaCard
                      mesa={mesa}
                      scale={0.6}
                      showTimer={false}
                      showCapacity={false}
                      showReservationTime={false}
                    />
                  </div>

                  {/* Detalles */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg">Mesa {mesa.numero}</h4>
                      {mesa.customName && (
                        <Badge variant="outline" className="text-xs">
                          {mesa.customName}
                        </Badge>
                      )}
                      {tieneAlerta && (
                        <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {mesa.comensales || 0}/{mesa.capacidad} personas
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{forma.icon}</span>
                        {forma.label}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{mesa.zona === 'principal' ? '🏠' : '🌿'}</span>
                        {mesa.zona === 'principal' ? 'Principal' : 'Exterior'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estado y acciones */}
                <div className="flex items-center gap-4">
                  {/* Estado */}
                  <div className="text-right">
                    <Badge className={cn("text-white mb-1", estado.color)}>
                      {estado.icon} {estado.label}
                    </Badge>
                    
                    {/* Timer */}
                    {tiempoTranscurrido && mesa.estado === 'ocupada' && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {tiempoTranscurrido}
                      </div>
                    )}
                    
                    {tiempoHastaReserva && mesa.estado === 'reservada' && (
                      <div className="flex items-center gap-1 text-sm text-yellow-600">
                        <Calendar className="w-3 h-3" />
                        {tiempoHastaReserva}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMesaClick?.(mesa)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMesaEdit?.(mesa)}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Resumen */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
          <div>
            Mostrando {sortedMesas.length} de {mesas.length} mesas
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>{mesas.filter(m => m.estado === 'disponible').length} disponibles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>{mesas.filter(m => m.estado === 'ocupada').length} ocupadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>{mesas.filter(m => m.estado === 'reservada').length} reservadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
              <span>{mesas.filter(m => m.estado === 'limpieza').length} en limpieza</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
