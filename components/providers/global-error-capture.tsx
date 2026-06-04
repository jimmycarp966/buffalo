"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Provider que inicializa la captura global de errores
 * Debe ser incluido en el layout principal de la app
 */
export function GlobalErrorCapture({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Inicializar captura global de errores
        logger.initGlobalErrorCapture();
    }, []);

    return <>{children}</>;
}
