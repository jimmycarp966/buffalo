"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrinterSettings, updatePrinterSettings } from "@/actions/configActions";
import { useNotificationStore } from "@/store/notificationStore";
import { Printer, Save, HelpCircle } from "lucide-react";

export function PrinterConfigPanel() {
  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [cashierPrinter, setCashierPrinter] = useState("");
  const [localPrintServerEnabled, setLocalPrintServerEnabled] = useState(false);
  const [localPrintServerHost, setLocalPrintServerHost] = useState("");
  const [localPrintServerPort, setLocalPrintServerPort] = useState("3001");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const result = await getPrinterSettings();
      if (result.success && result.data) {
        setKitchenPrinter(result.data.kitchen_printer_name || "");
        setCashierPrinter(result.data.cashier_printer_name || "");
        setLocalPrintServerEnabled(Boolean(result.data.local_print_server_enabled));
        setLocalPrintServerHost(result.data.local_print_server_host || "");
        setLocalPrintServerPort(result.data.local_print_server_port || "3001");
      } else {
        // Si hay error al cargar, mostrar notificación pero permitir configurar
        console.warn("No se pudieron cargar las configuraciones existentes. Se usarán valores vacíos.");
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      // No mostrar error, permitir configurar de todos modos
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log('💾 Guardando configuración de impresoras:', {
        cocina: kitchenPrinter,
        cajero: cashierPrinter,
        servidorLocal: {
          enabled: localPrintServerEnabled,
          host: localPrintServerHost,
          port: localPrintServerPort,
        }
      });
      
      const result = await updatePrinterSettings(
        kitchenPrinter,
        cashierPrinter,
        localPrintServerEnabled,
        localPrintServerHost,
        localPrintServerPort,
      );
      
      console.log('📊 Resultado de guardar:', result);
      
      if (result.success) {
        addNotification("success", "Configuración de impresoras guardada correctamente");
      } else {
        console.error('❌ Error del servidor:', result.message);
        addNotification("error", result.message || "Error al guardar configuración");
      }
    } catch (error) {
      console.error('❌ Error inesperado al guardar:', error);
      addNotification("error", "Error inesperado al guardar configuración");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPrinterSettings = () => {
    // Abrir configuración de impresoras de Windows
    if (typeof window !== 'undefined') {
      window.open('ms-settings:printers', '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Cargando configuración...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          <CardTitle>Configuración de Impresoras</CardTitle>
        </div>
        <CardDescription>
          Configurá las impresoras que se usarán automáticamente para cada tipo de ticket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900">¿Cómo obtener el nombre de la impresora?</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Presioná Win + R</li>
                <li>Escribí: <code className="bg-blue-100 px-1 rounded">control printers</code></li>
                <li>Copiá el nombre exacto de la impresora (ejemplo: "Gadnic IMP30")</li>
                <li>Pegá el nombre en el campo correspondiente</li>
              </ol>
              <p className="text-blue-800">
                Si queres imprimir desde celulares, carga abajo la IP de la PC del bar que tiene la impresora por USB.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPrinterSettings}
                className="mt-2"
              >
                Abrir configuración de impresoras
              </Button>
            </div>
          </div>
        </div>

        {/* Impresora de Cocina */}
        <div className="space-y-2">
          <Label htmlFor="kitchen-printer">
            🍳 Impresora de Cocina (Pedidos del Bar)
          </Label>
          <Input
            id="kitchen-printer"
            value={kitchenPrinter}
            onChange={(e) => setKitchenPrinter(e.target.value)}
            placeholder="Ejemplo: Gadnic IMP30"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Esta impresora se usará automáticamente para imprimir los pedidos que van a cocina
          </p>
        </div>

        {/* Impresora del Cajero */}
        <div className="space-y-2">
          <Label htmlFor="cashier-printer">
            🧾 Impresora del Cajero (Tickets de Venta)
          </Label>
          <Input
            id="cashier-printer"
            value={cashierPrinter}
            onChange={(e) => setCashierPrinter(e.target.value)}
            placeholder="Ejemplo: HP LaserJet o Epson TM-T20"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Esta impresora se usará automáticamente para imprimir los tickets de venta al cliente
          </p>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="local-print-server-enabled">PC puente del bar</Label>
            <div className="flex items-center gap-2">
              <input
                id="local-print-server-enabled"
                type="checkbox"
                checked={localPrintServerEnabled}
                onChange={(e) => setLocalPrintServerEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="local-print-server-enabled" className="cursor-pointer font-normal">
                Usar una PC fija del bar para imprimir desde celulares
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Activalo si la impresora esta conectada por USB a una computadora del local.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-print-server-host">IP, nombre o URL del puente</Label>
            <Input
              id="local-print-server-host"
              value={localPrintServerHost}
              onChange={(e) => setLocalPrintServerHost(e.target.value)}
              placeholder="Ejemplo: 192.168.0.50 o https://mi-puente..."
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Usa la IP local de la PC del bar o una URL HTTPS del puente si lo exponés con túnel.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-print-server-port">Puerto del PrintServer</Label>
            <Input
              id="local-print-server-port"
              value={localPrintServerPort}
              onChange={(e) => setLocalPrintServerPort(e.target.value)}
              placeholder="3001"
              className="font-mono"
            />
          </div>
        </div>

        {/* Nota importante */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900">
            <strong>Nota:</strong> Si dejás los campos vacíos, el sistema abrirá el diálogo de impresión normal donde tendrás que seleccionar la impresora manualmente cada vez.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            onClick={loadSettings}
            variant="outline"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

