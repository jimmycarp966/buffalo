/**
 * Servicio de Impresión Térmica para Gadnic IMP30
 * Maneja la impresión automática de pedidos con opciones personalizadas
 */

import { getCurrentDate } from "./utils";
import { printToLocal } from "./localPrinter";
import { brand } from "./brand";

// Nota: La librería node-thermal-printer no es compatible con Next.js
// Se usa solo para generar el contenido del ticket
// La impresión real se debe implementar en el servidor

export interface ThermalPrintData {
  tableNumber: number;
  items: Array<{
    name: string;
    quantity: number;
    customization?: string; // Campo de texto libre para personalizaciones
  }>;
  timestamp: string;
}

export interface ThermalPrinterConfig {
  printerName: string;
  printerIp?: string;
  printerPort?: number;
  isEnabled: boolean;
  printOnNewOrder: boolean;
  printOnTableOpen: boolean;
}

class ThermalPrinterService {
  private config: ThermalPrinterConfig;
  private printQueue: ThermalPrintData[] = [];
  private isProcessing = false;

  constructor(config: ThermalPrinterConfig) {
    this.config = config;
  }

  /**
   * Agregar pedido a la cola de impresión
   */
  async addToPrintQueue(printData: ThermalPrintData): Promise<boolean> {
    if (!this.config.isEnabled) {
      console.log("🖨️ Impresora térmica deshabilitada");
      return false;
    }

    this.printQueue.push(printData);
    console.log(`🖨️ Pedido agregado a cola de impresión: Mesa ${printData.tableNumber}`);
    
    // Procesar cola si no está en proceso
    if (!this.isProcessing) {
      this.processPrintQueue();
    }

    return true;
  }

  /**
   * Procesar cola de impresión
   */
  private async processPrintQueue(): Promise<void> {
    if (this.isProcessing || this.printQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.printQueue.length > 0) {
      const printData = this.printQueue.shift();
      if (printData) {
        await this.printOrder(printData);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Imprimir pedido específico
   */
  private async printOrder(printData: ThermalPrintData): Promise<boolean> {
    try {
      console.log(`🖨️ Imprimiendo pedido para Mesa ${printData.tableNumber}`);
      
      // Generar contenido del ticket
      const ticketContent = this.generateTicketContent(printData);
      
      // Enviar a impresora
      const success = await this.sendToPrinter(ticketContent);
      
      if (success) {
        console.log(`✅ Ticket impreso exitosamente para Mesa ${printData.tableNumber}`);
      } else {
        console.error(`❌ Error al imprimir ticket para Mesa ${printData.tableNumber}`);
      }

      return success;
    } catch (error) {
      console.error("Error en printOrder:", error);
      return false;
    }
  }

  /**
   * Generar contenido del ticket
   */
  private generateTicketContent(printData: ThermalPrintData): string {
    const { tableNumber, items, timestamp } = printData;
    
    let content = "";
    
    // Encabezado
    content += this.centerText(brand.name.toUpperCase()) + "\n";
    content += this.centerText("🍺 BAR - PEDIDO DE COCINA") + "\n";
    content += this.drawLine() + "\n";
    
  // Información de la mesa
  content += `MESA: ${tableNumber}\n`;
  content += `HORA: ${timestamp}\n`;
  content += this.drawLine() + "\n";
    
  // Items del pedido
  content += "PEDIDO:\n";
  items.forEach((item, index) => {
    content += `${item.quantity}x ${item.name}\n`;
    
    // Mostrar personalizaciones si las hay
    if (item.customization && item.customization.trim()) {
      content += `   NOTA: ${item.customization}\n`;
    }
    content += "\n";
  });
    
  content += this.drawLine() + "\n";
  content += "\n\n\n"; // Espacio para cortar
    
    return content;
  }

  /**
   * Enviar contenido a la impresora
   */
  private async sendToPrinter(content: string): Promise<boolean> {
    try {
      // Si hay IP configurada, usar impresión por red
      if (this.config.printerIp) {
        return await this.printViaNetwork(content);
      } else {
        // Usar impresión local (USB/Bluetooth)
        return await this.printLocally(content);
      }
    } catch (error) {
      console.error("Error enviando a impresora:", error);
      return false;
    }
  }

  /**
   * Imprimir por red (TCP/IP)
   */
  private async printViaNetwork(content: string): Promise<boolean> {
    try {
      console.log(`🖨️ Enviando a impresora por red: ${this.config.printerIp}:${this.config.printerPort}`);
      
      const result = await printToLocal(content, this.config.printerName, "kitchen", 48);

      if (result.success) {
        console.log(`✅ Ticket impreso por red: ${this.config.printerIp}:${this.config.printerPort}`);
        return true;
      }

      console.error(`❌ Error en impresión por red: ${result.message}`);
      return false;
    } catch (error) {
      console.error("Error en impresión por red:", error);
      return false;
    }
  }

  /**
   * Imprimir localmente (USB/Bluetooth)
   */
  private async printLocally(content: string): Promise<boolean> {
    try {
      console.log(`🖨️ Enviando a impresora local: ${this.config.printerName}`);
      
      const result = await printToLocal(content, this.config.printerName, "kitchen", 48);

      if (result.success) {
        console.log(`✅ Ticket impreso localmente: ${this.config.printerName}`);
        return true;
      }

      console.error(`❌ Error en impresión local: ${result.message}`);
      if (result.availablePrinters) {
        console.log('📋 Impresoras disponibles:', result.availablePrinters);
      }
      return false;
    } catch (error) {
      console.error("Error en impresión local:", error);
      return false;
    }
  }

  /**
   * Utilidades de formato
   */
  private centerText(text: string, width = 32): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  private drawLine(char = "-", width = 32): string {
    return char.repeat(width);
  }

  /**
   * Actualizar configuración
   */
  updateConfig(newConfig: Partial<ThermalPrinterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtener estado de la impresora
   */
  getStatus(): {
    isEnabled: boolean;
    queueLength: number;
    isProcessing: boolean;
    config: ThermalPrinterConfig;
  } {
    return {
      isEnabled: this.config.isEnabled,
      queueLength: this.printQueue.length,
      isProcessing: this.isProcessing,
      config: this.config,
    };
  }
}

// Instancia singleton del servicio
let thermalPrinterInstance: ThermalPrinterService | null = null;

export function getThermalPrinterService(): ThermalPrinterService {
  if (!thermalPrinterInstance) {
    // Configuración por defecto
  const defaultConfig: ThermalPrinterConfig = {
    printerName: "POS-58",
    isEnabled: true,
    printOnNewOrder: true,
    printOnTableOpen: true,
  };
    
    thermalPrinterInstance = new ThermalPrinterService(defaultConfig);
  }
  
  return thermalPrinterInstance;
}

/**
 * Función helper para imprimir pedido automáticamente
 */
export async function printOrderToThermal(
  tableNumber: number,
  items: Array<{
    name: string;
    quantity: number;
    customization?: string;
  }>
): Promise<boolean> {
  const printer = getThermalPrinterService();
  
  const printData: ThermalPrintData = {
    tableNumber,
    items,
    timestamp: getCurrentDate().toLocaleString('es-ES'),
  };
  
  return await printer.addToPrintQueue(printData);
}

