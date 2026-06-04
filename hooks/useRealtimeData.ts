"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook para suscribirse a cambios en tiempo real de Supabase con optimizaciones
 * Incluye: Throttling de actualizaciones y pausa cuando la pestaña no es visible
 */
export function useRealtimeData<T>(
  table: string,
  initialData: T[],
  filter?: { column: string; value: unknown },
  throttleMs: number = 2000
) {
  const [data, setData] = useState<T[]>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

  const throttledSetData = useCallback((updateFn: (current: T[]) => T[]) => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= throttleMs) {
      lastUpdateRef.current = now;
      setData(updateFn);
      setLastEventAt(now);
    }
  }, [throttleMs]);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    const setupSubscription = () => {
      if (!isVisibleRef.current) return;

      channel = supabase.channel(`${table}_changes`);

      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: table,
            ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
          },
          (payload) => {
            throttledSetData((current) => [payload.new as T, ...current]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: table,
            ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
          },
          (payload) => {
            throttledSetData((current) =>
              current.map((item) =>
                (item as { id: string }).id === (payload.new as { id: string }).id
                  ? (payload.new as T)
                  : item
              )
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: table,
            ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
          },
          (payload) => {
            throttledSetData((current) =>
              current.filter(
                (item) => (item as { id: string }).id !== (payload.old as { id: string }).id
              )
            );
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
          } else {
            setIsConnected(false);
          }
        });
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current) {
        setupSubscription();
      } else if (channel) {
        channel.unsubscribe();
        channel = null;
        setIsConnected(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    setupSubscription();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, filter, throttledSetData]);

  return { data, isConnected, lastEventAt, setData };
}

/**
 * Hook especializado para ventas en tiempo real
 */
export function useRealtimeSales(sessionId: string | null) {
  const [sales, setSales] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("sales_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
          filter: `cash_register_session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newSale = payload.new as { total_amount: number };
          setSales((prev) => prev + 1);
          setTotal((prev) => prev + newSale.total_amount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { salesCount: sales, salesTotal: total };
}

/**
 * Hook para stock en tiempo real
 */
export function useRealtimeStock() {
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();

    // Consulta inicial
    const fetchLowStock = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, stock, min_stock");

      if (!error && data) {
        const lowStock = data.filter((p) => p.stock < p.min_stock);
        setLowStockCount(lowStock.length);
      }
    };

    fetchLowStock();

    // Suscripción a cambios
    const channel = supabase
      .channel("stock_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          // Reconsultar cuando cambia el stock
          fetchLowStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { lowStockCount };
}

/**
 * Hook para actividad del sistema en tiempo real
 */
export function useRealtimeActivity() {
  const [lastActivity, setLastActivity] = useState<{
    type: string;
    message: string;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("system_activity")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const log = payload.new as { action: string; entity_type: string };
          setLastActivity({
            type: log.action,
            message: `${log.action} en ${log.entity_type}`,
            timestamp: new Date(),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { lastActivity };
}

