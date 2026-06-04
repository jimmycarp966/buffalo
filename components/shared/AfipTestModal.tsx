"use client";

import { useState } from "react";
import { testAfipConnection } from "@/actions/invoiceActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Activity } from "lucide-react";
import { toast } from "sonner";

interface AfipTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function AfipTestModal({ open, onClose }: AfipTestModalProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const testResult = await testAfipConnection();
      setResult(testResult);

      if (testResult.success) {
        toast.success("Test exitoso: Conexión con AFIP OK");
      } else {
        toast.error(testResult.message || "Error en el test de conexión");
      }
    } catch (error: any) {
      toast.error(error.message || "Error al ejecutar test");
      setResult({
        success: false,
        message: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Test de Conexión AFIP
          </DialogTitle>
          <DialogDescription>
            Verifica la configuración y conectividad con AFIP sin generar facturas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botón de test */}
          {!result && (
            <div className="flex justify-center py-8">
              <Button
                onClick={handleTest}
                disabled={testing}
                size="lg"
                className="min-w-[200px]"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Probando conexión...
                  </>
                ) : (
                  <>
                    <Activity className="mr-2 h-5 w-5" />
                    Ejecutar Test
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Resultados */}
          {result && (
            <div className="space-y-4">
              {/* Estado general */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {result.success ? "✅ Conexión Exitosa" : "❌ Error de Conexión"}
                    </p>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                  </div>
                </div>
                <Badge variant={result.success ? "success" : "destructive"}>
                  {result.success ? "OK" : "ERROR"}
                </Badge>
              </div>

              {/* Detalles de configuración */}
              {result.data && (
                <div className="space-y-3 border rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Configuración Detectada
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">CUIT</p>
                      <p className="font-mono font-semibold">{result.data.cuit}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Punto de Venta</p>
                      <p className="font-mono font-semibold">
                        {String(result.data.pointOfSale).padStart(4, '0')}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Ambiente</p>
                      <Badge variant={result.data.environment === 'production' ? 'default' : 'secondary'}>
                        {result.data.environment === 'production' ? 'Producción' : 'Testing'}
                      </Badge>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Servidor AFIP</p>
                      <Badge variant={result.data.serverStatus === 'OK' ? 'success' : 'secondary'}>
                        {result.data.serverStatus}
                      </Badge>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Último N° Factura</p>
                      <p className="font-mono font-semibold">
                        {String(result.data.pointOfSale).padStart(4, '0')}-
                        {String(result.data.lastInvoiceNumber).padStart(8, '0')}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Certificado</p>
                      <Badge variant={result.data.certificateValid ? 'success' : 'destructive'}>
                        {result.data.certificateValid ? 'Válido' : 'Inválido'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Próxima factura:</strong> {String(result.data.pointOfSale).padStart(4, '0')}-
                      {String(result.data.lastInvoiceNumber + 1).padStart(8, '0')}
                    </p>
                  </div>
                </div>
              )}

              {/* Errores */}
              {result.errors && result.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-sm text-red-900 mb-2">
                    Errores Encontrados
                  </h3>
                  <ul className="space-y-1">
                    {result.errors.map((error: string, index: number) => (
                      <li key={index} className="text-sm text-red-800 flex items-start gap-2">
                        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setResult(null)}>
                  Ejecutar de Nuevo
                </Button>
                <Button onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

