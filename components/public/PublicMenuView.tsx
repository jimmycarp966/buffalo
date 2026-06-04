"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, Check, Clock, CreditCard, Loader2, MapPin, Minus, Phone, Plus, Search, ShoppingCart, Store, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createPublicOrder, type CartItem } from "@/actions/publicMenuActions";
import { formatCurrency } from "@/lib/utils";

interface PublicProduct { id: string; name: string; description?: string; sale_price: number; category_id?: string; image_url?: string; is_available: boolean; }
interface PublicCategory { id: string; name: string; product_count: number; }
interface PublicMenuViewProps { products: PublicProduct[]; categories: PublicCategory[]; storeName: string; estimatedTime: number; isOpen: boolean; dailyMenuContent?: string; dailyMenuActive?: boolean; bankAlias?: string; bankCbu?: string; bankHolder?: string; }
interface LocalCartItem extends CartItem { id: string; }
type PaymentMethod = "mercadopago" | "transfer" | "cash";
type CheckoutStep = "cart" | "details" | "payment" | "confirmation";

const CART_STORAGE_KEY = "buffalo_public_cart";
const LEGACY_CART_STORAGE_KEY = String.fromCharCode(102,105,107,97,95,112,117,98,108,105,99,95,99,97,114,116);

export function PublicMenuView({ products, categories, storeName, estimatedTime, isOpen, dailyMenuContent, dailyMenuActive, bankAlias, bankCbu, bankHolder }: PublicMenuViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("cart");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ order_number: string; total: number; estimated_time: number; tracking_code?: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(CART_STORAGE_KEY) ?? localStorage.getItem(LEGACY_CART_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as LocalCartItem[];
      setCart(parsed);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch (parseError) {
      console.error("Error parsing cart", parseError);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory && product.is_available;
  }), [products, searchTerm, selectedCategory]);

  const groupedProducts = useMemo(() => categories.map((category) => ({ ...category, items: filteredProducts.filter((product) => product.category_id === category.id) })).filter((section) => section.items.length > 0), [categories, filteredProducts]);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const addToCart = (product: PublicProduct) => {
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) return current.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { id: crypto.randomUUID(), product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (itemId: string, delta: number) => setCart((current) => current.map((item) => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0));

  const clearCart = () => {
    setCart([]);
    setCheckoutStep("cart");
    setError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    }
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createPublicOrder({
        items: cart.map(({ product_id, product_name, quantity, unit_price }) => ({ product_id, product_name, quantity, unit_price })),
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_notes: deliveryNotes,
        payment_method: paymentMethod,
      });
      if (!result.success || !result.data) {
        setError(result.message || "Error al procesar el pedido. Intentá nuevamente.");
      } else {
        const nextResult = { order_number: result.data.order_number, total: result.data.total, estimated_time: result.data.estimated_time, tracking_code: result.data.tracking_code };
        clearCart();
        setOrderResult(nextResult);
        setCheckoutStep("confirmation");
      }
    } catch (submitError) {
      console.error(submitError);
      setError("Ocurrió un error inesperado de conexión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 text-foreground">
      <section className="brand-panel overflow-hidden rounded-[1.75rem] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><Badge variant={isOpen ? "secondary" : "warning"}>{isOpen ? "Abierto ahora" : "Cerrado"}</Badge><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /><span>Demora estimada {estimatedTime} min</span></div></div>
            <h1 className="font-brand text-3xl text-secondary sm:text-4xl">{storeName}</h1>
            <p className="max-w-2xl text-muted-foreground">Elegí tu próxima ronda, armá el pedido y dejá lista la noche desde acá.</p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-background/50 px-4 py-3 text-sm text-muted-foreground">Carta activa para pickup y delivery.</div>
        </div>
      </section>

      <div className="sticky top-0 z-10 -mx-4 border-b border-primary/15 bg-background/75 px-4 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Buscar tragos, cocina, promos..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
          <Button onClick={() => setIsCartOpen(true)} className="sm:hidden"><ShoppingCart className="mr-2 h-4 w-4" />{cartItemsCount > 0 && <Badge className="ml-1 bg-background text-secondary">{cartItemsCount}</Badge>}{cartTotal > 0 && <span className="ml-2">{formatCurrency(cartTotal)}</span>}</Button>
        </div>
      </div>

      {dailyMenuActive && dailyMenuContent && !searchTerm && !selectedCategory && <Card className="relative overflow-hidden border-secondary/20 bg-secondary/5 shadow-md"><div className="absolute right-0 top-0 z-10 rounded-bl-lg bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-secondary-foreground">Solo mediodía</div><CardContent className="p-6"><h2 className="mb-3 flex items-center gap-2 font-brand text-2xl text-secondary"><Clock className="h-6 w-6" />Menú del día</h2><div className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-foreground">{dailyMenuContent}</div></CardContent></Card>}

      <div className="flex gap-6">
        <div className="flex-1 space-y-8">
          {groupedProducts.map((section) => <section key={section.id}><h2 className="mb-4 flex items-center gap-2 font-brand text-xl text-secondary"><span className="h-1 w-8 rounded-full bg-primary" />{section.name}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{section.items.map((product) => { const inCart = cart.find((item) => item.product_id === product.id); return <Card key={product.id} className="flex h-full flex-col overflow-hidden border-primary/15 bg-card transition-shadow hover:shadow-[0_24px_64px_rgba(168, 52, 28,0.12)]">{product.image_url ? <div className="group relative aspect-video w-full overflow-hidden bg-background/70"><Image src={product.image_url} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized /></div> : null}<CardContent className="flex flex-1 flex-col p-4"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="min-w-0 flex-1 font-semibold leading-tight text-foreground">{product.name}</h3><p className="whitespace-nowrap text-lg font-bold text-secondary">{formatCurrency(product.sale_price)}</p></div>{product.description && <p className="mb-4 flex-1 line-clamp-3 text-sm text-muted-foreground">{product.description}</p>}{inCart ? <div className="mt-auto flex items-center gap-2 pt-2"><Button size="sm" variant="outline" className="h-9 w-9 bg-background/70 p-0" onClick={() => updateQuantity(inCart.id, -1)}><Minus className="h-4 w-4" /></Button><span className="w-8 text-center text-lg font-semibold">{inCart.quantity}</span><Button size="sm" variant="outline" className="h-9 w-9 bg-background/70 p-0" onClick={() => updateQuantity(inCart.id, 1)}><Plus className="h-4 w-4" /></Button><div className="ml-auto rounded bg-primary/10 px-2 py-1 text-sm font-medium text-secondary">{formatCurrency(inCart.quantity * inCart.unit_price)}</div></div> : <Button size="sm" className="mt-auto h-9 w-full" onClick={() => addToCart(product)}><Plus className="mr-2 h-4 w-4" />Agregar al pedido</Button>}</CardContent></Card>; })}</div></section>)}
          {filteredProducts.length === 0 && <div className="py-12 text-center"><div className="mb-4 text-4xl">🔎</div><p className="text-muted-foreground">No se encontraron productos{searchTerm ? ` para "${searchTerm}"` : ""}</p></div>}
        </div>

        <div className="sticky top-32 hidden w-80 self-start sm:block"><CartSidebar cart={cart} cartTotal={cartTotal} checkoutStep={checkoutStep} setCheckoutStep={setCheckoutStep} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress} deliveryNotes={deliveryNotes} setDeliveryNotes={setDeliveryNotes} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} updateQuantity={updateQuantity} clearCart={clearCart} handleSubmitOrder={handleSubmitOrder} isSubmitting={isSubmitting} error={error} orderResult={orderResult} estimatedTime={estimatedTime} bankAlias={bankAlias} bankCbu={bankCbu} bankHolder={bankHolder} /></div>
      </div>

      {isCartOpen && <><div className="fixed inset-0 z-40 bg-black/70 sm:hidden" onClick={() => setIsCartOpen(false)} /><div className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-[1.75rem] border border-primary/20 bg-background shadow-[0_-24px_64px_rgba(0,0,0,0.38)] sm:hidden"><div className="flex items-center justify-between border-b border-primary/15 px-4 py-4"><div><p className="font-brand text-xl text-secondary">Tu pedido</p><p className="text-sm text-muted-foreground">{cartItemsCount} items</p></div><Button variant="ghost" size="icon" onClick={() => setIsCartOpen(false)}><X className="h-5 w-5" /></Button></div><div className="max-h-[72vh] overflow-y-auto p-4"><CartSidebar cart={cart} cartTotal={cartTotal} checkoutStep={checkoutStep} setCheckoutStep={setCheckoutStep} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress} deliveryNotes={deliveryNotes} setDeliveryNotes={setDeliveryNotes} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} updateQuantity={updateQuantity} clearCart={clearCart} handleSubmitOrder={handleSubmitOrder} isSubmitting={isSubmitting} error={error} orderResult={orderResult} estimatedTime={estimatedTime} bankAlias={bankAlias} bankCbu={bankCbu} bankHolder={bankHolder} /></div></div></>}
    </div>
  );
}

