import { KitchenView } from "@/components/shared/KitchenView";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Forzar que esta pagina siempre haga fetch en cada request (sin cache)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: `Cocina | ${brand.name} ${brand.descriptor}`,
  description: "Vista de cocina con pedidos en tiempo real",
};

export default async function CocinaPage() {
  const supabase = await createClient();
  
  // Verificar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verificar permisos - Verificar que el usuario tenga acceso a la vista de cocina
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // Roles permitidos: admin, supervisor, cashier, kitchen, waiter
  // Los mozos (waiter) SÍ pueden ver y gestionar la cocina según la documentación
  if (userData && !["admin", "supervisor", "cashier", "kitchen", "waiter"].includes(userData.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="w-full" translate="no">
      <KitchenView />
    </div>
  );
}

