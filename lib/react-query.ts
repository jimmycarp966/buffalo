import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos por defecto
      gcTime: 1000 * 60 * 30, // 30 minutos (antes cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Solo refetch al montar, no en background
      refetchOnReconnect: true, // Refetch al reconectar
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
      networkMode: 'online', // Solo ejecutar cuando hay conexión
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'online',
    },
  },
});

// Configuraciones específicas por tipo de datos (optimizadas para conexión lenta)
export const queryConfigs = {
  products: {
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchInterval: false as const, // Sin refetch automático para ahorrar ancho de banda
    refetchOnMount: true, // Solo al montar
    refetchOnWindowFocus: false, // No refetch al cambiar de pestaña
  },
  sales: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchInterval: false as const, // Sin refetch automático
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  },
  tables: {
    staleTime: 15 * 1000, // 15 segundos - balance entre frescura y rendimiento
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: false as const, // Desactivado para reducir consumo de CPU - usar refetch manual
    refetchIntervalInBackground: false, // No refetch en background
    refetchOnMount: true,
    refetchOnWindowFocus: false, // No refetch al cambiar de pestaña
  },
  stats: {
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
    refetchInterval: false as const, // Sin refetch automático
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  },
  config: {
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    refetchOnMount: false, // Solo refetch cuando se invalida manualmente
    refetchOnWindowFocus: false,
    refetchInterval: false as const,
  },
  // Nueva configuración para datos críticos de caja
  cash: {
    staleTime: 30 * 1000, // 30 segundos - más agresivo para datos críticos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: false as const, // Sin refetch automático
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    networkMode: 'online' as const,
  },
  cashSessions: {
    staleTime: 2 * 1000, // 2 segundos - ultra agresivo para primera carga
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: false as const, // Sin refetch automático
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    networkMode: 'online' as const,
    retry: 1, // Solo 1 retry para ser más rápido
  },
};

