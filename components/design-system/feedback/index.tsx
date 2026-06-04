"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { 
  Package, 
  ShoppingCart, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Users,
  UtensilsCrossed,
  TrendingUp,
  FileText,
  ArrowRight
} from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
  };
  variant?: "default" | "compact";
}

const iconMap: Record<string, React.ReactNode> = {
  products: <Package className="h-16 w-16" />,
  sales: <ShoppingCart className="h-16 w-16" />,
  search: <Search className="h-16 w-16" />,
  users: <Users className="h-16 w-16" />,
  kitchen: <UtensilsCrossed className="h-16 w-16" />,
  stats: <TrendingUp className="h-16 w-16" />,
  documents: <FileText className="h-16 w-16" />,
};

/**
 * Empty State - Estado vacío útil
 * Muestra un mensaje amigable cuando no hay datos
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center text-center",
        isCompact ? "py-8" : "py-12"
      )}
    >
      {icon && (
        <div className={cn(
          "text-muted-foreground/30 mb-4",
          isCompact && "scale-75"
        )}>
          {icon}
        </div>
      )}
      
      <h3 className={cn(
        "font-bold text-gray-900",
        isCompact ? "text-lg" : "text-xl"
      )}>
        {title}
      </h3>
      
      {description && (
        <p className="text-muted-foreground mt-2 max-w-sm">
          {description}
        </p>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          {action && (
            action.href ? (
              <a href={action.href}>
                <Button>
                  {action.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            ) : (
              <Button onClick={action.onClick}>
                {action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );

  if (isCompact) {
    return content;
  }

  return (
    <Card className="p-8">
      {content}
    </Card>
  );
}

/**
 * Empty State predefinidos por contexto
 */
export function EmptyProducts({ action }: { action?: EmptyStateProps["action"] }) {
  return (
    <EmptyState
      icon={iconMap.products}
      title="No hay productos"
      description="Aún no has agregado ningún producto al inventario."
      action={action}
    />
  );
}

export function EmptySales({ action }: { action?: EmptyStateProps["action"] }) {
  return (
    <EmptyState
      icon={iconMap.sales}
      title="No hay ventas"
      description="No se encontraron ventas en el período seleccionado."
      action={action}
    />
  );
}

export function EmptySearch({ searchTerm, onClear }: { searchTerm: string; onClear: () => void }) {
  return (
    <EmptyState
      icon={iconMap.search}
      title={`No se encontraron resultados para "${searchTerm}"`}
      description="Intenta con otros términos de búsqueda."
      action={{ label: "Limpiar búsqueda", onClick: onClear }}
      variant="compact"
    />
  );
}

export function EmptyKitchen() {
  return (
    <EmptyState
      icon={iconMap.kitchen}
      title="No hay pedidos pendientes"
      description="Los nuevos pedidos aparecerán aquí automáticamente."
    />
  );
}

/**
 * Error State - Para mostrar errores amigables
 */
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function ErrorState({ 
  title = "Algo salió mal", 
  message, 
  onRetry, 
  onGoBack 
}: ErrorStateProps) {
  return (
    <Card className="p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        <p className="text-muted-foreground mt-2 max-w-sm">{message}</p>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              Intentar nuevamente
            </Button>
          )}
          {onGoBack && (
            <Button onClick={onGoBack} variant="ghost">
              Volver atrás
            </Button>
          )}
        </div>
      </motion.div>
    </Card>
  );
}

/**
 * Success State - Para confirmaciones
 */
interface SuccessStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function SuccessState({ 
  title, 
  message, 
  action,
  autoHide,
  autoHideDelay = 3000
}: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="rounded-lg bg-green-50 border border-green-200 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-green-900">{title}</h4>
          {message && <p className="text-sm text-green-700 mt-1">{message}</p>}
        </div>
        {action && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={action.onClick}
            className="text-green-700 hover:text-green-800 hover:bg-green-100"
          >
            {action.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Info Alert - Para mensajes informativos
 */
interface InfoAlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: "info" | "warning";
  onClose?: () => void;
  className?: string;
}

export function InfoAlert({ title, children, variant = "info", onClose, className }: InfoAlertProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  };

  const iconStyles = {
    info: "text-blue-600",
    warning: "text-yellow-600",
  };

  return (
    <div className={cn("rounded-lg border p-4", styles[variant], className)}>
      <div className="flex items-start gap-3">
        <Info className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconStyles[variant])} />
        <div className="flex-1">
          {title && <h4 className="font-semibold">{title}</h4>}
          <div className={cn("text-sm", !title && "text-base")}>{children}</div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading Overlay - Para operaciones en progreso
 */
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ isLoading, message, children }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl"
        >
          <div className="w-12 h-12 border-4 border-buffalo-caramel/20 border-t-buffalo-caramel rounded-full animate-spin" />
          {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Badge de estado - Para mostrar estados consistentes
 */
interface StatusBadgeProps {
  status: "success" | "warning" | "error" | "info" | "pending";
  children: React.ReactNode;
  pulse?: boolean;
}

const statusStyles = {
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
  error: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-gray-100 text-gray-700 border-gray-200",
};

export function StatusBadge({ status, children, pulse }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        statusStyles[status],
        pulse && "animate-pulse"
      )}
    >
      {status === "success" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />}
      {status === "pending" && pulse && <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5 animate-pulse" />}
      {children}
    </span>
  );
}
