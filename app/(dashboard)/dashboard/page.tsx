import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  DollarSign,
  FileText,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { getDashboardData } from "@/actions/dashboardActions";
import { Header } from "@/components/shared/Header";
import { SystemMonitor } from "@/components/shared/SystemMonitor";
import { WelcomeWizard } from "@/components/shared/WelcomeWizard";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 120;

export default async function DashboardPage() {
  const { success, data: dashboardData, message } = await getDashboardData();

  if (!success || !dashboardData) {
    console.error("Error loading dashboard:", message);

    return (
      <div className="space-y-8">
        <ErrorPanel message={message || "No se pudieron cargar los datos del panel."} />
        <DashboardContent
          user={{ name: "Usuario", role: "cashier" }}
          stats={{
            totalProducts: 0,
            lowStockProducts: 0,
            ventasHoy: 0,
            cantidadVentasHoy: 0,
            ingresosMes: 0,
            usuariosActivos: 0,
          }}
        />
      </div>
    );
  }

  return <DashboardContent user={dashboardData.user} stats={dashboardData.stats} />;
}

interface DashboardContentProps {
  user: {
    name: string;
    role: string;
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

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  tone?: "pink" | "gold" | "amber";
}

interface ShortcutCardProps {
  href: string;
  title: string;
  description: string;
  eyebrow?: string;
  icon: LucideIcon;
  featured?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

function DashboardContent({ user, stats }: DashboardContentProps) {
  const userRole = user.role as "admin" | "supervisor" | "cashier";
  const roleLabel =
    userRole === "admin" ? "Administrador" : userRole === "supervisor" ? "Supervisor" : "Cajero";

  return (
    <div className="space-y-8">
      <WelcomeWizard userRole={userRole} userName={user.name || "Usuario"} />

      <Header title="Panel Principal" subtitle={`Bienvenido, ${user.name || "Usuario"}`} size="lg">
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-secondary" />
          {roleLabel}
        </div>
      </Header>

      {stats.lowStockProducts > 0 && (userRole === "admin" || userRole === "supervisor") && (
        <LowStockAlert lowStockProducts={stats.lowStockProducts} />
      )}

      {userRole === "cashier" && <CashierView />}
      {userRole === "supervisor" && <SupervisorView stats={stats} />}
      {userRole === "admin" && <AdminView stats={stats} />}

      {userRole === "admin" && <SystemMonitor />}
    </div>
  );
}

function CashierView() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Turno en marcha"
        description="Arranca rápido con las tareas de barra y el historial operativo del día."
      />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
        <ShortcutCard
          href="/caja-bar"
          title="Abrir Caja Bar"
          description="Entra directo al punto de venta para cobrar, abrir mesas y registrar pedidos sin perder tiempo."
          eyebrow="Acceso principal"
          icon={ShoppingBag}
          featured
        />
        <ShortcutCard
          href="/ventas"
          title="Historial de ventas"
          description="Consulta operaciones recientes, tickets y movimientos del turno."
          eyebrow="Seguimiento"
          icon={FileText}
        />
      </div>
    </div>
  );
}

function SupervisorView({ stats }: { stats: DashboardContentProps["stats"] }) {
  return (
    <div className="space-y-8">
      <MetricsGrid
        metrics={[
          {
            title: "Ventas de hoy",
            value: formatCurrency(stats.ventasHoy || 0),
            subtitle: `${stats.cantidadVentasHoy || 0} ventas registradas`,
            icon: ShoppingCart,
            tone: "gold",
          },
          {
            title: "Productos",
            value: stats.totalProducts,
            subtitle: "Inventario disponible",
            icon: Package,
          },
          {
            title: "Ingresos del mes",
            value: formatCurrency(stats.ingresosMes || 0),
            subtitle: "Acumulado mensual",
            icon: DollarSign,
            tone: "amber",
          },
          {
            title: "Stock bajo",
            value: stats.lowStockProducts,
            subtitle: "Ítems para reponer",
            icon: AlertTriangle,
            tone: "pink",
          },
        ]}
      />

      <SectionHeader
        title="Control rápido"
        description="Entradas directas para supervisión, inventario y análisis del salón."
      />

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <ShortcutCard
          href="/caja-bar"
          title="Caja Bar"
          description="Revisar operaciones activas y flujo de cobro."
          eyebrow="Operación"
          icon={ShoppingBag}
        />
        <ShortcutCard
          href="/reportes"
          title="Reportes"
          description="Analiza ventas, cierres y rendimiento del equipo."
          eyebrow="Análisis"
          icon={BarChart3}
        />
        <ShortcutCard
          href="/productos"
          title="Productos"
          description="Ajusta stock, categorías y disponibilidad."
          eyebrow="Inventario"
          icon={Package}
        />
      </div>
    </div>
  );
}

