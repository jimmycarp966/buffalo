"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSales, createSale } from "@/actions/saleActions";
import { queryConfigs } from "@/lib/react-query";

interface SaleMutationOptions {
  skipOpenTablesInvalidation?: boolean;
}

export function useSales(sessionId?: string) {
  return useQuery({
    queryKey: ['sales', sessionId],
    queryFn: () => getSales(sessionId),
    ...queryConfigs.sales,
  });
}

export function useSaleMutation(options?: SaleMutationOptions) {
  const queryClient = useQueryClient();
  const shouldInvalidateOpenTables = options?.skipOpenTablesInvalidation !== true;
  
  return useMutation({
    mutationFn: createSale,
    onSuccess: () => {
      // Invalidar queries relacionadas después de crear una venta
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      if (shouldInvalidateOpenTables) {
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSettled: () => {
      if (!shouldInvalidateOpenTables) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['openTables'] });
    },
  });
}









