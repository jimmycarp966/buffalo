"use client";

import { useQuery } from "@tanstack/react-query";
import { getProducts, getProductsForSearch } from "@/actions/productActions";
import { queryConfigs } from "@/lib/react-query";

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts(),
    ...queryConfigs.products,
  });
}

export function useProductsWithStats() {
  return useQuery({
    queryKey: ['products-with-stats'],
    queryFn: async () => {
      const { getProductsWithStats } = await import("@/actions/productActions");
      return getProductsWithStats();
    },
    ...queryConfigs.products,
  });
}

export function useProductSearchIndex(initialData?: Awaited<ReturnType<typeof getProductsForSearch>>) {
  return useQuery({
    queryKey: ['product-search-index'],
    queryFn: () => getProductsForSearch(),
    initialData,
    ...queryConfigs.products,
  });
}









