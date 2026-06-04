"use client";

import Image from "next/image";
import { useState } from "react";
import { brand } from "@/lib/brand";

interface OptimizedLogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function OptimizedLogo({
  width = 120,
  height = 40,
  className = "",
  priority = false,
}: OptimizedLogoProps) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-primary px-4 text-center text-primary-foreground ${className}`}
        style={{ width, height }}
      >
        <span className="font-brand text-sm">{brand.name}</span>
      </div>
    );
  }

  return (
    <Image
      src={brand.logo.src}
      alt={brand.logo.alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      onError={() => setImageError(true)}
      sizes="(max-width: 768px) 100px, (max-width: 1200px) 120px, 120px"
    />
  );
}
