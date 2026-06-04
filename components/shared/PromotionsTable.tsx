"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Tag, Edit } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PromotionModal } from "./PromotionModal";

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  product?: { name: string } | null;
}

interface PromotionsTableProps {
  promotions: Promotion[];
}

export function PromotionsTable({ promotions }: PromotionsTableProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

  const filteredPromotions = promotions.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getDiscountLabel = (type: string, value: number | null) => {
    switch (type) {
      case "percentage":
        return `${value}% OFF`;
      case "fixed":
        return `$${value} OFF`;
      case "2x1":
        return "2x1";
      default:
        return type;
    }
  };

  const getStatus = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);

    if (!promo.is_active) return { label: "Inactiva", variant: "secondary" as const };
    if (now < start) return { label: "Próxima", variant: "secondary" as const };
    if (now > end) return { label: "Expirada", variant: "destructive" as const };
    return { label: "Activa", variant: "success" as const };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar promociones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          <span className="ml-2">Nueva Promoción</span>
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Producto</th>
                <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Vigencia</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron promociones</p>
                  </td>
                </tr>
              ) : (
                filteredPromotions.map((promo) => {
                  const status = getStatus(promo);
                  return (
                    <tr key={promo.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{promo.name}</div>
                        {promo.description && (
                          <div className="text-xs text-muted-foreground">{promo.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {getDiscountLabel(promo.discount_type, promo.discount_value)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm hidden sm:table-cell">
                        {promo.product?.name || "Todos"}
                      </td>
                      <td className="px-4 py-3 text-sm hidden sm:table-cell">
                        <div>{formatDate(new Date(promo.start_date))}</div>
                        <div className="text-xs text-muted-foreground">
                          hasta {formatDate(new Date(promo.end_date))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPromotion(promo);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PromotionModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPromotion(null);
        }}
        promotion={selectedPromotion}
      />
    </div>
  );
}

