"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShoppingCart, Trash2, DollarSign, Sparkles, Loader2, Plus, CheckCircle, XCircle, Package, Clock, ArrowUpDown, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { Badge } from "@/components/ui/badge";
import { searchProductByName, searchProducts, getProducts } from "@/actions/productActions";
import { createSale, getPaymentMethods, completeCounter, getSaleKitchenItems } from "@/actions/saleActions";
import { getPrinterConfig, getKitchenPrinterString } from "@/actions/configActions";
import { printToLocal } from "@/lib/localPrinter";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { PaymentModal } from "./PaymentModal";
import { SimplePaymentModal } from "./SimplePaymentModal";
import { PrintTicket } from "./PrintTicket";
import { SelectedTableDetail } from "./SelectedTableDetail";
import { CounterSaleForm } from "./CounterSaleForm";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SaleItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  unlimited_stock?: boolean;
  cocina_only?: boolean;
  customization?: string;
}

interface CounterSaleViewProps {
  cashRegister: any;
  session: any;
  initialOrders?: any[];
}

type CounterSortOption = "newest" | "oldest" | "amount_high" | "amount_low" | "name";
type CounterStatusFilter = "all" | "pending" | "completed" | "cancelled";

export function CounterSaleView({ cashRegister, session, initialOrders = [] }: CounterSaleViewProps) {
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [paymentsForPrint, setPaymentsForPrint] = useState<Array<{ payment_method_name: string; amount: number }>>([]);
  const [cartItemsForPrint, setCartItemsForPrint] = useState<any[]>([]);
  const [preloadedProducts, setPreloadedProducts] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [showSaleCard, setShowSaleCard] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>(initialOrders);
  const [isLoadingOrders, setIsLoadingOrders] = useState(!initialOrders.length);
  const [selectedOrderForPanel, setSelectedOrderForPanel] = useState<any | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(session?.id || null);
  // Estados para filtrado y ordenamiento de la lista de pedidos
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderSortOption, setOrderSortOption] = useState<CounterSortOption>("newest");
  const [orderStatusFilter, setOrderStatusFilter] = useState<CounterStatusFilter>("all");

  useEffect(() => {
    setActiveSessionId(session?.id || session?.cash_register_session_id || null);
  }, [session?.id, session?.cash_register_session_id]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const confirm = useConfirm();


  const colorClass = "text-foreground";
  const bgColorClass = "bg-buffalo-caramel/10";

  // Filtrar y ordenar pedidos de mostrador
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...pendingOrders];

    // Filtrar por estado
    if (orderStatusFilter !== "all") {
      result = result.filter(order => order.status === orderStatusFilter);
    }

    // Filtrar por búsqueda
    if (orderSearchQuery.trim()) {
      const query = orderSearchQuery.toLowerCase().trim();
      result = result.filter(order =>
        (order.customer_name?.toLowerCase().includes(query)) ||
        (order.customer_phone?.includes(query)) ||
        (order.sale_number?.toLowerCase().includes(query))
      );
    }

    // Ordenar
    result.sort((a, b) => {
      switch (orderSortOption) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_high":
          return b.total_amount - a.total_amount;
        case "amount_low":
          return a.total_amount - b.total_amount;
        case "name":
          const nameA = a.customer_name || "";
          const nameB = b.customer_name || "";
          return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
        default:
          return 0;
      }
    });

    return result;
  }, [pendingOrders, orderSearchQuery, orderSortOption, orderStatusFilter]);

  // Prefetch de productos
  useEffect(() => {
    const prefetchProducts = async () => {
      try {
        const result = await getProducts();
        if (result.success && (result as any).data) {
          setPreloadedProducts((result as any).data);
        }
      } catch (error) {
        console.error("Error prefetching products:", error);
      }
    };
    prefetchProducts();
  }, []);

  const fetchCounterOrders = useCallback(async (sessionOverride?: string | null) => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("sales")
      .select(`
        id,
        sale_number,
        total_amount,
        status,
        sale_type,
        kitchen_ready,
        customer_name,
        customer_phone,
        cash_register_session_id,
        created_at,
        user:users!sales_user_id_fkey(name),
        sale_items(
          id,
          quantity,
          unit_price,
          subtotal,
          customization,
          product:products!sale_items_product_id_fkey(
            name,
            unlimited_stock
          )
        ),
        sale_payments(
          id,
          amount,
          payment_method:payment_methods(name)
        )
      `)
      .eq("sale_type", "counter")
      .order("created_at", { ascending: false });

    const sessionFilter = sessionOverride ?? activeSessionId;
    if (sessionFilter) {
      query = query.eq("cash_register_session_id", sessionFilter);
    } else if (process.env.NODE_ENV === "development") {
      console.warn("⚠️ CounterSale DEBUG -> No hay session filter, obteniendo TODAS las ventas");
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const normalizedOrders = (data || []).map((order: any) => {
      const normalized = {
        ...order,
        session_id: order.cash_register_session_id,
        user: Array.isArray(order.user) ? order.user[0] : order.user,
        sale_items:
          order.sale_items?.map((item: any) => ({
            ...item,
            product: Array.isArray(item.product) ? item.product[0] : item.product,
          })) || [],
        sale_payments:
          order.sale_payments?.map((payment: any) => ({
            ...payment,
            payment_method: Array.isArray(payment.payment_method)
              ? payment.payment_method[0]
              : payment.payment_method,
          })) || [],
      };

      const paid =
        normalized.sale_payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
      return {
        ...normalized,
        paid_amount: normalized.paid_amount ?? paid,
        remaining_amount:
          normalized.remaining_amount ?? Math.max(normalized.total_amount - paid, 0),
      };
    });
    if (process.env.NODE_ENV === "development") {
      console.log(
        `🔍 CounterSale DEBUG -> Ventas obtenidas: ${normalizedOrders.length}`,
        normalizedOrders.map((o: any) => ({
          id: o.id,
          status: o.status,
          session_id: o.cash_register_session_id,
          created_at: o.created_at,
        }))
      );
    }
    return normalizedOrders;
  }, [activeSessionId]);

  // Cargar todas las ventas de mostrador
  const loadPendingOrders = useCallback(async (sessionOverride?: string | null) => {
    setIsLoadingOrders(true);
    try {
      const orders = await fetchCounterOrders(sessionOverride);
      setPendingOrders(orders);
    } catch (error: any) {
      addNotification("error", error.message || "Error al cargar ventas de mostrador");
    } finally {
      setIsLoadingOrders(false);
    }
  }, [fetchCounterOrders, addNotification]);

  useEffect(() => {
    if (initialOrders.length > 0) {
      setPendingOrders(initialOrders);
      setIsLoadingOrders(false);
    }
  }, [initialOrders]);

  useEffect(() => {
    if (session && session.status === "open" && !showSaleCard) {
      loadPendingOrders();
    }
  }, [session, showSaleCard, loadPendingOrders]);

  // 🚀 SUPABASE REALTIME - Actualizaciones instantáneas para mostrador
  // Hook unificado con throttling y visibilidad de pestaña
  const { isConnected: realtimeConnected, lastEventAt } = useRealtimeData(
    'sales',
    pendingOrders,
    { column: 'sale_type', value: 'counter' },
    2000 // throttle 2 segundos
  );

  // Efecto para recargar cuando llega una actualización de realtime
  useEffect(() => {
    if (realtimeConnected && session?.status === "open" && !showSaleCard) {
      // Solo log en desarrollo
      if (process.env.NODE_ENV === "development") {
        console.log("🔔 REALTIME - Conectado a actualizaciones de mostrador");
      }
    }
  }, [realtimeConnected, session?.status, showSaleCard]);

  useEffect(() => {
    if (!lastEventAt || session?.status !== "open" || showSaleCard) return;
    void loadPendingOrders();
  }, [lastEventAt, session?.status, showSaleCard, loadPendingOrders]);

  // Búsqueda con debounce
  const debouncedSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchProducts(query);
      if (result.success && (result as any).data) {
        const ranked = sortProductsByQueryMatch((result as any).data, query);
        setSearchResults(ranked);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  }, [debouncedSearch]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

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


  const addProductToCart = async (product: any) => {
    if (!product.unlimited_stock && product.stock <= 0) {
      addNotification("error", "Producto sin stock disponible");
      return;
    }

    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      if (!product.unlimited_stock && existingItem.quantity + 1 > product.stock) {
        addNotification("error", `Stock insuficiente. Disponible: ${product.stock}`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? {
              ...item,
              quantity: item.quantity + 1,
              cocina_only: product.cocina_only ?? item.cocina_only ?? false,
            }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.sale_price,
          quantity: 1,
          stock: product.stock,
          unlimited_stock: product.unlimited_stock,
          customization: "",
          cocina_only: product.cocina_only ?? false,
        },
      ]);
    }

    addNotification("success", `${product.name} agregado al carrito`);
    setCode("");
    setShowDropdown(false);
    setSearchResults([]);
    setSearchQuery("");
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
    if (!code.trim()) return;

    if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
      addProductToCart(searchResults[selectedIndex]);
      return;
    }

    if (searchResults.length === 1) {
      addProductToCart(searchResults[0]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchProductByName(code.trim());
      if (result.success && (result as any).data) {
        const product = (result as any).data;
        if (!product.unlimited_stock && product.stock <= 0) {
          addNotification("error", "Producto sin stock disponible");
          setIsLoading(false);
          return;
        }

        const existingItem = cart.find((item) => item.product_id === product.id);
        if (existingItem) {
          if (!product.unlimited_stock && existingItem.quantity + 1 > product.stock) {
            addNotification("error", `Stock insuficiente. Disponible: ${product.stock}`);
            setIsLoading(false);
            return;
          }
          setCart(
            cart.map((item) =>
              item.product_id === product.id
                ? {
                  ...item,
                  quantity: item.quantity + 1,
                  cocina_only: product.cocina_only ?? item.cocina_only ?? false,
                }
                : item
            )
          );
        } else {
          setCart([
            ...cart,
            {
              product_id: product.id,
              name: product.name,
              unit_price: product.sale_price,
              quantity: 1,
              stock: product.stock,
              unlimited_stock: product.unlimited_stock,
              cocina_only: product.cocina_only ?? false,
            },
          ]);
        }

        addNotification("success", `${product.name} agregado al carrito`);
        setCode("");
      } else {
        addNotification("error", (result as any).message || "Producto no encontrado");
      }
    } catch (error) {
      addNotification("error", "Error al buscar el producto");
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((item) => item.product_id !== productId));
      return;
    }

    const item = cart.find((item) => item.product_id === productId);
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

  const removeItem = (productId: string) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateCustomization = (productId: string, customization: string) => {
    setCart(
      cart.map((item) =>
        item.product_id === productId ? { ...item, customization } : item
      )
    );
  };

  const handleSaleComplete = () => {
    setCart([]);
    setCode("");
    setSaleData(null);
    setPaymentsForPrint([]);
    setCartItemsForPrint([]);
    setCustomerName("");
    setShowSaleCard(false);
  };

  const handleNewOrder = () => {
    setShowSaleCard(true);
    setCustomerName("");
    setCart([]);
    setCode("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  const handleCreateSale = async (payments: Array<{ payment_method_id: string; amount: number }>) => {
    if (cart.length === 0) {
      addNotification("error", "El carrito está vacío");
      return;
    }

    setIsLoading(true);
    try {
      // Obtener nombres de métodos de pago
      const paymentMethodsResult = await getPaymentMethods();
      const paymentMethodsMap = new Map<string, string>();
      if (paymentMethodsResult.success && paymentMethodsResult.data) {
        paymentMethodsResult.data.forEach((method: any) => {
          paymentMethodsMap.set(method.id, method.name);
        });
      }

      // Verificar si hay productos de cocina en el carrito
      const hasKitchenProducts = cart.some((item) => item.cocina_only === true);

      // Si hay productos de cocina, la venta debe quedar como "pending" hasta que cocina la marque como lista
      // Si solo hay productos de inventario, la venta puede completarse inmediatamente
      const saleStatus: "pending" | "completed" = hasKitchenProducts ? "pending" : "completed";

      const result = await createSale({
        status: saleStatus,
        sale_type: "counter",
        cash_register_id: cashRegister.id,
        area: "bar",
        customer_name: customerName.trim() || undefined,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
          customization: item.customization,
        })),
        payments: payments,
      });

      if (result.success && (result as any).data) {
        // Guardar datos antes de limpiar
        const cartItemsTemp = cart.map((item) => ({ ...item }));
        const saleDataTemp = {
          id: (result as any).data.id,
          sale_number: (result as any).data.sale_number || `MOST-${Date.now()}`,
          total_amount: total,
          created_at: new Date().toISOString(),
          user: { name: "Cajero" },
        };
        const paymentsDataTemp = payments.map(p => ({
          payment_method_name: paymentMethodsMap.get(p.payment_method_id) || "Método de pago",
          amount: p.amount
        }));

        // Verificar si hay productos de cocina para imprimir térmicamente
        console.log('🖨️ [MOSTRADOR] Iniciando proceso de impresión...');
        console.log('🖨️ [MOSTRADOR] Carrito temporal:', cartItemsTemp.map(item => ({ name: item.name, cocina_only: item.cocina_only })));

        let kitchenItems: Array<{ quantity: number; name: string; customization?: string }> = [];
        let resolvedTableNumber =
          parseInt(saleDataTemp.sale_number.replace(/\D/g, "")) || 999;
        let resolvedCustomerName = customerName.trim() || undefined;
        let resolvedDeliveryAddress: string | undefined = undefined;

        // Primero intentar obtener desde la base de datos (más confiable)
        try {
          console.log('🖨️ [MOSTRADOR] Obteniendo datos de cocina desde la venta creada...');
          const kitchenDataResult = await getSaleKitchenItems(saleDataTemp.id);
          if (kitchenDataResult.success && kitchenDataResult.data) {
            const kitchenData = kitchenDataResult.data;
            console.log('🖨️ [MOSTRADOR] Datos obtenidos desde BD:', kitchenData);
            if (kitchenData.items.length > 0) {
              kitchenItems = kitchenData.items;
              if (kitchenData.tableNumber) {
                resolvedTableNumber = kitchenData.tableNumber;
              } else if (kitchenData.saleNumber) {
                resolvedTableNumber =
                  parseInt(kitchenData.saleNumber.replace(/\D/g, "")) || resolvedTableNumber;
              }
              resolvedCustomerName = kitchenData.customerName || resolvedCustomerName;
              resolvedDeliveryAddress = kitchenData.deliveryAddress || resolvedDeliveryAddress;
            }
          }
        } catch (kitchenFetchError) {
          console.error("❌ [MOSTRADOR] Error obteniendo datos de cocina desde BD:", kitchenFetchError);
        }

        // Fallback: usar el carrito si no se obtuvieron datos desde BD
        if (kitchenItems.length === 0) {
          console.log('🖨️ [MOSTRADOR] Usando fallback: filtrando productos de cocina del carrito...');
          kitchenItems = cartItemsTemp
            .filter((item: any) => item.cocina_only === true)
            .map((item) => ({
              quantity: item.quantity,
              name: item.name,
              customization: item.customization,
            }));
          console.log('🖨️ [MOSTRADOR] Productos de cocina encontrados en carrito:', kitchenItems.length);
        }

        // Imprimir si hay productos de cocina
        if (kitchenItems.length > 0) {
          console.log(`🖨️ [MOSTRADOR] ${kitchenItems.length} producto(s) de cocina detectado(s), enviando a impresora...`);
          console.log('🖨️ [MOSTRADOR] Items a imprimir:', kitchenItems);

          // Hacer petición directa al servidor de impresión
          try {
            // Obtener configuración de impresora
            const configResult = await getPrinterConfig();
            const config = configResult.success && configResult.data ? configResult.data.kitchen : { width: 48 };
            console.log('🖨️ [MOSTRADOR] Configuración de impresora:', config);

            // Obtener la cadena de impresora desde Supabase
            const printerResult = await getKitchenPrinterString();
            const printerName = printerResult.success ? printerResult.data : '192.168.0.114:9100';
            console.log('🖨️ [MOSTRADOR] Impresora configurada:', printerName);

            // Generar contenido del ticket
            const generateKitchenTicket = (await import("@/lib/kitchenPrinter")).generateKitchenTicket;
            const ticketContent = generateKitchenTicket({
              tableNumber: resolvedTableNumber,
              timestamp: new Date().toISOString(),
              items: kitchenItems,
              orderType: 'new',
              saleType: 'counter',
              customerName: resolvedCustomerName,
              deliveryAddress: resolvedDeliveryAddress,
            }, config.width);

            console.log('🖨️ [MOSTRADOR] Ticket generado, longitud:', ticketContent.length);
            console.log('🖨️ [MOSTRADOR] Enviando a la impresora térmica...');

            const result = await printToLocal(
              ticketContent,
              printerName,
              "kitchen",
              config.width
            );
            if (result.success) {
              console.log('✅ [MOSTRADOR] Impresión enviada exitosamente');
            } else {
              console.error('❌ [MOSTRADOR] Error en impresión térmica mostrador:', (result as any).message);
            }
          } catch (printError) {
            console.error('❌ [MOSTRADOR] Error al enviar impresión térmica mostrador:', printError);
            // No bloquear la venta si falla la impresión
          }
        } else {
          console.log('⚠️ [MOSTRADOR] No hay productos de cocina en este pedido, no se imprime');
        }

        // Limpiar carrito y estados
        setCart([]);
        setCode("");
        setSearchQuery("");
        setShowDropdown(false);
        setCustomerName("");
        setShowSaleCard(false);

        // Establecer datos para impresión
        setSaleData(saleDataTemp);
        setPaymentsForPrint(paymentsDataTemp);
        setCartItemsForPrint(cartItemsTemp);

        // Cerrar modal y resetear loading
        setIsPaymentModalOpen(false);
        setIsLoading(false);

        addNotification("success", "Venta completada exitosamente");

        const saleSessionId =
          (result as any).data?.cash_register_session_id;
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 CounterSale DEBUG -> Venta creada:", {
            saleStatus,
            saleId: (result as any).data?.id,
            sessionFromSale: saleSessionId,
          });
        }

        if (saleSessionId) {
          setActiveSessionId(saleSessionId);
          await loadPendingOrders(saleSessionId);
        } else {
          await loadPendingOrders();
        }
      } else {
        addNotification("error", (result as any).message || "Error al crear venta");
        setIsLoading(false);
      }
    } catch (error: any) {
      addNotification("error", error.message || "Error al procesar la venta");
      setIsLoading(false);
    }
  };

  if (!session || session.status !== "open") {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Caja Cerrada</h3>
          <p className="text-muted-foreground">
            Necesitás abrir la caja antes de poder realizar ventas de mostrador.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">🛒 Pedidos de Mostrador</h2>
          <p className="text-muted-foreground">
            {filteredAndSortedOrders.length} de {pendingOrders.length} {pendingOrders.length === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
        <Button onClick={handleNewOrder} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Barra de filtros y búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o número..."
            value={orderSearchQuery}
            onChange={(e) => setOrderSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={orderStatusFilter} onValueChange={(value: CounterStatusFilter) => setOrderStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="completed">Completados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orderSortOption} onValueChange={(value: CounterSortOption) => setOrderSortOption(value)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="amount_high">Mayor monto</SelectItem>
              <SelectItem value="amount_low">Menor monto</SelectItem>
              <SelectItem value="name">Por nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sección de pedidos */}
      <>
        {isLoadingOrders && pendingOrders.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Lista de pedidos (2/3 del ancho en xl) */}
            <div className="lg:col-span-2">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="px-0 pt-0">
                  {pendingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
                      <div className="text-6xl mb-4 grayscale opacity-50">🛒</div>
                      <h3 className="text-lg font-medium mb-2">No hay pedidos</h3>
                      <p className="text-muted-foreground mb-4">
                        Todavía no hay pedidos de mostrador registrados
                      </p>
                      <Button onClick={handleNewOrder}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Nuevo Pedido
                      </Button>
                    </div>
                  ) : filteredAndSortedOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
                      <div className="text-6xl mb-4 grayscale opacity-50">🔍</div>
                      <h3 className="text-lg font-medium mb-2">Sin resultados</h3>
                      <p className="text-muted-foreground mb-4">
                        No se encontraron pedidos con los filtros seleccionados
                      </p>
                      <Button variant="outline" onClick={() => { setOrderSearchQuery(""); setOrderStatusFilter("all"); }}>
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredAndSortedOrders.map((order, index) => {
                        const totalItems = order.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                        const isSelected = selectedOrderForPanel?.id === order.id;

                        const getProduct = (product: any) => {
                          if (!product) return null;
                          if (Array.isArray(product)) return product[0];
                          return product;
                        };

                        const getStatusBadge = () => {
                          if (order.status === 'cancelled') {
                            return (
                              <Badge variant="destructive" className="bg-red-600 text-white">
                                <XCircle className="h-3 w-3 mr-1 inline" />
                                Cancelado
                              </Badge>
                            );
                          }
                          if (order.status === 'completed') {
                            return (
                              <Badge variant="default" className="bg-green-600 text-white">
                                <CheckCircle className="h-3 w-3 mr-1 inline" />
                                Completo
                              </Badge>
                            );
                          }
                          // Pending
                          const hasKitchenProducts = order.sale_items?.some((item: any) => {
                            const product = getProduct(item.product);
                            return product?.unlimited_stock === true;
                          }) || false;

                          if (hasKitchenProducts) {
                            if (order.kitchen_ready) {
                              return (
                                <Badge variant="default" className="bg-blue-600 text-white">
                                  ✅ Listo en cocina
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="secondary" className="bg-orange-500 text-white">
                                  <Clock className="h-3 w-3 mr-1 inline" />
                                  Preparando
                                </Badge>
                              );
                            }
                          }

                          return (
                            <Badge variant="secondary" className="bg-orange-500 text-white">
                              <Clock className="h-3 w-3 mr-1 inline" />
                              Pendiente
                            </Badge>
                          );
                        };

                        return (
                          <div
                            key={order.id}
                            style={{ animationDelay: `${index * 50}ms` }}
                            className={`
                              relative group cursor-pointer transition-all duration-200
                              animate-in fade-in slide-in-from-bottom-2 fill-mode-both
                            `}
                            onClick={() => setSelectedOrderForPanel(order)}
                          >
                            <div className={`
                              absolute inset-0 rounded-xl transition-all duration-200
                              ${isSelected ? 'bg-foreground/5 ring-1 ring-foreground' : 'hover:bg-foreground/5'}
                            `} />

                            <div className={`
                              relative bg-card rounded-xl border shadow-sm p-4 h-full flex flex-col justify-between
                              transition-all duration-200
                              ${isSelected ? 'border-foreground ring-1 ring-foreground/10' : 'border-border group-hover:border-border/60'}
                            `}>
                              {/* Header */}
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                  <span className={`font-bold text-lg leading-tight ${order.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {order.customer_name || `Pedido #${order.sale_number?.slice(-4) || '???'}`}
                                  </span>
                                  <span className="text-xs font-mono text-muted-foreground mt-0.5">
                                    #{order.sale_number || order.id.slice(0, 8)}
                                  </span>
                                </div>
                              </div>

                              {/* Body Information */}
                              <div className="space-y-4 mb-4">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge()}
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Package className="h-3.5 w-3.5" />
                                  <span>{totalItems} items</span>
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="pt-3 border-t border-dashed border-border flex items-end justify-between mt-auto">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{formatDate(new Date(order.created_at))}</span>
                                </div>
                                <span className={`text-xl font-bold font-mono tracking-tight ${order.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {formatCurrency(order.total_amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Panel lateral (1/3 del ancho en xl) */}
            <div className="lg:col-span-1 lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
              {showSaleCard ? (
                <div className="xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
                  <CounterSaleForm
                    session={session}
                    cashRegister={cashRegister}
                    onClose={() => {
                      setShowSaleCard(false);
                      setCart([]);
                      setCustomerName("");
                    }}
                    onComplete={async () => {
                      setShowSaleCard(false);
                      setCart([]);
                      setCustomerName("");
                      await loadPendingOrders();
                    }}
                  />
                </div>
              ) : selectedOrderForPanel ? (
                <div className="xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
                  <SelectedTableDetail
                    table={{
                      ...selectedOrderForPanel,
                      table_number: null,
                      sale_type: 'counter',
                    }}
                    onClose={() => setSelectedOrderForPanel(null)}
                    onUpdate={async () => {
                      await loadPendingOrders();
                      const refreshedOrders = await fetchCounterOrders();
                      const updatedOrder = refreshedOrders.find((o: any) => o.id === selectedOrderForPanel.id);
                      setSelectedOrderForPanel(updatedOrder || null);
                    }}
                  />
                </div>
              ) : (
                <Card className="p-6">
                  <div className="text-center py-12 space-y-4">
                    <div className="text-7xl">🛒</div>
                    <h3 className="text-xl font-bold text-foreground">
                      Selecciona un pedido
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Hacé clic en un pedido de la lista para ver sus detalles y gestionarlo
                    </p>
                    <Button onClick={handleNewOrder} size="lg" className="mt-4">
                      <Plus className="mr-2 h-5 w-5" />
                      Nuevo Pedido
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </>

    </div>
  );
}

