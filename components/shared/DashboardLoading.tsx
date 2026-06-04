"use client";

import { DashboardSkeleton, CardSkeleton } from "./LoadingSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-gray-200 to-gray-300 p-6 rounded-xl animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-400 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-400 rounded w-32"></div>
            <div className="h-4 bg-gray-400 rounded w-48"></div>
            <div className="h-3 bg-gray-400 rounded w-24"></div>
          </div>
        </div>
      </div>

      {/* Stats cards skeleton */}
      <DashboardSkeleton />

      {/* Quick access skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Additional content skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse w-24"></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 bg-muted rounded animate-pulse"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
