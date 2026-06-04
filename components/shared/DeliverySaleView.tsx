"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, ShoppingCart, Trash2, Sparkles, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { searchProductByName, searchProducts, getProducts } from "@/actions/productActions";
import { createSale } from "@/actions/saleActions";
import { getPrinterConfig, getKitchenPrinterString } from "@/actions/configActions";
import { printToLocal } from "@/lib/localPrinter";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useProductSearchIndex } from "@/hooks/useProducts";
import { useCanEditPrices } from "@/hooks/useCanEditPrices";

interface SaleItem {
  id: string; // ID único para cada item del carrito
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  unlimited_stock?: boolean;
  cocina_only?: boolean;
  customization?: string;
}

interface DeliverySaleViewProps {
  cashRegister: any;
  session: any;
  onBack: () => void;
  onSaleComplete?: () => void;
}

export function DeliverySaleView({ cashRegister, session, onBack, onSaleComplete }: DeliverySaleViewProps) {
  const [code, setCode] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Campos de delivery
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const confirm = useConfirm();

  const colorClass = "text-foreground";
  const bgColorClass = "bg-buffalo-caramel/10";


  // ============================================================================
  // OPTIMIZACIONES DE BÚSQUEDA (igual que QuickSalePanel)
  // ============================================================================
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchCacheRef = useRef<Record<string, any[]>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: productIndexResult, isFetching: isProductIndexLoading } = useProductSearchIndex();
  const productCatalog = productIndexResult?.data ?? [];

  useEffect(() => {
    searchCacheRef.current = {}; // Limpiar caché al montar

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
      if (result.success && result.data) {
        setSearchResults(result.data);
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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  }, [debouncedSearch]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
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
          id: `item-${product.id}-${Date.now()}`,
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
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
      if (result.success && result.data) {
        const product = result.data;
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
              id: `item-${product.id}-${Date.now()}`,
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
        addNotification("error", result.message || "Producto no encontrado");
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

  const canEditPrices = useCanEditPrices();

  const updatePrice = (productId: string, price: number) => {
    setCart(
      cart.map((item) =>
        item.product_id === productId ? { ...item, unit_price: price >= 0 ? price : item.unit_price } : item
      )
    );
  };

  const handleCreateDelivery = async () => {
    if (cart.length === 0) {
      addNotification("error", "Debe agregar al menos un producto");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createSale({
        status: "pending",
        sale_type: "delivery",
        cash_register_id: cashRegister.id,
        area: "bar",
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
          customization: item.customization,
        })),
        payments: [], // Delivery no tiene pagos al crear
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
        delivery_notes: deliveryNotes.trim() || undefined,
      });

      // 🔍 DEBUG DELIVERY: Verificar datos antes de enviar a createSale
      console.log('🔍 [DEBUG DELIVERY] DeliverySaleView - Datos antes de createSale:');
      console.log('  - deliveryAddress original:', deliveryAddress);
      console.log('  - deliveryAddress.trim():', deliveryAddress.trim());
      console.log('  - deliveryAddress.trim() || undefined:', deliveryAddress.trim() || undefined);
      console.log('  - customerName:', customerName);
      console.log('  - customerPhone:', customerPhone);
      console.log('  - Objeto completo que se envía:', {
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
        delivery_notes: deliveryNotes.trim() || undefined,
      });

      if (result.success) {
        // 🔍 DEBUG DELIVERY: Verificar respuesta de createSale
        console.log('🔍 [DEBUG DELIVERY] DeliverySaleView - Respuesta de createSale:');
        console.log('  - result.success:', result.success);
        console.log('  - result.data:', result.data);
        // Verificar si hay productos de cocina para imprimir térmicamente
        console.log('🖨️ [DELIVERY] Iniciando proceso de impresión...');
        console.log('🖨️ [DELIVERY] Carrito:', cart.map(item => ({ name: item.name, cocina_only: item.cocina_only })));

        const saleId = (result as any).data?.id;
        console.log('  - saleId creado:', saleId);
        let kitchenItems: Array<{ quantity: number; name: string; customization?: string }> = [];
        let resolvedTableNumber = 888;
        let resolvedCustomerName = customerName.trim() || undefined;
        let resolvedDeliveryAddress = deliveryAddress.trim() || undefined;

        // Primero intentar obtener desde la base de datos (más confiable)
        if (saleId) {
          try {
            console.log('🖨️ [DELIVERY] Obteniendo datos de cocina desde la venta creada...');
            const { getSaleKitchenItems } = await import('@/actions/saleActions');
            const kitchenDataResult = await getSaleKitchenItems(saleId);
            if (kitchenDataResult.success && kitchenDataResult.data) {
              const kitchenData = kitchenDataResult.data;
              console.log('🖨️ [DELIVERY] Datos obtenidos desde BD:', kitchenData);
              if (kitchenData.items.length > 0) {
                kitchenItems = kitchenData.items;
                if (kitchenData.saleNumber) {
                  resolvedTableNumber = parseInt(kitchenData.saleNumber.replace(/\D/g, '')) || 888;
                }
                resolvedCustomerName = kitchenData.customerName || resolvedCustomerName;
                resolvedDeliveryAddress = kitchenData.deliveryAddress || resolvedDeliveryAddress;
              }
            }
          } catch (kitchenFetchError) {
            console.error("❌ [DELIVERY] Error obteniendo datos de cocina desde BD:", kitchenFetchError);
          }
        }

        // Fallback: usar el carrito si no se obtuvieron datos desde BD
        if (kitchenItems.length === 0) {
          console.log('🖨️ [DELIVERY] Usando fallback: filtrando productos de cocina del carrito...');
          kitchenItems = cart
            .filter(item => item.cocina_only === true)
            .map(item => ({
              quantity: item.quantity,
              name: item.name,
              customization: item.customization
            }));
          console.log('🖨️ [DELIVERY] Productos de cocina encontrados en carrito:', kitchenItems.length);
        }

        // Imprimir si hay productos de cocina
        if (kitchenItems.length > 0) {
          console.log(`🖨️ [DELIVERY] ${kitchenItems.length} producto(s) de cocina detectado(s), enviando a impresora...`);
          console.log('🖨️ [DELIVERY] Items a imprimir:', kitchenItems);

          // Hacer petición directa al servidor de impresión
          try {
            // Obtener configuración de impresora
            const configResult = await getPrinterConfig();
            const config = configResult.success && configResult.data ? configResult.data.kitchen : { width: 48 };
            console.log('🖨️ [DELIVERY] Configuración de impresora:', config);

            // Obtener la cadena de impresora desde Supabase
            const printerResult = await getKitchenPrinterString();
            const printerName = printerResult.success ? printerResult.data : '192.168.0.114:9100';
            console.log('🖨️ [DELIVERY] Impresora configurada:', printerName);

            // Generar contenido del ticket
            const generateKitchenTicket = (await import("@/lib/kitchenPrinter")).generateKitchenTicket;
            const ticketContent = generateKitchenTicket({
              tableNumber: resolvedTableNumber,
              timestamp: new Date().toISOString(),
              items: kitchenItems,
              orderType: 'new',
              saleType: 'delivery',
              customerName: resolvedCustomerName,
              deliveryAddress: resolvedDeliveryAddress,
            }, config.width);

            console.log('🖨️ [DELIVERY] Ticket generado, longitud:', ticketContent.length);
            console.log('🖨️ [DELIVERY] Enviando a la impresora térmica...');

            const printResult = await printToLocal(
              ticketContent,
              printerName,
              "kitchen",
              config.width
            );
            if (printResult.success) {
              console.log('✅ [DELIVERY] Impresión enviada exitosamente');
            } else {
              console.error('❌ [DELIVERY] Error en impresión térmica delivery:', printResult.message);
            }
          } catch (printError) {
            console.error('❌ [DELIVERY] Error al enviar impresión térmica delivery:', printError);
            // No bloquear la venta si falla la impresión
          }
        } else {
          console.log('⚠️ [DELIVERY] No hay productos de cocina en este pedido, no se imprime');
        }

        addNotification("success", "Pedido de delivery creado exitosamente. Se envió a cocina.");
        // Limpiar formulario
        setCart([]);
        setCode("");
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setDeliveryNotes("");
        setSearchQuery("");
        if (onSaleComplete) {
          onSaleComplete();
        }
      } else {
        addNotification("error", result.message || "Error al crear pedido de delivery");
      }
    } catch (error: any) {
      addNotification("error", error.message || "Error al procesar el pedido");
    } finally {
      setIsLoading(false);
    }
  };

  if (!session || session.status !== "open") {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Caja Cerrada</h3>
          <p className="text-muted-foreground">
            Necesitás abrir la caja antes de poder crear pedidos de delivery.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={bgColorClass}>
        <CardHeader>
          <CardTitle className={colorClass}>🚴 Nuevo Pedido de Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Datos del cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Nombre del Cliente (opcional)</Label>
              <Input
                id="customerName"
                placeholder="Nombre completo..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Teléfono (opcional)</Label>
              <Input
                id="customerPhone"
                placeholder="Teléfono de contacto..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Dirección de Entrega (opcional)</Label>
            <Input
              id="deliveryAddress"
              placeholder="Dirección completa..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryNotes">Notas para el Repartidor (opcional)</Label>
            <Textarea
              id="deliveryNotes"
              placeholder="Instrucciones especiales, referencia, etc..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Buscador de productos */}
          <div className="relative pt-4 border-t">
            <Label className="mb-2 block">Buscar Productos</Label>
            <form onSubmit={handleCodeSubmit} className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar producto por nombre o código..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </form>

            {/* Dropdown de resultados */}
            {showDropdown && searchResults.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                {searchResults.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToCart(product)}
                    className={`w-full px-4 py-2 text-left hover:bg-muted ${index === selectedIndex ? "bg-muted" : ""
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(product.sale_price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input de código de barras */}
          <form onSubmit={handleCodeSubmit} className="relative">
            <Input
              type="text"
              placeholder="Escaneá código de barras..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Carrito */}
        <div className="lg:col-span-2 space-y-4">
          {cart.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Carrito vacío</h3>
                <p className="text-muted-foreground">
                  Buscá o escaneá productos para comenzar
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Carrito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{item.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="font-medium w-12 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          disabled={!item.unlimited_stock && item.quantity >= item.stock}
                        >
                          +
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                            disabled={!canEditPrices}
                            title={!canEditPrices ? "Solo admin/supervisor pueden cambiar el precio" : undefined}
                            className="w-20 h-8 text-sm text-right disabled:opacity-70 disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold min-w-[60px] text-right">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </span>
                        </div>
                      </div>
                      {item.customization !== undefined && (
                        <div className="mt-2">
                          <Input
                            placeholder="Personalización (opcional)..."
                            value={item.customization || ""}
                            onChange={(e) => updateCustomization(item.product_id, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
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
              <CardTitle>Total del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>El carrito está vacío</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span className={colorClass}>{formatCurrency(total)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateDelivery}
                    className="w-full"
                    size="lg"
                    disabled={cart.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        🚴 Crear Pedido
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={onBack}
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  return null;
}

