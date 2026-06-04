import { getExpenses } from "@/actions/expenseActions";
import { ExpensesTable } from "@/components/shared/ExpensesTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function GastosPage() {
  const result = await getExpenses();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground">Registra y gestiona los gastos diarios</p>
        </div>
        <div className="rounded-md bg-red-500/10 p-4 border border-red-500/20">
          <div className="text-red-700">
            <strong>Error al cargar gastos:</strong> {result.message}
          </div>
        </div>
      </div>
    );
  }

  const expenses = result.data || [];

  // Calcular totales
  const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount || 0), 0);

  // Calcular gastos del día (hoy)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayExpenses = expenses
    .filter((exp: any) => {
      const expDate = new Date(exp.created_at);
      expDate.setHours(0, 0, 0, 0);
      return expDate.getTime() === today.getTime();
    })
    .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount || 0), 0);

  // Calcular gastos del mes
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthExpenses = expenses
    .filter((exp: any) => {
      const expDate = new Date(exp.created_at);
      return expDate >= startOfMonth;
    })
    .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
        <p className="text-muted-foreground">Registra y gestiona los gastos diarios</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Histórico</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{expenses.length} gastos registrados</p>
          </CardContent>
        </Card>

        <Card className={todayExpenses > 0 ? "border-orange-200 bg-orange-50/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${todayExpenses > 0 ? "text-orange-600" : ""}`}>
              {formatCurrency(todayExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.filter((exp: any) => {
                const expDate = new Date(exp.created_at);
                expDate.setHours(0, 0, 0, 0);
                return expDate.getTime() === today.getTime();
              }).length} gastos hoy
            </p>
          </CardContent>
        </Card>

        <Card className={monthExpenses > 0 ? "border-blue-200 bg-blue-50/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthExpenses > 0 ? "text-blue-600" : ""}`}>
              {formatCurrency(monthExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.filter((exp: any) => new Date(exp.created_at) >= startOfMonth).length} gastos en {today.toLocaleDateString('es-AR', { month: 'long' })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Gastos</CardTitle>
          <CardDescription>
            {expenses.length} gastos registrados en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <ExpensesTable expenses={expenses} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

