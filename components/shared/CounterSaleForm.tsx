"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, Loader2, HelpCircle, Keyboard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { searchProducts } from "@/actions/productActions";
import { createSale, getPaymentMethods } from "@/actions/saleActions";
import { getPrinterConfig, getKitchenPrinterString } from "@/actions/configActions";
import { printToLocal } from "@/lib/localPrinter";
import { useNotificationStore } from "@/store/notificationStore";
import { useProductSearchIndex } from "@/hooks/useProducts";
import { useCanEditPrices } from "@/hooks/useCanEditPrices";

interface CounterSaleFormProps {
  session: any;
  cashRegister: any;
  onClose: () => void;
  onComplete: () => void;
}

interface CartItem {
  id: string; // ID único para cada item del carrito (permite múltiples items del mismo producto con personalizaciones diferentes)
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  customization?: string;
  unlimited_stock?: boolean;
  cocina_only?: boolean;
}

export function CounterSaleForm({ session, cashRegister, onClose, onComplete }: CounterSaleFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [focusMode, setFocusMode] = useState<'search' | 'cart'>('search');
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // ============================================================================
  // OPTIMIZACIONES DE BÚSQUEDA (igual que QuickSalePanel)
  // ============================================================================
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchCacheRef = useRef<Record<string, any[]>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: productIndexResult, isFetching: isProductIndexLoading } = useProductSearchIndex();
  const productCatalog = productIndexResult?.data ?? [];


  useEffect(() => {
    searchInputRef.current?.focus();
    searchCacheRef.current = {}; // Limpiar caché al abrir

    // Cleanup: Cancelar búsquedas pendientes al desmontar
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Cargar métodos de pago activos al montar y setear "Efectivo" por defecto
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const result = await getPaymentMethods();
      if (!isMounted) return;
      if (result.success && result.data) {
        const methods = result.data.map((m: any) => ({ id: m.id, name: m.name }));
        setPaymentMethods(methods);

        const efectivo = methods.find(
          (m) => m.name === "Efectivo" || m.name.toLowerCase() === "efectivo"
        );
        setSelectedPaymentMethodId(efectivo ? efectivo.id : methods[0]?.id || "");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    console.log('🔄 RESET STATES - searchResults or cart changed:', {
      searchResultsLength: searchResults.length,
      cartLength: cart.length
    });
    setSelectedProductIndex(-1);
    setSelectedQuantity(1);
    setSelectedCartIndex(-1);
  }, [searchResults, cart]);


  const addToCart = useCallback((product: any, quantity: number = 1, forceNew: boolean = false) => {
    setCart((prevCart) => {
      // Verificar stock disponible (sumar todas las cantidades del mismo producto)
      if (!product.unlimited_stock) {
        const totalQuantity = prevCart
          .filter(item => item.product_id === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (totalQuantity + quantity > product.stock) {
          addNotification("error", "No hay suficiente stock disponible");
          return prevCart;
        }
      }

      // Si forceNew es true, siempre crear un nuevo item (para personalizaciones distintas)
      if (forceNew) {
        const newItem: CartItem = {
          id: `${product.id}-${Date.now()}-${Math.random()}`,
          product_id: product.id,
          name: product.name,
          unit_price: product.sale_price,
          quantity: quantity,
          stock: product.stock,
          customization: "",
          unlimited_stock: product.unlimited_stock,
          cocina_only: product.cocina_only ?? false
        };
        setSearchQuery("");
        setSearchResults([]);
        setSelectedProductIndex(-1);
        setSelectedQuantity(1);
        setSelectedCartIndex(-1);
        setFocusMode('search');
        searchInputRef.current?.focus();
        return [...prevCart, newItem];
      }

      // Buscar si ya existe un item del mismo producto SIN personalización
      const existingItemWithoutCustomization = prevCart.find(
        item => item.product_id === product.id && (!item.customization || item.customization.trim() === "")
      );

      // Si existe un item sin personalización, incrementar cantidad
      if (existingItemWithoutCustomization) {
        const updatedCart = prevCart.map(item =>
          item.id === existingItemWithoutCustomization.id
            ? { ...item, quantity: item.quantity + quantity, unlimited_stock: product.unlimited_stock }
            : item
        );
        setSearchQuery("");
        setSearchResults([]);
        setSelectedProductIndex(-1);
        setSelectedQuantity(1);
        setSelectedCartIndex(-1);
        setFocusMode('search');
        searchInputRef.current?.focus();
        return updatedCart;
      }

      // Si no existe o todos tienen personalización, crear nuevo item
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}-${Math.random()}`,
        product_id: product.id,
        name: product.name,
        unit_price: product.sale_price,
        quantity: quantity,
        stock: product.stock,
        customization: "",
        unlimited_stock: product.unlimited_stock,
        cocina_only: product.cocina_only ?? false
      };

      setSearchQuery("");
      setSearchResults([]);
      setSelectedProductIndex(-1);
      setSelectedQuantity(1);
      setSelectedCartIndex(-1);
      setFocusMode('search');
      searchInputRef.current?.focus();
      return [...prevCart, newItem];
    });
  }, [addNotification]);

  // Event listener específico para el input de búsqueda
  useEffect(() => {
    const handleSearchInputKeyDown = (e: KeyboardEvent) => {
      // Solo manejar flechas cuando hay resultados de búsqueda
      if (searchResults.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedProductIndex >= 0) {
          setSelectedQuantity(prev => prev + 1);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedProductIndex >= 0) {
          setSelectedQuantity(prev => Math.max(1, prev - 1));
        }
        return;
      }

      // Permitir que otras teclas funcionen normalmente en el input
      // Como Enter para seleccionar, Escape para limpiar, etc.
    };

    const searchInput = searchInputRef.current;
    if (searchInput) {
      searchInput.addEventListener('keydown', handleSearchInputKeyDown);
      return () => searchInput.removeEventListener('keydown', handleSearchInputKeyDown);
    }
  }, [searchResults, selectedProductIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      // F2 para cambiar entre modos de foco
      if (e.key === 'F2') {
        e.preventDefault();
        if (focusMode === 'search' && cart.length > 0) {
          setFocusMode('cart');
          setSelectedCartIndex(0);
          setSelectedProductIndex(-1);
          setSelectedQuantity(1);
        } else if (focusMode === 'cart') {
          setFocusMode('search');
          setSelectedCartIndex(-1);
          searchInputRef.current?.focus();
        }
        return;
      }

      // Permitir navegación cuando hay resultados de búsqueda
      if (focusMode === 'search' && searchResults.length > 0) {
        // Navegación en resultados de búsqueda - permitir desde cualquier lugar
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedProductIndex((prev) => {
            const nextIndex = prev === -1 ? 0 : (prev < searchResults.length - 1 ? prev + 1 : prev);
            if (resultsListRef.current) {
              const productElements = resultsListRef.current.querySelectorAll('[data-product-index]');
              const element = productElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedProductIndex((prev) => {
            const nextIndex = prev === -1 ? searchResults.length - 1 : (prev > 0 ? prev - 1 : 0);
            if (resultsListRef.current) {
              const productElements = resultsListRef.current.querySelectorAll('[data-product-index]');
              const element = productElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedProductIndex >= 0 && selectedProductIndex < searchResults.length) {
            const selectedProduct = searchResults[selectedProductIndex];
            if (selectedProduct) {
              addToCart(selectedProduct, selectedQuantity);
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSearchQuery("");
          setSearchResults([]);
          setSelectedProductIndex(-1);
          setSelectedQuantity(1);
        }
      }

      // Atajos numéricos - permitir desde cualquier lugar cuando hay producto seleccionado
      if (e.key >= '1' && e.key <= '9' && selectedProductIndex >= 0) {
        e.preventDefault();
        setSelectedQuantity(parseInt(e.key));
      }

      // Navegación en carrito
      if (focusMode === 'cart' && cart.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCartIndex((prev) => {
            const nextIndex = prev < cart.length - 1 ? prev + 1 : prev;
            if (cartListRef.current) {
              const cartElements = cartListRef.current.querySelectorAll('[data-cart-index]');
              const element = cartElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCartIndex((prev) => {
            const nextIndex = prev > 0 ? prev - 1 : 0;
            if (cartListRef.current) {
              const cartElements = cartListRef.current.querySelectorAll('[data-cart-index]');
              const element = cartElements[nextIndex] as HTMLElement;
              element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return nextIndex;
          });
        } else if (e.key === 'ArrowRight' || e.key === '+') {
          e.preventDefault();
          if (selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
            updateQuantity(cart[selectedCartIndex].id, 1);
          }
        } else if (e.key === 'ArrowLeft' || e.key === '-') {
          e.preventDefault();
          if (selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
            updateQuantity(cart[selectedCartIndex].id, -1);
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
            removeFromCart(cart[selectedCartIndex].id);
            setSelectedCartIndex((prev) => Math.min(prev, cart.length - 2));
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedCartIndex(-1);
          setFocusMode('search');
          searchInputRef.current?.focus();
        }
      }

      // Atajos globales
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0) {
          handleCreateSale();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchResults, selectedProductIndex, selectedQuantity, focusMode, selectedCartIndex, cart, addToCart]);

  // ============================================================================
  // FUNCIONES DE BÚSQUEDA OPTIMIZADA (igual que QuickSalePanel)
  // ============================================================================
  const normalizeText = useCallback((value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }, []);

  const getLocalMatches = useCallback(
    (query: string) => {
      if (!productCatalog || productCatalog.length === 0) return [];
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) {
        return productCatalog.slice(0, 12);
      }

      const filtered = productCatalog.filter((product: any) => {
        const normalizedName = normalizeText(product.name || "");
        const normalizedCode = product.code ? normalizeText(product.code) : "";
        return (
          normalizedName.includes(normalizedQuery) ||
          (normalizedCode && normalizedCode.includes(normalizedQuery))
        );
      });

      return sortProductsByQueryMatch(filtered, query).slice(0, 12);
    },
    [productCatalog, normalizeText]
  );

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Si el catálogo ya está precargado, respondemos inmediatamente sin esperar al backend
    if (productCatalog.length > 0) {
      setSearchResults(getLocalMatches(query.trim()));
      setIsSearching(false);
      return;
    }

    const normalizedCacheKey = query.trim().toLowerCase();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      if (searchCacheRef.current[normalizedCacheKey]) {
        setSearchResults(searchCacheRef.current[normalizedCacheKey]);
        setIsSearching(false);
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const result = await searchProducts(query.trim());

        if (abortController.signal.aborted) {
          return;
        }

        if (result.success && result.data) {
          const ranked = sortProductsByQueryMatch(result.data, query.trim());
          const limitedResults = ranked.slice(0, 8);
          searchCacheRef.current[normalizedCacheKey] = limitedResults;
          setSearchResults(limitedResults);
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        console.error("❌ Error en búsqueda:", error);
      } finally {
        setIsSearching(false);
      }
    }, 150);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      const item = prevCart.find(item => item.id === itemId);
      if (!item) return prevCart;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== itemId);
      }

      // Verificar stock disponible (sumar todas las cantidades del mismo producto excepto el actual)
      if (!item.unlimited_stock) {
        const otherItemsQuantity = prevCart
          .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== itemId)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

        if (otherItemsQuantity + newQuantity > item.stock) {
          addNotification("error", "No hay suficiente stock disponible");
          return prevCart;
        }
      }

      return prevCart.map(cartItem =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: newQuantity }
          : cartItem
      );
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== itemId));
  };

  const updateCustomization = (itemId: string, customization: string) => {
    setCart((prevCart) =>
      prevCart.map(item =>
        item.id === itemId
          ? { ...item, customization }
          : item
      )
    );
  };

  const canEditPrices = useCanEditPrices();

  const updatePrice = (itemId: string, price: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: price >= 0 ? price : item.unit_price }
          : item
      )
    );
  };

  const handleCreateSale = async () => {
    if (cart.length === 0) {
      addNotification("error", "Agrega al menos un producto al carrito");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determinar si tiene productos de cocina
      // CRÍTICO: Usar cocina_only (no unlimited_stock) porque:
      // - unlimited_stock = true significa producto preparado (puede ser cocina O bar)
      // - cocina_only = true significa que específicamente va a cocina
      // Si usamos unlimited_stock, productos del bar (unlimited_stock=true, cocina_only=false)
      // se crearían como "pending" pero NO aparecerían en cocina
      const hasKitchenProducts = cart.some(item => item.cocina_only === true);
      // Mostrador SIEMPRE se crea abierto (pending). El cobro y el medio de pago
      // se eligen al cerrar el pedido, igual que una mesa. Flag runtime para que
      // TS no estreche el tipo (el bloque de pago de abajo queda inactivo).
      const crearAbierto: boolean = true;
      const saleStatus: "pending" | "completed" = crearAbierto ? "pending" : "completed";

      const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

      // Determinar el método de pago a usar (solo si la venta se completa)
      // Se usa el método elegido por el usuario en el selector. Si por algún motivo
      // está vacío, se cae a "Efectivo" o al primer método activo disponible.
      let paymentMethodId: string | null = null;
      if (saleStatus === "completed") {
        if (selectedPaymentMethodId) {
          paymentMethodId = selectedPaymentMethodId;
        } else {
          const efectivoMethod = paymentMethods.find(
            (method) => method.name === "Efectivo" || method.name.toLowerCase() === "efectivo"
          );
          paymentMethodId = efectivoMethod ? efectivoMethod.id : paymentMethods[0]?.id || null;
        }

        if (!paymentMethodId) {
          addNotification("error", "No se encontró un método de pago válido");
          setIsSubmitting(false);
          return;
        }
      }

      const result = await createSale({
        status: saleStatus,
        sale_type: "counter",
        cash_register_id: cashRegister.id,
        area: session.area,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          customization: item.customization || undefined,
        })),
        payments: saleStatus === "completed" && paymentMethodId ? [{ payment_method_id: paymentMethodId, amount: total }] : [],
        customer_name: customerName || undefined,
      });

      if (result.success) {
        // Verificar si hay productos de cocina para imprimir
        // IMPORTANTE: Solo productos con cocina_only = true van a cocina
        // Esto debe coincidir con el filtro de KitchenView
        const kitchenItems = cart.filter(item => item.cocina_only === true);

        if (kitchenItems.length > 0) {
          console.log(`🖨️ [MOSTRADOR] ${kitchenItems.length} productos de cocina detectados, enviando a impresión térmica`);

          try {
            // Obtener configuración de impresora
            const configResult = await getPrinterConfig();
            const config = configResult.success && configResult.data ? configResult.data.kitchen : { width: 48 };

            // Obtener la cadena de impresora desde Supabase
            const printerResult = await getKitchenPrinterString();
            const printerName = printerResult.success ? printerResult.data : '192.168.0.114:9100';

            // Generar contenido del ticket
            const generateKitchenTicket = (await import("@/lib/kitchenPrinter")).generateKitchenTicket;
            const ticketContent = generateKitchenTicket({
              tableNumber: null,
              timestamp: new Date().toISOString(),
              items: kitchenItems.map(item => ({
                quantity: item.quantity,
                name: item.name,
                customization: item.customization
              })),
              orderType: 'new',
              saleType: 'counter',
              customerName: customerName || undefined
            }, config.width);

            console.log('🖨️ [MOSTRADOR] Enviando a la impresora térmica...');

            const printResult = await printToLocal(
              ticketContent,
              printerName,
              "kitchen",
              config.width
            );
            if (printResult.success) {
              console.log('✅ Impresión térmica exitosa para mostrador');
            } else {
              console.error('❌ Error al enviar impresión térmica:', printResult.message);
            }
          } catch (printError) {
            console.error('❌ Error al preparar impresión térmica:', printError);
          }
        }

        addNotification(
          "success",
          hasKitchenProducts
            ? "Pedido de mostrador creado y enviado a cocina. Cobralo al cerrar el pedido."
            : "Pedido de mostrador creado. Cobralo al cerrar el pedido."
        );

        setCart([]);
        setCustomerName("");
        onComplete();
        onClose();
      } else {
        addNotification("error", result.message || "Error al crear venta");
      }
    } catch (error: any) {
      addNotification("error", error.message || "Error al procesar la venta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">🛒 Nuevo Pedido de Mostrador</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              className="h-6 w-6"
              title="Mostrar atajos de teclado"
            >
              <Keyboard className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Ayuda de atajos de teclado */}
        {showKeyboardHelp && (
          <div className="mt-3 p-3 bg-muted/50 rounded-md border">
            <div className="text-sm font-medium mb-2">🎯 Atajos de Teclado</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><kbd className="bg-background px-1 rounded border">↑↓</kbd> Navegar productos</div>
              <div><kbd className="bg-background px-1 rounded border">←→</kbd> Cambiar cantidad</div>
              <div><kbd className="bg-background px-1 rounded border">1-9</kbd> Cantidad específica</div>
              <div><kbd className="bg-background px-1 rounded border">Enter</kbd> Agregar producto</div>
              <div><kbd className="bg-background px-1 rounded border">F2</kbd> Editar carrito</div>
              <div><kbd className="bg-background px-1 rounded border">Ctrl+Enter</kbd> Finalizar venta</div>
              <div><kbd className="bg-background px-1 rounded border">Esc</kbd> Cancelar/Limpiar</div>
              <div><kbd className="bg-background px-1 rounded border">Supr</kbd> Eliminar (en carrito)</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Campo de nombre del cliente (opcional) */}
        <div className="space-y-2">
          <Label htmlFor="customer-name">Cliente (opcional)</Label>
          <Input
            id="customer-name"
            placeholder="Nombre del cliente..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        {/* Búsqueda de productos */}
        {/* Búsqueda de productos */}
        <div className="space-y-3 relative z-50">
          <Label htmlFor="product-search" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Agregar Productos
          </Label>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <Input
              ref={searchInputRef}
              id="product-search"
              placeholder="Escribe para buscar productos..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-12 text-lg bg-muted/30 border-border focus:bg-card focus:border-foreground focus:ring-1 focus:ring-foreground transition-all rounded-xl"
            />

            {/* Resultados de búsqueda (Command Palette Style) */}
            {searchResults.length > 0 && (
              <div
                ref={resultsListRef}
                className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100 p-1.5 space-y-0.5"
              >
                <div className="text-[10px] font-mono font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
                  Resultados encontrados ({searchResults.length})
                </div>
                {searchResults.map((product, index) => {
                  const isInCart = cart.some(item => item.product_id === product.id);
                  const isSelected = selectedProductIndex === index;

                  return (
                    <div
                      key={product.id}
                      data-product-index={index}
                      className={`
                        relative flex flex-col gap-1 p-2.5 rounded-lg border transition-all cursor-pointer
                        ${isSelected
                          ? 'bg-foreground border-foreground text-background shadow-md'
                          : 'bg-card border-transparent hover:bg-muted/30 text-foreground'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => addToCart(product, selectedProductIndex === index ? selectedQuantity : 1, false)}
                          className="flex-1 flex items-center justify-between text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate text-sm">
                              {product.name}
                            </div>
                            <div className={`text-xs flex items-center gap-2 ${isSelected ? 'text-background/60' : 'text-muted-foreground'}`}>
                              {product.code && <span className="font-mono bg-white/10 px-1 rounded">{product.code}</span>}
                              {isInCart && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/20 text-green-600 border-0">
                                  En carrito
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3 pl-2">
                            {isSelected && selectedQuantity > 1 && (
                              <div className="bg-buffalo-caramel text-black text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center shadow-sm">
                                x{selectedQuantity}
                              </div>
                            )}
                            <div className={`font-mono font-bold text-sm ${isSelected ? 'text-buffalo-caramel' : 'text-foreground'}`}>
                              {formatCurrency(product.sale_price)}
                            </div>
                            {!product.unlimited_stock && (
                              <div className={`text-[10px] ${isSelected ? 'text-background/60' : 'text-muted-foreground'}`}>
                                Stock: {product.stock}
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Botón para agregar nuevo con personalización */}
                        {product.unlimited_stock && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product, 1, true);
                            }}
                            className={`h-7 px-2 text-xs flex-shrink-0 ${isSelected ? 'text-background/60 hover:text-background hover:bg-background/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'}`}
                            title="Agregar nuevo con personalización distinta"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-3 mt-1 pt-1.5 border-t border-border text-[10px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1"><span className="bg-white/20 px-1 rounded">↵</span> Agregar</span>
                          <span className="flex items-center gap-1"><span className="bg-white/20 px-1 rounded">←→</span> Cantidad</span>
                          <span className="flex items-center gap-1"><span className="bg-white/20 px-1 rounded">1-9</span> Directo</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrito */}
        <div className="space-y-3 z-0">
          <div className="flex items-center justify-between border-b border-dashed border-border pb-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Carrito ({cart.length})
            </Label>
            {cart.length > 0 && (
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${focusMode === 'cart'
                  ? 'bg-buffalo-caramel text-foreground border-buffalo-caramel animate-pulse'
                  : 'text-muted-foreground border-border'
                  }`}
              >
                {focusMode === 'cart' ? '🎯 MODO EDICIÓN (F2)' : 'F2 PARA EDITAR'}
              </Badge>
            )}
          </div>
          <div
            ref={cartListRef}
            className="rounded-xl overflow-hidden bg-muted/30 min-h-[100px]"
          >
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl m-2">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">Carrito vacío</p>
                <p className="text-xs">Usa el buscador para agregar productos</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((item, index) => (
                  <div
                    key={item.id}
                    data-cart-index={index}
                    className={`
                      relative p-3 space-y-2 transition-all duration-200 animate-in slide-in-from-right-4 fade-in
                      ${focusMode === 'cart' && selectedCartIndex === index
                        ? 'bg-card shadow-lg z-10 scale-[1.02] ring-1 ring-foreground border-transparent my-1 rounded-lg'
                        : 'hover:bg-card hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-foreground leading-tight">{item.name}</div>
                        <div className="text-xs font-mono text-muted-foreground mt-0.5">
                          {formatCurrency(item.unit_price)} c/u
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Controls */}
                        <div className="flex items-center bg-card rounded-md border border-border shadow-sm h-7">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="h-full px-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-l-md disabled:opacity-30"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className={`w-8 text-center text-xs font-bold font-mono ${focusMode === 'cart' && selectedCartIndex === index ? 'text-buffalo-caramel' : 'text-foreground'
                            }`}>
                            {item.quantity}
                          </span>
                          <button
                            className="h-full px-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-r-md disabled:opacity-30"
                            onClick={() => {
                              // Verificar stock antes de incrementar
                              const otherItemsQuantity = cart
                                .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== item.id)
                                .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

                              if (!item.unlimited_stock && otherItemsQuantity + item.quantity + 1 > item.stock) {
                                addNotification("error", "No hay suficiente stock disponible");
                                return;
                              }
                              updateQuantity(item.id, 1);
                            }}
                            disabled={!item.unlimited_stock && (() => {
                              const otherItemsQuantity = cart
                                .filter(cartItem => cartItem.product_id === item.product_id && cartItem.id !== item.id)
                                .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
                              return otherItemsQuantity + item.quantity >= item.stock;
                            })()}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <button
                          className="text-muted-foreground/50 hover:text-red-500 transition-colors p-1"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Input de personalización - PARA TODOS LOS PRODUCTOS (igual que QuickSalePanel) */}
                    <Input
                      placeholder="Personalización (ej: sin lechuga, picante)"
                      value={item.customization || ""}
                      onChange={(e) => updateCustomization(item.id, e.target.value)}
                      className="text-xs h-8"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!canEditPrices}
                          title={!canEditPrices ? "Solo admin/supervisor pueden cambiar el precio" : undefined}
                          className="w-24 h-8 text-sm text-right disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="font-mono font-bold text-foreground text-right min-w-[60px]">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </div>
                    </div>

                    {focusMode === 'cart' && selectedCartIndex === index && (
                      <div className="text-xs text-foreground font-medium mt-1">
                        💡 ←→ o +/- para cantidad • Supr/Retroceso para eliminar • Esc para salir
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Total */}
        {cart.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total:</span>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(cartTotal)}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer con botones de acción */}
      <div className="p-4 border-t space-y-3">
        {/* El cobro se realiza al cerrar el pedido (ahí se elige el medio de pago). */}
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          El pedido se crea <b>abierto</b>. El cobro y el medio de pago se eligen al <b>cerrar el pedido</b>.
        </p>

        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={handleCreateSale}
          disabled={cart.length === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Crear Pedido
            </>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </Card>
  );
}

