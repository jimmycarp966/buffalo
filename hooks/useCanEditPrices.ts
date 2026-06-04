import { useAuthStore } from "@/store/authStore";

/**
 * Permiso de UI para editar manualmente el precio unitario de un ítem
 * durante la venta (override de precio). Solo admin y supervisor pueden;
 * cajeros y mozos ven el precio pero no lo cambian.
 *
 * El control efectivo de precios sigue siendo el catálogo de Productos
 * (gated por products.edit). Esto bloquea el override puntual en caja.
 */
export function useCanEditPrices(): boolean {
  const role = useAuthStore((state) => state.user?.role);
  return role === "admin" || role === "supervisor";
}
