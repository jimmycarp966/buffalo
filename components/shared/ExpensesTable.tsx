"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getActiveCashSession } from "@/actions/cashActions";
import { getUserNavigationPermissions } from "@/actions/permissionActions";
import { ExpenseModal } from "./ExpenseModal";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: "services" | "supplies" | "maintenance" | "other";
  created_at: string;
  cash_register_session_id: string;
  user?: { name: string };
  cash_register_session?: {
    cash_register?: { name: string; type: string };
  };
}

interface ExpensesTableProps {
  expenses: Expense[];
}

export function ExpensesTable({ expenses }: ExpensesTableProps) {
  const [search, setSearch] = useState("");
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [user, setUser] = useState<any>({ role: 'waiter' }); // Asumir permisos por defecto
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false); // No loading inicialmente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const router = useRouter();

  // Verificar permisos usando el sistema de permisos granulares
  // Fallback: si no hay permisos cargados, permitir por rol
  const hasLoadedPermissions = Object.keys(userPermissions).length > 0;
  const fallbackPermission = user?.role === 'waiter' || user?.role === 'admin';

  const canCreateExpense = hasLoadedPermissions
    ? userPermissions['expenses.create'] === true
    : fallbackPermission; // Usar fallback mientras se cargan permisos

  const canEditExpense = hasLoadedPermissions
    ? userPermissions['expenses.edit'] === true
    : user?.role === 'admin';

  // Verificar si hay sesiones de caja abiertas
  const hasOpenSessions = activeSessions.length > 0;

  // El botón está habilitado solo si tiene permisos (independientemente de sesiones abiertas)
  // Esto permite que los gastos se registren incluso si hay problemas de detección de sesiones
  const isButtonEnabled = canCreateExpense;

  // Debug logging
  console.log("🔍 ExpensesTable: canCreateExpense =", canCreateExpense, "hasLoadedPermissions =", hasLoadedPermissions, "fallbackPermission =", fallbackPermission, "userPermissions =", userPermissions);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Intentar obtener información real del usuario (sin bloquear la UI)
        const supabase = createClient();

        // Timeout más corto para mejor UX
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), 1000)
        );

        const { data: { user: authUser } } = await Promise.race([userPromise, timeoutPromise]) as any;

        if (authUser) {
          try {
            // Obtener datos del usuario con timeout más corto
            const userDataPromise = supabase
              .from("users")
              .select("role")
              .eq("id", authUser.id)
              .single();

            const userTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('User data timeout')), 1000)
            );

            const { data: userData } = await Promise.race([userDataPromise, userTimeoutPromise]) as any;
            if (userData) {
              setUser(userData);

              // Cargar permisos del usuario
              try {
                console.log("🔍 ExpensesTable: Loading permissions for user", authUser.id);
                const permissionsPromise = getUserNavigationPermissions(authUser.id);
                const permissionsTimeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Permissions timeout')), 3000) // Aumentar a 3 segundos
                );

                const { data: permissionsData } = await Promise.race([permissionsPromise, permissionsTimeoutPromise]) as any;
                console.log("✅ ExpensesTable: Permissions loaded", permissionsData);

                if (permissionsData) {
                  setUserPermissions(permissionsData);
                  console.log("✅ ExpensesTable: Permissions set in state", permissionsData['expenses.create']);
                } else {
                  console.warn("⚠️ ExpensesTable: No permissions data received");
                }
              } catch (permissionsError) {
                console.error("❌ ExpensesTable: Could not fetch user permissions", permissionsError);
              }
            }
          } catch (userError) {
            // Si falla obtener datos del usuario, mantener el rol por defecto
            console.warn("Could not fetch user data, keeping default role");
          }
        }

        // Obtener sesiones activas (sin timeout, no crítico)
        try {
          const result = await getActiveCashSession();
          setActiveSessions(result.data || []);
        } catch (sessionError) {
          // Si falla obtener sesiones, no es crítico
          console.warn("Could not fetch active sessions");
          setActiveSessions([]);
        }
      } catch (error) {
        // Error general - mantener configuración por defecto
        console.warn("Auth check failed, using default permissions");
      }
    };

    // Ejecutar en background sin bloquear la UI
    fetchData();
  }, []);

  const filteredExpenses = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );


  const handleNewExpense = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleModalSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gastos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          disabled={!isButtonEnabled}
          onClick={handleNewExpense}
          title={
            !canCreateExpense
              ? "No tienes permisos para registrar gastos"
              : "Registrar nuevo gasto"
          }
          size="sm"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2">Nuevo Gasto</span>
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Categoría</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Caja</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Monto</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Registrado por</th>
                {canEditExpense && (
                  <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="h-12 w-12 text-muted-foreground/50" />
                      <p>No se encontraron gastos</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {formatDate(new Date(expense.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{expense.description}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="secondary">{expense.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {expense.cash_register_session?.cash_register?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                      {expense.user?.name || "-"}
                    </td>
                    {canEditExpense && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditExpense(expense)}
                          title="Editar gasto"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseModal
        open={isModalOpen}
        onClose={handleCloseModal}
        expense={editingExpense}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

