"use client";

import { useState, useEffect, useRef, useCallback, useDeferredValue } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";
import { brand } from "@/lib/brand";
import { formatCurrency } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { searchProducts } from "@/actions/productActions";
import { getKitchenPrinterString, getPrinterConfig } from "@/actions/configActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useSaleMutation } from "@/hooks/useSales";
import { useProductSearchIndex } from "@/hooks/useProducts";
import { generateKitchenTicket } from "@/lib/kitchenPrinter";
import { generateCashierTicket, printToLocal } from "@/lib/localPrinter";
import type { OpenTablesResult } from "@/hooks/useOpenTables";

interface QuickSalePanelProps {
  tableNumber: number;
  session: any;
  onClose: () => void;
  onComplete: (tableNumber: number, optimisticTable?: any) => void;
}

interface CartItem {
  id: string; // ID único para cada item del carrito
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  customization?: string;
  unlimited_stock?: boolean;
  cocina_only?: boolean;
}

export function QuickSalePanel({ tableNumber, session, onClose, onComplete }: QuickSalePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  // Ref para mantener referencia al carrito actual (evita problemas de closure)
  const cartRef = useRef<CartItem[]>([]);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const currentUser = useAuthStore((state) => state.user);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Hook de mutación para crear ventas con invalidación automática
  const saleMutation = useSaleMutation({ skipOpenTablesInvalidation: true });
  const { data: productIndexResult, isFetching: isProductIndexLoading } = useProductSearchIndex();
  const productCatalog = productIndexResult?.data ?? [];
  const openTablesInvalidateTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar ref con estado del carrito
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    return () => {
      if (openTablesInvalidateTimeout.current) {
        clearTimeout(openTablesInvalidateTimeout.current);
      }
    };
  }, []);

  // ============================================================================
  // OPTIMIZACIONES DE BÚSQUEDA
  // ============================================================================

  // Ref para el timer de debounce (evita múltiples búsquedas mientras se escribe)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref para el caché de búsquedas (evita llamadas repetidas a la BD)
  const searchCacheRef = useRef<Record<string, any[]>>({});

  // Ref para el AbortController (cancela búsquedas en curso si hay una nueva)
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Enfocar búsqueda al montar y limpiar caché
    searchInputRef.current?.focus();
    searchCacheRef.current = {}; // Limpiar caché al abrir el panel

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

  useEffect(() => {
    // Resetear índice seleccionado cuando cambian los resultados
    setSelectedProductIndex(-1);
    setSelectedQuantity(1);
  }, [searchResults]);

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


  // Agregar producto al carrito
  const addToCart = useCallback((product: any, quantity: number = 1) => {
    console.log('🛒 QuickSalePanel - addToCart:', product.name, 'unlimited_stock:', product.unlimited_stock);
    console.log('📋 Carrito actual:', cart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));

    setCart((prevCart) => {
      // Para productos de cocina (unlimited_stock), SIEMPRE crear un item independiente
      // Esto permite que cada uno tenga su propia personalización
      if (product.unlimited_stock) {
        console.log('🍳 Creando item independiente para producto de cocina');
        const uniqueId = `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newCart = [
          ...prevCart,
          {
            id: uniqueId,
            product_id: product.id,
            name: product.name,
            unit_price: product.sale_price,
            quantity,
            customization: "",
            unlimited_stock: product.unlimited_stock,
            cocina_only: product.cocina_only ?? false,
          },
        ];
        console.log('📋 Nuevo carrito:', newCart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));
        return newCart;
      }

      // Para productos con stock limitado, buscar uno existente sin personalización para incrementar cantidad
      const existing = prevCart.find(item => item.product_id === product.id && (!item.customization || item.customization.trim() === ""));

      if (existing) {
        console.log('📦 Encontrado item existente sin personalización, incrementando cantidad');
        const newCart = prevCart.map(item =>
          item.product_id === product.id && (!item.customization || item.customization.trim() === "")
            ? {
              ...item,
              quantity: item.quantity + quantity,
              unlimited_stock: product.unlimited_stock,
              cocina_only: product.cocina_only ?? item.cocina_only ?? false,
            }
            : item
        );
        console.log('📋 Nuevo carrito:', newCart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));
        return newCart;
      } else {
        // Si no existe ninguno sin personalización, crear uno nuevo
        console.log('📦 No encontrado item existente, creando nuevo');
        const uniqueId = `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newCart = [
          ...prevCart,
          {
            id: uniqueId,
            product_id: product.id,
            name: product.name,
            unit_price: product.sale_price,
            quantity,
            customization: "",
            unlimited_stock: product.unlimited_stock,
            cocina_only: product.cocina_only ?? false,
          },
        ];
        console.log('📋 Nuevo carrito:', newCart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));
        return newCart;
      }
    });

    // Limpiar búsqueda
    setSearchQuery("");
    setSearchResults([]);
    setSelectedProductIndex(-1);
    setSelectedQuantity(1);

    // Enfocar el input después de un pequeño delay para evitar que se reabra el dropdown
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const canEditPrices = currentUser?.role === "admin" || currentUser?.role === "supervisor";

  const updatePrice = useCallback((itemId: string, price: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: price >= 0 ? price : item.unit_price }
          : item
      )
    );
  }, []);

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

  // Manejar navegación con teclado (para flechas arriba/abajo y enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {


      // Enter solo funciona cuando estamos en el input de búsqueda
      if (e.key === 'Enter' && e.target === searchInputRef.current && !saleMutation.isPending) {
        e.preventDefault();

        // Si hay producto seleccionado, agregarlo al carrito
        if (selectedProductIndex >= 0 && selectedProductIndex < searchResults.length) {
          const selectedProduct = searchResults[selectedProductIndex];
          if (selectedProduct) {
            addToCart(selectedProduct, selectedQuantity);
          }
        }
        // Si no hay producto seleccionado pero hay productos en el carrito, abrir mesa
        else if (cartRef.current.length > 0) {
          handleFinalize(e);
        }
        // Si no hay productos y el input está vacío, cerrar panel
        else if (cartRef.current.length === 0 && searchQuery.trim() === '' && searchResults.length === 0) {
          onClose();
        }
        return;
      }

      // Enter global fuera del input - abrir mesa si hay productos
      if (e.key === 'Enter' && e.target !== searchInputRef.current && !saleMutation.isPending) {
        e.preventDefault();
        e.stopPropagation();
        if (cartRef.current.length > 0) {
          handleFinalize(e);
        }
        return;
      }

      // Solo manejar teclado si tenemos resultados de búsqueda
      if (searchResults.length === 0) return;

      // Solo manejar si estamos en el input de búsqueda (identificado por ref)
      if (e.target === searchInputRef.current) {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchResults, selectedProductIndex, selectedQuantity, addToCart, searchQuery, cart, saleMutation.isPending, onClose]);

  // ============================================================================
  // BÚSQUEDA OPTIMIZADA DE PRODUCTOS
  // Implementa: Debouncing + Caché Local + Cancelación de búsquedas
  // ============================================================================

  // Efecto para búsqueda local usando deferredSearchQuery
  useEffect(() => {
    if (productCatalog.length > 0 && searchQuery.trim().length > 0) {
      const matches = getLocalMatches(deferredSearchQuery);
      setSearchResults(matches);
      setIsSearching(false);
    }
  }, [deferredSearchQuery, productCatalog.length, getLocalMatches, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Si el catálogo ya está precargado, no hacemos búsqueda fetch
    if (productCatalog.length > 0) {
      setIsSearching(true); // Mostrar loading sutil mientras deferredValue procesa
      return;
    }

    const normalizedCacheKey = trimmedQuery.toLowerCase();

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
        const result = await searchProducts(trimmedQuery);

        if (abortController.signal.aborted) {
          return;
        }

        if (result.success && result.data) {
          const ranked = sortProductsByQueryMatch(result.data, trimmedQuery);
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
  }, [getLocalMatches, productCatalog.length]);

  // Actualizar personalización
  const updateCustomization = (itemId: string, customization: string) => {
    console.log('✏️ QuickSalePanel - updateCustomization:', itemId, customization);
    console.log('📋 Carrito ANTES:', cart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));

    setCart(cart.map(item =>
      item.id === itemId
        ? { ...item, customization }
        : item
    ));

    setTimeout(() => {
      console.log('📋 Carrito DESPUÉS:', cart.map(item => ({ id: item.id, name: item.name, customization: item.customization })));
    }, 0);
  };

  // Actualizar cantidad
  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // Remover del carrito
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Calcular total
  const total = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const injectOptimisticTable = (saleData: any, cartItems: CartItem[]) => {
    if (!saleData) return null;

    const optimisticSale = {
      id: saleData.id,
      sale_number: saleData.sale_number,
      total_amount: saleData.total_amount,
      status: saleData.status ?? "pending",
      table_number: saleData.table_number ?? tableNumber,
      sale_type: saleData.sale_type ?? "table",
      kitchen_ready: false,
      customer_name: saleData.customer_name || null,
      customer_phone: saleData.customer_phone || null,
      delivery_address: saleData.delivery_address || null,
      delivery_notes: saleData.delivery_notes || null,
      created_at: saleData.created_at || new Date().toISOString(),
      cash_register_session_id: saleData.cash_register_session_id ?? session?.id,
      user: currentUser?.name ? { name: currentUser.name } : { name: "Cajero" },
      sale_items: cartItems.map((item, index) => ({
        id: `${saleData.id}-${item.product_id}-${index}`,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        product: {
          name: item.name,
          cocina_only: item.cocina_only ?? false,
        },
      })),
      sale_payments: [],
      paid_amount: 0,
      remaining_amount: saleData.total_amount,
    };

    queryClient.setQueryData<OpenTablesResult>(["openTables"], (previous) => {
      const previousData = previous?.data ?? [];
      const filtered = previousData.filter(
        (table: any) =>
          table.table_number !== optimisticSale.table_number && table.id !== optimisticSale.id
      );

      return {
        success: true,
        data: [optimisticSale, ...filtered],
        message: previous?.message,
      } as OpenTablesResult;
    });

    return optimisticSale;
  };

  const shouldAutoPrintOnMobile = () => {
    if (typeof window === "undefined") return false;

    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    const narrowScreen = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileAgent =
      userAgent.includes("android") ||
      userAgent.includes("iphone") ||
      userAgent.includes("ipad") ||
      userAgent.includes("mobile");

    return mobileAgent || (coarsePointer && narrowScreen);
  };

  const printOpeningTableTickets = async (createdSale: any, cartItems: CartItem[]) => {
    try {
      if (!shouldAutoPrintOnMobile()) {
        return;
      }

      const configResult = await getPrinterConfig();
      const config = configResult.success && configResult.data ? configResult.data : null;
      if (!config?.localServer?.enabled || !config.localServer.host) {
        return;
      }

      const formattedItems = cartItems.map((item) => ({
        quantity: item.quantity,
        name:
          item.customization && item.customization.trim() !== ""
            ? `${item.name} (${item.customization.trim()})`
            : item.name,
        unit_price: item.unit_price,
        customization: item.customization,
        cocina_only: item.cocina_only === true,
      }));
      const orderTotal = cartItems.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0,
      );

      const kitchenItems = formattedItems.filter((item) => item.cocina_only);
      if (kitchenItems.length > 0 && config.kitchen.enabled) {
        const printerStringResult = await getKitchenPrinterString();
        const kitchenPrinterName = printerStringResult.success
          ? printerStringResult.data
          : config.kitchen.ip;

        const kitchenTicketContent = generateKitchenTicket({
          tableNumber,
          timestamp: createdSale.created_at || new Date().toISOString(),
          items: kitchenItems.map((item) => ({
            quantity: item.quantity,
            name: item.name,
            customization: item.customization,
          })),
          orderType: "new",
          saleType: "table",
          waiterName: currentUser?.name || undefined,
        }, config.kitchen.width || 48);

        await printToLocal(
          kitchenTicketContent,
          kitchenPrinterName,
          "kitchen",
          config.kitchen.width || 48,
        );
      }

      const orderSummaryContent = generateCashierTicket({
        header: brand.name,
        businessInfo: {
          address: "Leandro Araoz 95",
          phone: "",
          cuit: "",
        },
        saleType: "table",
        tableNumber,
        lines: [
          { label: "Fecha", value: new Date(createdSale.created_at || new Date()).toLocaleDateString("es-AR") },
          { label: "Ticket", value: createdSale.sale_number || createdSale.id || `MESA-${tableNumber}` },
        ],
        items: formattedItems.map((item) => ({
          quantity: item.quantity,
          name: item.name,
          unit_price: item.unit_price,
        })),
        total: createdSale.total_amount || orderTotal,
        totalLabel: "TOTAL:",
        footer: "Pedido de mesa",
      });

      await printToLocal(
        orderSummaryContent,
        config.cash.name || "Caja USB",
        "cash",
        config.cash.width || 32,
      );

      addNotification("success", `Mesa ${tableNumber}: tickets enviados a impresión`);
    } catch (printError: any) {
      console.error("Error imprimiendo tickets de apertura de mesa:", printError);
      addNotification(
        "warning",
        `Mesa ${tableNumber} abierta, pero falló la impresión automática`,
      );
    }
  };

  // Finalizar venta (abrir mesa) - UI Optimista Real
  const handleFinalize = async (e?: React.MouseEvent | React.KeyboardEvent | KeyboardEvent | MouseEvent) => {
    // Prevenir comportamiento por defecto si es un evento
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Usar ref para asegurar que tenemos el estado más actualizado del carrito
    const currentCart = cartRef.current;

    if (currentCart.length === 0) {
      addNotification("error", "El carrito está vacío");
      return;
    }

    // 1. Crear venta optimista con ID temporal ANTES de la mutación
    const tempId = `temp-${Date.now()}-${tableNumber}`;
    const totalAmount = currentCart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    const optimisticSale = {
      id: tempId,
      table_number: tableNumber,
      status: 'pending' as const,
      total_amount: totalAmount,
      paid_amount: 0, // Evita que SelectedTableDetail haga fetch de balance
      remaining_amount: totalAmount, // Evita que SelectedTableDetail haga fetch de balance
      created_at: new Date().toISOString(),
      sale_type: 'table' as const,
      items: currentCart.map(item => ({
        id: `temp-item-${Date.now()}-${item.product_id}`,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        customization: item.customization,
        product: {
          id: item.product_id,
          name: item.name,
          price: item.unit_price,
        }
      })),
      // Agregar sale_items para compatibilidad con SelectedTableDetail
      sale_items: currentCart.map(item => ({
        id: `temp-item-${Date.now()}-${item.product_id}`,
        product_id: item.product_id,
        quantity: item.quantity,
        remaining_quantity: item.quantity, // Inicialmente igual a la cantidad
        paid_quantity: 0,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        remaining_amount: item.unit_price * item.quantity, // Inicialmente igual al subtotal
        customization: item.customization,
        product: {
          id: item.product_id,
          name: item.name,
          price: item.unit_price,
        }
      })),
    };

    // 2. Inyectar mesa optimista en la caché de React Query INMEDIATAMENTE
    queryClient.setQueryData<OpenTablesResult>(["openTables"], (previous) => {
      const previousData = previous?.data ?? [];
      return {
        success: true,
        data: [optimisticSale, ...previousData],
        message: previous?.message,
      } as OpenTablesResult;
    });

    // 3. Cerrar panel INMEDIATAMENTE (antes de la mutación)
    addNotification("info", `Abriendo mesa ${tableNumber}...`);
    onComplete(tableNumber, optimisticSale);

    // Limpiar caché de búsqueda
    searchCacheRef.current = {};

    // 4. Preparar datos para la mutación real
    const saleData = {
      cash_register_id: session?.cash_register_id || session?.cash_register?.id,
      cash_register_session_id: session.id,
      table_number: tableNumber,
      status: "pending" as const,
      sale_type: "table" as const,
      area: "bar" as const,
      items: currentCart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        customization: item.customization || undefined
      })),
      payments: []
    };

    // 5. Ejecutar mutación en segundo plano
    try {
      const result = await saleMutation.mutateAsync(saleData);

      if (result.success) {
        console.log("✅ [BACKGROUND] Mutación exitosa - reemplazando venta temporal con real");

        queryClient.setQueryData<OpenTablesResult>(["openTables"], (previous) => {
          const previousData = previous?.data ?? [];
          const filtered = previousData.filter(
            (table: any) =>
              !table.id.startsWith("temp-") || Number(table.table_number) !== Number(tableNumber)
          );

          return {
            success: true,
            data: [result.data, ...filtered],
            message: previous?.message,
          } as OpenTablesResult;
        });

        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });

        addNotification("success", `¡Mesa ${tableNumber} abierta con éxito! 🍺`);

        if (openTablesInvalidateTimeout.current) {
          clearTimeout(openTablesInvalidateTimeout.current);
        }
        openTablesInvalidateTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["openTables"], refetchType: "active" });
        }, 500);

        await printOpeningTableTickets(result.data, currentCart);
      } else {
        console.error("❌ [BACKGROUND] Error en mutación - haciendo rollback");
        queryClient.setQueryData<OpenTablesResult>(["openTables"], (previous) => {
          const previousData = previous?.data ?? [];
          return {
            success: true,
            data: previousData.filter((table: any) => table.id !== tempId),
            message: previous?.message,
          } as OpenTablesResult;
        });
        addNotification("error", result.message || "Error al abrir la mesa");
      }
    } catch (error: any) {
      console.error("❌ [BACKGROUND] Error exception - haciendo rollback:", error);
      queryClient.setQueryData<OpenTablesResult>(["openTables"], (previous) => {
        const previousData = previous?.data ?? [];
        return {
          success: true,
          data: previousData.filter((table: any) => table.id !== tempId),
          message: previous?.message,
        } as OpenTablesResult;
      });
      addNotification("error", error.message || "Error al abrir la mesa");
    }
  };

  const getTableLabel = () => {
    if (tableNumber >= 38 && tableNumber <= 41) return `🥂 Barra ${tableNumber}`;
    return `🍺 Mesa ${tableNumber}`;
  };

  return (
    <Card className="sticky top-6 shadow-xl">
      <CardHeader className="pb-4 bg-muted/30 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-green-700 mb-1">
              {getTableLabel()}
            </CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              Tomando Pedido
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Buscador */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isProductIndexLoading && (
            <p className="text-xs text-muted-foreground pl-1">
              Precargando catálogo para búsquedas instantáneas...
            </p>
          )}

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto" ref={resultsListRef}>
              {searchResults.map((product, index) => (
                <button
                  key={product.id}
                  data-product-index={index}
                  onClick={() => {
                    addToCart(product, selectedProductIndex === index ? selectedQuantity : 1);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left border-b last:border-0 transition-colors relative ${selectedProductIndex === index
                    ? 'bg-primary/20 border-l-4 border-l-primary ring-2 ring-primary/30'
                    : 'hover:bg-muted/50'
                    }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-green-600">{formatCurrency(product.sale_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {selectedProductIndex === index && selectedQuantity > 1 && (
                      <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                        {selectedQuantity}
                      </div>
                    )}
                    <Plus className="h-4 w-4 text-green-600" />
                  </div>

                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Productos ({cart.length})</h3>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCart([])}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Buscá y agregá productos</p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {cart.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm flex-1">{item.name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700 -mt-1"
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Input de personalización */}
                  <Input
                    placeholder="Personalización (ej: sin lechuga, picante)"
                    value={item.customization || ""}
                    onChange={(e) => updateCustomization(item.id, e.target.value)}
                    className="text-xs h-8"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product_id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-semibold w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product_id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                        disabled={!canEditPrices}
                        title={!canEditPrices ? "Solo admin/supervisor pueden cambiar el precio" : undefined}
                        className="w-24 h-8 text-sm text-right disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                      <p className="font-semibold text-green-600 w-24 text-right">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total y acciones */}
        {cart.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">TOTAL:</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(total)}
              </span>
            </div>

            <Button
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => handleFinalize(e)}
              disabled={saleMutation.isPending}
              type="button"
            >
              {saleMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Abrir Mesa
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return null;
}

