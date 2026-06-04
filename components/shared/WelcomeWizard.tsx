"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowRight, X, Sparkles, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";

interface WelcomeWizardProps {
  userRole: string;
  userName: string;
}

export function WelcomeWizard({ userRole, userName }: WelcomeWizardProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hasSeenWizard = localStorage.getItem(`wizard_seen_${userRole}`);

    if (!hasSeenWizard) {
      setTimeout(() => {
        setOpen(true);
      }, 500);
    }
  }, [userRole]);

  const handleClose = () => {
    localStorage.setItem(`wizard_seen_${userRole}`, "true");
    setOpen(false);
  };

  const handleAction = (path: string) => {
    handleClose();
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl overflow-hidden border-primary/25 text-foreground">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent" />
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full border border-primary/40 bg-muted p-2 shadow-[0_0_24px_rgba(168, 52, 28,0.22)]">
                <Image src={brand.logo.icon} alt={brand.logo.alt} fill className="object-contain p-1" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-primary/70">
                  {brand.name} {brand.descriptor}
                </p>
                <DialogTitle className="font-display text-2xl">
                  Bienvenido, {userName}
                </DialogTitle>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {userRole === "cashier" && (
            <>
              <div className="text-center">
                <h3 className="font-display text-3xl text-primary">Turno listo para arrancar</h3>
                <p className="text-muted-foreground">
                  Entra directo a barra y abre tu caja para empezar a vender.
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => handleAction("/caja-bar")}
                  className="group w-full max-w-md rounded-[28px] border border-primary/35 bg-gradient-to-br from-primary/10 via-white/5 to-accent/10 p-6 text-center transition-all hover:-translate-y-1 hover:border-accent/45 hover:shadow-[0_18px_48px_rgba(0,0,0,0.38)]"
                >
                  <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_24px_rgba(168, 52, 28,0.22)] transition-transform group-hover:scale-110">
                    <ShoppingBag className="h-10 w-10 text-primary" />
                  </div>
                  <h4 className="mb-1 font-display text-2xl text-accent">Bar</h4>
                  <p className="text-sm text-muted-foreground">Abrir caja, cargar ventas y seguir el ritmo del salon.</p>
                  <div className="mt-4 flex items-center justify-center gap-2 font-semibold text-primary">
                    <span>Ir ahora</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              </div>

              <div className="rounded-3xl border border-border bg-muted/30 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-accent">
                  <Sparkles className="h-4 w-4" />
                  Flujo recomendado
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Abrir caja con el monto inicial.</li>
                  <li>Usar nueva venta para arrancar pedidos rapido.</li>
                  <li>Escanear o buscar productos desde la barra.</li>
                  <li>Cerrar caja al terminar el turno.</li>
                </ul>
              </div>
            </>
          )}

          {userRole === "supervisor" && (
            <>
              <div className="text-center">
                <h3 className="font-display text-3xl text-primary">Panel de supervision</h3>
                <p className="text-muted-foreground">
                  Tienes visibilidad completa sobre ventas, inventario y rendimiento.
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-muted/30 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-accent">
                  <Sparkles className="h-4 w-4" />
                  Tu circuito
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Revisar reportes y estados de caja.</li>
                  <li>Seguir historial de ventas y cocina.</li>
                  <li>Gestionar productos, stock y categorias.</li>
                  <li>Controlar gastos y cierres del dia.</li>
                </ul>
              </div>
            </>
          )}

          {userRole === "admin" && (
            <>
              <div className="text-center">
                <h3 className="font-display text-3xl text-primary">Control total del sistema</h3>
                <p className="text-muted-foreground">
                  Tienes acceso a configuracion, equipo, permisos y operacion completa del bar.
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-muted/30 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-accent">
                  <ShieldCheck className="h-4 w-4" />
                  Acceso completo
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Gestion de empleados, usuarios y permisos.</li>
                  <li>Configuracion general de sala, barra y PWA.</li>
                  <li>Proveedores, compras y control de inventario.</li>
                  <li>Reportes y estadisticas del negocio.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Entendido
          </Button>
          {userRole === "cashier" && (
            <Button variant="shell" onClick={() => handleAction("/caja-bar")}>
              Ir a barra
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
