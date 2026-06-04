import dynamic from 'next/dynamic';

// ============================================================================
// COMPONENTES CON LAZY LOADING
// ============================================================================
// Este archivo contiene componentes que se cargan bajo demanda para mejorar el rendimiento

// Modal de producto con lazy loading
export const ProductModal = dynamic(() =>
  import('./ProductModal').then(mod => ({ default: mod.ProductModal })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando...</span>
      </div>
    )
  }
);

// Gráficos de reportes con lazy loading (sin SSR)
export const ReportsCharts = dynamic(() =>
  import('./ReportsCharts').then(mod => ({ default: mod.ReportsCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando gráficos...</span>
      </div>
    )
  }
);

// Vista del canvas del bar con lazy loading (sin SSR)
export const BarCanvasView = dynamic(() =>
  import('./BarCanvasView').then(mod => ({ default: mod.BarCanvasView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando mapa del bar...</span>
      </div>
    )
  }
);

/*
// Modal de configuración con lazy loading
export const ConfigurationModal = dynamic(() => 
  import('./ConfigurationModal').then(mod => ({ default: mod.ConfigurationModal })),
  { 
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando configuración...</span>
      </div>
    )
  }
);
*/

// Modal de permisos con lazy loading
export const PermissionsModal = dynamic(() =>
  import('./PermissionsModal').then(mod => ({ default: mod.PermissionsModal })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando permisos...</span>
      </div>
    )
  }
);

// Modal de importación PDF con lazy loading
export const ImportPDFModal = dynamic(() =>
  import('./ImportPDFModal').then(mod => ({ default: mod.ImportPDFModal })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Cargando importador...</span>
      </div>
    )
  }
);

// Monitor del sistema con lazy loading
export const SystemMonitor = dynamic(() =>
  import('./SystemMonitor').then(mod => ({ default: mod.SystemMonitor })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-sm">Cargando monitor...</span>
      </div>
    )
  }
);

// Componente de exportación con lazy loading
export const ExportButtons = dynamic(() =>
  import('./ExportButtons').then(mod => ({ default: mod.ExportButtons })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-sm">Cargando exportador...</span>
      </div>
    )
  }
);

// Vista de venta (POS) con lazy loading
export const SaleView = dynamic(() =>
  import('./SaleView').then(mod => ({ default: mod.SaleView })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-buffalo-caramel"></div>
        <span className="ml-2">Cargando venta...</span>
      </div>
    )
  }
);

// Vista de mostrador con lazy loading
export const CounterSaleView = dynamic(() =>
  import('./CounterSaleView').then(mod => ({ default: mod.CounterSaleView })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Cargando mostrador...</span>
      </div>
    )
  }
);

// Lista de pedidos delivery con lazy loading
export const DeliveryOrdersList = dynamic(() =>
  import('./DeliveryOrdersList').then(mod => ({ default: mod.DeliveryOrdersList })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="ml-2">Cargando pedidos...</span>
      </div>
    )
  }
);

/*
-- ============================================================================
-- COMENTARIOS SOBRE LAZY LOADING
-- ============================================================================
-- Estos componentes se cargan bajo demanda para mejorar el rendimiento:
-- 1. Modales pesados (ProductModal, PermissionsModal, etc.)
-- 2. Componentes con gráficos (ReportsCharts)
-- 3. Componentes del bar (BarCanvasView)
-- 4. Componentes de configuración y administración

-- Los componentes con ssr: false no se renderizan en el servidor
-- Los componentes de loading muestran un spinner mientras cargan
-- Esto reduce el tamaño del bundle inicial y mejora los tiempos de carga
*/

