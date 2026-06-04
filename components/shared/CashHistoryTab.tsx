"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCashHistory } from "@/actions/cashActions";

interface CashHistoryTabProps {
  cashRegisterId: string;
}

interface CashSession {
  id: string;
  opening_amount: number;
  closing_amount: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  opened_by: any;
  closed_by: any;
  sales_count: number;
  sales_total: number;
  expenses_count: number;
  expenses_total: number;
  payment_totals?: Record<string, number>; // Desglose por método de pago
  total_invoiced?: number; // Total facturado
}

export function CashHistoryTab({ cashRegisterId }: CashHistoryTabProps) {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);

  useEffect(() => {
    loadHistory();
  }, [cashRegisterId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const result = await getCashHistory(cashRegisterId);
      if (result.success && result.data) {
        setSessions(result.data);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Agrupar sesiones por fecha
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.opened_at).toLocaleDateString("es-AR");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, CashSession[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-16 w-16 text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium mb-2">Sin Historial</h3>
          <p className="text-muted-foreground">
            Aún no hay sesiones de caja cerradas para mostrar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedSessions)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
        .map(([date, dateSessions]) => (
          <Card key={date}>
            <CardHeader>
              <CardTitle className="text-xl">📅 {date}</CardTitle>
              <CardDescription>
                {dateSessions.length} sesión{dateSessions.length > 1 ? "es" : ""} registrada{dateSessions.length > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dateSessions
                .sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime())
                .map((session) => (
                  <div
                    key={session.id}
                    className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Header de la sesión */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        <div>
                          <h4 className="font-semibold text-lg">
                            Sesión de Caja
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {session.opened_by?.name || (Array.isArray(session.opened_by) ? session.opened_by[0]?.name : "N/A")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.closed_at ? "success" : "secondary"}>
                        {session.closed_at ? "Cerrado" : "Abierto"}
                      </Badge>
                    </div>

                    {/* Estadísticas de la sesión */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      <div className="bg-muted/50 rounded p-3">
                        <p className="text-xs text-muted-foreground mb-1">Apertura</p>
                        <p className="font-semibold">{formatCurrency(session.opening_amount)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-3">
                        <p className="text-xs text-muted-foreground mb-1">Ventas</p>
                        <p className="font-semibold">
                          {session.sales_count} ({formatCurrency(session.sales_total)})
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded p-3">
                        <p className="text-xs text-muted-foreground mb-1">Gastos</p>
                        <p className="font-semibold">
                          {session.expenses_count} ({formatCurrency(session.expenses_total)})
                        </p>
                      </div>
                      {session.closed_at && (
                        <div className="bg-muted/50 rounded p-3">
                          <p className="text-xs text-muted-foreground mb-1">Diferencia</p>
                          <p className={`font-semibold ${
                            session.difference === 0 
                              ? "text-green-600" 
                              : session.difference && session.difference > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {session.difference ? formatCurrency(session.difference) : "$0"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cierre info */}
                    {session.closed_at && (
                      <div className="flex items-center justify-between pt-2 border-t text-sm">
                        <div>
                          <span className="text-muted-foreground">Cerrado por: </span>
                          <span className="font-medium">{session.closed_by?.name || (Array.isArray(session.closed_by) ? session.closed_by[0]?.name : "N/A") || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cierre: </span>
                          <span className="font-medium">{formatCurrency(session.closing_amount || 0)}</span>
                        </div>
                      </div>
                    )}

                    {/* Botón ver detalle */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedSession(session)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalle Completo
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}

      {/* Modal de detalle (TODO: implementar) */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Sesión de Caja
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                >
                  ✕
                </Button>
              </div>
              <CardDescription>
                {formatDate(new Date(selectedSession.opened_at))}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Apertura</p>
                  <p className="font-semibold text-lg">
                    {formatCurrency(selectedSession.opening_amount)}
                  </p>
                </div>
                {selectedSession.closed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cierre</p>
                    <p className="font-semibold text-lg">
                      {formatCurrency(selectedSession.closing_amount || 0)}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Resumen Detallado</h4>
                <div className="space-y-3 text-sm">
                  {/* Total de ventas */}
                  <div className="flex justify-between font-medium pb-2 border-b">
                    <span>Total Ventas ({selectedSession.sales_count}):</span>
                    <span className="text-lg">{formatCurrency(selectedSession.sales_total)}</span>
                  </div>
                  
                  {/* Desglose por método de pago */}
                  {selectedSession.payment_totals && Object.keys(selectedSession.payment_totals).length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Desglose por método de pago:</p>
                      {Object.entries(selectedSession.payment_totals)
                        .sort((a, b) => b[1] - a[1]) // Ordenar por monto descendente
                        .map(([method, amount]) => (
                          <div key={method} className="flex justify-between text-sm bg-muted/30 rounded px-3 py-2">
                            <span className="flex items-center gap-2">
                              {method === 'Efectivo' && '💵'}
                              {method === 'Transferencia' && '🔄'}
                              {method !== 'Efectivo' && method !== 'Transferencia' && '💰'}
                              <span className="font-medium">{method}:</span>
                            </span>
                            <span className="font-semibold">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Gastos */}
                  <div className="flex justify-between pt-2 border-t bg-red-50 rounded px-3 py-2">
                    <span className="font-medium text-red-700">Gastos ({selectedSession.expenses_count}):</span>
                    <span className="font-semibold text-red-700">
                      -{formatCurrency(selectedSession.expenses_total)}
                    </span>
                  </div>

                  {/* Facturado */}
                  {selectedSession.total_invoiced !== undefined && selectedSession.total_invoiced > 0 && (
                    <div className="flex justify-between pt-2 border-t bg-blue-50 rounded px-3 py-2">
                      <span className="font-medium text-blue-700 flex items-center gap-2">
                        🧾 Facturado:
                      </span>
                      <span className="font-semibold text-blue-700">
                        {formatCurrency(selectedSession.total_invoiced)}
                      </span>
                    </div>
                  )}
                  
                  {/* Diferencia */}
                  {selectedSession.closed_at && selectedSession.difference !== null && (
                    <div className={`flex justify-between font-semibold pt-3 border-t-2 ${
                      selectedSession.difference === 0 
                        ? "text-green-700 bg-green-50" 
                        : selectedSession.difference > 0 
                          ? "text-blue-700 bg-blue-50" 
                          : "text-red-700 bg-red-50"
                    } rounded px-3 py-2`}>
                      <span>Diferencia:</span>
                      <span className="text-lg">
                        {formatCurrency(selectedSession.difference)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

