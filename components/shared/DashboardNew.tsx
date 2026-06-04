"use client";

import Link from "next/link";
import { Header } from "./Header";
import { StatCard, ActionCard, InfoCard } from "@/components/design-system";
import {
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  AlertTriangle,
  BarChart3,
  Settings,
  FileText,
  ShoppingBag,
} from "lucide-react";

interface DashboardData {
  user: {
    name: string;
    role: "admin" | "supervisor" | "cashier";
  };
  stats: {
    totalProducts: number;
    lowStockProducts: number;
    ventasHoy?: number;
    cantidadVentasHoy?: number;
    ingresosMes?: number;
    usuariosActivos?: number;
  };
}

interface DashboardNewProps {
  data: DashboardData;
}

/**
 * Dashboard rediseñado con el Design System
 */
export function DashboardNew({ data }: DashboardNewProps) {
  const { user, stats } = data;
  const userRole = user.role;

  return (
    <div className="space-y-6">
      {/* Header simplificado */}
      <Header
        title="INICIO"
        subtitle={`Bienvenido, ${user.name}`}
        size="lg"
      >
        <span className="text-muted-foreground text-sm hidden sm:inline">
          {userRole === "admin" ? "Administrador" : userRole === "supervisor" ? "Supervisor" : "Cajero"}
        </span>
      </Header>

      {/* Alertas */}
      {stats.lowStockProducts > 0 && (userRole === "admin" || userRole === "supervisor") && (
        <InfoCard variant="warning" title="Stock Bajo">
          {stats.lowStockProducts} producto{stats.lowStockProducts > 1 ? "s" : ""} necesita
          {stats.lowStockProducts === 1 ? "" : "n"} reposición.{" "}
          <Link href="/productos" className="underline font-medium">
            Ver productos
          </Link>
        </InfoCard>
      )}

      {/* ==================== VISTA CAJERO ==================== */}
      {userRole === "cashier" && (
        <div className="space-y-6">
          <SectionHeader
            title="¿Qué querés hacer?"
            description="Seleccioná una opción para comenzar"
          />

          {/* Acceso principal - Caja Bar */}
          <Link href="/caja-bar" className="block">
            <ActionCard
              title="Caja Bar"
              description="Punto de Venta - Hacé click para abrir la caja y comenzar a vender"
              icon={<ShoppingBag className="h-10 w-10" />}
              className="border-2 border-buffalo-caramel/50 hover:border-buffalo-caramel"
            />
          </Link>

          {/* Acceso a historial */}
          <Link href="/ventas">
            <ActionCard
              title="Historial de Ventas"
              description="Consultas y reportes de ventas"
              icon={<FileText className="h-6 w-6" />}
            />
          </Link>
        </div>
      )}

      {/* ==================== VISTA SUPERVISOR ==================== */}
      {userRole === "supervisor" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Ventas de Hoy"
              value={`$${(stats.ventasHoy || 0).toLocaleString("es-AR")}`}
              subtitle={`${stats.cantidadVentasHoy || 0} ventas`}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <StatCard
              title="Productos"
              value={stats.totalProducts}
              subtitle="En inventario"
              icon={<Package className="h-4 w-4" />}
            />
            <StatCard
              title="Ingresos del Mes"
              value={`$${(stats.ingresosMes || 0).toLocaleString("es-AR")}`}
              subtitle="Este mes"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              title="Stock Bajo"
              value={stats.lowStockProducts}
              subtitle="Productos"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          {/* Accesos rápidos */}
          <SectionHeader
            title="Accesos Rápidos"
            description="Gestión rápida del sistema"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/caja-bar">
              <ActionCard
                title="Caja Bar"
                description="Punto de venta"
                icon={<ShoppingBag className="h-6 w-6" />}
              />
            </Link>
            <Link href="/reportes">
              <ActionCard
                title="Reportes"
                description="Ver estadísticas"
                icon={<BarChart3 className="h-6 w-6" />}
              />
            </Link>
            <Link href="/productos">
              <ActionCard
                title="Productos"
                description="Gestionar inventario"
                icon={<Package className="h-6 w-6" />}
              />
            </Link>
          </div>
        </div>
      )}

      {/* ==================== VISTA ADMIN ==================== */}
      {userRole === "admin" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Ventas de Hoy"
              value={`$${(stats.ventasHoy || 0).toLocaleString("es-AR")}`}
              subtitle={`${stats.cantidadVentasHoy || 0} ventas`}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <StatCard
              title="Productos"
              value={stats.totalProducts}
              subtitle="En inventario"
              icon={<Package className="h-4 w-4" />}
            />
            <StatCard
              title="Ingresos del Mes"
              value={`$${(stats.ingresosMes || 0).toLocaleString("es-AR")}`}
              subtitle="Este mes"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              title="Usuarios Activos"
              value={stats.usuariosActivos || 0}
              subtitle="En el sistema"
              icon={<Users className="h-4 w-4" />}
            />
          </div>

          {/* Accesos rápidos */}
          <SectionHeader
            title="Accesos Rápidos"
            description="Gestión rápida del sistema"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/caja-bar">
              <ActionCard
                title="Caja Bar"
                description="Punto de venta"
                icon={<ShoppingBag className="h-6 w-6" />}
              />
            </Link>
            <Link href="/reportes">
              <ActionCard
                title="Reportes"
                description="Estadísticas"
                icon={<BarChart3 className="h-6 w-6" />}
              />
            </Link>
            <Link href="/configuracion">
              <ActionCard
                title="Configuración"
                description="Sistema"
                icon={<Settings className="h-6 w-6" />}
              />
            </Link>
          </div>

          {/* Grid de gestión */}
          <SectionHeader
            title="Gestión Completa"
            description="Todas las opciones del sistema"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground mb-3">Gestión</h3>
              <Link href="/productos" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <Package className="h-4 w-4" />
                  Productos
                </div>
              </Link>
              <Link href="/proveedores" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4" />
                  Proveedores
                </div>
              </Link>
              <Link href="/compras" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <ShoppingBag className="h-4 w-4" />
                  Compras
                </div>
              </Link>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground mb-3">Operaciones</h3>
              <Link href="/ventas" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4" />
                  Ventas
                </div>
              </Link>
              <Link href="/gastos" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <DollarSign className="h-4 w-4" />
                  Gastos
                </div>
              </Link>
              <Link href="/inventario" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <Package className="h-4 w-4" />
                  Inventario
                </div>
              </Link>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground mb-3">Administración</h3>
              <Link href="/reportes" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Reportes
                </div>
              </Link>
              <Link href="/configuracion" className="block p-2 hover:bg-muted/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2 text-foreground">
                  <Settings className="h-4 w-4" />
                  Configuración
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}
