"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, ShoppingCart, Trash2, DollarSign, Sparkles } from "lucide-react";
import { formatCurrency, normalizeText } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { Badge } from "@/components/ui/badge";
import { searchProducts } from "@/actions/productActions";
import type { getProductsForSearch } from "@/actions/productActions";
import { checkTableAvailability, createSale } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useTablesStore } from "@/store/tablesStore";
import { useSaleMutation } from "@/hooks/useSales";
import { useProductSearchIndex } from "@/hooks/useProducts";
import { PaymentModal } from "./PaymentModal";
import { PrintTicket } from "./PrintTicket";

interface SaleItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  unlimited_stock?: boolean;
  cocina_only?: boolean;
  customization?: string; // Campo para personalizaciones
}

interface ProductSearchItem {
  id: string;
  code: string | null;
  name: string;
  sale_price: number;
  stock: number;
  min_stock: number;
  unlimited_stock: boolean;
  cocina_only?: boolean;
  normalizedName: string;
  normalizedCode: string;
}

interface SaleViewProps {
  cashRegister: any;
  session: any;
  onBack: () => void;
  onSaleComplete?: () => void;
  type: "bar";
  preSelectedTable?: number | null; // Mesa pre-seleccionada desde el mapa
  initialProductSearchIndex?: Awaited<ReturnType<typeof getProductsForSearch>>["data"];
}

const normalizeProductForSearch = (product: any): ProductSearchItem => ({
  id: product.id,
  code: product.code ?? null,
  name: product.name,
  sale_price: product.sale_price,
  stock: product.stock ?? 0,
  min_stock: product.min_stock ?? 0,
  unlimited_stock: Boolean(product.unlimited_stock),
  cocina_only: Boolean(product.cocina_only),
  normalizedName: normalizeText(product.name),
  normalizedCode: product.code ? normalizeText(product.code) : "",
});

