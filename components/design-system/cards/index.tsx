"use client";

import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { forwardRef } from "react";

export interface CardProps extends React.ComponentPropsWithoutRef<typeof ShadcnCard> {
  isInteractive?: boolean;
  isSelected?: boolean;
  noPadding?: boolean;
  headerAction?: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, isInteractive, isSelected, noPadding, children, ...props }, ref) => {
    return (
      <motion.div
        whileHover={isInteractive ? { y: -3, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)" } : undefined}
        transition={{ duration: 0.2 }}
      >
        <ShadcnCard
          ref={ref}
          className={cn(
            "rounded-[1.5rem] border border-border bg-card text-foreground shadow-[0_18px_56px_rgba(0,0,0,0.08)]",
            isInteractive && "cursor-pointer hover:border-primary/35",
            isSelected && "border-secondary ring-2 ring-secondary/20",
            className
          )}
          {...props}
        >
          {noPadding ? children : <div className="p-6">{children}</div>}
        </ShadcnCard>
      </motion.div>
    );
  }
);
Card.displayName = "Card";

export interface StatCardProps extends CardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, subtitle, icon, trend, isLoading, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/48">
            {title}
          </CardTitle>
          {icon && <div className="text-secondary">{icon}</div>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-black tracking-tight text-white">{value}</div>
              {(subtitle || trend) && (
                <div className="mt-1 flex items-center gap-2">
                  {trend && (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        trend.isPositive ? "text-green-300" : "text-red-300"
                      )}
                    >
                      {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                    </span>
                  )}
                  {subtitle && <p className="text-xs text-white/58">{subtitle}</p>}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);
StatCard.displayName = "StatCard";

export interface ActionCardProps extends CardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

export const ActionCard = forwardRef<HTMLDivElement, ActionCardProps>(
  ({ className, title, description, icon, onClick, href, ...props }, ref) => {
    const content = (
      <Card ref={ref} isInteractive className={cn("h-full", className)} {...props}>
        <div className="flex h-full flex-col items-center justify-between p-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-black/20 text-secondary">
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="font-brand text-2xl text-white">{title}</h3>
            {description && <p className="text-sm leading-6 text-white/64">{description}</p>}
          </div>
          <div className="mt-6 text-sm font-semibold text-secondary">Entrar</div>
        </div>
      </Card>
    );

    if (href) {
      return (
        <a href={href} className="block h-full">
          {content}
        </a>
      );
    }

    return (
      <button onClick={onClick} className="block h-full w-full text-left">
        {content}
      </button>
    );
  }
);
ActionCard.displayName = "ActionCard";

export interface InfoCardProps extends CardProps {
  variant?: "info" | "warning" | "error" | "success";
  title?: string;
  children: React.ReactNode;
}

const variantStyles = {
  info: {
    border: "border-primary/25",
    bg: "bg-primary/5",
    text: "text-foreground",
  },
  warning: {
    border: "border-yellow-400/30",
    bg: "bg-yellow-50",
    text: "text-foreground",
  },
  error: {
    border: "border-red-400/30",
    bg: "bg-red-50",
    text: "text-foreground",
  },
  success: {
    border: "border-green-400/30",
    bg: "bg-green-50",
    text: "text-foreground",
  },
};

export const InfoCard = forwardRef<HTMLDivElement, InfoCardProps>(
  ({ className, variant = "info", title, children, ...props }, ref) => {
    const styles = variantStyles[variant];

    return (
      <Card ref={ref} className={cn(styles.border, styles.bg, className)} {...props}>
        {title && (
          <CardHeader className="pb-3">
            <CardTitle className={cn("font-brand text-xl", styles.text)}>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn("text-sm leading-6", styles.text)}>{children}</CardContent>
      </Card>
    );
  }
);
InfoCard.displayName = "InfoCard";

export interface ListCardProps extends CardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant: "default" | "success" | "warning" | "danger";
  };
  rightContent?: React.ReactNode;
  onClick?: () => void;
}

export const ListCard = forwardRef<HTMLDivElement, ListCardProps>(
  ({ className, title, subtitle, badge, rightContent, onClick, ...props }, ref) => {
    const badgeStyles = {
      default: "bg-white/10 text-white/75",
      success: "bg-green-500/15 text-green-200",
      warning: "bg-yellow-400/15 text-yellow-200",
      danger: "bg-red-500/15 text-red-200",
    };

    const content = (
      <Card ref={ref} isInteractive={!!onClick} className={cn("p-4", className)} {...props}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-medium text-white">{title}</h4>
              {badge && (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badgeStyles[badge.variant])}>
                  {badge.text}
                </span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-sm text-white/58">{subtitle}</p>}
          </div>
          {rightContent && <div className="ml-4">{rightContent}</div>}
        </div>
      </Card>
    );

    if (onClick) {
      return (
        <button onClick={onClick} className="block w-full text-left">
          {content}
        </button>
      );
    }

    return content;
  }
);
ListCard.displayName = "ListCard";
