import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/notificationStore';

interface OptimisticUpdateOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: string[];
  updateFn: (oldData: TData[] | undefined, variables: TVariables) => TData[];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook personalizado para manejar actualizaciones optimistas
 * Actualiza la UI inmediatamente y revierte si hay error
 */
export function useOptimisticUpdate<TData, TVariables>({
  mutationFn,
  queryKey,
  updateFn,
  successMessage = "Operación exitosa",
  errorMessage = "Error en la operación",
  onSuccess,
  onError,
}: OptimisticUpdateOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn,

    // Actualización optimista: Se ejecuta antes de la mutación
    onMutate: async (variables: TVariables) => {
      // Cancelar queries en curso para evitar sobrescribir el update optimista
      await queryClient.cancelQueries({ queryKey });

      // Snapshot del estado anterior
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Actualizar optimistamente
      queryClient.setQueryData<TData[]>(queryKey, (old) => {
        return updateFn(old, variables);
      });

      // Retornar el snapshot para rollback si hay error
      return { previousData };
    },

    // Si la mutación falla, hacer rollback
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      addNotification("error", errorMessage);
      onError?.(error);
    },

    // Si la mutación tiene éxito, refrescar desde el servidor
    onSuccess: (data) => {
      addNotification("success", successMessage);
      onSuccess?.(data);
    },

    // Siempre revalidar después de error o éxito
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Hook simplificado para operaciones CRUD típicas
 */
export function useOptimisticCRUD<TData extends { id: string }>(
  queryKey: string[],
  resourceName: string
) {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  // CREATE
  const create = useMutation({
    mutationFn: async (newItem: Omit<TData, 'id'>) => {
      // Esta función debe ser reemplazada por la acción real
      throw new Error('mutationFn debe ser proporcionada');
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Agregar el nuevo item con un ID temporal
      queryClient.setQueryData<TData[]>(queryKey, (old = []) => [
        ...old,
        { ...newItem, id: `temp-${Date.now()}` } as TData,
      ]);

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      addNotification("error", `Error al crear ${resourceName}`);
    },
    onSuccess: () => {
      addNotification("success", `${resourceName} creado exitosamente`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // UPDATE
  const update = useMutation({
    mutationFn: async (updatedItem: Partial<TData> & { id: string }) => {
      throw new Error('mutationFn debe ser proporcionada');
    },
    onMutate: async (updatedItem) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Actualizar el item en la lista
      queryClient.setQueryData<TData[]>(queryKey, (old = []) =>
        old.map((item) =>
          item.id === updatedItem.id ? { ...item, ...updatedItem } : item
        )
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      addNotification("error", `Error al actualizar ${resourceName}`);
    },
    onSuccess: () => {
      addNotification("success", `${resourceName} actualizado exitosamente`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // DELETE
  const remove = useMutation({
    mutationFn: async (id: string) => {
      throw new Error('mutationFn debe ser proporcionada');
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Eliminar el item de la lista
      queryClient.setQueryData<TData[]>(queryKey, (old = []) =>
        old.filter((item) => item.id !== id)
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      addNotification("error", `Error al eliminar ${resourceName}`);
    },
    onSuccess: () => {
      addNotification("success", `${resourceName} eliminado exitosamente`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    create,
    update,
    remove,
  };
}

