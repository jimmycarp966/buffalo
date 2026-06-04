"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { importProductsFromPDF } from "@/actions/productActions";
import { useRouter } from "next/navigation";

interface ImportPDFModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportPDFModal({ open, onClose }: ImportPDFModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: {
      imported: number;
      skipped: number;
      total: number;
    };
  } | null>(null);

  const router = useRouter();

  const handleImport = async () => {
    setIsImporting(true);
    setResult(null);

    try {
      const response = await importProductsFromPDF();
      setResult(response);

      if (response.success) {
        // Refrescar la página después de 2 segundos para mostrar los nuevos productos
        setTimeout(() => {
          router.refresh();
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Error inesperado durante la importación"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Productos desde PDF
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Se importarán los códigos y nombres de productos desde el archivo ARTICULOS.pdf.
            Los valores de costo, precio y stock se establecerán en 0 para que puedas ajustarlos manualmente.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                El archivo ARTICULOS.pdf debe estar ubicado en la raíz del proyecto.
                Solo se importarán productos que no existan ya en el sistema.
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.message}
                {result.data && (
                  <div className="mt-2 text-sm">
                    <p>Total productos en PDF: {result.data.total}</p>
                    <p>Productos importados: {result.data.imported}</p>
                    <p>Productos omitidos (ya existían): {result.data.skipped}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>

          {!result && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Importar Productos
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
