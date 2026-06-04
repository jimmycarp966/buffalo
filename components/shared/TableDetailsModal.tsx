"use client";

import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { Plus, Minus, ShoppingCart, X, Search, Package, Trash2 } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { addItemsToOpenTable, removeItemFromTable, cancelTable, closeTable, getTablePartialPayments } from "@/actions/barActions";
import { useProductSearchIndex } from "@/hooks/useProducts";
import { useCanEditPrices } from "@/hooks/useCanEditPrices";
import { useQueryClient } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  sale_price: number;
  stock: number;
  unlimited_stock: boolean;
  cocina_only?: boolean;
}

interface CartItem {
  id: string; // ID único para cada item del carrito (permite múltiples items del mismo producto con personalizaciones diferentes)
  product_id: string;
  name: string;
  sale_price: number;
  quantity: number;
  stock: number;
  unlimited_stock: boolean;
  cocina_only?: boolean;
  customization: string; // Campo para personalizaciones - ahora requerido
}

// Componente separado para cada item del carrito con su propio estado
function CartItemComponent({
  item,
  cart,
  onRemove,
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateCustomization,
  addNotification,
  customization,
  canEditPrice
}: {
  item: CartItem;
  cart: CartItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateCustomization: (id: string, customization: string) => void;
  addNotification: (type: "success" | "error" | "warning" | "info", message: string) => void;
  customization: string;
  canEditPrice: boolean;
}) {

  return (
    <div className="bg-background border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.name}</div>
          <div className="text-muted-foreground text-xs mt-0.5">
            {formatCurrency(item.sale_price)} × {item.quantity} = {formatCurrency(item.sale_price * item.quantity)}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(item.id)}
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Controles de cantidad */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 border rounded-lg p-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="h-7 w-7 p-0"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Verificar stock antes de incrementar
              const otherItemsQuantity = cart
                .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== item.id)
                .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

              if (!item.unlimited_stock && otherItemsQuantity + item.quantity + 1 > item.stock) {
                addNotification("error", "No hay suficiente stock disponible");
                return;
              }
              onUpdateQuantity(item.id, item.quantity + 1);
            }}
            disabled={!item.unlimited_stock && (() => {
              const otherItemsQuantity = cart
                .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== item.id)
                .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
              return otherItemsQuantity + item.quantity >= item.stock;
            })()}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.sale_price}
            onChange={(e) => onUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
            disabled={!canEditPrice}
            title={!canEditPrice ? "Solo admin/supervisor pueden cambiar el precio" : undefined}
            className="w-24 h-8 text-sm text-right disabled:opacity-70 disabled:cursor-not-allowed"
          />
          <span className="font-semibold">
            {formatCurrency(item.sale_price * item.quantity)}
          </span>
        </div>
      </div>

      {/* Campo de personalización */}
      {item.unlimited_stock && (
        <div className="space-y-1">
          <label
            htmlFor={`customization-${item.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Personalización
          </label>
          <Input
            id={`customization-${item.id}`}
            placeholder="Ej: sin lechuga, picante..."
            value={customization}
            onChange={(e) => {
              console.log('🔍 INPUT onChange - Item:', item.id, 'Valor anterior:', customization, 'Nuevo valor:', e.target.value);
              onUpdateCustomization(item.id, e.target.value);
            }}
            className="text-sm h-9"
          />
        </div>
      )}
    </div>
  );
}

interface TableDetailsModalProps {
  open: boolean;
  onClose: () => void;
  table: {
    id: string;
    table_number?: number | null;
    total_amount: number;
    created_at: string;
    sale_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      product: { name: string } | { name: string }[] | null;
    }>;
  };
  onComplete: () => void;
}

// Helper function to get product name safely
const getProductName = (product: { name: string } | { name: string }[] | null): string => {
  if (!product) return "Producto";
  if (Array.isArray(product)) return product[0]?.name || "Producto";
  return product.name || "Producto";
};

export function TableDetailsModal({ open, onClose, table, onComplete }: TableDetailsModalProps) {
  console.log('🚀 DEBUG: TableDetailsModal COMPONENTE RENDER - open:', open, 'table:', table?.id);
  console.log('🚀 INICIANDO TableDetailsModal - open:', open, 'table:', table?.id);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; subtotal: number } | null>(null);
  const [hasPartialPayments, setHasPartialPayments] = useState(false);
  const [totalPaid, setTotalPaid] = useState(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const productsListRef = useRef<HTMLDivElement>(null);
  const cartItemCounterRef = useRef<number>(0);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const { data: productIndexResult, isFetching: isProductIndexLoading } = useProductSearchIndex();
  const productCatalog = productIndexResult?.data ?? [];
  const isLoadingProducts = isProductIndexLoading && productCatalog.length === 0;

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedProductIndex(-1);
      cartItemCounterRef.current = 0; // Resetear contador al abrir modal
    }
  }, [open]);


  useEffect(() => {
    // Resetear índice seleccionado cuando cambian los productos
    setSelectedProductIndex(-1);
  }, [products]);

  const addToCart = useCallback((product: Product, forceNew: boolean = false) => {
    console.log('🔍 DEBUG: addToCart LLAMADA - Producto:', product.name, 'Unlimited stock:', product.unlimited_stock);
    console.log('🔍 Agregando producto al carrito:', {
      name: product.name,
      unlimited_stock: product.unlimited_stock,
      stock: product.stock,
      forceNew
    });

    setCart((prevCart) => {
      // Para productos de cocina (unlimited_stock), SIEMPRE crear un item independiente
      // Esto permite que cada uno tenga su propia personalización
      if (product.unlimited_stock || forceNew) {
        cartItemCounterRef.current += 1;
        const uniqueId = `cart-item-${cartItemCounterRef.current}-${product.id}-${Date.now()}`;
        const newItem: CartItem = {
          id: uniqueId,
          product_id: product.id,
          name: product.name,
          sale_price: product.sale_price,
          quantity: 1,
          stock: product.stock,
          unlimited_stock: product.unlimited_stock,
          cocina_only: product.cocina_only,
          customization: ""
        };
        console.log('🛒 Nuevo item independiente creado (cocina/forceNew):', newItem);
        console.log('🔢 Contador actual:', cartItemCounterRef.current);

        return [...prevCart, newItem];
      }

      // Para productos con stock limitado, verificar stock disponible
      const totalQuantity = prevCart
        .filter(item => item.product_id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (totalQuantity >= product.stock) {
        addNotification("error", "No hay suficiente stock disponible");
        return prevCart;
      }

      // Para productos con stock limitado, siempre crear items separados para permitir personalizaciones diferentes
      // Esto mantiene consistencia con el comportamiento de productos ilimitados
      cartItemCounterRef.current += 1;
      const uniqueId = `cart-item-${cartItemCounterRef.current}-${product.id}-${Date.now()}`;
      const newItem: CartItem = {
        id: uniqueId,
        product_id: product.id,
        name: product.name,
        sale_price: product.sale_price,
        quantity: 1,
        stock: product.stock,
        unlimited_stock: product.unlimited_stock,
        cocina_only: product.cocina_only,
        customization: ""
      };

      console.log('🛒 Nuevo item en carrito (stock limitado):', newItem);
      console.log('🔢 Contador actual:', cartItemCounterRef.current);

      return [...prevCart, newItem];
    });
  }, [addNotification]);

  const normalizeText = useCallback((value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }, []);

  const getLocalMatches = useCallback(
    (term: string) => {
      if (!productCatalog || productCatalog.length === 0) return [];
      const normalizedQuery = normalizeText(term);
      if (!normalizedQuery) {
        return productCatalog.slice(0, 40);
      }

      const filtered = productCatalog.filter((product: any) => {
        const normalizedName = normalizeText(product.name || "");
        const normalizedCode = product.code ? normalizeText(product.code) : "";
        return (
          normalizedName.includes(normalizedQuery) ||
          (normalizedCode && normalizedCode.includes(normalizedQuery))
        );
      });

      return sortProductsByQueryMatch(filtered, term).slice(0, 40);
    },
    [productCatalog, normalizeText]
  );

  // Manejar navegación con teclado
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo manejar teclado si no estamos escribiendo en un textarea de personalización
      if (e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Si estamos en el input de búsqueda, permitir navegación con flechas y Enter
      if (e.target instanceof HTMLInputElement && e.target.type === 'text' && e.target.placeholder?.includes('Buscar')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedProductIndex((prev) => {
            const nextIndex = prev === -1 ? 0 : (prev < products.length - 1 ? prev + 1 : prev);
            if (productsListRef.current) {
              const productElements = productsListRef.current.querySelectorAll('[data-product-index]');
              const element = productElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedProductIndex((prev) => {
            const nextIndex = prev === -1 ? products.length - 1 : (prev > 0 ? prev - 1 : 0);
            if (productsListRef.current) {
              const productElements = productsListRef.current.querySelectorAll('[data-product-index]');
              const element = productElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedProductIndex >= 0 && selectedProductIndex < products.length) {
            const selectedProduct = products[selectedProductIndex];
            if (selectedProduct && (!selectedProduct.unlimited_stock ? selectedProduct.stock > 0 : true)) {
              addToCart(selectedProduct, false);
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSearchTerm("");
          setSelectedProductIndex(-1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, products, selectedProductIndex, addToCart]);

  useEffect(() => {
    if (!open) return;
    if (!productCatalog || productCatalog.length === 0) return;
    const matches = getLocalMatches(deferredSearchTerm);
    setProducts(matches);
  }, [open, productCatalog, deferredSearchTerm, getLocalMatches]);

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateCustomization = useCallback((itemId: string, customization: string) => {
    console.log('✏️ updateCustomization LLAMADA - ItemId:', itemId, 'Customization:', customization);
    console.log('📋 Estado del carrito ANTES:', cart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));

    setCart(prevCart => {
      const newCart = prevCart.map(item =>
        item.id === itemId
          ? { ...item, customization }
          : item
      );
      console.log('📋 Estado del carrito DESPUÉS:', newCart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));
      return newCart;
    });
  }, []); // Remover dependencia de cart

  const canEditPrices = useCanEditPrices();

  const updatePrice = useCallback((itemId: string, price: number) => {
    if (Number.isNaN(price)) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId
          ? { ...item, sale_price: price >= 0 ? price : item.sale_price }
          : item
      )
    );
  }, []);

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const item = cart.find(item => item.id === itemId);
    if (!item) return;

    // Verificar stock disponible (sumar todas las cantidades del mismo producto excepto el actual)
    if (!item.unlimited_stock) {
      const otherItemsQuantity = cart
        .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== itemId)
        .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

      if (otherItemsQuantity + quantity > item.stock) {
        addNotification("error", "No hay suficiente stock disponible");
        return;
      }
    }

    setCart(cart.map(cartItem =>
      cartItem.id === itemId
        ? { ...cartItem, quantity }
        : cartItem
    ));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.sale_price * item.quantity), 0);
  };

  const handleAddProducts = async () => {
    // Prevenir acciones si el ID es temporal (Optimistic UI sync)
    if (table.id.startsWith('temp-')) {
      addNotification("warning", "Sincronizando mesa... Espere un momento");
      return;
    }

    if (cart.length === 0) {
      addNotification("error", "Debes agregar al menos un producto");
      return;
    }

    setIsLoading(true);
    try {
      // Enviar cada item con su personalización (si tiene)
      const itemsToSend = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.sale_price,
        customization: item.customization || undefined
      }));

      const result = await addItemsToOpenTable(table.id, itemsToSend);

      if (result.success) {
        addNotification("success", `Se agregaron ${cart.length} producto${cart.length > 1 ? "s" : ""} ${table.table_number ? `a la mesa ${table.table_number}` : "al pedido"}`);

        // INVALIDAR QUERY para actualizar la lista de mesas
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        setCart([]);
        onComplete();

        onClose();
      } else {
        addNotification("error", result.message || "Error al agregar productos");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al agregar productos");
    } finally {
      setIsLoading(false);
    }
  };


  const handleClose = () => {
    setCart([]);
    setSearchTerm("");
    setItemToDelete(null);
    setShowCancelConfirm(false);
    onClose();
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    // Verificar si es el último artículo
    const remainingItems = table.sale_items.length;

    // Encontrar el item para obtener su subtotal
    const itemToRemove = table.sale_items.find(item => item.id === itemId);
    const itemSubtotal = itemToRemove?.subtotal || 0;

    if (remainingItems === 1) {
      // Si es el último item, verificar si hay pagos parciales
      const paymentsResult = await getTablePartialPayments(table.id);
      const payments = paymentsResult.success ? paymentsResult.data : [];
      const paid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      setHasPartialPayments(payments.length > 0);
      setTotalPaid(paid);
      setItemToDelete({ id: itemId, name: itemName, subtotal: itemSubtotal });
      setShowCancelConfirm(true);
    } else {
      // Si no es el último, eliminar directamente
      await deleteItem(itemId);
    }
  };

  const deleteItem = async (itemId: string) => {
    console.log("🔍 DEBUG deleteItem - Iniciando eliminación:", { itemId, tableId: table.id });
    setIsDeleting(true);
    try {
      const result = await removeItemFromTable(itemId, table.id);
      console.log("🔍 DEBUG deleteItem - Resultado de la eliminación:", result);

      if (result.success) {
        console.log("✅ DEBUG deleteItem - Eliminación exitosa, actualizando datos...");
        addNotification("success", "Artículo eliminado correctamente");
        // INVALIDAR QUERY para actualizar la lista de mesas
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        // Actualizar los datos inmediatamente
        onComplete();
        // No cerrar el modal, mantenerlo abierto para seguir gestionando
      } else {
        console.log("❌ DEBUG deleteItem - Error en eliminación:", result.message);
        addNotification("error", result.message || "Error al eliminar artículo");
      }
    } catch (error) {
      console.log("❌ DEBUG deleteItem - Error inesperado:", error);
      addNotification("error", "Error inesperado al eliminar artículo");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsDeleting(true);
    try {
      const result = await cancelTable(table.id);

      if (result.success) {
        addNotification("success", "Mesa cancelada correctamente");
        // INVALIDAR QUERY para actualizar la lista de mesas
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        setShowCancelConfirm(false);
        onComplete();
        onClose();
      } else {
        addNotification("error", result.message || "Error al cancelar mesa");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al cancelar mesa");
    } finally {
      setIsDeleting(false);
    }
  };

  // Nueva función: Solo eliminar el item (no cerrar mesa)
  const handleDeleteOnlyItem = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const result = await removeItemFromTable(itemToDelete.id, table.id);

      if (result.success) {
        addNotification("success", "Artículo eliminado correctamente");
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        setShowCancelConfirm(false);
        setItemToDelete(null);
        onComplete();
        // Mantener el modal abierto si la mesa sigue activa (saldo > 0)
        // Si la mesa queda con $0, se puede cerrar manualmente después
      } else {
        addNotification("error", result.message || "Error al eliminar artículo");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al eliminar artículo");
    } finally {
      setIsDeleting(false);
    }
  };

  // Nueva función: Eliminar item Y cerrar mesa
  const handleCloseTableAfterDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      // Primero eliminar el item
      const deleteResult = await removeItemFromTable(itemToDelete.id, table.id);

      if (!deleteResult.success) {
        addNotification("error", deleteResult.message || "Error al eliminar artículo");
        return;
      }

      // Luego cerrar la mesa (sin pagos adicionales, ya está pagada)
      const closeResult = await closeTable(table.id, []);

      if (closeResult.success) {
        addNotification("success", "Mesa cerrada correctamente con los pagos registrados");
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        setShowCancelConfirm(false);
        setItemToDelete(null);
        onComplete();
        onClose();
      } else {
        addNotification("error", closeResult.message || "Error al cerrar mesa");
      }
    } catch (error) {
      addNotification("error", "Error inesperado al cerrar mesa");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-lg">
              {table.table_number
                ? `🍺 Mesa ${table.table_number}`
                : 'Pedido'
              } - Agregar Productos
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Total actual: <span className="font-semibold text-foreground">{formatCurrency(table.total_amount)}</span>
            </p>
          </DialogHeader>

          {/* Layout: Productos arriba/izquierda, Carrito abajo/derecha - responsive */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Columna izquierda: Artículos actuales + Búsqueda + Lista de productos */}
            <div className="flex-1 flex flex-col overflow-hidden md:border-r min-h-0">
              <div className="p-4 space-y-3 border-b bg-muted/10 shrink-0">
                {/* Artículos actuales de la mesa - Compacto */}
                {table.sale_items && table.sale_items.length > 0 && (
                  <div className="border rounded-lg p-3 bg-background flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Artículos actuales ({table.sale_items.length})</span>
                      {isAdmin && (
                        <Badge variant="secondary" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {table.sale_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-muted/30 border rounded-md text-xs">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="font-semibold truncate text-sm">{getProductName(item.product)}</div>
                            <div className="text-muted-foreground text-[11px]">
                              {formatCurrency(item.unit_price)} × {item.quantity} = {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item.id, getProductName(item.product))}
                              disabled={isDeleting}
                              className="h-6 w-6 p-0 ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buscador - Más prominente */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder="Buscar productos por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 text-base"
                    autoFocus
                  />
                </div>
              </div>

              {/* Lista de productos - Más espacio */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0" ref={productsListRef}>
                {isLoadingProducts ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                      <p className="text-sm text-muted-foreground">Buscando productos...</p>
                    </div>
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
                    <div className="text-center">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No hay productos disponibles</p>
                      <p className="text-xs mt-1">Intenta buscar con otro término</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-y-auto flex-1 p-2 min-h-0">
                    <div className="space-y-1.5">
                      {products.map((product, index) => {
                        const isInCart = cart.some(item => item.product_id === product.id);
                        const hasCustomizationInCart = cart.some(
                          item => item.product_id === product.id && item.customization && item.customization.trim() !== ""
                        );

                        return (
                          <div
                            key={product.id}
                            data-product-index={index}
                            className={`flex items-center gap-2 p-3 rounded-lg transition-all ${selectedProductIndex === index
                              ? 'bg-primary/20 border-2 border-primary shadow-sm'
                              : 'hover:bg-muted/50 border-2 border-transparent hover:border-muted'
                              } ${!product.unlimited_stock && product.stock === 0
                                ? 'opacity-50'
                                : ''
                              }`}
                          >
                            <button
                              onClick={() => {
                                if (!product.unlimited_stock && product.stock === 0) return;
                                addToCart(product, false);
                                setSelectedProductIndex(-1);
                              }}
                              disabled={!product.unlimited_stock && product.stock === 0}
                              className="flex-1 flex items-center justify-between text-left min-w-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-sm">{product.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-semibold text-green-600 text-sm">{formatCurrency(product.sale_price)}</span>
                                  {!product.unlimited_stock && (
                                    <Badge
                                      variant={product.stock === 0 ? "destructive" : "secondary"}
                                      className="text-xs h-5"
                                    >
                                      Stock: {product.stock}
                                    </Badge>
                                  )}
                                  {isInCart && (
                                    <Badge variant="outline" className="text-xs h-5">
                                      En carrito
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="ml-3 flex-shrink-0">
                                {!product.unlimited_stock && product.stock === 0 ? (
                                  <Badge variant="outline" className="text-xs">Sin Stock</Badge>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
                                    <Plus className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                              </div>
                            </button>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha: Carrito - responsive */}
            <div className="w-full md:w-96 flex flex-col border-t md:border-t-0 md:border-l bg-muted/20 min-h-0 max-h-[40vh] md:max-h-none">
              {cart.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Carrito vacío</p>
                    <p className="text-xs mt-1">Agrega productos desde la lista</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b bg-background">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Productos a agregar ({cart.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {cart.map((item) => (
                      <CartItemComponent
                        key={item.id}
                        item={item}
                        cart={cart}
                        onRemove={removeFromCart}
                        onUpdateQuantity={updateQuantity}
                        onUpdatePrice={updatePrice}
                        onUpdateCustomization={updateCustomization}
                        addNotification={addNotification}
                        customization={item.customization}
                        canEditPrice={canEditPrices}
                      />
                    ))}
                    {/* Footer: Resumen + Botón de acción */}
                    <div className="p-4 border-t bg-muted/20 shrink-0">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-sm font-medium text-muted-foreground uppercase">Subtotal a agregar:</span>
                        <span className="text-2xl font-bold text-primary">{formatCurrency(getCartTotal())}</span>
                      </div>
                      <Button
                        className="w-full h-14 text-lg font-bold shadow-xl transition-all active:scale-95"
                        onClick={handleAddProducts}
                        disabled={isLoading || cart.length === 0 || table.id.startsWith('temp-')}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Procesando...
                          </div>
                        ) : table.id.startsWith('temp-') ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white opacity-50"></div>
                            Sincronizando Mesa...
                          </div>
                        ) : (
                          <>
                            <Plus className="mr-2 h-6 w-6" />
                            Agregar {cart.length} Producto{cart.length > 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                    <Button variant="outline" onClick={handleClose} disabled={isLoading} className="w-full">
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Diálogo de confirmación para eliminar último item */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasPartialPayments
                ? "Eliminar último artículo"
                : "¿Cancelar mesa completa?"
              }
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás por eliminar el último artículo de la Mesa {table.table_number}:
                </p>
                <p className="font-semibold text-foreground">
                  "{itemToDelete?.name}"
                </p>

                {hasPartialPayments ? (
                  <>
                    {/* Resumen financiero cuando hay pagos parciales */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total actual:</span>
                        <span className="font-medium">{formatCurrency(table.total_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ya pagado:</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Después de eliminar:</span>
                        <span className="font-medium">{formatCurrency(table.total_amount - (itemToDelete?.subtotal || 0))}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-muted-foreground">Saldo restante:</span>
                        <span className={`font-bold ${(table.total_amount - (itemToDelete?.subtotal || 0) - totalPaid) <= 0
                          ? "text-green-600"
                          : "text-orange-600"
                          }`}>
                          {formatCurrency(Math.max(0, table.total_amount - (itemToDelete?.subtotal || 0) - totalPaid))}
                          {(table.total_amount - (itemToDelete?.subtotal || 0) - totalPaid) <= 0 && " ✓"}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ¿Qué deseas hacer?
                    </p>
                  </>
                ) : (
                  <p>
                    Esto cancelará toda la mesa y no se contabilizará como venta. ¿Deseas continuar?
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
              No, mantener
            </AlertDialogCancel>

            {hasPartialPayments ? (
              <>
                {/* Opción: Solo eliminar item */}
                <Button
                  variant="outline"
                  onClick={handleDeleteOnlyItem}
                  disabled={isDeleting}
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? "Procesando..." : "Solo eliminar item"}
                </Button>

                {/* Opción: Cerrar mesa (si está pagada o sobrepagada) */}
                {(table.total_amount - (itemToDelete?.subtotal || 0) - totalPaid) <= 0 && (
                  <Button
                    onClick={handleCloseTableAfterDelete}
                    disabled={isDeleting}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  >
                    {isDeleting ? "Cerrando..." : "Cerrar mesa"}
                  </Button>
                )}
              </>
            ) : (
              /* Sin pagos parciales: cancelar mesa */
              <AlertDialogAction
                onClick={handleConfirmCancel}
                disabled={isDeleting}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Cancelando..." : "Sí, cancelar mesa"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
