import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getPublicProducts, getPublicCategories, getStoreSettings } from "@/actions/publicMenuActions";
import { PublicMenuView } from "@/components/public/PublicMenuView";
import { brand } from "@/lib/brand";

export const metadata = {
  title: `Pedidos - ${brand.name}`,
  description: `Pedí online en ${brand.name} ${brand.descriptor}.`,
};

export const dynamic = "force-dynamic";

async function MenuContent() {
  const [productsResult, categoriesResult, settingsResult] = await Promise.all([
    getPublicProducts(),
    getPublicCategories(),
    getStoreSettings(),
  ]);

  const products = productsResult.success ? productsResult.data || [] : [];
  const categories = categoriesResult.success ? categoriesResult.data || [] : [];
  const settings = settingsResult.success ? settingsResult.data : null;

  return (
    <PublicMenuView
      products={products}
      categories={categories}
      storeName={settings?.store_name || brand.defaultStoreName}
      estimatedTime={settings?.estimated_delivery_time || 30}
      isOpen={settings?.is_open ?? true}
      dailyMenuContent={settings?.daily_menu_content}
      dailyMenuActive={settings?.daily_menu_active}
      bankAlias={settings?.bank_alias}
      bankCbu={settings?.bank_cbu}
      bankHolder={settings?.bank_holder}
    />
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Cargando carta nocturna...</p>
          </div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
