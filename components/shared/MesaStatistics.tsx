"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Clock, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Timer
} from "lucide-react";
import { Mesa, MesaStats } from "@/types/mesa";

interface MesaStatisticsProps {
  mesas: Mesa[];
  className?: string;
}

export function MesaStatistics({ mesas, className }: MesaStatisticsProps) {
  const stats = calculateStats(mesas);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Resumen general */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Resumen General
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalMesas}</div>
            <div className="text-sm text-muted-foreground">Total Mesas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.disponibles}</div>
            <div className="text-sm text-muted-foreground">Disponibles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.ocupadas}</div>
            <div className="text-sm text-muted-foreground">Ocupadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.reservadas}</div>
            <div className="text-sm text-muted-foreground">Reservadas</div>
          </div>
        </div>
      </Card>

      {/* Ocupación por zona */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-green-500" />
          Ocupación por Zona
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Zona Principal</span>
              <Badge variant="outline">
                {mesas.filter(m => m.zona === 'principal').length} mesas
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(mesas.filter(m => m.zona === 'principal' && m.estado === 'ocupada').length / 
                           mesas.filter(m => m.zona === 'principal').length) * 100}%` 
                }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Zona Exterior</span>
              <Badge variant="outline">
                {mesas.filter(m => m.zona === 'exterior').length} mesas
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(mesas.filter(m => m.zona === 'exterior' && m.estado === 'ocupada').length / 
                           mesas.filter(m => m.zona === 'exterior').length) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tiempo promedio de ocupación */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          Tiempo Promedio de Ocupación
        </h3>
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">
            {Math.floor(stats.tiempoPromedioOcupacion)} min
          </div>
          <div className="text-sm text-muted-foreground">
            Promedio de todas las mesas ocupadas
          </div>
        </div>
      </Card>

      {/* Rotación diaria */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          Rotación Diaria
        </h3>
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-600">
            {stats.rotacionDiaria}
          </div>
          <div className="text-sm text-muted-foreground">
            Veces que se han usado las mesas hoy
          </div>
        </div>
      </Card>

      {/* Mesas más ocupadas */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          Mesas Más Activas
        </h3>
        <div className="space-y-2">
          {stats.mesasMasOcupadas.slice(0, 5).map((mesa, index) => (
            <div key={mesa.numero} className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-3">
                <Badge variant="outline">#{index + 1}</Badge>
                <span className="font-medium">Mesa {mesa.numero}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {mesa.vecesUsada} usos • {Math.floor(mesa.tiempoTotal / 60)}h
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Alertas */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Alertas
        </h3>
        <div className="space-y-2">
          {mesas.filter(m => m.estado === 'ocupada' && m.horaOcupacion && 
            (new Date().getTime() - m.horaOcupacion.getTime()) > 2 * 60 * 60 * 1000).map(mesa => (
            <div key={mesa.numero} className="flex items-center gap-3 p-2 bg-red-50 rounded">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm">
                Mesa {mesa.numero} lleva más de 2 horas ocupada
              </span>
            </div>
          ))}
          {mesas.filter(m => m.estado === 'limpieza' && m.horaInicioLimpieza && 
            (new Date().getTime() - m.horaInicioLimpieza.getTime()) > 30 * 60 * 1000).map(mesa => (
            <div key={mesa.numero} className="flex items-center gap-3 p-2 bg-orange-50 rounded">
              <Timer className="w-4 h-4 text-orange-500" />
              <span className="text-sm">
                Mesa {mesa.numero} lleva más de 30 min en limpieza
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Función para calcular estadísticas
function calculateStats(mesas: Mesa[]): MesaStats {
  const ahora = new Date();
  const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  // Contar estados
  const totalMesas = mesas.length;
  const disponibles = mesas.filter(m => m.estado === 'disponible').length;
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
  const reservadas = mesas.filter(m => m.estado === 'reservada').length;
  const enLimpieza = mesas.filter(m => m.estado === 'limpieza').length;

  // Calcular tiempo promedio de ocupación
  const mesasOcupadas = mesas.filter(m => m.estado === 'ocupada' && m.horaOcupacion);
  const tiempoPromedioOcupacion = mesasOcupadas.length > 0 
    ? mesasOcupadas.reduce((sum, mesa) => {
        const tiempoOcupada = (ahora.getTime() - mesa.horaOcupacion!.getTime()) / (1000 * 60);
        return sum + tiempoOcupada;
      }, 0) / mesasOcupadas.length
    : 0;

  // Calcular rotación diaria (simulado - en un sistema real vendría de la base de datos)
  const rotacionDiaria = mesas.reduce((sum, mesa) => {
    // Simular rotación basada en el estado y tiempo
    if (mesa.estado === 'ocupada' && mesa.horaOcupacion) {
      const horasOcupada = (ahora.getTime() - mesa.horaOcupacion.getTime()) / (1000 * 60 * 60);
      return sum + Math.floor(horasOcupada) + 1; // +1 por la ocupación actual
    }
    return sum;
  }, 0);

  // Mesas más ocupadas (simulado)
  const mesasMasOcupadas = mesas.map(mesa => ({
    numero: mesa.numero,
    tiempoTotal: mesa.horaOcupacion 
      ? (ahora.getTime() - mesa.horaOcupacion.getTime()) / (1000 * 60)
      : 0,
    vecesUsada: Math.floor(Math.random() * 10) + 1 // Simulado
  })).sort((a, b) => b.tiempoTotal - a.tiempoTotal);

  return {
    totalMesas,
    disponibles,
    ocupadas,
    reservadas,
    enLimpieza,
    tiempoPromedioOcupacion,
    rotacionDiaria,
    mesasMasOcupadas
  };
}

// Hook para usar estadísticas
export function useMesaStatistics(mesas: Mesa[]) {
  const [stats, setStats] = React.useState<MesaStats>(() => calculateStats(mesas));

  React.useEffect(() => {
    setStats(calculateStats(mesas));
  }, [mesas]);

  return stats;
}
