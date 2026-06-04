"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Context ──────────────────────────────────────────── */
interface DialogCtx { onClose: () => void }
const DialogContext = React.createContext<DialogCtx | null>(null);

/* ─── Dialog ────────────────────────────────────────────── */
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ onClose: () => onOpenChange(false) }}>
      {/* Stack — bottom-sheet on mobile, centered on sm+ */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-foreground/25 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </DialogContext.Provider>
  );
}

/* ─── DialogContent ─────────────────────────────────────── */
interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pass true on modals that manage their own internal scroll layout */
  manualScroll?: boolean;
  style?: React.CSSProperties;
}

export function DialogContent({
  className,
  style,
  manualScroll = false,
  children,
  ...props
}: DialogContentProps) {
  const ctx = React.useContext(DialogContext);

  return (
    <div
      className={cn(
        // Position & stacking
        "relative z-50 flex flex-col",
        // Shape — full-width bottom sheet on mobile, rounded card on sm+
        "w-full rounded-t-3xl",
        "sm:w-auto sm:rounded-[1.75rem]",
        // Colours & shadow
        "border border-border brand-panel text-foreground",
        "shadow-[0_-4px_32px_rgba(0,0,0,0.10)] sm:shadow-[0_30px_90px_rgba(0,0,0,0.12)]",
        // Height limits — leaves thumb room on mobile
        "max-h-[92dvh] sm:max-h-[90vh]",
        // Scroll — default overflow-y-auto so content scrolls
        // (modals with manualScroll use overflow-hidden themselves)
        manualScroll ? "overflow-hidden" : "overflow-y-auto",
        // Width on sm+
        "sm:min-w-[32rem] sm:max-w-lg",
        "md:max-w-xl",
        "lg:max-w-2xl",
        "xl:max-w-4xl",
        "2xl:max-w-6xl",
        className
      )}
      style={style}
      {...props}
    >
      {/* ── Close button (always visible, absolute top-right) ── */}
      {ctx && (
        <button
          type="button"
          onClick={ctx.onClose}
          aria-label="Cerrar"
          className={cn(
            "absolute right-4 top-4 z-20",
            "flex h-8 w-8 items-center justify-center rounded-full",
            "border border-border bg-muted/70 text-muted-foreground",
            "transition hover:bg-muted hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {children}
    </div>
  );
}

/* ─── DialogHeader ───────────────────────────────────────── */
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // pr-12 / pr-14 keeps title clear of the X button
      className={cn(
        "flex shrink-0 flex-col space-y-1.5 p-5 pb-3 pr-12 sm:p-6 sm:pb-4 sm:pr-14",
        className
      )}
      {...props}
    />
  );
}

/* ─── DialogTitle ────────────────────────────────────────── */
export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

/* ─── DialogFooter ───────────────────────────────────────── */
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Stack buttons on mobile, row on sm+
        "flex shrink-0 flex-col-reverse gap-2 p-5 pt-3 sm:flex-row sm:items-center sm:justify-end sm:p-6 sm:pt-3",
        className
      )}
      {...props}
    />
  );
}

/* ─── DialogDescription ──────────────────────────────────── */
export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
