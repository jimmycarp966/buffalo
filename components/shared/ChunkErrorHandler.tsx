"use client";

import { useEffect } from "react";

const APP_STORAGE_PREFIXES = ["buffalo_"];

function isChunkRelatedError(message?: string, name?: string) {
  const value = `${name || ""} ${message || ""}`.toLowerCase();
  return (
    value.includes("chunkloaderror") ||
    value.includes("loading chunk") ||
    value.includes("failed to fetch dynamically imported module") ||
    value.includes("loading css chunk") ||
    value.includes("build manifest")
  );
}

function clearAppStorage() {
  for (const key of Object.keys(localStorage)) {
    if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }

  for (const key of Object.keys(sessionStorage)) {
    if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      sessionStorage.removeItem(key);
    }
  }
}

async function clearServiceWorkerCache() {
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  const channel = new MessageChannel();
  await new Promise<void>((resolve) => {
    channel.port1.onmessage = () => resolve();
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHE" }, [channel.port2]);
    setTimeout(resolve, 1500);
  });
}

export function ChunkErrorHandler() {
  useEffect(() => {
    const recoverFromChunkError = async () => {
      console.warn("Detectado un error de versionado. Limpiando cache de la app...");
      clearAppStorage();
      await clearServiceWorkerCache();
      window.location.reload();
    };

    const handleChunkError = (event: ErrorEvent) => {
      if (!isChunkRelatedError(event.message, event.error?.name)) {
        return;
      }

      event.preventDefault();
      void recoverFromChunkError();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkRelatedError(event.reason?.message, event.reason?.name)) {
        return;
      }

      event.preventDefault();
      void recoverFromChunkError();
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
