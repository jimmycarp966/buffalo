"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

// Importar BarWithSaleView sin SSR para evitar hydration errors
const BarWithSaleView = dynamic(
  () => import("./BarWithSaleView").then((mod) => ({ default: mod.BarWithSaleView })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[600px] bg-muted/30 rounded-lg">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Cargando mapa del bar...</p>
        </div>
      </div>
    )
  }
);

interface BarCanvasViewWrapperProps {
  cashRegister: any;
  initialSession: any;
}

export function BarCanvasViewWrapper({ cashRegister, initialSession }: BarCanvasViewWrapperProps) {
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log("🔍 [DEBUG] BarCanvasViewWrapper mounting...");
    // Verificar que estamos en el cliente
    setIsClient(true);
    console.log("🔍 [DEBUG] BarCanvasViewWrapper client state set to true");
    
    // Verificar localStorage
    try {
      if (typeof window !== 'undefined') {
        // Test de localStorage
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
      }
    } catch (error) {
      console.error('Error con localStorage:', error);
      setHasError(true);
    }
  }, []);

  const handleClearCache = () => {
    try {
      if (typeof window !== 'undefined') {
        // Limpiar todo el localStorage relacionado con la app
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.error(`Error removing ${key}:`, e);
          }
        });
        
        // Recargar la página
        window.location.reload();
      }
    } catch (error) {
      console.error('Error limpiando caché:', error);
      alert('Error al limpiar el caché. Por favor, intenta en modo incógnito o limpia el caché del navegador manualmente.');
    }
  };

  if (hasError) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
          <h3 className="text-xl font-semibold">Error al cargar el mapa del bar</h3>
          <p className="text-muted-foreground">
            Hay un problema con el almacenamiento del navegador. 
            <br />
            Esto puede ocurrir por datos corruptos en el caché.
          </p>
          <div className="space-y-2">
            <Button onClick={handleClearCache} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpiar Caché y Recargar
            </Button>
            <p className="text-sm text-muted-foreground">
              O intenta usar el modo incógnito del navegador
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Solo renderizar el mapa cuando estamos en el cliente
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-muted/30 rounded-lg">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Inicializando mapa del bar...</p>
        </div>
      </div>
    );
  }

  console.log("🔍 [DEBUG] BarCanvasViewWrapper rendering BarWithSaleView");
  try {
    return <BarWithSaleView cashRegister={cashRegister} initialSession={initialSession} />;
  } catch (error) {
    console.error("🔍 [DEBUG] Error rendering BarWithSaleView:", error);
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
          <h3 className="text-xl font-semibold">Error al cargar el mapa del bar</h3>
          <p className="text-muted-foreground">
            Error: {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      </Card>
    );
  }
}

