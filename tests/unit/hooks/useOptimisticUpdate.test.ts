import { renderHook, act } from '@testing-library/react-hooks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOptimisticUpdate, useOptimisticCRUD } from '@/hooks/useOptimisticUpdate'
import { ReactNode } from 'react'

// Mock Zustand store
const mockAddNotification = jest.fn()
jest.mock('@/store/notificationStore', () => ({
  useNotificationStore: (selector: any) => selector({
    addNotification: mockAddNotification,
  }),
}))

// Wrapper component for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useOptimisticUpdate', () => {
  beforeEach(() => {
    mockAddNotification.mockClear()
  })

  it('should perform optimistic update and rollback on error', async () => {
    const queryKey = ['test-data']
    const mockData = [{ id: '1', name: 'Item 1' }]
    const mockMutationFn = jest.fn().mockRejectedValue(new Error('API Error'))
    const mockUpdateFn = jest.fn((oldData, variables) => [
      ...(oldData || []),
      { id: '2', name: variables.name }
    ])

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
      }),
      { wrapper: createWrapper() }
    )

    // Set initial data
    const queryClient = result.current.queryClient
    queryClient.setQueryData(queryKey, mockData)

    // Execute mutation
    act(() => {
      result.current.mutate({ name: 'New Item' })
    })

    // Check optimistic update
    expect(queryClient.getQueryData(queryKey)).toEqual([
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'New Item' }
    ])

    // Wait for error and rollback
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Check rollback occurred
    expect(queryClient.getQueryData(queryKey)).toEqual(mockData)
    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Error en la operación')
  })

  it('should perform optimistic update and keep changes on success', async () => {
    const queryKey = ['test-data']
    const mockData = [{ id: '1', name: 'Item 1' }]
    const mockMutationFn = jest.fn().mockResolvedValue({ id: '2', name: 'New Item' })
    const mockUpdateFn = jest.fn((oldData, variables) => [
      ...(oldData || []),
      { id: '2', name: variables.name }
    ])
    const mockOnSuccess = jest.fn()

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
        successMessage: 'Custom success message',
        onSuccess: mockOnSuccess,
      }),
      { wrapper: createWrapper() }
    )

    // Set initial data
    const queryClient = result.current.queryClient
    queryClient.setQueryData(queryKey, mockData)

    // Execute mutation
    act(() => {
      result.current.mutate({ name: 'New Item' })
    })

    // Check optimistic update
    expect(queryClient.getQueryData(queryKey)).toEqual([
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'New Item' }
    ])

    // Wait for success
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Check success notification and callback
    expect(mockAddNotification).toHaveBeenCalledWith('success', 'Custom success message')
    expect(mockOnSuccess).toHaveBeenCalledWith({ id: '2', name: 'New Item' })
  })

  it('should cancel queries on mutate', async () => {
    const queryKey = ['test-data']
    const mockMutationFn = jest.fn().mockResolvedValue({})
    const mockUpdateFn = jest.fn((oldData) => oldData || [])

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
      }),
      { wrapper: createWrapper() }
    )

    const queryClient = result.current.queryClient
    const cancelQueriesSpy = jest.spyOn(queryClient, 'cancelQueries')

    act(() => {
      result.current.mutate({})
    })

    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey })
  })

  it('should invalidate queries on settled', async () => {
    const queryKey = ['test-data']
    const mockMutationFn = jest.fn().mockResolvedValue({})
    const mockUpdateFn = jest.fn((oldData) => oldData || [])

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
      }),
      { wrapper: createWrapper() }
    )

    const queryClient = result.current.queryClient
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      result.current.mutate({})
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey })
  })

  it('should handle undefined oldData', async () => {
    const queryKey = ['test-data']
    const mockMutationFn = jest.fn().mockResolvedValue({})
    const mockUpdateFn = jest.fn((oldData, variables) => [
      { id: '1', name: variables.name }
    ])

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
      }),
      { wrapper: createWrapper() }
    )

    // No initial data set (undefined)
    const queryClient = result.current.queryClient

    act(() => {
      result.current.mutate({ name: 'New Item' })
    })

    // Check optimistic update with undefined oldData
    expect(mockUpdateFn).toHaveBeenCalledWith(undefined, { name: 'New Item' })
    expect(queryClient.getQueryData(queryKey)).toEqual([
      { id: '1', name: 'New Item' }
    ])
  })

  it('should call custom error callback on error', async () => {
    const queryKey = ['test-data']
    const mockMutationFn = jest.fn().mockRejectedValue(new Error('Custom error'))
    const mockUpdateFn = jest.fn((oldData) => oldData || [])
    const mockOnError = jest.fn()

    const { result } = renderHook(
      () => useOptimisticUpdate({
        mutationFn: mockMutationFn,
        queryKey,
        updateFn: mockUpdateFn,
        errorMessage: 'Custom error message',
        onError: mockOnError,
      }),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.mutate({})
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Custom error message')
    expect(mockOnError).toHaveBeenCalledWith(new Error('Custom error'))
  })
})

