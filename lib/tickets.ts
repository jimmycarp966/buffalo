import { normalizeText } from "./utils";

export interface TicketItem {
  name: string;
  unit_price: number;
  quantity: number;
  customization?: string | null;
}

/**
 * Agrupa productos iguales (mismo nombre, precio y personalización) para
 * tickets finales. Evita mezclar ítems con personalizaciones distintas.
 */
export function groupTicketItems<T extends TicketItem>(items: T[]): T[] {
  const groups = new Map<string, TicketItem>();

  items.forEach((item) => {
    if (!item || typeof item.unit_price !== "number" || typeof item.quantity !== "number") {
      return;
    }

    const normalizedName = normalizeText(item.name || "");
    const normalizedCustomization = normalizeText(item.customization || "");
    const key = `${normalizedName}::${item.unit_price}::${normalizedCustomization}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name: item.name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        customization: item.customization,
      });
      return;
    }

    const grouped = groups.get(key)!;
    grouped.quantity += item.quantity;
  });

  return Array.from(groups.values()) as T[];
}


