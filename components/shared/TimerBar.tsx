"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimerBarProps {
  createdAt: string;
}

export function TimerBar({ createdAt }: TimerBarProps) {
  const [timeInMinutes, setTimeInMinutes] = useState(0);

  useEffect(() => {
    // Calcular tiempo inicial
    calculateTime();

    // Actualizar cada 60 segundos
    const interval = setInterval(() => {
      calculateTime();
    }, 60000);

    return () => clearInterval(interval);
  }, [createdAt]);

  const calculateTime = () => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    setTimeInMinutes(diffMins);
  };

  // Determinar color y porcentaje según tiempo
  const getTimerStyles = () => {
    if (timeInMinutes <= 30) {
      // Verde: Recién abierta (0-30 min)
      return {
        bg: "bg-emerald-500",
        bgLight: "bg-emerald-100",
        width: Math.min((timeInMinutes / 30) * 100, 100),
        label: "Reciente",
      };
    } else if (timeInMinutes <= 60) {
      // Amarillo: Tiempo normal (30-60 min)
      return {
        bg: "bg-yellow-500",
        bgLight: "bg-yellow-100",
        width: 100,
        label: "Normal",
      };
    } else if (timeInMinutes <= 120) {
      // Naranja: Tiempo largo (60-120 min)
      return {
        bg: "bg-orange-500",
        bgLight: "bg-orange-100",
        width: 100,
        label: "Largo",
      };
    } else {
      // Rojo: Mucho tiempo (120+ min)
      return {
        bg: "bg-red-500",
        bgLight: "bg-red-100",
        width: 100,
        label: "¡Alerta!",
      };
    }
  };

  const timerStyles = getTimerStyles();

  const formatTime = () => {
    if (timeInMinutes < 60) {
      return `${timeInMinutes}m`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const mins = timeInMinutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  return (
    <div className="relative group">
      {/* Barra de fondo */}
      <div className={cn("w-full h-1.5 rounded-full overflow-hidden", timerStyles.bgLight)}>
        {/* Barra de progreso */}
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            timerStyles.bg
          )}
          style={{ width: `${timerStyles.width}%` }}
        />
      </div>

      {/* Tooltip al hacer hover */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-900 text-white px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {formatTime()} abierta
      </div>
    </div>
  );
}




















