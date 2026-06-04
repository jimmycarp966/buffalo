"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getOpenTables } from "@/actions/barActions";
import { getActiveCashSession } from "@/actions/cashActions";
import { queryConfigs } from "@/lib/react-query";

export type OpenTablesResult = Awaited<ReturnType<typeof getOpenTables>>;

export function useOpenTables(initialData?: OpenTablesResult): UseQueryResult<OpenTablesResult> {
  return useQuery({
    queryKey: ["openTables"],
    queryFn: () => getOpenTables(),
    initialData,
    ...queryConfigs.tables,
  });
}

// Hook específico para sesiones activas de caja
export function useActiveCashSession(cashRegisterId?: string, initialData?: Awaited<ReturnType<typeof getActiveCashSession>>) {
  return useQuery({
    queryKey: ["activeCashSession", cashRegisterId],
    queryFn: () => getActiveCashSession(cashRegisterId),
    initialData,
    ...queryConfigs.cash,
  });
}









