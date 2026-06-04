import { getCashRegisters, getActiveCashSession } from "@/actions/cashActions";
import { getOpenTables } from "@/actions/barActions";
import { getProductsForSearch } from "@/actions/productActions";
import { PointOfSaleTabs } from "@/components/shared/PointOfSaleTabs";
import { getCachedBarLayoutsForAreas } from "@/lib/cache";
import { ErrorState, TablesMapSkeleton, InfoAlert } from "@/components/design-system";
import { AlertCircle, RefreshCw } from "lucide-react";

// Forzar que esta página siempre haga fetch en cada request (sin cache)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Página de Caja Bar mejorada con Design System
 * - Estados de error amigables
 * - Skeletons de carga
 * - Mejor feedback visual
 */
export default async function CajaBarPage() {
  const result = await getCashRegisters();

  // Error al cargar cajas registradoras
  if (!result.success) {
    console.error("❌ [SERVER] Error obteniendo cajas registradoras:", result.message);
    return (
      <div className="py-12">
        <ErrorState
          title="Error al cargar cajas"
          message={result.message || "No se pudieron cargar las cajas registradoras. Por favor, intenta nuevamente."}
          onRetry={async () => {
            'use server';
            // Revalidar la página
            const { revalidatePath } = await import('next/cache');
            revalidatePath('/caja-bar');
          }}
        />
        
        {/* Detalles técnicos (colapsable) */}
        <details className="mt-4 max-w-2xl mx-auto">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground text-center">
            Ver detalles técnicos
          </summary>
          <pre className="mt-2 p-4 bg-muted/50 rounded-lg text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  const cashRegisters = result.data;
  const barRegister = cashRegisters?.find((r) => r.type === "bar");

  // No se encontró la caja bar
  if (!barRegister) {
    return (
      <div className="py-12">
        <ErrorState
          title="Caja Bar no encontrada"
          message="No se encontró la caja Bar en la base de datos. Por favor, verifica la configuración del sistema."
        />
        
        <InfoAlert variant="info" className="mt-4 max-w-2xl mx-auto">
          <p className="font-medium">Total de cajas encontradas: {cashRegisters?.length || 0}</p>
          <p className="text-sm mt-1">
            Cajas disponibles: {cashRegisters?.map(r => r.name).join(", ") || "Ninguna"}
          </p>
        </InfoAlert>

        <details className="mt-4 max-w-2xl mx-auto">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground text-center">
            Ver detalles técnicos
          </summary>
          <pre className="mt-2 p-4 bg-muted/50 rounded-lg text-xs overflow-auto">
            {JSON.stringify({ result, cashRegisters, barRegister }, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // Cargar datos en paralelo
  const [activeSessionResult, openTablesResult, layoutsResult, productSearchIndexResult] = await Promise.all([
    getActiveCashSession(barRegister.id),
    getOpenTables(),
    getCachedBarLayoutsForAreas(),
    getProductsForSearch(),
  ]);

  // Error al cargar sesiones
  if (!activeSessionResult.success) {
    console.error("Error obteniendo sesiones activas:", activeSessionResult.message);
    return (
      <div className="py-12">
        <ErrorState
          title="Error al cargar sesiones"
          message={activeSessionResult.message || "No se pudieron cargar las sesiones activas."}
        />
      </div>
    );
  }

  // Error al cargar mesas
  if (!openTablesResult.success) {
    console.error("Error obteniendo mesas abiertas:", openTablesResult.message);
    return (
      <div className="py-12">
        <ErrorState
          title="Error al cargar mesas"
          message={openTablesResult.message || "No se pudieron cargar las mesas abiertas."}
        />
      </div>
    );
  }

  const activeSessions = activeSessionResult.data;
  const barSession = activeSessions?.find((s) => s.area === "bar");

  const initialLayoutSalon = layoutsResult.data?.salon ?? [];
  const initialLayoutVereda = layoutsResult.data?.vereda ?? [];
  const initialProductSearchIndex = productSearchIndexResult.success ? productSearchIndexResult.data : [];

  return (
    <div className="space-y-6 w-full">
      {/* Sistema completo: Pestañas de Punto de Venta */}
      <PointOfSaleTabs
        cashRegister={barRegister}
        initialSession={barSession}
        initialCashSessionResult={activeSessionResult}
        initialOpenTablesResult={openTablesResult}
        initialLayouts={{
          salon: initialLayoutSalon,
          vereda: initialLayoutVereda,
        }}
        initialProductSearchIndex={initialProductSearchIndex}
      />
    </div>
  );
}
