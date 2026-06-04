"use client";

import { useState } from "react";
import type { getActiveCashSession } from "@/actions/cashActions";
import type { getOpenTables } from "@/actions/barActions";
import type { getTablesByArea } from "@/actions/barLayoutActions";
import type { getProductsForSearch } from "@/actions/productActions";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { LayoutGrid, ShoppingBag, Truck } from "lucide-react";
import { CashRegisterInfo } from "./CashRegisterInfo";
import { BarWithSaleView } from "./BarWithSaleView";
import { CounterSaleView, DeliveryOrdersList } from "./LazyComponents";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type CashSessionResult = Awaited<ReturnType<typeof getActiveCashSession>>;
type OpenTablesResult = Awaited<ReturnType<typeof getOpenTables>>;
type LayoutResult = Awaited<ReturnType<typeof getTablesByArea>>;
type ProductSearchIndex = Awaited<ReturnType<typeof getProductsForSearch>>["data"];

interface PointOfSaleTabsProps {
  cashRegister: any;
  initialSession: any;
  initialCashSessionResult?: CashSessionResult;
  initialOpenTablesResult?: OpenTablesResult;
  initialLayouts?: Record<'salon' | 'vereda', LayoutResult["data"]>;
  initialProductSearchIndex?: ProductSearchIndex;
}

type TabValue = "mesas" | "mostrador" | "delivery";

const tabs = [
  {
    value: "mesas" as TabValue,
    label: "Mesas",
    icon: LayoutGrid,
    color: "buffalo-caramel",
    description: "Gestión de mesas del salón y vereda",
  },
  {
    value: "mostrador" as TabValue,
    label: "Mostrador",
    icon: ShoppingBag,
    color: "buffalo-espresso",
    description: "Ventas rápidas para llevar",
  },
  {
    value: "delivery" as TabValue,
    label: "Delivery",
    icon: Truck,
    color: "buffalo-ink",
    description: "Pedidos a domicilio",
  },
];

/**
 * Tabs de punto de venta mejorados con Design System
 * - Tabs personalizados con animaciones
 * - Estados visuales claros
 */
export function PointOfSaleTabs({
  cashRegister,
  initialSession,
  initialCashSessionResult,
  initialOpenTablesResult,
  initialLayouts,
  initialProductSearchIndex,
}: PointOfSaleTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("mesas");
  const [selectedOrderId] = useState<string | undefined>(undefined);

  const normalizeOrder = (order: any) => ({
    ...order,
    user: Array.isArray(order.user) ? order.user[0] : order.user,
    sale_items:
      order.sale_items?.map((item: any) => ({
        ...item,
        product: Array.isArray(item.product) ? item.product[0] : item.product,
      })) ?? [],
    sale_payments:
      order.sale_payments?.map((payment: any) => ({
        ...payment,
        payment_method: Array.isArray(payment.payment_method)
          ? payment.payment_method[0]
          : payment.payment_method,
      })) ?? [],
  });

  const initialTablesData =
    initialOpenTablesResult && initialOpenTablesResult.success
      ? initialOpenTablesResult.data.map(normalizeOrder)
      : [];

  const initialCounterOrders = initialTablesData.filter(
    (sale: any) => sale.sale_type === "counter",
  );
  const initialDeliveryOrders = initialTablesData.filter(
    (sale: any) => sale.sale_type === "delivery",
  );

  const activeTabData = tabs.find(t => t.value === activeTab);

  return (
    <>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="w-full">
        {/* Header unificado con tabs integrados */}
        <CashRegisterInfo
          cashRegister={cashRegister}
          initialSession={initialSession}
          type="bar"
          centerContent={
            <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-muted/50 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;

                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      "focus-visible:ring-2 focus-visible:ring-buffalo-caramel focus-visible:ring-offset-2",
                      isActive
                        ? tab.value === "mesas"
                          ? "bg-buffalo-caramel text-white shadow-md"
                          : tab.value === "mostrador"
                            ? "bg-buffalo-espresso text-white shadow-md"
                            : "bg-buffalo-ink text-white shadow-md"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={tab.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>

                    {/* Indicador activo (solo en móvil) */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-lg bg-white/10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          }
        />

        <div className="mt-4">
          {/* Contenido de tabs con animaciones */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="mesas" className="mt-0">
                <BarWithSaleView
                  cashRegister={cashRegister}
                  initialSession={initialSession}
                  initialCashSessionResult={initialCashSessionResult}
                  initialOpenTablesResult={initialOpenTablesResult}
                  initialLayouts={initialLayouts}
                  initialProductSearchIndex={initialProductSearchIndex}
                />
              </TabsContent>

              <TabsContent value="mostrador" className="mt-0">
                <CounterSaleView
                  cashRegister={cashRegister}
                  session={initialSession}
                  initialOrders={initialCounterOrders}
                />
              </TabsContent>

              <TabsContent value="delivery" className="mt-0">
                <DeliveryOrdersList
                  cashRegister={cashRegister}
                  session={initialSession}
                  initialOrders={initialDeliveryOrders}
                  selectedOrderId={selectedOrderId}
                />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </>
  );
}
