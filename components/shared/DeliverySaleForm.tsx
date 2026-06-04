"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { sortProductsByQueryMatch } from "@/lib/search";
import { searchProducts } from "@/actions/productActions";
import { createSale, getPaymentMethods } from "@/actions/saleActions";
import { getPrinterConfig, getKitchenPrinterString } from "@/actions/configActions";
import { printToLocal } from "@/lib/localPrinter";
import { useNotificationStore } from "@/store/notificationStore";
import { useCanEditPrices } from "@/hooks/useCanEditPrices";

interface DeliverySaleFormProps {
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

export function DeliverySaleForm({ session, cashRegister, onClose, onComplete }: DeliverySaleFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedProductIndex(-1);
  }, [searchResults]);

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

  const addToCart = useCallback((product: any, forceNew: boolean = false) => {
    setCart((prevCart) => {
      // Verificar stock disponible (sumar todas las cantidades del mismo producto)
      if (!product.unlimited_stock) {
        const totalQuantity = prevCart
          .filter(item => item.product_id === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (totalQuantity >= product.stock) {
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
          quantity: 1,
          stock: product.stock,
          customization: "",
          unlimited_stock: product.unlimited_stock,
          cocina_only: product.cocina_only ?? false
        };
        setSearchQuery("");
        setSearchResults([]);
        setSelectedProductIndex(-1);
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
            ? { ...item, quantity: item.quantity + 1, unlimited_stock: product.unlimited_stock }
            : item
        );
        setSearchQuery("");
        setSearchResults([]);
        setSelectedProductIndex(-1);
        searchInputRef.current?.focus();
        return updatedCart;
      }

      // Si no existe o todos tienen personalización, crear nuevo item
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}-${Math.random()}`,
        product_id: product.id,
        name: product.name,
        unit_price: product.sale_price,
        quantity: 1,
        stock: product.stock,
        customization: "",
        unlimited_stock: product.unlimited_stock,
        cocina_only: product.cocina_only ?? false
      };

      setSearchQuery("");
      setSearchResults([]);
      setSelectedProductIndex(-1);
      searchInputRef.current?.focus();
      return [...prevCart, newItem];
    });
  }, [addNotification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (searchResults.length === 0) return;

      // Solo manejar si estamos en el input de búsqueda
      if (e.target instanceof HTMLInputElement && e.target.id === 'product-search') {
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
              addToCart(selectedProduct);
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setSearchQuery("");
          setSearchResults([]);
          setSelectedProductIndex(-1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchResults, selectedProductIndex, addToCart]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchProducts(query);
      if (result.success && result.data) {
        const ranked = sortProductsByQueryMatch(result.data, query);
        setSearchResults(ranked);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
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
      // Delivery SIEMPRE se crea abierto (pending). El cobro y el medio de pago
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
        sale_type: "delivery",
        cash_register_id: cashRegister.id,
        area: session.area,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          customization: item.customization || undefined,
        })),
        payments: saleStatus === "completed" && paymentMethodId ? [{ payment_method_id: paymentMethodId, amount: total }] : [],
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
        delivery_notes: deliveryNotes.trim() || undefined,
      });

      if (result.success) {
        // Verificar si hay productos de cocina para imprimir
        // IMPORTANTE: Solo productos con cocina_only = true van a cocina
        // Esto debe coincidir con el filtro de KitchenView
        const kitchenItems = cart.filter(item => item.cocina_only === true);

        if (kitchenItems.length > 0) {
          console.log(`🖨️ [DELIVERY] ${kitchenItems.length} productos de cocina detectados, enviando a impresión térmica`);

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
              saleType: 'delivery',
              customerName: customerName.trim() || undefined,
              deliveryAddress: deliveryAddress.trim() || undefined
            }, config.width);

            console.log('🖨️ [DELIVERY] Enviando a la impresora térmica...');

            const printResult = await printToLocal(
              ticketContent,
              printerName,
              "kitchen",
              config.width
            );
            if (printResult.success) {
              console.log('✅ Impresión térmica exitosa para delivery');
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
            ? "Pedido de delivery creado y enviado a cocina. Cobralo al cerrar el pedido."
            : "Pedido de delivery creado. Cobralo al cerrar el pedido."
        );

        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setDeliveryNotes("");
        onComplete();
        onClose();
      } else {
        addNotification("error", result.message || "Error al crear pedido");
      }
    } catch (error: any) {
      addNotification("error", error.message || "Error al procesar el pedido");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🚴 Nuevo Pedido de Delivery</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Datos del cliente */}
        <div className="space-y-3 pb-3 border-b">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nombre del Cliente (opcional)</Label>
            <Input
              id="customer-name"
              placeholder="Nombre completo..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Teléfono (opcional)</Label>
            <Input
              id="customer-phone"
              placeholder="Número de contacto..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-address">Dirección de Entrega (opcional)</Label>
            <Textarea
              id="delivery-address"
              placeholder="Dirección completa..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-notes">Notas (opcional)</Label>
            <Textarea
              id="delivery-notes"
              placeholder="Indicaciones adicionales..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Búsqueda de productos */}
        <div className="space-y-2">
          <Label htmlFor="product-search">Buscar Producto</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              id="product-search"
              placeholder="Código o nombre..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />

            {/* Resultados de búsqueda */}
            {searchResults.length > 0 && (
              <div
                ref={resultsListRef}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
              >
                {searchResults.map((product, index) => {
                  const isInCart = cart.some(item => item.product_id === product.id);

                  return (
                    <div
                      key={product.id}
                      data-product-index={index}
                      className={`flex items-center gap-2 p-3 border-b last:border-b-0 ${selectedProductIndex === index ? 'bg-buffalo-caramel/10 ring-2 ring-buffalo-caramel/50' : 'hover:bg-muted/30'
                        }`}
                    >
                      <button
                        onClick={() => addToCart(product, false)}
                        className="flex-1 flex items-center justify-between text-left"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {product.code && <span>Código: {product.code}</span>}
                            {isInCart && (
                              <Badge variant="outline" className="text-xs h-5">
                                En carrito
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">
                            {formatCurrency(product.sale_price)}
                          </div>
                          {!product.unlimited_stock && (
                            <div className="text-xs text-muted-foreground">
                              Stock: {product.stock}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Botón para agregar nuevo con personalización (solo si es producto de cocina) */}
                      {product.unlimited_stock && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product, true);
                          }}
                          className="h-8 px-2 text-xs flex-shrink-0"
                          title="Agregar nuevo con personalización distinta"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Nuevo
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrito */}
        <div className="space-y-2">
          <Label>Carrito ({cart.length} productos)</Label>
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Carrito vacío
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.unit_price)} c/u
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
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
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
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
                    <div className="text-sm font-semibold text-green-600">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </div>
                  </div>

                  {/* Personalización */}
                  {item.unlimited_stock && (
                    <Input
                      key={`customization-${item.id}`}
                      placeholder="Personalización (opcional)..."
                      value={item.customization || ""}
                      onChange={(e) => updateCustomization(item.id, e.target.value)}
                      className="text-xs"
                    />
                  )}

                  <div className="text-right text-sm font-medium">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </div>
                </div>
              ))
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

