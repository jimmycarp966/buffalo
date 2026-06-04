"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Mesa, MESA_ESTADOS, MESA_FORMAS } from "@/types/mesa";
import { Clock, Users, Calendar, AlertTriangle } from "lucide-react";

interface MesaCardProps {
  mesa: Mesa;
  isSelected?: boolean;
  isEditMode?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  scale?: number;
  showTimer?: boolean;
  showCapacity?: boolean;
  showReservationTime?: boolean;
}

export function MesaCard({
  mesa,
  isSelected = false,
  isEditMode = false,
  onClick,
  onDoubleClick,
  scale = 1,
  showTimer = true,
  showCapacity = true,
  showReservationTime = true,
}: MesaCardProps) {
  const estado = MESA_ESTADOS[mesa.estado];
  const forma = MESA_FORMAS[mesa.forma];
  
  // Calcular tiempo transcurrido
  const getTiempoTranscurrido = () => {
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

  // Calcular tiempo hasta reserva
  const getTiempoHastaReserva = () => {
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

  // Determinar si mostrar alerta por tiempo excesivo
  const mostrarAlerta = () => {
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

  const tiempoTranscurrido = getTiempoTranscurrido();
  const tiempoHastaReserva = getTiempoHastaReserva();
  const tieneAlerta = mostrarAlerta();

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:scale-105",
        isSelected && "ring-4 ring-blue-500 ring-opacity-50",
        isEditMode && "cursor-move"
      )}
      style={{
        transform: `scale(${scale})`,
        width: `${80 * scale}px`,
        height: `${80 * scale}px`,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Mesa principal */}
      <div
        className={cn(
          "w-full h-full flex flex-col items-center justify-center text-white font-bold text-sm shadow-lg border-2",
          estado.color,
          forma.className,
          isSelected && "ring-2 ring-white ring-opacity-50",
          tieneAlerta && "animate-pulse"
        )}
      >
        {/* Número de mesa */}
        <div className="text-lg font-bold">
          {mesa.numero}
        </div>
        
        {/* Capacidad */}
        {showCapacity && (
          <div className="flex items-center gap-1 text-xs">
            <Users className="w-3 h-3" />
            {mesa.comensales || 0}/{mesa.capacidad}
          </div>
        )}
      </div>

      {/* Indicadores superiores */}
      <div className="absolute -top-2 -right-2 flex flex-col gap-1">
        {/* Alerta de tiempo excesivo */}
        {tieneAlerta && (
          <div className="bg-red-500 text-white rounded-full p-1 shadow-lg">
            <AlertTriangle className="w-3 h-3" />
          </div>
        )}
        
        {/* Estado específico */}
        <div className={cn(
          "text-xs px-2 py-1 rounded-full text-white font-semibold shadow-lg",
          estado.color
        )}>
          {estado.icon}
        </div>
      </div>

      {/* Timer de ocupación */}
      {showTimer && tiempoTranscurrido && mesa.estado === 'ocupada' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-foreground/80 text-background px-2 py-1 rounded text-xs whitespace-nowrap">
          <Clock className="w-3 h-3 inline mr-1" />
          {tiempoTranscurrido}
        </div>
      )}

      {/* Timer de reserva */}
      {showReservationTime && tiempoHastaReserva && mesa.estado === 'reservada' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-yellow-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
          <Calendar className="w-3 h-3 inline mr-1" />
          {tiempoHastaReserva}
        </div>
      )}

      {/* Indicador de forma */}
      <div className="absolute -top-1 -left-1 bg-foreground text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
        {forma.icon}
      </div>

      {/* Nombre personalizado */}
      {mesa.customName && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-foreground text-white px-2 py-1 rounded text-xs whitespace-nowrap">
          {mesa.customName}
        </div>
      )}

      {/* Indicador de zona */}
      <div className={cn(
        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
        mesa.zona === 'principal' ? "bg-blue-500" : "bg-green-500"
      )} />
    </div>
  );
}