describe('useOptimisticCRUD', () => {
  const queryKey = ['test-items']
  const resourceName = 'item'

  it('should create item optimistically', async () => {
    const mockCreateFn = jest.fn().mockResolvedValue({ id: 'real-1', name: 'Real Item' })

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.create.mutationFn = mockCreateFn

    // Set initial data
    const queryClient = result.current.create.queryClient
    queryClient.setQueryData(queryKey, [{ id: 'existing', name: 'Existing Item' }])

    act(() => {
      result.current.create.mutate({ name: 'New Item' })
    })

    // Check optimistic update (should have temp ID)
    const currentData = queryClient.getQueryData(queryKey)
    expect(currentData).toHaveLength(2)
    expect(currentData![0]).toEqual({ id: 'existing', name: 'Existing Item' })
    expect(currentData![1].name).toBe('New Item')
    expect(currentData![1].id).toMatch(/^temp-\d+$/)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockAddNotification).toHaveBeenCalledWith('success', 'item creado exitosamente')
  })

  it('should update item optimistically', async () => {
    const mockUpdateFn = jest.fn().mockResolvedValue({ id: '1', name: 'Updated Item' })

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.update.mutationFn = mockUpdateFn

    // Set initial data
    const queryClient = result.current.update.queryClient
    queryClient.setQueryData(queryKey, [
      { id: '1', name: 'Original Item' },
      { id: '2', name: 'Other Item' }
    ])

    act(() => {
      result.current.update.mutate({ id: '1', name: 'Updated Item' })
    })

    // Check optimistic update
    const currentData = queryClient.getQueryData(queryKey)
    expect(currentData![0]).toEqual({ id: '1', name: 'Updated Item' })
    expect(currentData![1]).toEqual({ id: '2', name: 'Other Item' })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockAddNotification).toHaveBeenCalledWith('success', 'item actualizado exitosamente')
  })

  it('should delete item optimistically', async () => {
    const mockDeleteFn = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.remove.mutationFn = mockDeleteFn

    // Set initial data
    const queryClient = result.current.remove.queryClient
    queryClient.setQueryData(queryKey, [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' }
    ])

    act(() => {
      result.current.remove.mutate('2')
    })

    // Check optimistic delete
    const currentData = queryClient.getQueryData(queryKey)
    expect(currentData).toHaveLength(2)
    expect(currentData).toEqual([
      { id: '1', name: 'Item 1' },
      { id: '3', name: 'Item 3' }
    ])

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockAddNotification).toHaveBeenCalledWith('success', 'item eliminado exitosamente')
  })

  it('should rollback create on error', async () => {
    const mockCreateFn = jest.fn().mockRejectedValue(new Error('Create failed'))
    const initialData = [{ id: 'existing', name: 'Existing Item' }]

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.create.mutationFn = mockCreateFn

    // Set initial data
    const queryClient = result.current.create.queryClient
    queryClient.setQueryData(queryKey, initialData)

    act(() => {
      result.current.create.mutate({ name: 'New Item' })
    })

    // Check optimistic update
    expect(queryClient.getQueryData(queryKey)).toHaveLength(2)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Check rollback
    expect(queryClient.getQueryData(queryKey)).toEqual(initialData)
    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Error al crear item')
  })

  it('should rollback update on error', async () => {
    const mockUpdateFn = jest.fn().mockRejectedValue(new Error('Update failed'))
    const initialData = [
      { id: '1', name: 'Original Item' },
      { id: '2', name: 'Other Item' }
    ]

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.update.mutationFn = mockUpdateFn

    // Set initial data
    const queryClient = result.current.update.queryClient
    queryClient.setQueryData(queryKey, initialData)

    act(() => {
      result.current.update.mutate({ id: '1', name: 'Failed Update' })
    })

    // Check optimistic update
    expect(queryClient.getQueryData(queryKey)![0].name).toBe('Failed Update')

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Check rollback
    expect(queryClient.getQueryData(queryKey)).toEqual(initialData)
    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Error al actualizar item')
  })

  it('should rollback delete on error', async () => {
    const mockDeleteFn = jest.fn().mockRejectedValue(new Error('Delete failed'))
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]

    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    // Override the mutation function
    result.current.remove.mutationFn = mockDeleteFn

    // Set initial data
    const queryClient = result.current.remove.queryClient
    queryClient.setQueryData(queryKey, initialData)

    act(() => {
      result.current.remove.mutate('2')
    })

    // Check optimistic delete
    expect(queryClient.getQueryData(queryKey)).toHaveLength(1)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Check rollback
    expect(queryClient.getQueryData(queryKey)).toEqual(initialData)
    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Error al eliminar item')
  })

  it('should throw error if mutationFn is not provided', async () => {
    const { result } = renderHook(
      () => useOptimisticCRUD(queryKey, resourceName),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.create.mutate({ name: 'Test' })
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockAddNotification).toHaveBeenCalledWith('error', 'Error al crear item')
  })
})








