"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, ExternalLink } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

export function QRGenerator() {
  const [menuUrl, setMenuUrl] = useState("");
  const [qrSize, setQrSize] = useState(300);
  const [isGenerating, setIsGenerating] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Obtener URL actual del menu
  const getMenuUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/menu`;
    }
    return "";
  };

  // Generar QR usando Canvas API (sin librerias externas)
  const generateQR = async () => {
    setIsGenerating(true);
    const url = menuUrl || getMenuUrl();
    
    try {
      // Usar API publica de QR Code generator
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(url)}`;
      
      // Crear imagen y dibujar en canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        const canvas = qrCanvasRef.current;
        if (canvas) {
          canvas.width = qrSize;
          canvas.height = qrSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, qrSize, qrSize);
          }
        }
        setIsGenerating(false);
        addNotification("success", "Codigo QR generado exitosamente");
      };

      img.onerror = () => {
        setIsGenerating(false);
        addNotification("error", "Error al generar codigo QR");
      };

      img.src = qrApiUrl;
    } catch (error) {
      console.error("Error generating QR:", error);
      setIsGenerating(false);
      addNotification("error", "Error al generar codigo QR");
    }
  };

  // Descargar QR como imagen PNG
  const downloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = 'buffalo-menu-qr.png';
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          addNotification("success", "Codigo QR descargado");
        }
      });
    } else {
      addNotification("error", "Primero genera el codigo QR");
    }
  };

  // Abrir menu en nueva pestana
  const openMenu = () => {
    const url = menuUrl || getMenuUrl();
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-6 w-6 text-buffalo-caramel" />
          Generador de QR para Carta Digital
        </CardTitle>
        <CardDescription>
          Crea codigos QR para que tus clientes accedan al menu digital desde sus celulares
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL del menu */}
        <div className="space-y-2">
          <Label htmlFor="menu-url">URL del Menu</Label>
          <div className="flex gap-2">
            <Input
              id="menu-url"
              type="url"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              placeholder={getMenuUrl()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={openMenu}
              title="Abrir menu en nueva pestana"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Si dejas vacio, se usara la URL actual del menu
          </p>
        </div>

        {/* Tamano del QR */}
        <div className="space-y-2">
          <Label htmlFor="qr-size">Tamano del QR (pixeles)</Label>
          <div className="flex items-center gap-4">
            <Input
              id="qr-size"
              type="number"
              min="200"
              max="1000"
              step="50"
              value={qrSize}
              onChange={(e) => setQrSize(parseInt(e.target.value) || 300)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">
              {qrSize}x{qrSize}px
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Recomendado: 300px para imprimir en A4, 500px para carteles grandes
          </p>
        </div>

        {/* Botones de accion */}
        <div className="flex gap-2">
          <Button
            onClick={generateQR}
            disabled={isGenerating}
            className="flex-1 bg-buffalo-caramel hover:bg-buffalo-caramel/90 text-buffalo-espresso font-bold"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {isGenerating ? "Generando..." : "Generar Codigo QR"}
          </Button>
          <Button
            onClick={downloadQR}
            variant="outline"
            className="border-buffalo-caramel text-buffalo-caramel hover:bg-buffalo-caramel/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </div>

        {/* Canvas para mostrar el QR */}
        <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-dashed border-slate-300">
          <canvas
            ref={qrCanvasRef}
            className="max-w-full h-auto"
            style={{ display: qrCanvasRef.current ? 'block' : 'none' }}
          />
          {!qrCanvasRef.current && (
            <div className="text-center text-slate-400 py-12">
              <QrCode className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm">
                El código QR aparecerá aquí después de generarlo
              </p>
            </div>
          )}
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">
            Como usar el codigo QR
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Imprimi el codigo QR en tamaño A4 o mas grande</li>
            <li>• Colocalo en cada mesa o en la entrada del bar</li>
            <li>• Los clientes lo escanean con la camara de su celular</li>
            <li>• Se abrira automaticamente el menu digital en su navegador</li>
            <li>• No necesitan instalar ninguna app</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}



