import { getPromotions } from "@/actions/promotionActions";
import { PromotionsTable } from "@/components/shared/PromotionsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, TrendingDown, Calendar } from "lucide-react";

export default async function PromocionesPage() {
  const { data: promotions } = await getPromotions();

  const activePromotions = promotions?.filter((p: any) => {
    const now = new Date();
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    return p.is_active && now >= start && now <= end;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Promociones y Descuentos</h1>
        <p className="text-muted-foreground">
          Gestiona promociones temporales (2x1, descuentos, ofertas especiales)
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promociones Activas</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-buffalo-caramel">{activePromotions.length}</div>
            <p className="text-xs text-muted-foreground">Vigentes ahora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promociones</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">En el sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                promotions?.filter((p: any) => {
                  const now = new Date();
                  const start = new Date(p.start_date);
                  return p.is_active && start > now;
                }).length || 0
              }
            </div>
            <p className="text-xs text-muted-foreground">Por comenzar</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Promociones</CardTitle>
          <CardDescription>
            {promotions?.length || 0} promociones registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <PromotionsTable promotions={promotions || []} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

