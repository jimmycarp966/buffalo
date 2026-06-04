"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSale } from "@/actions/saleActions";
import { useNotificationStore } from "@/store/notificationStore";

export function useSaleMutation() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: createSale,
    onMutate: async (newSale) => {
      // Cancelar queries en curso para evitar conflictos
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      await queryClient.cancelQueries({ queryKey: ['openTables'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });

      // Snapshot del estado actual
      const previousSales = queryClient.getQueryData(['sales']);
      const previousTables = queryClient.getQueryData(['openTables']);
      const previousDashboard = queryClient.getQueryData(['dashboard']);

      // Update optimista - agregar la venta a la lista
      if (previousSales) {
        queryClient.setQueryData(['sales'], (old: any) => {
          if (old?.data) {
            return {
              ...old,
              data: [newSale, ...old.data]
            };
          }
          return old;
        });
      }

      // Si es una venta con mesa, actualizar mesas abiertas inmediatamente
      if (newSale.table_number) {
        if (previousTables) {
          queryClient.setQueryData(['openTables'], (old: any) => {
            if (old?.data) {
              // Crear objeto de venta optimista con los campos necesarios
              const optimisticSale = {
                id: `temp-${Date.now()}`, // ID temporal
                table_number: newSale.table_number,
                status: 'pending',
                sale_type: 'table',
                area: newSale.area || 'bar',
                total: newSale.items?.reduce((sum: number, item: any) =>
                  sum + (item.unit_price * item.quantity), 0) || 0,
                created_at: new Date().toISOString(),
                items: newSale.items || [],
                // Campos adicionales que podrían necesitar las mesas abiertas
                is_table_group: false,
                grouped_tables: null
              };

              // Verificar que no exista ya esta mesa (prevenir duplicados)
              const existingTable = old.data.find((table: any) =>
                table.table_number === newSale.table_number
              );

              if (!existingTable) {
                return {
                  ...old,
                  data: [optimisticSale, ...old.data]
                };
              }
            }
            return old;
          });
        }
      }

      return {
        previousSales,
        previousTables,
        previousDashboard
      };
    },
    onError: (err, newSale, context) => {
      // Rollback en caso de error - restaurar estado anterior
      if (context?.previousSales) {
        queryClient.setQueryData(['sales'], context.previousSales);
      }
      if (context?.previousTables) {
        queryClient.setQueryData(['openTables'], context.previousTables);
      }
      if (context?.previousDashboard) {
        queryClient.setQueryData(['dashboard'], context.previousDashboard);
      }

      // Mostrar notificación de error
      addNotification("error", `Error al crear venta: ${err.message || 'Error desconocido'}`);
    },
    onSuccess: (result, newSale) => {
      if (result.success) {
        // Mostrar notificación de éxito
        addNotification("success", "Venta creada exitosamente");

        // Invalidar queries para sincronizar con el servidor - con refetch inmediato
        queryClient.invalidateQueries({
          queryKey: ['sales'],
          refetchType: 'active' // Refetch inmediato para queries activas
        });
        queryClient.invalidateQueries({
          queryKey: ['openTables'],
          refetchType: 'active' // Refetch inmediato para queries activas
        });
        queryClient.invalidateQueries({
          queryKey: ['dashboard'],
          refetchType: 'active'
        });
        queryClient.invalidateQueries({
          queryKey: ['products'],
          refetchType: 'none' // No refetch inmediato para productos
        });
      } else {
        // Mostrar error del servidor
        addNotification("error", result.message || "Error al crear venta");
      }
    },
    onSettled: () => {
      // Solo invalidar si hubo error (el éxito ya invalida en onSuccess)
      // Nota: El rollback de onError ya restauró los datos, aquí solo nos aseguramos
      // de sincronizar en caso de que algo haya fallado silenciosamente
    },
  });
}

// Hook para mutaciones de ventas pendientes
export function usePendingSaleMutation() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: async (data: { saleId: string; payments: Array<{ payment_method_id: string; amount: number }> }) => {
      const { closePendingSale } = await import('@/actions/saleActions');
      return closePendingSale(data.saleId, data.payments);
    },
    onMutate: async (data) => {
      // Cancelar queries en curso
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      await queryClient.cancelQueries({ queryKey: ['openTables'] });

      // Snapshot del estado actual
      const previousSales = queryClient.getQueryData(['sales']);
      const previousTables = queryClient.getQueryData(['openTables']);

      // Update optimista - remover la venta de mesas abiertas
      if (previousTables) {
        queryClient.setQueryData(['openTables'], (old: any) => {
          if (old?.data) {
            return {
              ...old,
              data: old.data.filter((table: any) => table.id !== data.saleId)
            };
          }
          return old;
        });
      }

      return { previousSales, previousTables };
    },
    onError: (err, data, context) => {
      // Rollback en caso de error
      if (context?.previousSales) {
        queryClient.setQueryData(['sales'], context.previousSales);
      }
      if (context?.previousTables) {
        queryClient.setQueryData(['openTables'], context.previousTables);
      }

      addNotification("error", `Error al cerrar venta: ${err.message || 'Error desconocido'}`);
    },
    onSuccess: (result) => {
      if (result.success) {
        addNotification("success", "Venta cerrada exitosamente");

        // Invalidar queries para sincronizar
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['openTables'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        addNotification("error", result.message || "Error al cerrar venta");
      }
    },
    onSettled: () => {
      // Solo invalidar si hubo error (el éxito ya invalida en onSuccess)
    },
  });
}









