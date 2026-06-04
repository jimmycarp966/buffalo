"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Skeleton para tablas
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="flex-1">
              <div className="h-4 bg-muted rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Skeleton para cards
export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 bg-muted rounded animate-pulse w-3/4"></div>
        <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded animate-pulse"></div>
          <div className="h-4 bg-muted rounded animate-pulse w-5/6"></div>
          <div className="h-4 bg-muted rounded animate-pulse w-4/6"></div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton para listas de productos
export function ProductListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
              <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
              <div className="h-6 bg-muted rounded animate-pulse w-1/3"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Skeleton para dashboard
export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
            <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded animate-pulse w-20 mb-2"></div>
            <div className="h-3 bg-muted rounded animate-pulse w-32"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Skeleton para formularios
export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
          <div className="h-10 bg-muted rounded animate-pulse"></div>
        </div>
      ))}
      <div className="flex space-x-2 pt-4">
        <div className="h-10 bg-muted rounded animate-pulse w-20"></div>
        <div className="h-10 bg-muted rounded animate-pulse w-20"></div>
      </div>
    </div>
  );
}

// Skeleton para gráficos
export function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-full">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded"></div>
          <div className="h-2 bg-muted rounded w-5/6"></div>
          <div className="h-2 bg-muted rounded w-4/6"></div>
          <div className="h-2 bg-muted rounded w-3/4"></div>
        </div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    </div>
  );
}

// Skeleton para botones
export function ButtonSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`h-10 bg-muted rounded animate-pulse ${className}`}></div>
  );
}

// Skeleton para texto
export function TextSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className={`h-4 bg-muted rounded animate-pulse ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        ></div>
      ))}
    </div>
  );
}
