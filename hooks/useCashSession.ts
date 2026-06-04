"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getActiveCashSession } from "@/actions/cashActions";
import { queryConfigs } from "@/lib/react-query";

type CashSessionResult = Awaited<ReturnType<typeof getActiveCashSession>>;

interface UseCashSessionOptions {
  cashRegisterId?: string;
  initialData?: CashSessionResult;
}

export function useCashSession({
  cashRegisterId,
  initialData,
}: UseCashSessionOptions = {}): UseQueryResult<CashSessionResult> {
  return useQuery({
    queryKey: ["cashSessions", cashRegisterId || "bar"],
    queryFn: () => getActiveCashSession(cashRegisterId),
    initialData,
    ...queryConfigs.cashSessions,
  });
}

export function useBarCashSession(initialData?: CashSessionResult) {
  return useCashSession({ initialData });
}
