// Cálculo de costo de producción a partir de la receta (insumos + cantidades).
// Un insumo tiene un precio por su unidad de compra (kg / L / unidad). En la
// receta la cantidad se carga en la sub-unidad correspondiente (g / ml / u) y
// el costo de la línea se convierte automáticamente.

export type IngredientUnit = "kg" | "l" | "unidad";

export const INGREDIENT_UNITS: { value: IngredientUnit; label: string; sub: string }[] = [
  { value: "kg", label: "Kilo — precio por kg", sub: "g" },
  { value: "l", label: "Litro — precio por L", sub: "ml" },
  { value: "unidad", label: "Unidad — precio por u", sub: "u" },
];

// Etiqueta de la sub-unidad en la que se carga la cantidad de la receta.
export function recipeUnitLabel(unit: string): string {
  if (unit === "kg") return "g";
  if (unit === "l") return "ml";
  return "u";
}

// Etiqueta de la unidad de compra (para mostrar "precio por ...").
export function purchaseUnitLabel(unit: string): string {
  if (unit === "kg") return "kg";
  if (unit === "l") return "L";
  return "unidad";
}

// Costo de una línea de receta. Para kg/L la cantidad viene en g/ml (÷1000).
export function ingredientLineCost(unit: string, costPerUnit: number, quantity: number): number {
  const c = Number(costPerUnit) || 0;
  const q = Number(quantity) || 0;
  if (unit === "kg" || unit === "l") return c * (q / 1000);
  return c * q;
}

// Costo total de producción de una receta.
export function recipeTotalCost(
  items: { unit: string; cost: number; quantity: number }[]
): number {
  return (items || []).reduce(
    (sum, it) => sum + ingredientLineCost(it.unit, it.cost, it.quantity),
    0
  );
}
