"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, LogIn, LogOut, History, Wallet } from "lucide-react";

import { cn, formatCurrency } from "@/lib/utils";
import { OpenCashModal } from "./OpenCashModal";
import { CloseCashModal } from "./CloseCashModal";
import { IncomeModal } from "./IncomeModal";
import { CashHistoryTab } from "./CashHistoryTab";
import { PrimaryButton, DangerButton, GhostButton, StatusBadge } from "@/components/design-system";

interface CashRegisterInfoProps {
  cashRegister: any;
  initialSession: any;
  type: "bar";
  centerContent?: React.ReactNode;
}

export function CashRegisterInfo({
  cashRegister,
  initialSession,
  type,
  centerContent,
}: CashRegisterInfoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-[1.75rem] border border-border bg-muted" />
    );
  }

  if (!cashRegister?.id || !cashRegister?.name) return null;

  const isOpen = initialSession?.status === "open";
  const shiftEmoji = {
    morning: "☀️",
    afternoon: "🌆",
    night: "🌙",
  };
  const shiftName = {
    morning: "Mañana",
    afternoon: "Tarde",
    night: "Noche",
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col gap-4"
      >
        <div className="sticky top-2 z-50 flex min-h-[84px] flex-col gap-4 rounded-[1.75rem] border border-border brand-panel px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.08)] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 justify-start overflow-x-auto">
            {centerContent}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-brand text-3xl leading-none text-foreground">{cashRegister.name}</h1>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Punto de venta principal
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {isOpen && initialSession ? (
                <>
                  <span className="font-medium text-foreground/80">
                    {shiftEmoji[initialSession.shift as keyof typeof shiftEmoji] || "🕐"}{" "}
                    {shiftName[initialSession.shift as keyof typeof shiftName] || initialSession.shift}
                  </span>
                  <StatusBadge status="success" pulse>
                    Abierta
                  </StatusBadge>
                  <span className="hidden sm:inline text-border">•</span>
                  <span className="hidden sm:inline">
                    {initialSession.opened_by?.full_name?.split(" ")[0] || "Sin asignar"}
                  </span>
                </>
              ) : (
                <StatusBadge status="warning">Cerrada</StatusBadge>
              )}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            {isOpen && initialSession ? (
              <>
                <div className="hidden rounded-2xl border border-border bg-muted/50 px-4 py-2 text-right lg:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Inicio
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(initialSession.opening_amount)}
                  </p>
                </div>

                <GhostButton
                  size="sm"
                  leftIcon={<Wallet className="h-4 w-4" />}
                  onClick={() => setIsIncomeModalOpen(true)}
                  className="hidden border border-green-400/20 bg-green-500/10 text-green-700 hover:bg-green-500/15 sm:flex"
                >
                  Ingreso
                </GhostButton>

                <GhostButton
                  size="sm"
                  leftIcon={<History className="h-4 w-4" />}
                  onClick={() => setIsHistoryOpen((value) => !value)}
                  className={cn(
                    "border border-border bg-muted/50 text-foreground hover:bg-muted",
                    isHistoryOpen && "bg-muted"
                  )}
                >
                  <span className="hidden sm:inline">{isHistoryOpen ? "Caja" : "Historial"}</span>
                </GhostButton>

                <DangerButton
                  size="sm"
                  leftIcon={<LogOut className="h-4 w-4" />}
                  onClick={() => setIsCloseModalOpen(true)}
                >
                  <span className="hidden sm:inline">Cerrar</span>
                </DangerButton>
              </>
            ) : (
              <PrimaryButton
                size="default"
                leftIcon={<LogIn className="h-4 w-4" />}
                onClick={() => setIsOpenModalOpen(true)}
              >
                Abrir Caja
              </PrimaryButton>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CashHistoryTab cashRegisterId={cashRegister.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <OpenCashModal
        open={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        cashRegisterId={cashRegister.id}
        type={type}
      />

      {initialSession && (
        <>
          <CloseCashModal
            open={isCloseModalOpen}
            onClose={() => setIsCloseModalOpen(false)}
            session={initialSession}
          />
          <IncomeModal
            open={isIncomeModalOpen}
            onClose={() => setIsIncomeModalOpen(false)}
            sessionId={initialSession.id}
            sessionArea={initialSession.area || type}
          />
        </>
      )}
    </>
  );
}
