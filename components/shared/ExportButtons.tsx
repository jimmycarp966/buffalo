"use client";

import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download, Loader2 } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { useNotificationStore } from "@/store/notificationStore";
import { useState } from "react";

interface ExportButtonsProps {
  data: any;
  filename: string;
}

export function ExportButtons({ data, filename }: ExportButtonsProps) {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const result = await exportToExcel(data, filename);
      if (result.success) {
        addNotification("success", "Reporte exportado a Excel exitosamente");
      } else {
        addNotification("error", result.message || "Error al exportar a Excel");
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      addNotification("error", "Error al exportar a Excel");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const result = await exportToPDF(data, filename);
      if (result.success) {
        addNotification("success", "Reporte exportado a PDF exitosamente");
      } else {
        addNotification("error", result.message || "Error al exportar a PDF");
      }
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      addNotification("error", "Error al exportar a PDF");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        onClick={handleExportExcel} 
        className="gap-2"
        disabled={isExportingExcel || isExportingPDF}
      >
        {isExportingExcel ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {isExportingExcel ? "Exportando..." : "Excel Completo"}
      </Button>
      <Button 
        variant="outline" 
        onClick={handleExportPDF} 
        className="gap-2"
        disabled={isExportingExcel || isExportingPDF}
      >
        {isExportingPDF ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {isExportingPDF ? "Exportando..." : "PDF Profesional"}
      </Button>
    </div>
  );
}

