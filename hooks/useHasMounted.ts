import { useState, useEffect } from "react";

/**
 * Hook para detectar si el componente se ha montado en el cliente.
 * Útil para evitar errores de hidratación al renderizar contenido 
 * que depende de APIs del navegador o estados persistidos.
 */
export function useHasMounted() {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    return hasMounted;
}
