import { printToLocal } from "./localPrinter";
import { brand } from "./brand";

export class PrintService {
  static async printTicket(
    content: string,
    printerName?: string,
    type: "kitchen" | "cash" = "kitchen",
    width?: number
  ): Promise<void> {
    const result = await printToLocal(content, printerName, type, width);

    if (!result.success) {
      throw new Error(result.message || "Error al imprimir");
    }
  }

  static async printWithLocalServer(
    content: string,
    printerName?: string,
    type: "kitchen" | "cash" = "kitchen",
    width?: number
  ): Promise<void> {
    await this.printTicket(content, printerName, type, width);
  }

  static async disconnect(): Promise<void> {
    return;
  }
}

export async function imprimirEnCocina(content: string): Promise<void> {
  await PrintService.printTicket(content, `Cocina ${brand.name}`, "kitchen");
}

export async function imprimirEnCaja(content: string): Promise<void> {
  await PrintService.printTicket(content, undefined, "cash");
}
