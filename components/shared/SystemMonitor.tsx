"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { Activity, AlertTriangle, Info, Trash2, Download } from "lucide-react";

/**
 * Monitor del Sistema - Muestra logs y errores en tiempo real
 * Solo visible para admins
 */
interface Log {
  level: string;
  message: string;
  timestamp: string;
  context?: {
    module?: string;
    userName?: string;
    metadata?: any;
  };
}

interface AppError {
  message: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  context?: any;
}

export function SystemMonitor() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const interval = setInterval(loadLogs, 5000); // Actualizar cada 5 segundos
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadLogs = () => {
    setLogs(logger.getLogs());
    setErrors(logger.getErrors());
  };

  const handleClearLogs = () => {
    if (confirm("¿Estás seguro de limpiar todos los logs?")) {
      logger.clearLogs();
      loadLogs();
    }
  };

  const handleExportLogs = () => {
    const data = {
      logs,
      errors,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        <Activity className="h-4 w-4 mr-2" />
        Monitor
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Activity className="h-6 w-6 text-buffalo-caramel" />
              Monitor del Sistema
            </CardTitle>
            <CardDescription>
              Logs y errores en tiempo real
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportLogs}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              onClick={handleClearLogs}
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              variant="default"
              size="sm"
            >
              Cerrar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          <Tabs defaultValue="logs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logs">
                <Info className="h-4 w-4 mr-2" />
                Logs ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="errors">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Errores ({errors.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="space-y-2 max-h-[500px] overflow-auto">
              {logs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay logs registrados
                </p>
              ) : (
                logs.reverse().map((log, index) => (
                  <LogEntry key={index} log={log} />
                ))
              )}
            </TabsContent>

            <TabsContent value="errors" className="space-y-2 max-h-[500px] overflow-auto">
              {errors.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  ✅ No hay errores registrados
                </p>
              ) : (
                errors.reverse().map((error, index) => (
                  <ErrorEntry key={index} error={error} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Componente individual de log
 */
function LogEntry({ log }: { log: Log }) {
  const levelColors = {
    info: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    warn: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    debug: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={levelColors[log.level as keyof typeof levelColors]}>
              {log.level}
            </Badge>
            <span className="text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleString("es-AR")}
            </span>
            {log.context?.module && (
              <Badge variant="outline" className="text-xs">
                {log.context.module}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium">{log.message}</p>
          {log.context?.userName && (
            <p className="text-xs text-gray-600 mt-1">
              👤 {log.context.userName}
            </p>
          )}
          {log.context?.metadata && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">
                Ver detalles
              </summary>
              <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(log.context.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente individual de error
 */
function ErrorEntry({ error }: { error: AppError }) {
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-red-600 text-white">ERROR</Badge>
            <span className="text-xs text-gray-500">
              {new Date(error.timestamp).toLocaleString("es-AR")}
            </span>
          </div>
          <p className="text-sm font-medium text-red-900">{error.message}</p>
          {error.context?.userName && (
            <p className="text-xs text-gray-600 mt-1">
              👤 {error.context.userName}
            </p>
          )}
          {error.url && (
            <p className="text-xs text-gray-600 mt-1">
              🔗 {error.url}
            </p>
          )}
          <details className="mt-2">
            <summary className="text-xs text-gray-700 cursor-pointer font-medium">
              Ver detalles técnicos
            </summary>
            <div className="mt-2 space-y-2">
              {error.context && (
                <pre className="text-xs bg-white p-2 rounded overflow-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              )}
              {error.userAgent && (
                <p className="text-xs text-gray-600">
                  <strong>Navegador:</strong> {error.userAgent}
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}


