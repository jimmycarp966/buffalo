export const DEFAULT_PRINT_BRIDGE_PORT = 3001;
// Sin túnel por defecto: si no se configura un host de PC puente en Configuración,
// el sistema imprime por el diálogo de impresión del navegador (Windows print).
export const DEFAULT_PRINT_BRIDGE_HOST = "";

export type PrintBridgeConfigInput = {
  enabled?: boolean | null;
  host?: string | null;
  port?: number | null;
  fallbackHost?: string | null;
};

function normalizeHost(host?: string | null) {
  return host?.trim().replace(/\/+$/, "") || "";
}

export function buildPrintBridgeBaseUrl(
  input: PrintBridgeConfigInput
): string | null {
  if (!input.enabled) {
    return null;
  }

  const explicitHost = normalizeHost(input.host);
  const fallbackHost = normalizeHost(
    input.fallbackHost || DEFAULT_PRINT_BRIDGE_HOST
  );
  const resolvedHost = explicitHost || fallbackHost;

  if (!resolvedHost) {
    return null;
  }

  if (/^https?:\/\//i.test(resolvedHost)) {
    return resolvedHost;
  }

  const port = input.port || DEFAULT_PRINT_BRIDGE_PORT;
  return `http://${resolvedHost}:${port}`;
}
