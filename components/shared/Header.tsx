"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "default" | "lg";
  centered?: boolean;
}

export function Header({
  title,
  subtitle,
  children,
  className,
  size = "default",
  centered = false,
}: HeaderProps) {
  const sizeStyles = {
    sm: {
      container: "py-3 px-4",
      title: "text-lg",
      subtitle: "text-sm",
    },
    default: {
      container: "py-4 px-6",
      title: "text-xl sm:text-2xl",
      subtitle: "text-sm sm:text-base",
    },
    lg: {
      container: "py-6 px-6 sm:px-8",
      title: "text-2xl sm:text-3xl",
      subtitle: "text-base",
    },
  };

  const styles = sizeStyles[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "brand-panel rounded-[1.75rem] text-white",
        styles.container,
        "flex items-center justify-between gap-4",
        centered && "flex-col text-center",
        className
      )}
    >
      <div className={cn("min-w-0 flex-1", centered && "w-full")}>
        <h1 className={cn("font-brand text-secondary", styles.title)}>{title}</h1>
        {subtitle && <p className={cn("mt-2 text-muted-foreground", styles.subtitle)}>{subtitle}</p>}
      </div>
      {children && (
        <div className={cn("flex items-center gap-3", centered && "mt-2 w-full justify-center")}>
          {children}
        </div>
      )}
    </motion.div>
  );
}

interface MinimalHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function MinimalHeader({ title, subtitle, className }: MinimalHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-brand text-2xl text-secondary sm:text-3xl"
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-1 text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="font-brand text-lg text-secondary">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
