import { getCashRegisters } from "@/actions/cashActions";
import { CashHistoryTab } from "@/components/shared/CashHistoryTab";
import { ErrorState } from "@/components/design-system";

// Siempre datos frescos
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaHistorialPage() {
  const result = await getCashRegisters();
  const barRegister = result.success ? result.data?.find((r: any) => r.type === "bar") : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historial de Caja</h1>
        <p className="text-muted-foreground">
          Arqueos de cierres anteriores. No necesitás tener una caja abierta para verlos.
        </p>
      </div>

      {barRegister ? (
        <CashHistoryTab cashRegisterId={barRegister.id} />
      ) : (
        <ErrorState
          title="Caja no encontrada"
          message="No se encontró la caja Bar en la base de datos."
        />
      )}
    </div>
  );
}
