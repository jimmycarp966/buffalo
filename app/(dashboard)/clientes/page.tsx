import { CustomersTable } from "@/components/shared/CustomersTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground">
          Cuentas corrientes: cargá clientes, fijá su límite de crédito, mirá el saldo y registrá pagos.
        </p>
      </div>
      <CustomersTable />
    </div>
  );
}
