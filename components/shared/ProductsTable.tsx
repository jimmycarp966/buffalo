"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Package, History, ChevronLeft, ChevronRight, Upload, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ProductModal } from "./ProductModal";
import { PriceHistoryModal } from "./PriceHistoryModal";
import { ImportPDFModal } from "./ImportPDFModal";
import { deleteProduct, updateProduct } from "@/actions/productActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useAuthStore } from "@/store/authStore";

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
  supplier?: { name: string } | null;
  is_active: boolean;
  unlimited_stock: boolean;
  cocina_only?: boolean | null | undefined;
}

interface ProductsTableProps {
  products: Product[];
}

type SortColumn = "name" | "category" | "code" | "cost_price" | "sale_price" | "stock" | null;
type SortDirection = "asc" | "desc";

export function ProductsTable({ products }: ProductsTableProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [savingPriceProductId, setSavingPriceProductId] = useState<string | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const itemsPerPage = 20;
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const confirm = useConfirm();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";

  const getDisplayedSalePrice = (product: Product) =>
    priceOverrides[product.id] ?? product.sale_price;

  const beginPriceEdit = (product: Product) => {
    if (savingPriceProductId === product.id) return;

    setEditingPriceProductId(product.id);
    setEditingPriceValue(String(getDisplayedSalePrice(product)));
  };

  const cancelPriceEdit = () => {
    setEditingPriceProductId(null);
    setEditingPriceValue("");
  };

  const parsePriceInput = (value: string) => {
    const normalizedValue = value.trim().replace(",", ".");

    if (!normalizedValue) {
      return null;
    }

    const parsed = Number(normalizedValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  };

  const saveSalePrice = async (product: Product) => {
    const parsedPrice = parsePriceInput(editingPriceValue);

    if (parsedPrice === null) {
      addNotification("error", "Ingresá un precio válido");
      return;
    }

    if (parsedPrice === getDisplayedSalePrice(product)) {
      cancelPriceEdit();
      return;
    }

    setSavingPriceProductId(product.id);

    try {
      const result = await updateProduct(product.id, {
        sale_price: parsedPrice,
      });

      if (result.success) {
        setPriceOverrides((current) => ({
          ...current,
          [product.id]: parsedPrice,
        }));
        addNotification("success", "Precio actualizado correctamente");
        cancelPriceEdit();
        router.refresh();
      } else {
        addNotification("error", result.message || "No se pudo actualizar el precio");
      }
    } catch (error) {
      console.error("Error updating sale price:", error);
      addNotification("error", "Error inesperado al actualizar el precio");
    } finally {
      setSavingPriceProductId(null);
    }
  };

  // Función para manejar el ordenamiento
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Si ya está ordenando por esta columna, cambiar dirección o resetear
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Resetear a la primera página al ordenar
  };

  // Componente para el encabezado ordenable
  const SortableHeader = ({ column, label, align = "left" }: { column: SortColumn; label: string; align?: "left" | "right" | "center" }) => {
    const isActive = sortColumn === column;
    const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

    return (
      <th className={`px-4 py-3 text-${align} text-sm font-medium`}>
        <button
          onClick={() => handleSort(column)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${alignClass} ${isActive ? "text-foreground" : "text-muted-foreground"}`}
        >
          {label}
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          )}
        </button>
      </th>
    );
  };

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, search]);

  // Ordenar productos
  const sortedProducts = useMemo(() => {
    if (!sortColumn) return filteredProducts;

    return [...filteredProducts].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
          break;
        case "category":
          const catA = a.category?.name || "";
          const catB = b.category?.name || "";
          comparison = catA.localeCompare(catB, "es", { sensitivity: "base" });
          break;
        case "code":
          const codeA = a.code || "";
          const codeB = b.code || "";
          comparison = codeA.localeCompare(codeB, "es", { sensitivity: "base" });
          break;
        case "cost_price":
          comparison = a.cost_price - b.cost_price;
          break;
        case "sale_price":
          comparison = a.sale_price - b.sale_price;
          break;
        case "stock":
          // Productos con stock ilimitado van al final
          if (a.unlimited_stock && !b.unlimited_stock) return 1;
          if (!a.unlimited_stock && b.unlimited_stock) return -1;
          if (a.unlimited_stock && b.unlimited_stock) return 0;
          comparison = a.stock - b.stock;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProducts.slice(startIndex, endIndex);
  }, [sortedProducts, currentPage]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleImportPDF = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleShowPriceHistory = (product: Product) => {
    setSelectedProduct(product);
    setIsPriceHistoryOpen(true);
  };

  const handleClosePriceHistory = () => {
    setIsPriceHistoryOpen(false);
    setSelectedProduct(null);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isAdmin) {
      addNotification("error", "Solo los administradores pueden eliminar productos");
      return;
    }

    const confirmed = await confirm({
      title: "🗑️ Eliminar Producto",
      description: `¿Eliminar el producto "${product.name}"?\n\nEsta acción lo quitará del listado y no podrá utilizarse en nuevas ventas.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "destructive"
    });
    if (!confirmed) return;

    setDeletingProductId(product.id);
    try {
      const result = await deleteProduct(product.id);

      if (result.success) {
        addNotification("success", "Producto eliminado correctamente");
        router.refresh();
      } else {
        addNotification("error", result.message || "No se pudo eliminar el producto");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      addNotification("error", "Error inesperado al eliminar el producto");
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header responsivo - se apila en móvil */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleImportPDF} className="flex-1 sm:flex-initial" size="sm">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Importar PDF</span>
          </Button>
          <Button onClick={handleNew} className="flex-1 sm:flex-initial" size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Nuevo Producto</span>
            <span className="sm:hidden ml-2">Nuevo</span>
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <SortableHeader column="name" label="Producto" align="left" />
                <SortableHeader column="category" label="Categoría" align="left" />
                <SortableHeader column="cost_price" label="Costo" align="right" />
                <SortableHeader column="sale_price" label="Precio" align="right" />
                <SortableHeader column="stock" label="Stock" align="center" />
                <th className="px-4 py-3 text-center text-sm font-medium">Preparación</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                      <p>No se encontraron productos</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {product.category?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatCurrency(product.cost_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {editingPriceProductId === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          value={editingPriceValue}
                          disabled={savingPriceProductId === product.id}
                          onChange={(e) => setEditingPriceValue(e.target.value)}
                          onBlur={() => {
                            if (savingPriceProductId !== product.id) {
                              cancelPriceEdit();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveSalePrice(product);
                            }

                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelPriceEdit();
                            }
                          }}
                          className="ml-auto h-8 w-28 text-right"
                        />
                      ) : (
                        <button
                          type="button"
                          onDoubleClick={() => beginPriceEdit(product)}
                          className="rounded px-2 py-1 transition-colors hover:bg-muted"
                          title="Doble click para editar el precio"
                        >
                          {formatCurrency(getDisplayedSalePrice(product))}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.unlimited_stock ? (
                        <Badge variant="default" className="bg-blue-600">
                          ∞ Ilimitado
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            product.stock === 0
                              ? "destructive"
                              : product.stock <= product.min_stock
                                ? "warning"
                                : "success"
                          }
                        >
                          {product.stock}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.unlimited_stock ? (
                        product.cocina_only ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">
                            🖨️ Cocina
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            ☕ Bar
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-muted text-foreground">
                          📦 Inventario
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={product.is_active ? "success" : "secondary"}>
                        {product.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowPriceHistory(product)}
                          title="Ver historial de precios"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                            disabled={deletingProductId === product.id}
                            className="text-red-600 hover:text-red-600"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, sortedProducts.length)} de{" "}
            {sortedProducts.length} productos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ProductModal
        open={isModalOpen}
        onClose={handleCloseModal}
        product={selectedProduct}
      />

      <PriceHistoryModal
        open={isPriceHistoryOpen}
        onClose={handleClosePriceHistory}
        product={selectedProduct}
      />

      <ImportPDFModal
        open={isImportModalOpen}
        onClose={handleCloseImportModal}
      />
    </div>
  );
}

