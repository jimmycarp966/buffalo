"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShoppingBag, Eye, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseModal } from "./PurchaseModal";
import { markPurchaseAsPaid } from "@/actions/supplierActions";
import { useNotificationStore } from "@/store/notificationStore";

interface Purchase {
  id: string;
  total_amount: number;
  created_at: string;
  payment_status?: "paid" | "pending";
  paid_at?: string | null;
  payment_method_id?: string | null;
  payment_method?: { name: string } | null;
  supplier?: { name: string };
  user?: { name: string };
  purchase_items?: Array<{
    quantity: number;
    unit_cost: number;
    product: { name: string };
  }>;
}

interface PurchasesTableProps {
  purchases: Purchase[];
}

export function PurchasesTable({ purchases }: PurchasesTableProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const filteredPurchases = purchases.filter(
    (p) =>
      p.supplier?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.user?.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
  };

  const handleMarkAsPaid = async (purchaseId: string) => {
    setPayingId(purchaseId);
    try {
      const result = await markPurchaseAsPaid(purchaseId);
      if (result.success) {
        addNotification("success", result.message || "Compra marcada como pagada");
        router.refresh();
      } else {
        addNotification("error", result.message || "Error al marcar la compra como pagada");
      }
    } catch (error) {
      addNotification("error", "Error inesperado");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar compras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          <span className="ml-2">Nueva Compra</span>
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Productos</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Registrado por</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron compras</p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">
                      {formatDate(new Date(purchase.created_at))}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {purchase.supplier?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {purchase.purchase_items?.length || 0} productos
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(purchase.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      {purchase.payment_status === "paid" ? (
                        <Badge variant="success">
                          Pagada
                          {purchase.payment_method?.name
                            ? ` · ${purchase.payment_method.name}`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                      {purchase.user?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {purchase.payment_status !== "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={payingId === purchase.id}
                            onClick={() => handleMarkAsPaid(purchase.id)}
                          >
                            {payingId === purchase.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Marcar como pagada</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(purchase)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PurchaseModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Modal de detalles */}
      {selectedPurchase && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedPurchase(null)}
        >
          <div
            className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Detalle de Compra</h3>
            <div className="space-y-2 mb-4">
              <p>
                <strong>Proveedor:</strong> {selectedPurchase.supplier?.name}
              </p>
              <p>
                <strong>Fecha:</strong>{" "}
                {formatDate(new Date(selectedPurchase.created_at))}
              </p>
            </div>
            <table className="w-full border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-sm">Producto</th>
                  <th className="px-4 py-2 text-right text-sm">Cantidad</th>
                  <th className="px-4 py-2 text-right text-sm">Costo Unit.</th>
                  <th className="px-4 py-2 text-right text-sm">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchase.purchase_items?.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2">{item.product.name}</td>
                    <td className="px-4 py-2 text-right">{item.quantity}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(item.unit_cost)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(item.unit_cost * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-bold">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right">
                    TOTAL:
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(selectedPurchase.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-4 text-right">
              <Button onClick={() => setSelectedPurchase(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

