"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getCustomers, deleteCustomer } from "@/actions/customerActions";
import { CustomerModal } from "./CustomerModal";
import { CustomerPaymentModal } from "./CustomerPaymentModal";
import { useNotificationStore } from "@/store/notificationStore";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Wallet, UserCircle } from "lucide-react";

export function CustomersTable() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<any | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getCustomers();
    if (res.success) setCustomers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (c: any) => {
    const ok = await confirm({
      title: "Eliminar cliente",
      description: `¿Eliminar a "${c.name}"? Dejará de aparecer en las listas.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await deleteCustomer(c.id);
    if (res.success) {
      addNotification("success", "Cliente eliminado");
      load();
    } else {
      addNotification("error", res.message || "Error al eliminar");
    }
  };

  const totalDeuda = customers.reduce((sum, c) => sum + (Number(c.current_balance) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {customers.length} cliente(s)
          {totalDeuda > 0 && (
            <> · deuda total: <span className="font-semibold text-red-600">{formatCurrency(totalDeuda)}</span></>
          )}
        </p>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <UserCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Todavía no cargaste clientes</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Cargá tus clientes con su límite de crédito. Después, al abrir una mesa podés asignarles el consumo
            a su cuenta corriente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Teléfono</th>
                <th className="px-4 py-2.5 text-right">Límite</th>
                <th className="px-4 py-2.5 text-right">Saldo (debe)</th>
                <th className="px-4 py-2.5 text-right">Disponible</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const saldo = Number(c.current_balance) || 0;
                const limite = Number(c.credit_limit) || 0;
                const disp = limite > 0 ? limite - saldo : null;
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{limite > 0 ? formatCurrency(limite) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${saldo > 0 ? "text-red-600" : "text-foreground"}`}>
                      {formatCurrency(saldo)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${disp !== null && disp < 0 ? "text-red-600" : "text-green-600"}`}>
                      {disp !== null ? formatCurrency(disp) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Cuenta corriente / pagos"
                          onClick={() => { setPaymentCustomer(c); setPaymentOpen(true); }}>
                          <Wallet className="h-4 w-4 text-secondary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                          onClick={() => { setEditing(c); setModalOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Eliminar"
                          onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CustomerModal open={modalOpen} onClose={() => setModalOpen(false)} customer={editing} onSaved={load} />
      <CustomerPaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} customer={paymentCustomer} onSaved={load} />
    </div>
  );
}
