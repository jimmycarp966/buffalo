"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { brandFullName } from "@/lib/brand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReloadOnControllerChange = useRef(false);

  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  }, []);

  const handleAppInstalled = useCallback(() => {
    console.log("PWA instalada exitosamente");
    setIsInstalled(true);
    setShowInstallBanner(false);
    setDeferredPrompt(null);
  }, []);

  const checkAndShowBanner = useCallback(() => {
    if (deferredPrompt && !isInstalled && isMobile) {
      setShowInstallBanner(true);
    } else {
      setShowInstallBanner(false);
    }
  }, [deferredPrompt, isInstalled, isMobile]);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobile = window.matchMedia("(max-width: 767px)").matches || navigator.maxTouchPoints > 0;
      setIsMobile(mobile);
    };
    const handleControllerChange = () => {
      if (!shouldReloadOnControllerChange.current) return;
      shouldReloadOnControllerChange.current = false;
      window.location.reload();
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registrado:", registration.scope);

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  if (confirm("Hay una actualizacion disponible. Queres recargar la pagina?")) {
                    shouldReloadOnControllerChange.current = true;
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("Error al registrar Service Worker:", error);
        });
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      console.log("App ejecutandose como PWA instalada");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("resize", checkIsMobile);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [handleAppInstalled, handleBeforeInstallPrompt]);

  useEffect(() => {
    checkAndShowBanner();
  }, [checkAndShowBanner]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("Usuario acepto instalar la PWA");
    } else {
      console.log("Usuario rechazo instalar la PWA");
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!showInstallBanner || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 md:left-auto md:right-4 md:w-96">
      <div className="overflow-hidden rounded-[28px] border border-primary/35 brand-panel p-4 shadow-[0_18px_60px_rgba(0,0,0,0.15)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-2xl shadow-[0_0_24px_rgba(168, 52, 28,0.2)]">
            <span aria-hidden="true">P</span>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/70">
              {brandFullName}
            </p>
            <h3 className="mb-1 font-display text-2xl text-foreground">Instala la app</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Lleva caja, cocina y pedidos en una sola app con acceso rapido y modo offline.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleInstallClick}
                className="flex-1 rounded-full bg-primary text-primary-foreground shadow-[0_0_28px_rgba(168, 52, 28,0.24)] hover:bg-primary/90"
              >
                <Download className="mr-2 h-4 w-4" />
                Instalar
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowInstallBanner(false)}
                className="rounded-full border border-border text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
