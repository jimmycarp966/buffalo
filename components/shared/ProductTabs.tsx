"use client";

import { useSearchParams } from "next/navigation";
import { ProductsTable } from "@/components/shared/ProductsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  cost_price: number;
  sale_price: number;
  profit_margin: number | null;
  use_auto_price: boolean;
  stock: number;
  min_stock: number;
  category?: { name: string } | null;
  is_active: boolean;
  unlimited_stock: boolean;
}


interface ProductTabsProps {
  products: Product[];
  lowStockProducts: Product[];
}

export function ProductTabs({ products, lowStockProducts }: ProductTabsProps) {
  const searchParams = useSearchParams();
  const defaultTab = "productos";

  return (
    <Tabs defaultValue={defaultTab} className="w-full" suppressHydrationWarning>
      <TabsList className="grid w-full grid-cols-1">
        <TabsTrigger value="productos">Productos</TabsTrigger>
      </TabsList>

      <TabsContent value="productos">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Productos</CardTitle>
            <CardDescription>
              {products?.length || 0} productos en el inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsTable products={products || []} />
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  );
}
