import { getProductsWithStats } from "@/actions/productActions";
import { ProductTabs } from "@/components/shared/ProductTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// Configurar revalidación inteligente (5 minutos)
export const revalidate = 300;

export default async function ProductosPage() {
  // Obtener todos los datos de productos en una sola consulta optimizada
  const { success, data: productsData, message } = await getProductsWithStats();

  if (!success || !productsData) {
    console.error("Error loading products:", message);
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Error al cargar productos</p>
      </div>
    );
  }

  const { products, lowStockProducts } = productsData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
        <p className="text-muted-foreground">Gestiona tu inventario de productos y consulta el historial de movimientos</p>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-500/25 bg-yellow-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-foreground">Productos con Stock Bajo</CardTitle>
            </div>
            <CardDescription className="text-yellow-700">
              {lowStockProducts.length} producto{lowStockProducts.length > 1 ? "s" : ""}{" "}
              necesita{lowStockProducts.length === 1 ? "" : "n"} reposición
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.slice(0, 5).map((product: any) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-yellow-700">
                    Stock: {product.stock} (Mín: {product.min_stock})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ProductTabs
        products={products}
        lowStockProducts={lowStockProducts}
      />
    </div>
  );
}

