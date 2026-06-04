"use client";

import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof ShadcnButton> {
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: "sm" | "default" | "lg" | "xl";
  fullWidth?: boolean;
}

const buttonSizes = {
  sm: "h-9 px-3 text-sm",
  default: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
  xl: "h-14 px-10 text-lg",
};

/**
 * Botón primario - Para acciones principales
 * Ej: "Guardar", "Crear Venta", "Abrir Caja"
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, loadingText, leftIcon, rightIcon, size = "default", fullWidth, children, disabled, ...props }, ref) => {
    return (
      <motion.div whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }} whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}>
        <ShadcnButton
          ref={ref}
          className={cn(
            // Estilos base
            "relative font-semibold transition-all duration-200",
            "bg-buffalo-caramel hover:bg-buffalo-caramel/90",
            "text-white",
            "shadow-lg shadow-buffalo-caramel/25 hover:shadow-xl hover:shadow-buffalo-caramel/30",
            "border-0",
            "focus-visible:ring-2 focus-visible:ring-buffalo-caramel focus-visible:ring-offset-2",
            "active:shadow-md",
            // Tamaño
            buttonSizes[size],
            // Ancho completo
            fullWidth && "w-full",
            // Estados deshabilitados
            (disabled || isLoading) && "opacity-60 cursor-not-allowed shadow-none",
            className
          )}
          disabled={disabled || isLoading}
          {...props}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingText || children}
            </>
          ) : (
            <>
              {leftIcon && <span className="mr-2">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="ml-2">{rightIcon}</span>}
            </>
          )}
        </ShadcnButton>
      </motion.div>
    );
  }
);
PrimaryButton.displayName = "PrimaryButton";

/**
 * Botón secundario - Para acciones secundarias
 * Ej: "Cancelar", "Volver", "Ver más"
 */
export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, loadingText, leftIcon, rightIcon, size = "default", fullWidth, children, ...props }, ref) => {
    return (
      <motion.div whileTap={{ scale: props.disabled || isLoading ? 1 : 0.97 }}>
        <ShadcnButton
          ref={ref}
          variant="outline"
          className={cn(
            "relative font-medium transition-all duration-200",
            "border-2 border-buffalo-espresso/20 hover:border-buffalo-espresso/40",
            "bg-white hover:bg-buffalo-cream/50",
            "text-buffalo-espresso",
            "shadow-sm hover:shadow-md",
            "focus-visible:ring-2 focus-visible:ring-buffalo-espresso focus-visible:ring-offset-2",
            buttonSizes[size],
            fullWidth && "w-full",
            (props.disabled || isLoading) && "opacity-60 cursor-not-allowed",
            className
          )}
          disabled={props.disabled || isLoading}
          {...props}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingText || children}
            </>
          ) : (
            <>
              {leftIcon && <span className="mr-2">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="ml-2">{rightIcon}</span>}
            </>
          )}
        </ShadcnButton>
      </motion.div>
    );
  }
);
SecondaryButton.displayName = "SecondaryButton";

/**
 * Botón de peligro - Para acciones destructivas
 * Ej: "Eliminar", "Cerrar Caja", "Cancelar Venta"
 */
export const DangerButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, loadingText, leftIcon, rightIcon, size = "default", fullWidth, children, ...props }, ref) => {
    return (
      <motion.div whileTap={{ scale: props.disabled || isLoading ? 1 : 0.97 }}>
        <ShadcnButton
          ref={ref}
          variant="outline"
          className={cn(
            "relative font-semibold transition-all duration-200",
            "border-2 border-red-200 hover:border-red-300",
            "bg-red-50 hover:bg-red-100",
            "text-red-700 hover:text-red-800",
            "shadow-sm hover:shadow-md",
            "focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
            buttonSizes[size],
            fullWidth && "w-full",
            (props.disabled || isLoading) && "opacity-60 cursor-not-allowed",
            className
          )}
          disabled={props.disabled || isLoading}
          {...props}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingText || children}
            </>
          ) : (
            <>
              {leftIcon && <span className="mr-2">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="ml-2">{rightIcon}</span>}
            </>
          )}
        </ShadcnButton>
      </motion.div>
    );
  }
);
DangerButton.displayName = "DangerButton";

/**
 * Botón ghost - Para acciones sutiles
 * Ej: "Editar", "Ver detalle", iconos sueltos
 */
export const GhostButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, leftIcon, rightIcon, size = "default", fullWidth, children, ...props }, ref) => {
    return (
      <ShadcnButton
        ref={ref}
        variant="ghost"
        className={cn(
          "relative font-medium transition-all duration-200",
          "hover:bg-buffalo-caramel/10 hover:text-buffalo-caramel",
          "focus-visible:ring-2 focus-visible:ring-buffalo-caramel focus-visible:ring-offset-2",
          size === "sm" && "h-8 px-2",
          size === "default" && "h-9 px-3",
          size === "lg" && "h-10 px-4",
          size === "xl" && "h-12 px-6",
          fullWidth && "w-full",
          (props.disabled || isLoading) && "opacity-60 cursor-not-allowed",
          className
        )}
        disabled={props.disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
          </>
        )}
      </ShadcnButton>
    );
  }
);
GhostButton.displayName = "GhostButton";

/**
 * Botón de acción flotante (FAB)
 * Para acciones principales en móvil
 */
export const FabButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, leftIcon, children, ...props }, ref) => {
    return (
      <motion.div whileTap={{ scale: props.disabled || isLoading ? 1 : 0.9 }} whileHover={{ scale: props.disabled || isLoading ? 1 : 1.05 }}>
        <ShadcnButton
          ref={ref}
          className={cn(
            "h-14 w-14 rounded-full",
            "bg-buffalo-caramel hover:bg-buffalo-caramel/90",
            "text-white",
            "shadow-xl shadow-buffalo-caramel/40",
            "focus-visible:ring-2 focus-visible:ring-buffalo-caramel focus-visible:ring-offset-4",
            "flex items-center justify-center",
            (props.disabled || isLoading) && "opacity-60 cursor-not-allowed",
            className
          )}
          disabled={props.disabled || isLoading}
          {...props}
        >
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : leftIcon || children}
        </ShadcnButton>
      </motion.div>
    );
  }
);
FabButton.displayName = "FabButton";
