// Tipos para el sistema de mesas estilo Fudo
export interface Mesa {
  id: string;
  numero: number;
  capacidad: number;
  forma: 'circular' | 'rectangular' | 'cuadrada';
  estado: 'disponible' | 'ocupada' | 'reservada' | 'limpieza';
  posicion: { x: number; y: number };
  zona: 'principal' | 'exterior';
  comensales?: number;
  ordenId?: string;
  horaOcupacion?: Date;
  horaReserva?: Date;
  horaInicioLimpieza?: Date;
  customName?: string;
  is_active?: boolean;
  shape?: string;
}

export interface MesaStats {
  totalMesas: number;
  disponibles: number;
  ocupadas: number;
  reservadas: number;
  enLimpieza: number;
  tiempoPromedioOcupacion: number; // en minutos
  rotacionDiaria: number;
  mesasMasOcupadas: Array<{
    numero: number;
    tiempoTotal: number;
    vecesUsada: number;
  }>;
}

export interface MesaFilter {
  estado?: Mesa['estado'];
  zona?: Mesa['zona'];
  capacidadMin?: number;
  capacidadMax?: number;
  forma?: Mesa['forma'];
}

export interface MesaNotification {
  id: string;
  mesaNumero: number;
  tipo: 'ocupacion_larga' | 'reserva_proxima' | 'limpieza_pendiente';
  mensaje: string;
  timestamp: Date;
  leida: boolean;
}

export interface MesaTimer {
  mesaNumero: number;
  tipo: 'ocupacion' | 'reserva' | 'limpieza';
  inicio: Date;
  duracion: number; // en minutos
  activo: boolean;
}

// Estados visuales para las mesas
export const MESA_ESTADOS = {
  disponible: {
    color: 'bg-green-500',
    icon: '🟢',
    label: 'Disponible',
    descripcion: 'Mesa libre para nuevos comensales'
  },
  ocupada: {
    color: 'bg-red-500',
    icon: '🔴',
    label: 'Ocupada',
    descripcion: 'Mesa en uso con comensales'
  },
  reservada: {
    color: 'bg-yellow-500',
    icon: '🟡',
    label: 'Reservada',
    descripcion: 'Mesa reservada para hora específica'
  },
  limpieza: {
    color: 'bg-gray-500',
    icon: '⚪',
    label: 'Por Limpiar',
    descripcion: 'Mesa necesita limpieza antes de usar'
  }
} as const;

// Formas de mesa
export const MESA_FORMAS = {
  circular: {
    icon: '●',
    label: 'Circular',
    className: 'rounded-full'
  },
  rectangular: {
    icon: '▬',
    label: 'Rectangular',
    className: 'rounded-lg'
  },
  cuadrada: {
    icon: '■',
    label: 'Cuadrada',
    className: 'rounded-md'
  }
} as const;

// Configuración de notificaciones
export const NOTIFICATION_CONFIG = {
  ocupacion_larga: {
    tiempoLimite: 120, // 2 horas en minutos
    mensaje: 'Mesa {numero} lleva más de {tiempo} ocupada',
    tipo: 'warning'
  },
  reserva_proxima: {
    tiempoLimite: 15, // 15 minutos antes
    mensaje: 'Reserva próxima en mesa {numero}',
    tipo: 'info'
  },
  limpieza_pendiente: {
    tiempoLimite: 30, // 30 minutos en limpieza
    mensaje: 'Mesa {numero} lleva mucho tiempo en limpieza',
    tipo: 'error'
  }
} as const;