export function SaleView({
  cashRegister,
  session,
  onBack,
  onSaleComplete,
  type,
  preSelectedTable,
  initialProductSearchIndex,
}: SaleViewProps) {
  // Hooks PRIMERO (siempre deben llamarse en el mismo orden)
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<number | null>(preSelectedTable || null); // Número de mesa (solo Bar)
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [payments, setPayments] = useState<Array<{ payment_method_id: string; amount: number }>>([]);
  const [paymentsForPrint, setPaymentsForPrint] = useState<Array<{ payment_method_name: string; amount: number }>>([]);
  const [cartItemsForPrint, setCartItemsForPrint] = useState<any[]>([]);
  const [searchIndex, setSearchIndex] = useState<ProductSearchItem[]>(() =>
    initialProductSearchIndex?.length ? initialProductSearchIndex.map(normalizeProductForSearch) : [],
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef("");
  const serverSearchCacheRef = useRef<Set<string>>(new Set());
  const addNotification = useNotificationStore((state) => state.addNotification);
  const confirm = useConfirm();
  const addTable = useTablesStore((state) => state.addTable);
  const pendingTables = useTablesStore((state) => state.pendingTables);
  const refreshTables = useTablesStore((state) => state.refreshTables);

  // Hook de mutación para crear ventas con invalidación automática
  const saleMutation = useSaleMutation();
  const initialSearchPayload = useMemo(() => {
    if (!initialProductSearchIndex) {
      return undefined;
    }
    return {
      success: true,
      data: initialProductSearchIndex,
    };
  }, [initialProductSearchIndex]);
  const { data: productSearchIndexResult } = useProductSearchIndex(initialSearchPayload);

  const bgColorClass = "bg-buffalo-caramel/10";

  const mergeSearchItems = useCallback(
    (items: ProductSearchItem[], options?: { returnUpdatedList?: boolean }) => {
      if (!items?.length) {
        return undefined;
      }

      let updatedList: ProductSearchItem[] | undefined;

      setSearchIndex((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        let changed = false;

        for (const item of items) {
          const existing = map.get(item.id);
          if (
            !existing ||
            existing.name !== item.name ||
            existing.sale_price !== item.sale_price ||
            existing.stock !== item.stock ||
            existing.unlimited_stock !== item.unlimited_stock ||
            existing.cocina_only !== item.cocina_only
          ) {
            map.set(item.id, item);
            changed = true;
          }
        }

        const nextList = changed
          ? Array.from(map.values()).sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          )
          : prev;

        if (options?.returnUpdatedList) {
          updatedList = nextList;
        }

        return nextList;
      });

      return updatedList;
    },
    [],
  );

  useEffect(() => {
    if (productSearchIndexResult?.success && productSearchIndexResult.data) {
      const normalized = productSearchIndexResult.data.map(normalizeProductForSearch);
      mergeSearchItems(normalized);
    }
  }, [productSearchIndexResult, mergeSearchItems]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const filterProductsLocally = useCallback(
    (query: string, source?: ProductSearchItem[]) => {
      if (!query.trim()) {
        return [];
      }

      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) {
        return [];
      }

      const baseSource = source ?? searchIndex;
      const filtered = baseSource.filter(
        (product) =>
          product.normalizedName.includes(normalizedQuery) ||
          (product.normalizedCode && product.normalizedCode.includes(normalizedQuery)),
      );

      return sortProductsByQueryMatch(filtered, query).slice(0, 20);
    },
    [searchIndex],
  );

  const fetchAndMergeFromServer = useCallback(
    async (query: string, options?: { force?: boolean; syncResults?: boolean }) => {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) {
        return [];
      }

      if (!options?.force) {
        if (serverSearchCacheRef.current.has(normalizedQuery)) {
          return [];
        }
        serverSearchCacheRef.current.add(normalizedQuery);
      }

      try {
        const result = await searchProducts(query);
        if (result.success && result.data?.length) {
          const normalizedItems = result.data.map(normalizeProductForSearch);
          const updatedList = mergeSearchItems(normalizedItems, { returnUpdatedList: true }) ?? normalizedItems;

          if (options?.syncResults) {
            const refreshed = filterProductsLocally(codeRef.current, updatedList);
            setSearchResults(refreshed);
            setShowDropdown(refreshed.length > 0);
            setSelectedIndex(refreshed.length === 1 ? 0 : -1);
          }

          return normalizedItems;
        }
      } catch (error) {
        console.error("Error searching products:", error);
      }

      return [];
    },
    [filterProductsLocally, mergeSearchItems],
  );

  useEffect(() => {
    if (!code.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    const filtered = filterProductsLocally(code);

    if (filtered.length > 0) {
      setSearchResults(filtered);
      setShowDropdown(true);
      setSelectedIndex((prev) =>
        prev >= filtered.length ? (filtered.length === 1 ? 0 : -1) : prev,
      );
      return;
    }

    if (code.trim().length >= 2) {
      fetchAndMergeFromServer(code, { syncResults: true }).catch(() => {
        setShowDropdown(false);
      });
    } else {
      setShowDropdown(false);
    }
  }, [code, filterProductsLocally, fetchAndMergeFromServer]);

  const findProductMatch = useCallback(
    (query: string, source?: ProductSearchItem[]) => {
      if (!query.trim()) {
        return undefined;
      }

      const normalized = normalizeText(query);
      const dataset = source ?? searchIndex;

      return (
        dataset.find((item) => item.normalizedCode === normalized) ||
        dataset.find((item) => item.normalizedName === normalized) ||
        dataset.find((item) => item.normalizedName.startsWith(normalized)) ||
        filterProductsLocally(query, dataset)[0]
      );
    },
    [searchIndex, filterProductsLocally],
  );

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  // Obtener números de mesas ocupadas
  const occupiedTableNumbers = pendingTables.map(table => table.table_number);

  // Refrescar lista de mesas abiertas al montar el componente
  useEffect(() => {
    if (type === "bar") {
      refreshTables();
    }
  }, [type, refreshTables]);


  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addProductToCart = (product: ProductSearchItem) => {
    // Verificar stock (excepto productos con stock ilimitado)
    if (!product.unlimited_stock && product.stock <= 0) {
      addNotification("error", "Producto sin stock disponible");
      return;
    }

    // Verificar si ya está en el carrito
    const existingItem = cart.find((item) => item.product_id === product.id);

    if (existingItem) {
      // Verificar que no exceda el stock (excepto productos con stock ilimitado)
      if (!product.unlimited_stock && existingItem.quantity + 1 > product.stock) {
        addNotification("error", `Stock insuficiente. Disponible: ${product.stock}`);
        return;
      }

      // Incrementar cantidad
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // Agregar nuevo item
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.sale_price,
          quantity: 1,
          stock: product.stock,
          unlimited_stock: product.unlimited_stock,
          customization: "", // Campo vacío para personalizaciones
        },
      ]);
    }

    addNotification("success", `${product.name} agregado al carrito`);
    setCode("");
    setShowDropdown(false);
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => {
          const nextIndex = prev < searchResults.length - 1 ? prev + 1 : prev;
          // Scroll al elemento seleccionado
          if (nextIndex !== prev && dropdownRef.current) {
            const productElements = dropdownRef.current.querySelectorAll('[data-product-index]');
            const element = productElements[nextIndex] as HTMLElement;
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          return nextIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => {
          const nextIndex = prev > 0 ? prev - 1 : (prev === -1 ? searchResults.length - 1 : -1);
          // Scroll al elemento seleccionado
          if (nextIndex !== prev && dropdownRef.current) {
            const productElements = dropdownRef.current.querySelectorAll('[data-product-index]');
            const element = productElements[nextIndex] as HTMLElement;
            if (element && nextIndex >= 0) {
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          return nextIndex;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          addProductToCart(searchResults[selectedIndex]);
        } else if (searchResults.length === 1) {
          addProductToCart(searchResults[0]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSearchResults([]);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
      addProductToCart(searchResults[selectedIndex]);
      return;
    }

    const localMatch = findProductMatch(trimmed);
    if (localMatch) {
      addProductToCart(localMatch);
      return;
    }

    const fetchedItems = await fetchAndMergeFromServer(trimmed, { force: true });
    if (fetchedItems.length === 0) {
      addNotification("error", "Producto no encontrado");
      return;
    }

    const normalizedQuery = normalizeText(trimmed);
    const fallbackMatch =
      fetchedItems.find((item) => item.normalizedCode === normalizedQuery) ||
      fetchedItems.find((item) => item.normalizedName.includes(normalizedQuery));

    if (fallbackMatch) {
      addProductToCart(fallbackMatch);
    } else {
      addNotification("error", "Producto no encontrado");
    }
  };

  const removeItem = (productId: string) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateCustomization = useCallback((productId: string, customization: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product_id === productId ? { ...item, customization } : item
      )
    );
  }, []);

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId);
      return;
    }

    const item = cart.find((i) => i.product_id === productId);
    // Validar stock solo si NO tiene stock ilimitado
    if (item && !item.unlimited_stock && newQuantity > item.stock) {
      addNotification("error", `Stock insuficiente. Disponible: ${item.stock}`);
      return;
    }

    setCart(
      cart.map((item) =>
        item.product_id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      addNotification("error", "El carrito está vacío");
      return;
    }

    // Crear venta pendiente directamente (mesas abiertas)
    handleCreatePendingSale();
  };

  const handleCreatePendingSale = async () => {
    if (cart.length === 0) {
      addNotification("error", "El carrito está vacío");
      return;
    }

    if (!tableNumber) {
      addNotification("error", "Debes seleccionar un número de mesa");
      return;
    }

    setIsLoading(true);

    try {
      // Primero verificar si la mesa ya está abierta
      const availabilityResult = await checkTableAvailability(tableNumber);
      if (!availabilityResult.success || !availabilityResult.data.isAvailable) {
        addNotification("error", availabilityResult.data.message || `La mesa ${tableNumber} ya está abierta`);
        setIsLoading(false);
        return;
      }

      const saleData = {
        status: "pending" as const,
        sale_type: "table" as const,
        cash_register_id: cashRegister.id,
        area: "bar" as const, // Área del bar
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        payments: [], // Sin pagos para venta pendiente
        table_number: tableNumber || undefined,
      };

      // Usar el hook de mutación que automáticamente invalida la caché de React Query
      saleMutation.mutate(saleData, {
        onSuccess: (result) => {

          console.log("🔍 DEBUG: Resultado de createSale:", result);
          console.log("🔍 DEBUG: result.success:", result.success);
          console.log("🔍 DEBUG: result.data:", result.data);

          if (result.success && result.data) {
            console.log("✅ DEBUG: Venta creada exitosamente:", result.data);

            addNotification("success", `Mesa ${tableNumber} abierta con ${cart.length} producto${cart.length > 1 ? "s" : ""}`);

            // Agregar la mesa al store global inmediatamente (para compatibilidad)
            const newTable = {
              id: result.data.id,
              sale_number: result.data.sale_number || `TEMP-${Date.now()}`,
              total_amount: total, // Usar la variable total definida arriba
              table_number: tableNumber!,
              created_at: new Date().toISOString(),
              user: { name: "Cajero" }, // Esto se debería obtener del contexto de autenticación
              sale_items: cart.map((item) => ({
                id: `temp-${item.product_id}-${Date.now()}`, // ID temporal
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.quantity * item.unit_price,
                product: {
                  name: item.name
                }
              }))
            };
            addTable(newTable);

            handleSaleComplete();
            console.log("✅ Mesa abierta - Caché invalidada automáticamente por useSaleMutation");
          } else {
            console.error("❌ DEBUG: Error en resultado de createSale:", result);
            addNotification("error", result.message || "Error al abrir mesa");
          }

          setIsLoading(false);
        },
        onError: (error: any) => {
          console.error("❌ DEBUG: Excepción en createSale:", error);

          // Solo mostrar error al usuario si es realmente un error crítico
          if (error.message?.includes("revalidatePath") || error.message?.includes("cache")) {
            console.log("⚠️ DEBUG: Error de revalidación ignorado");
          } else {
            addNotification("error", "Error al crear venta pendiente");
          }

          setIsLoading(false);
        }
      });
    } catch (error: any) {
      // Capturar errores de checkTableAvailability
      console.error("❌ DEBUG: Error al verificar disponibilidad:", error);
      addNotification("error", "Error al verificar disponibilidad de la mesa");
      setIsLoading(false);
    }
  };

  const handleCreateSale = async (payments: Array<{ payment_method_id: string; amount: number }>) => {
    if (cart.length === 0) {
      addNotification("error", "El carrito está vacío");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createSale({
        status: "completed",
        sale_type: "table",
        cash_register_id: cashRegister.id,
        area: "bar", // Área del bar
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
        })),
        payments: payments,
        table_number: type === "bar" ? tableNumber || undefined : undefined,
      });

      if (result.success && result.data) {
        // Preparar datos para impresión ANTES de limpiar el carrito
        const cartItemsTemp = [...cart]; // Copia del carrito antes de limpiarlo
        const saleDataTemp = {
          id: result.data.id,
          sale_number: result.data.sale_number,
          total_amount: cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
          created_at: new Date().toISOString(),
          user: { name: "Cajero" }, // Esto se debería obtener del contexto
          table_number: type === "bar" ? tableNumber : undefined,
        };
        const paymentsDataTemp = payments.map(p => ({
          payment_method_name: "Efectivo", // TODO: Obtener el nombre real del método de pago
          amount: p.amount
        }));

        // Limpiar el carrito y cerrar el modal ANTES de mostrar el ticket
        handleSaleComplete();

        // Preparar datos para impresión DESPUÉS de limpiar el carrito
        setSaleData(saleDataTemp);
        setPaymentsForPrint(paymentsDataTemp);
        setCartItemsForPrint(cartItemsTemp); // Guardar items para el ticket
      } else {
        addNotification("error", result.message || "Error al crear venta");
        setIsLoading(false);
      }
    } catch (error) {
      addNotification("error", "Error al procesar la venta");
      setIsLoading(false);
    }
  };

  const handleSaleComplete = () => {
    // Limpiar carrito y volver
    setCart([]);
    setTableNumber(null); // Limpiar mesa
    setIsPaymentModalOpen(false);
    setCartItemsForPrint([]); // Limpiar items para impresión
    addNotification("success", "¡Venta registrada exitosamente!");

    // Notificar al componente padre que se completó una venta
    if (onSaleComplete) {
      onSaleComplete();
    }
  };

  // Auto-focus en input de code (solo si no estamos escribiendo en otro campo)
  useEffect(() => {
    const input = document.getElementById("code-input");
    const activeElement = document.activeElement;

    // Solo hacer auto-focus si:
    // 1. El input existe
    // 2. El modal de pago no está abierto
    // 3. No estamos escribiendo en otro input (evita interrumpir la personalización)
    if (input && !isPaymentModalOpen && activeElement?.tagName !== 'INPUT') {
      input.focus();
    }
  }, [cart, isPaymentModalOpen]);

  // Validación defensiva: verificar que cashRegister existe (DESPUÉS de todos los hooks)
  if (!cashRegister) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-semibold">Error de Configuración</p>
          <p className="text-muted-foreground">
            No se pudo cargar la información de la caja registradora.
            <br />
            Por favor, recarga la página o contacta al administrador.
          </p>
          <Button onClick={onBack} variant="outline">Volver</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva Venta</h1>
          <p className="text-muted-foreground">{cashRegister.name}</p>
        </div>
      </div>

      {/* Selector de Mesa (solo Bar) */}
      {type === "bar" && (
        <Card className="bg-buffalo-espresso/10 border-2 border-buffalo-espresso">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground text-lg">
              🍺 {preSelectedTable ? "Mesa Seleccionada" : "Seleccionar Mesa"}
            </CardTitle>
            <CardDescription>
              {preSelectedTable
                ? `Pedido para Mesa ${preSelectedTable}`
                : "Elegí el número de mesa para esta venta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label htmlFor="table-select" className="font-medium text-sm">
                Mesa:
              </label>
              <select
                id="table-select"
                value={tableNumber || ""}
                onChange={(e) => setTableNumber(e.target.value ? parseInt(e.target.value) : null)}
                disabled={!!preSelectedTable}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin mesa</option>

                {/* Mesas normales 1-30 */}
                {Array.from({ length: 30 }, (_, i) => i + 1)
                  .filter(num => !occupiedTableNumbers.includes(num))
                  .map((num) => (
                    <option key={num} value={num}>
                      Mesa {num}
                    </option>
                  ))}

                {/* Separador visual */}
                <option disabled>──────────</option>

                {/* Barra: 38-41 */}
                {[38, 39, 40, 41]
                  .filter(num => !occupiedTableNumbers.includes(num))
                  .map((num) => (
                    <option key={num} value={num}>
                      🍺 Barra {num - 37} - Mesa {num}
                    </option>
                  ))}
              </select>
              {tableNumber && (
                <Badge
                  variant="default"
                  className={`text-white text-base px-4 py-1 ${tableNumber >= 38 && tableNumber <= 41
                    ? 'bg-orange-600'
                    : 'bg-buffalo-caramel'
                    }`}
                >
                  {tableNumber >= 38 && tableNumber <= 41
                    ? `🍺 Barra ${tableNumber - 37} - Mesa ${tableNumber}`
                    : `Mesa ${tableNumber}`
                  }
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Búsqueda */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buscar Producto</CardTitle>
              <CardDescription>
                Ingresá código o buscá por nombre del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCodeSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                  <Input
                    ref={searchInputRef}
                    id="code-input"
                    placeholder="Código o nombre del producto..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 text-lg"
                    autoFocus
                    disabled={isLoading}
                    autoComplete="off"
                  />

                  {/* Dropdown de resultados */}
                  {showDropdown && searchResults.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
                    >
                      {searchResults.map((product, index) => (
                        <div
                          key={product.id}
                          data-product-index={index}
                          onClick={() => addProductToCart(product)}
                          className={`px-4 py-3 cursor-pointer border-b border-border transition-colors ${index === selectedIndex
                            ? "bg-primary/20 border-l-4 border-l-primary"
                            : "hover:bg-buffalo-espresso/20"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">
                                {product.name}
                              </p>
                              {product.code && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Código: {product.code}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              {product.unlimited_stock ? (
                                <Badge variant="default" className="bg-blue-600 text-white">
                                  ∞
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
                                  Stock: {product.stock}
                                </Badge>
                              )}
                              <span className="font-bold text-foreground text-lg">
                                {formatCurrency(product.sale_price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={isLoading} size="lg">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                💡 Tip: Escribí al menos 2 letras para buscar. Usá ↑↓ para navegar y Enter para agregar
              </p>
            </CardContent>
          </Card>

          {/* Productos en el carrito */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Productos en el Carrito</CardTitle>
                <CardDescription>{cart.length} producto(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="p-3 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.unit_price)} × {item.quantity} ={" "}
                          <span className="font-medium">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </span>
                        </p>
                        {!item.name.includes("🎁") && (
                          <p className="text-xs text-muted-foreground">
                            Stock disponible: {item.stock}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!item.name.includes("🎁") ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={item.unlimited_stock ? undefined : item.stock}
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(item.product_id, parseInt(e.target.value) || 1)
                              }
                              className="w-16 h-10 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              disabled={!item.unlimited_stock && item.quantity >= item.stock}
                            >
                              +
                            </Button>
                          </>
                        ) : (
                          <Badge variant="success" className="px-3">
                            Combo Aplicado
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.product_id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Campo de personalización para productos con stock ilimitado */}
                    {item.unlimited_stock && type === "bar" && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Personalización (ej: picante, sin lechuga, etc.)
                        </label>
                        <Input
                          key={`customization-${item.product_id}`}
                          placeholder="Escribe las personalizaciones aquí..."
                          value={item.customization || ""}
                          onChange={(e) => updateCustomization(item.product_id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna derecha: Resumen y Total */}
        <div className="space-y-4">
          <Card className={`sticky top-4 ${bgColorClass} border-2`}>
            <CardHeader>
              <CardTitle>Total de la Venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>El carrito está vacío</p>
                  <p className="text-xs mt-1">Escaneá productos para comenzar</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Items:</span>
                      <span>{cart.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Unidades:</span>
                      <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">TOTAL:</span>
                      <span className="text-3xl font-bold text-foreground">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleFinalizeSale}
                    disabled={cart.length === 0}
                  >
                    <DollarSign className="mr-2 h-5 w-5" />
                    {type === "bar" ? "Abrir Mesa" : "Finalizar Venta"}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setCart([]);
                      setTableNumber(null);
                    }}
                  >
                    Cancelar / Limpiar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mostrar PrintTicket si hay datos de venta completada */}
      {saleData && (
        <PrintTicket
          sale={saleData}
          items={cartItemsForPrint}
          payments={paymentsForPrint}
          onAfterPrint={() => {
            setSaleData(null);
            setPayments([]);
            setPaymentsForPrint([]);
            setCartItemsForPrint([]);
            // Actualizar cards de ventas inmediatamente
            window.location.reload();
          }}
        />
      )}

      <PaymentModal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onComplete={handleSaleComplete}
        onCreateSale={handleCreateSale}
        total={total}
        items={cart}
        sessionId={session.id}
        cashRegisterId={cashRegister.id}
        tableNumber={tableNumber}
      />

    </div>
  );
}
