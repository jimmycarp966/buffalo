"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

interface MenuCardProps {
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  category?: string;
}

export function MenuCard({ name, description, price, imageUrl, category }: MenuCardProps) {
  const formattedPrice = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(price);

  return (
    <Card className="group overflow-hidden border-primary/15 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(168, 52, 28,0.12)]">
      <div className="relative h-52 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(168, 52, 28,0.08),transparent_35%),linear-gradient(135deg,rgba(255,243,233,0.94),rgba(255,248,240,0.98))]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="brand-grid flex h-full items-center justify-center">
            <span className="text-6xl opacity-30">🍸</span>
          </div>
        )}

        {category && (
          <div className="absolute left-3 top-3">
            <Badge variant="outline" className="bg-background/70 backdrop-blur-sm">
              {category}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">{name}</h3>
          <span className="shrink-0 text-lg font-black text-secondary">{formattedPrice}</span>
        </div>

        {description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
