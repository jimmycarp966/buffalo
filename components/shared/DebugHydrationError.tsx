"use client";

import { useEffect, useState } from "react";

export function DebugHydrationError({ 
  componentName, 
  showDetails = false 
}: { 
  componentName: string;
  showDetails?: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    console.log(`✅ ${componentName} montado correctamente en cliente`);
    
    // Detectar hydration errors más específicamente
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes("418") || event.message.includes("Hydration")) {
        const errorMsg = `❌ HYDRATION ERROR detectado cerca de: ${componentName}`;
        console.error(errorMsg);
        console.error("Stack completo:", event.error);
        setHydrationError(errorMsg);
      }
    };

    // También capturar errores de console.error
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('418') || message.includes('Hydration')) {
        const errorMsg = `🚨 [HYDRATION ERROR] ${componentName}: ${message}`;
        console.log(errorMsg);
        setHydrationError(errorMsg);
      }
      originalError.apply(console, args);
    };

    window.addEventListener("error", handleError);
    
    return () => {
      window.removeEventListener("error", handleError);
      console.error = originalError;
    };
  }, [componentName]);

  if (!isMounted) {
    return (
      <div className="text-xs text-gray-400 bg-gray-100 p-1 rounded">
        🔄 {componentName} - Cargando...
      </div>
    );
  }

  return (
    <div className="text-xs text-green-600 bg-green-50 p-1 rounded border border-green-200">
      ✅ {componentName} montado correctamente en cliente
      {hydrationError && (
        <div className="text-red-600 bg-red-50 p-1 mt-1 rounded border border-red-200">
          🚨 {hydrationError}
        </div>
      )}
      {showDetails && (
        <div className="text-xs text-gray-500 mt-1">
          Timestamp: {new Date().toISOString()}
        </div>
      )}
    </div>
  );
}