function CartSidebar({ cart, cartTotal, checkoutStep, setCheckoutStep, customerName, setCustomerName, customerPhone, setCustomerPhone, deliveryAddress, setDeliveryAddress, deliveryNotes, setDeliveryNotes, paymentMethod, setPaymentMethod, updateQuantity, clearCart, handleSubmitOrder, isSubmitting, error, orderResult, estimatedTime, bankAlias, bankCbu, bankHolder }: { cart: LocalCartItem[]; cartTotal: number; checkoutStep: CheckoutStep; setCheckoutStep: (step: CheckoutStep) => void; customerName: string; setCustomerName: (value: string) => void; customerPhone: string; setCustomerPhone: (value: string) => void; deliveryAddress: string; setDeliveryAddress: (value: string) => void; deliveryNotes: string; setDeliveryNotes: (value: string) => void; paymentMethod: PaymentMethod; setPaymentMethod: (value: PaymentMethod) => void; updateQuantity: (id: string, delta: number) => void; clearCart: () => void; handleSubmitOrder: () => void; isSubmitting: boolean; error: string | null; orderResult: { order_number: string; total: number; estimated_time: number; tracking_code?: string } | null; estimatedTime: number; bankAlias?: string; bankCbu?: string; bankHolder?: string; }) {
  if (checkoutStep === "confirmation" && orderResult) return <Card className="border-green-500/30 bg-green-500/10"><CardContent className="space-y-4 p-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500"><Check className="h-8 w-8 text-white" /></div><h3 className="text-xl font-bold text-green-300">Pedido confirmado</h3><div className="space-y-2 rounded-lg bg-background/80 p-4"><p className="text-sm text-muted-foreground">Número de pedido</p><p className="text-2xl font-mono font-bold">{orderResult.order_number}</p></div><div className="flex items-center justify-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span>Tiempo estimado: ~{orderResult.estimated_time} min</span></div><p className="text-lg font-bold">Total: {formatCurrency(orderResult.total)}</p>{paymentMethod === "transfer" && <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-left text-sm"><p className="mb-2 font-semibold text-primary">Datos para transferencia:</p>{bankAlias && <p>Alias: <strong>{bankAlias}</strong></p>}{bankCbu && <p>CBU: <strong>{bankCbu}</strong></p>}{bankHolder && <p>Titular: {bankHolder}</p>}{!bankAlias && !bankCbu && <p className="italic text-muted-foreground">Te enviaremos los datos por WhatsApp.</p>}</div>}{paymentMethod === "cash" && <p className="text-sm text-muted-foreground">Pagás cuando recibís tu pedido.</p>}<Button onClick={clearCart} className="w-full">Hacer otro pedido</Button></CardContent></Card>;
  if (checkoutStep === "payment") return <Card><CardContent className="space-y-4 p-4"><div className="flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => setCheckoutStep("details")}>← Volver</Button><h3 className="font-bold">Método de pago</h3></div><div className="space-y-3"><button onClick={() => setPaymentMethod("mercadopago")} disabled className={`flex w-full cursor-not-allowed items-center gap-3 rounded-lg border-2 p-4 opacity-50 transition-colors ${paymentMethod === "mercadopago" ? "border-blue-500 bg-blue-500/10" : "border-border"}`}><CreditCard className="h-6 w-6 text-blue-400" /><div className="flex-1 text-left"><p className="font-semibold">MercadoPago</p><p className="text-xs text-muted-foreground">Próximamente</p></div></button><button onClick={() => setPaymentMethod("transfer")} className={`flex w-full items-center gap-3 rounded-lg border-2 p-4 transition-colors ${paymentMethod === "transfer" ? "border-secondary bg-secondary/10" : "border-border hover:border-secondary/60"}`}><Store className="h-6 w-6 text-secondary" /><div className="flex-1 text-left"><p className="font-semibold">Transferencia</p><p className="text-xs text-muted-foreground">CBU / Alias</p></div>{paymentMethod === "transfer" && <Check className="h-5 w-5 text-secondary" />}</button><button onClick={() => setPaymentMethod("cash")} className={`flex w-full items-center gap-3 rounded-lg border-2 p-4 transition-colors ${paymentMethod === "cash" ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-300"}`}><Banknote className="h-6 w-6 text-green-400" /><div className="flex-1 text-left"><p className="font-semibold">Efectivo</p><p className="text-xs text-muted-foreground">Pagás al recibir</p></div>{paymentMethod === "cash" && <Check className="h-5 w-5 text-green-400" />}</button></div>{error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}<div className="border-t border-primary/15 pt-4"><div className="mb-4 flex justify-between"><span className="font-semibold">Total</span><span className="text-xl font-bold">{formatCurrency(cartTotal)}</span></div><Button onClick={handleSubmitOrder} disabled={isSubmitting || paymentMethod === "mercadopago"} className="w-full">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</> : <>Confirmar pedido<ArrowRight className="ml-2 h-4 w-4" /></>}</Button></div></CardContent></Card>;
  if (checkoutStep === "details") { const isValid = customerName.trim() && customerPhone.trim(); return <Card><CardContent className="space-y-4 p-4"><div className="flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => setCheckoutStep("cart")}>← Volver</Button><h3 className="font-bold">Tus datos</h3></div><div className="space-y-3"><div><label className="mb-1 flex items-center gap-2 text-sm font-medium"><User className="h-4 w-4" />Nombre *</label><Input placeholder="Tu nombre" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div><div><label className="mb-1 flex items-center gap-2 text-sm font-medium"><Phone className="h-4 w-4" />Teléfono *</label><Input placeholder="11 1234-5678" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></div><div><label className="mb-1 flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" />Dirección de entrega</label><Input placeholder="Calle, número, piso..." value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></div><div><label className="mb-1 block text-sm font-medium">Notas adicionales</label><Input placeholder="Ej: sin hielo, extra limón..." value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></div></div><div className="border-t border-primary/15 pt-4"><Button onClick={() => setCheckoutStep("payment")} disabled={!isValid} className="w-full">Continuar al pago<ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>; }
  return <Card><CardContent className="space-y-4 p-4"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><ShoppingCart className="h-5 w-5" />Tu pedido</h3>{cart.length > 0 && <Button variant="ghost" size="sm" onClick={clearCart}>Vaciar</Button>}</div>{cart.length === 0 ? <div className="py-8 text-center text-muted-foreground"><ShoppingCart className="mx-auto mb-3 h-12 w-12 text-primary/30" /><p>Tu carrito está vacío</p><p className="text-sm">Agregá productos para comenzar</p></div> : <><div className="max-h-[300px] space-y-3 overflow-y-auto">{cart.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg bg-background/60 p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.product_name}</p><p className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)} c/u</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, -1)} className="h-7 w-7 p-0"><Minus className="h-3 w-3" /></Button><span className="w-6 text-center font-medium">{item.quantity}</span><Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, 1)} className="h-7 w-7 p-0"><Plus className="h-3 w-3" /></Button></div></div>)}</div><div className="space-y-3 border-t border-primary/15 pt-4"><div className="flex justify-between text-lg"><span className="font-semibold">Total</span><span className="font-bold">{formatCurrency(cartTotal)}</span></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /><span>Tiempo estimado: ~{estimatedTime} min</span></div><Button onClick={() => setCheckoutStep("details")} className="w-full">Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button></div></>}</CardContent></Card>;
}
