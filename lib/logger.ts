/**
 * Sistema de Logging centralizado para el POS
 * 
 * En desarrollo: muestra en consola con colores
 * En producción: envía a sistema de monitoreo
 */

export type LogLevel = "info" | "warn" | "error" | "debug" | "success";

export interface LogContext {
  userId?: string;
  userName?: string;
  action?: string;
  module?: string;
  metadata?: Record<string, any>;
  sessionId?: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private globalErrorsInitialized = false;

  /**
   * Inicializar captura global de errores
   * IMPORTANTE: Llamar esto en el layout principal de la app
   */
  initGlobalErrorCapture() {
    if (typeof window === "undefined" || this.globalErrorsInitialized) {
      return;
    }

    this.globalErrorsInitialized = true;

    // Capturar errores de JavaScript no manejados
    window.onerror = (message, source, lineno, colno, error) => {
      this.error(`[JS Error] ${message}`, {
        module: "global",
        metadata: {
          source,
          lineno,
          colno,
          stack: error?.stack,
          type: "uncaught_error"
        }
      });
      return false; // Permitir que el error siga hacia la consola
    };

    // Capturar promesas rechazadas no manejadas
    window.onunhandledrejection = (event) => {
      const reason = event.reason;
      this.error(`[Unhandled Promise] ${reason?.message || reason}`, {
        module: "global",
        metadata: {
          stack: reason?.stack,
          type: "unhandled_rejection"
        }
      });
    };

    // Capturar errores de recursos (imágenes, scripts, etc.)
    window.addEventListener("error", (event) => {
      if (event.target && (event.target as HTMLElement).tagName) {
        const target = event.target as HTMLElement;
        this.warn(`[Resource Error] Failed to load: ${(target as any).src || (target as any).href}`, {
          module: "resources",
          metadata: {
            tagName: target.tagName,
            type: "resource_error"
          }
        });
      }
    }, true);

    console.log("✅ [Logger] Captura global de errores inicializada");
  }

  /**
   * Método principal de logging
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    // En desarrollo: console con colores
    if (this.isDevelopment) {
      this.logToConsole(logEntry);
    }

    // SIEMPRE guardar en storage para el Monitor del Sistema
    this.logToMonitoring(logEntry);

    // Siempre guardar errores críticos en localStorage (más persistente)
    if (level === "error") {
      this.saveErrorLog(logEntry);
    }
  }

  /**
   * Logging a consola con colores
   */
  private logToConsole(entry: LogEntry) {
    const colors = {
      info: "\x1b[36m",    // Cyan
      warn: "\x1b[33m",    // Yellow
      error: "\x1b[31m",   // Red
      debug: "\x1b[90m",   // Gray
      success: "\x1b[32m", // Green
    };

    const icons = {
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
      success: "✅",
    };

    const reset = "\x1b[0m";
    const color = colors[entry.level];
    const icon = icons[entry.level];

    console.log(
      `${color}${icon} [${entry.level.toUpperCase()}]${reset} ${entry.message}`,
      entry.context || ""
    );
  }

  /**
   * Enviar a sistema de monitoreo (Sentry, LogRocket, etc.)
   */
  private logToMonitoring(entry: LogEntry) {
    // Aquí se integraría con Sentry u otro servicio
    // Por ahora solo guardamos en sessionStorage para debugging
    try {
      if (typeof window !== "undefined") {
        const logs = JSON.parse(sessionStorage.getItem("app_logs") || "[]");
        logs.push(entry);

        // Mantener solo los últimos 100 logs
        if (logs.length > 100) {
          logs.shift();
        }

        sessionStorage.setItem("app_logs", JSON.stringify(logs));
      }
    } catch (error) {
      // Ignorar errores de storage
    }
  }

  /**
   * Guardar errores críticos localmente
   */
  private saveErrorLog(entry: LogEntry) {
    try {
      if (typeof window !== "undefined") {
        const errors = JSON.parse(localStorage.getItem("error_logs") || "[]");
        errors.push({
          ...entry,
          userAgent: navigator.userAgent,
          url: window.location.href,
        });

        // Mantener solo los últimos 50 errores
        if (errors.length > 50) {
          errors.shift();
        }

        localStorage.setItem("error_logs", JSON.stringify(errors));
      }
    } catch (error) {
      // Ignorar errores de storage
    }
  }

  /**
   * Log nivel INFO - Información general
   */
  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  /**
   * Log nivel SUCCESS - Operaciones exitosas
   */
  success(message: string, context?: LogContext) {
    this.log("success", message, context);
  }

  /**
   * Log nivel WARN - Advertencias
   */
  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  /**
   * Log nivel ERROR - Errores
   */
  error(message: string, context?: LogContext) {
    this.log("error", message, context);
  }

  /**
   * Log nivel DEBUG - Debugging
   */
  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  /**
   * Log de inicio de sesión
   */
  logLogin(userId: string, userName: string) {
    this.success("Usuario inició sesión", {
      userId,
      userName,
      action: "LOGIN",
      module: "auth",
    });
  }

  /**
   * Log de cierre de sesión
   */
  logLogout(userId: string, userName: string) {
    this.info("Usuario cerró sesión", {
      userId,
      userName,
      action: "LOGOUT",
      module: "auth",
    });
  }

  /**
   * Log de venta creada
   */
  logSale(saleId: string, amount: number, userId: string) {
    this.success("Venta creada", {
      userId,
      action: "CREATE_SALE",
      module: "sales",
      metadata: { saleId, amount },
    });
  }

  /**
   * Log de apertura de caja
   */
  logCashOpen(sessionId: string, amount: number, userId: string) {
    this.success("Caja abierta", {
      userId,
      action: "OPEN_CASH",
      module: "cash",
      metadata: { sessionId, amount },
    });
  }

  /**
   * Log de cierre de caja
   */
  logCashClose(sessionId: string, difference: number, userId: string) {
    this.success("Caja cerrada", {
      userId,
      action: "CLOSE_CASH",
      module: "cash",
      metadata: { sessionId, difference },
    });
  }

  /**
   * Obtener logs guardados (para debugging)
   */
  getLogs(): LogEntry[] {
    try {
      if (typeof window !== "undefined") {
        return JSON.parse(sessionStorage.getItem("app_logs") || "[]");
      }
    } catch (error) {
      // Ignorar
    }
    return [];
  }

  /**
   * Obtener errores guardados
   */
  getErrors(): any[] {
    try {
      if (typeof window !== "undefined") {
        return JSON.parse(localStorage.getItem("error_logs") || "[]");
      }
    } catch (error) {
      // Ignorar
    }
    return [];
  }

  /**
   * Limpiar logs
   */
  clearLogs() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("app_logs");
      localStorage.removeItem("error_logs");
      this.info("Logs limpiados");
    }
  }
}

// Instancia única del logger
export const logger = new Logger();

// Export default para facilitar importación
export default logger;


