import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { brand } from "./brand";

// Extender jsPDF con autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

/**
 * Exporta reportes completos a Excel con múltiples hojas
 */
export function exportToExcel(data: any, filename: string) {
  try {
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Resumen General
    if (data.stats) {
      const summaryData = [
        { Concepto: "Ventas Totales", Valor: formatCurrency(parseFloat(data.stats.total_sales || "0")) },
        { Concepto: "Transacciones", Valor: data.stats.total_transactions || 0 },
        { Concepto: "Ticket Promedio", Valor: formatCurrency(parseFloat(data.stats.average_ticket || "0")) },
        { Concepto: "", Valor: "" },
        { Concepto: "INGRESOS VS GASTOS", Valor: "" },
        { Concepto: "Ingresos", Valor: formatCurrency(parseFloat(data.incomeExpenses?.total_income || "0")) },
        { Concepto: "Gastos", Valor: formatCurrency(parseFloat(data.incomeExpenses?.total_expenses || "0")) },
        { Concepto: "Margen Neto", Valor: formatCurrency(parseFloat(data.incomeExpenses?.net_profit || "0")) }
      ];
      
      const ws1 = XLSX.utils.json_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Resumen");
    }

    // Hoja 2: Top Productos
    if (data.topProducts && data.topProducts.length > 0) {
      const productsData = data.topProducts.map((product: any, index: number) => ({
    "Posicion": index + 1,
        "Producto": product.product_name,
        "Cantidad": product.total_quantity,
        "Ingresos": formatCurrency(parseFloat(product.total_revenue || "0")),
        "Precio Promedio": formatCurrency(parseFloat(product.avg_price || "0"))
      }));
      
      const ws2 = XLSX.utils.json_to_sheet(productsData);
      ws2["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Top Productos");
    }

    // Hoja 3: Ventas por Turno
    if (data.salesByShift && data.salesByShift.length > 0) {
      const shiftsData = data.salesByShift.map((shift: any) => ({
        "Turno": shift.shift,
        "Área": shift.area.toUpperCase(),
        "Ventas": formatCurrency(parseFloat(shift.total_sales || "0")),
        "Transacciones": shift.transaction_count,
        "Ticket Promedio": formatCurrency(parseFloat(shift.avg_ticket || "0"))
      }));
      
      const ws3 = XLSX.utils.json_to_sheet(shiftsData);
      ws3["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Ventas por Turno");
    }

    // Hoja 4: Ventas por Empleado
    if (data.salesByEmployee && data.salesByEmployee.length > 0) {
      const employeesData = data.salesByEmployee.map((employee: any) => ({
        "Empleado": employee.employee_name,
        "Ventas": formatCurrency(parseFloat(employee.total_sales || "0")),
        "Transacciones": employee.transaction_count,
        "Ticket Promedio": formatCurrency(parseFloat(employee.avg_ticket || "0")),
        "Áreas": employee.areas_worked.join(", ")
      }));
      
      const ws4 = XLSX.utils.json_to_sheet(employeesData);
      ws4["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Ventas por Empleado");
    }

  // Hoja 5: Metodos de Pago
    if (data.paymentMethods && data.paymentMethods.length > 0) {
      const paymentsData = data.paymentMethods.map((method: any) => ({
    "Metodo": method.payment_method,
        "Monto": formatCurrency(parseFloat(method.total_amount || "0")),
        "Transacciones": method.transaction_count
      }));
      
      const ws5 = XLSX.utils.json_to_sheet(paymentsData);
      ws5["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws5, "Metodos de Pago");
    }

    // Hoja 6: Rentabilidad
    if (data.profitabilityReport && data.profitabilityReport.length > 0) {
      const profitabilityData = data.profitabilityReport.map((product: any) => ({
        "Producto": product.product_name,
        "Unidades Vendidas": product.units_sold,
        "Ingresos": formatCurrency(parseFloat(product.total_revenue || "0")),
        "Costo": formatCurrency(parseFloat(product.total_cost || "0")),
        "Ganancia": formatCurrency(parseFloat(product.gross_profit || "0")),
        "Margen %": `${product.margin_percentage.toFixed(1)}%`
      }));
      
      const ws6 = XLSX.utils.json_to_sheet(profitabilityData);
      ws6["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws6, "Rentabilidad");
    }

    XLSX.writeFile(wb, `${filename}.xlsx`);
    return { success: true };
  } catch (error: any) {
    console.error("Error exporting to Excel:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Exporta reportes completos a PDF profesional
 */
export function exportToPDF(data: any, filename: string) {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    
  // Configuracion de colores Shell
    const shellRed = [220, 38, 38];
    const shellYellow = [252, 211, 77];
    const shellDarkRed = [153, 27, 27];
    
  // Funcion para agregar header
    const addHeader = (title: string, subtitle?: string) => {
      doc.setFillColor(shellRed[0], shellRed[1], shellRed[2]);
      doc.rect(0, 0, 210, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(brand.name.toUpperCase(), 15, 15);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(title, 15, 22);
      
      if (subtitle) {
        doc.setFontSize(10);
        doc.text(subtitle, 15, 27);
      }
      
      // Fecha y hora
      doc.setFontSize(8);
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 150, 15);
    };

    // Funcion para agregar footer
    const addFooter = (pageNumber: number) => {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Pagina ${pageNumber}`, 15, 290);
      doc.text(`Sistema ${brand.name} - Reportes Avanzados`, 138, 290);
    };

    let currentY = 40;
    let pageNumber = 1;

    // Pagina 1: Resumen General
    addHeader('REPORTE DE VENTAS', 'Resumen General del Periodo');
    
    if (data.stats) {
      // KPIs principales
      const kpis = [
        ['Ventas Totales', formatCurrency(parseFloat(data.stats.total_sales || "0"))],
        ['Transacciones', data.stats.total_transactions || 0],
        ['Ticket Promedio', formatCurrency(parseFloat(data.stats.average_ticket || "0"))]
      ];
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores Principales', 15, currentY);
      currentY += 10;
      
      kpis.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${label}:`, 20, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(value, 80, currentY);
        currentY += 6;
      });
    }

    // Ingresos vs Gastos
    if (data.incomeExpenses) {
      currentY += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Analisis Financiero', 15, currentY);
      currentY += 10;
      
      const financial = [
        ['Ingresos', formatCurrency(parseFloat(data.incomeExpenses.total_income || "0"))],
        ['Gastos', formatCurrency(parseFloat(data.incomeExpenses.total_expenses || "0"))],
        ['Margen Neto', formatCurrency(parseFloat(data.incomeExpenses.net_profit || "0"))]
      ];
      
      financial.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${label}:`, 20, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(value, 80, currentY);
        currentY += 6;
      });
    }

    addFooter(pageNumber);
    pageNumber++;

    // Pagina 2: Top Productos
    if (data.topProducts && data.topProducts.length > 0) {
      doc.addPage();
      addHeader('TOP PRODUCTOS MAS VENDIDOS', 'Analisis de Productos');
      
      const productsData = data.topProducts.map((product: any, index: number) => [
        (index + 1).toString(),
        product.product_name?.toString() || "N/A",
        product.total_quantity?.toString() || "0",
        formatCurrency(parseFloat(product.total_revenue || "0")),
        formatCurrency(parseFloat(product.avg_price || "0"))
      ]);
      
      doc.autoTable({
        startY: 40,
        head: [['Pos', 'Producto', 'Cantidad', 'Ingresos', 'Precio Prom.']],
        body: productsData,
        theme: 'grid',
        headStyles: { fillColor: shellRed, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 60 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 }
        }
      });
      
      addFooter(pageNumber);
      pageNumber++;
    }

    // Pagina 3: Ventas por Turno
    if (data.salesByShift && data.salesByShift.length > 0) {
      doc.addPage();
      addHeader('VENTAS POR TURNO', 'Analisis Operativo');
      
      const shiftsData = data.salesByShift.map((shift: any) => [
        (shift.shift?.charAt(0).toUpperCase() + shift.shift?.slice(1)).toString(),
        shift.area?.toUpperCase().toString() || "N/A",
        formatCurrency(parseFloat(shift.total_sales || "0")),
        shift.transaction_count?.toString() || "0",
        formatCurrency(parseFloat(shift.avg_ticket || "0"))
      ]);
      
      doc.autoTable({
        startY: 40,
        head: [['Turno', 'Área', 'Ventas', 'Transacciones', 'Ticket Promedio']],
        body: shiftsData,
        theme: 'grid',
        headStyles: { fillColor: shellRed, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 30 },
          4: { cellWidth: 35 }
        }
      });
      
      addFooter(pageNumber);
      pageNumber++;
    }

    // Pagina 4: Ventas por Empleado
    if (data.salesByEmployee && data.salesByEmployee.length > 0) {
      doc.addPage();
      addHeader('VENTAS POR EMPLEADO', 'Rendimiento Individual');
      
      const employeesData = data.salesByEmployee.map((employee: any) => [
        employee.employee_name?.toString() || "N/A",
        formatCurrency(parseFloat(employee.total_sales || "0")),
        employee.transaction_count?.toString() || "0",
        formatCurrency(parseFloat(employee.avg_ticket || "0")),
        employee.areas_worked?.join(", ").toString() || "N/A"
      ]);
      
      doc.autoTable({
        startY: 40,
        head: [['Empleado', 'Ventas', 'Transacciones', 'Ticket Promedio', 'Áreas']],
        body: employeesData,
        theme: 'grid',
        headStyles: { fillColor: shellRed, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 40 }
        }
      });
      
      addFooter(pageNumber);
      pageNumber++;
    }

    // Pagina 5: Metodos de Pago
    if (data.paymentMethods && data.paymentMethods.length > 0) {
      doc.addPage();
      addHeader('METODOS DE PAGO', 'Distribucion de Pagos');
      
      const paymentsData = data.paymentMethods.map((method: any) => [
        method.payment_method?.toString() || "N/A",
        formatCurrency(parseFloat(method.total_amount || "0")),
        method.transaction_count?.toString() || "0"
      ]);
      
      doc.autoTable({
        startY: 40,
        head: [['Metodo', 'Monto', 'Transacciones']],
        body: paymentsData,
        theme: 'grid',
        headStyles: { fillColor: shellRed, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 50 },
          2: { cellWidth: 30 }
        }
      });
      
      addFooter(pageNumber);
    }

    doc.save(`${filename}.pdf`);
    return { success: true };
  } catch (error: any) {
    console.error("Error exporting to PDF:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Funcion auxiliar para formatear moneda
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}


