"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  LayoutDashboard,
  Package,
  DollarSign,
  LogOut,
  Menu,
  X,
  ChefHat,
  BarChart3,
  Truck,
  Tag,
  Users,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/actions/userActions";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useHasMounted } from "@/hooks/useHasMounted";
import { OptimizedLogo } from "@/components/shared/OptimizedLogo";

const navigation = [
  { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { name: "Caja Bar", href: "/caja-bar", icon: ShoppingBag },
  { name: "Cocina", href: "/cocina", icon: ChefHat },
  { name: "Ventas", href: "/ventas", icon: ShoppingCart },
  { name: "Productos", href: "/productos", icon: Package },
  { name: "Gastos", href: "/gastos", icon: DollarSign },
];

function filterNavigationByRole(role: string) {
  if (role === "admin") return navigation;

  if (role === "supervisor") {
    return navigation.filter((item) => !["/configuracion"].includes(item.href));
  }

  if (role === "cashier") {
    return navigation.filter((item) =>
      ["/dashboard", "/caja-bar", "/cocina", "/gastos"].includes(item.href)
    );
  }

  if (role === "waiter") {
    return navigation.filter((item) =>
      ["/dashboard", "/caja-bar", "/cocina", "/pedidos", "/ventas", "/gastos"].includes(item.href)
    );
  }

  if (role === "kitchen") {
    return navigation.filter((item) => ["/cocina", "/pedidos"].includes(item.href));
  }

  return navigation.filter((item) => ["/dashboard", "/caja-bar"].includes(item.href));
}

// Secciones de gestión/admin agrupadas en el menú "Más" (visibilidad por rol)
const moreNavigation = [
  { name: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin", "supervisor"] },
  { name: "Proveedores", href: "/proveedores", icon: Truck, roles: ["admin", "supervisor"] },
  { name: "Compras", href: "/compras", icon: ShoppingBag, roles: ["admin", "supervisor"] },
  { name: "Promociones", href: "/promociones", icon: Tag, roles: ["admin", "supervisor"] },
  { name: "Usuarios", href: "/usuarios", icon: Users, roles: ["admin"] },
  { name: "Configuración", href: "/configuracion", icon: Settings, roles: ["admin"] },
];

function filterMoreByRole(role: string) {
  return moreNavigation.filter((item) => item.roles.includes(role));
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const hasMounted = useHasMounted();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { user: storeUser, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ id: string | null; role: string } | null>(null);

  const currentRole = storeUser?.role || user?.role || "waiter";
  const filteredNavigation = filterNavigationByRole(currentRole);
  const filteredMore = filterMoreByRole(currentRole);

  useEffect(() => {
    if (!hasMounted || storeUser) return;

    const syncUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) return;

        const { data: dbUser } = await supabase.from("users").select("id, role").eq("id", authUser.id).single();

        if (dbUser) {
          setUser({ id: dbUser.id, role: dbUser.role });
        }
      } catch (error) {
        console.error("Navbar sync error:", error);
      }
    };

    syncUser();
  }, [hasMounted, storeUser]);

  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      logout();

      if (!result.success) {
        addNotification("error", result.message || "Error al cerrar sesión");
      } else {
        addNotification("success", "Sesión cerrada");
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("Error during logout:", error);
      logout();
      addNotification("error", "Error al cerrar sesión");
      router.push("/login");
      router.refresh();
    }
  };

  const brandBlock = (
    <Link href="/dashboard" className="flex items-center gap-3">
      <OptimizedLogo width={56} height={56} priority className="h-14 w-14 object-contain" />
      <div className="flex flex-col">
        <span className="font-brand text-lg leading-none text-secondary sm:text-2xl">{brand.name}</span>
        <span className="text-[10px] uppercase tracking-[0.35em] text-primary sm:text-xs">{brand.descriptor}</span>
      </div>
    </Link>
  );

  if (!hasMounted || filteredNavigation.length === 0) {
    return (
      <nav className="sticky top-0 z-40 border-b border-primary/15 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
          {brandBlock}
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Conectando</span>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-primary/15 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-6">
            {brandBlock}
            <div className="hidden max-w-[calc(100vw-370px)] items-center gap-1 overflow-x-auto lg:flex">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href} className="flex-shrink-0">
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.18em]",
                        isActive
                          ? "border border-secondary/40 shadow-[0_8px_26px_rgba(168, 52, 28,0.26)]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.name}</span>
                    </Button>
                  </Link>
                );
              })}

              {filteredMore.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                    >
                      <span>Más</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {filteredMore.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            href={item.href}
                            className="flex w-full cursor-pointer items-center gap-2"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right xl:block">
              <p className="text-xs uppercase tracking-[0.35em] text-primary">{brand.dashboardTagline}</p>
            </div>
            <Button
              size="sm"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="hidden lg:flex"
            >
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/65 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-80 overflow-y-auto border-r border-primary/20 brand-shell shadow-[0_30px_80px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-primary/20 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <OptimizedLogo width={52} height={52} className="h-13 w-13 object-contain" />
              <div>
                <p className="font-brand text-xl text-secondary">{brand.name}</p>
                <p className="text-xs uppercase tracking-[0.35em] text-primary">{brand.descriptor}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 p-4">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    !isActive && "text-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Button>
              </Link>
            );
          })}

          {filteredMore.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Más
              </p>
              {filteredMore.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3",
                        !isActive && "text-foreground hover:bg-primary/10 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-primary/20 bg-background/80 p-4">
          <Button
            className="w-full justify-start gap-3"
            onClick={() => {
              handleLogout();
              setMobileMenuOpen(false);
            }}
          >
            <LogOut className="h-5 w-5" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </div>
    </>
  );
}