function AdminView({ stats }: { stats: DashboardContentProps["stats"] }) {
  return (
    <div className="space-y-8">
      <MetricsGrid
        metrics={[
          {
            title: "Ventas de hoy",
            value: formatCurrency(stats.ventasHoy || 0),
            subtitle: `${stats.cantidadVentasHoy || 0} ventas registradas`,
            icon: ShoppingCart,
            tone: "gold",
          },
          {
            title: "Productos",
            value: stats.totalProducts,
            subtitle: "Inventario disponible",
            icon: Package,
          },
          {
            title: "Ingresos del mes",
            value: formatCurrency(stats.ingresosMes || 0),
            subtitle: "Acumulado mensual",
            icon: DollarSign,
            tone: "amber",
          },
          {
            title: "Usuarios activos",
            value: stats.usuariosActivos || 0,
            subtitle: "Cuentas habilitadas",
            icon: Users,
            tone: "pink",
          },
        ]}
      />

      <SectionHeader
        title="Accesos clave"
        description="Los tres frentes principales del negocio para entrar sin rodeos."
      />

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <ShortcutCard
          href="/caja-bar"
          title="Caja Bar"
          description="Operación en vivo, ventas del turno y atención de salón."
          eyebrow="Operación"
          icon={ShoppingBag}
          featured
        />
        <ShortcutCard
          href="/reportes"
          title="Reportes"
          description="Estadísticas, evolución de caja y lectura del negocio."
          eyebrow="Control"
          icon={BarChart3}
        />
        <ShortcutCard
          href="/configuracion"
          title="Configuración"
          description="Sistema, branding, permisos y ajustes generales."
          eyebrow="Sistema"
          icon={Settings}
        />
      </div>

      <SectionHeader
        title="Gestión completa"
        description="Todas las áreas organizadas por foco para navegar con claridad."
      />

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <ManagementPanel
          title="Gestión"
          description="Inventario, abastecimiento y estructura comercial."
          links={[
            { href: "/productos", icon: Package, label: "Productos" },
            { href: "/proveedores", icon: Users, label: "Proveedores" },
            { href: "/compras", icon: ShoppingBag, label: "Compras" },
          ]}
        />
        <ManagementPanel
          title="Operaciones"
          description="Caja, ventas y movimiento diario del bar."
          links={[
            { href: "/ventas", icon: FileText, label: "Ventas" },
            { href: "/gastos", icon: DollarSign, label: "Gastos" },
            { href: "/reportes", icon: BarChart3, label: "Reportes" },
          ]}
        />
        <ManagementPanel
          title="Administración"
          description="Usuarios, permisos y configuración global."
          links={[
            { href: "/usuarios", icon: Users, label: "Usuarios" },
            { href: "/configuracion", icon: Settings, label: "Configuración" },
          ]}
        />
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card className="overflow-hidden border-red-500/20 bg-red-50 text-foreground">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-red-600/80">
            Error de carga
          </p>
          <h2 className="font-brand text-2xl text-foreground">No pudimos armar el panel completo</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{message}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full border border-red-300/30 bg-red-100 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-200"
        >
          Reintentar
        </Link>
      </CardContent>
    </Card>
  );
}

function LowStockAlert({ lowStockProducts }: { lowStockProducts: number }) {
  return (
    <Card className="overflow-hidden border-yellow-400/25 bg-yellow-50 text-foreground">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-100 text-yellow-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700/70">
              Atención
            </p>
            <h3 className="mt-1 font-brand text-xl text-foreground">Stock bajo detectado</h3>
            <p className="mt-1 text-sm text-yellow-700/80">
              Hay {lowStockProducts} producto{lowStockProducts > 1 ? "s" : ""} que necesita
              {lowStockProducts === 1 ? "" : "n"} reposición.
            </p>
          </div>
        </div>

        <Link
          href="/productos"
          className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800 transition hover:bg-yellow-200"
        >
          Ver productos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function MetricsGrid({ metrics }: { metrics: MetricCardProps[] }) {
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "pink",
}: MetricCardProps) {
  const toneMap = {
    pink: {
      stripe: "from-primary/22 via-primary/8 to-transparent",
      border: "border-primary/20",
      icon: "text-primary",
    },
    gold: {
      stripe: "from-secondary/22 via-secondary/10 to-transparent",
      border: "border-secondary/25",
      icon: "text-secondary",
    },
    amber: {
      stripe: "from-orange-400/18 via-orange-300/8 to-transparent",
      border: "border-orange-300/20",
      icon: "text-orange-200",
    },
  };

  return (
    <Card className="overflow-hidden border-border bg-card text-foreground shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
      <CardContent className="p-0">
        <div className={`h-1 w-full bg-gradient-to-r ${toneMap[tone].stripe}`} />
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {title}
              </p>
              <div className="mt-3 text-4xl font-black tracking-tight text-foreground">{value}</div>
            </div>
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-muted/50 ${toneMap[tone].border} ${toneMap[tone].icon}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShortcutCard({
  href,
  title,
  description,
  eyebrow,
  icon: Icon,
  featured = false,
}: ShortcutCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card
        className={[
          "h-full overflow-hidden border-border text-foreground transition duration-300 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-[0_22px_70px_rgba(0,0,0,0.10)]",
          featured
            ? "bg-[radial-gradient(circle_at_top_left,rgba(181, 116, 58,0.08),transparent_34%),linear-gradient(180deg,rgba(255,253,250,0.98),rgba(255,243,233,0.98))]"
            : "bg-card",
        ].join(" ")}
      >
        <CardContent className="flex h-full flex-col justify-between p-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                {eyebrow && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {eyebrow}
                  </p>
                )}
                <h3 className="font-brand text-3xl leading-none text-foreground">{title}</h3>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-secondary transition group-hover:scale-105 group-hover:text-primary">
                <Icon className="h-6 w-6" />
              </div>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-secondary transition group-hover:text-primary">
            <span>Entrar</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.34em] text-secondary/85">Dashboard</p>
      <h2 className="font-brand text-3xl text-foreground">{title}</h2>
      {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}

function ManagementPanel({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: NavLink[];
}) {
  return (
    <Card className="overflow-hidden border-border bg-card text-foreground">
      <CardContent className="p-6">
        <div className="mb-6 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
          <h3 className="font-brand text-2xl text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground/74 transition hover:border-primary/25 hover:bg-primary/[0.05] hover:text-foreground"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/40 text-secondary transition group-hover:text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{link.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}
