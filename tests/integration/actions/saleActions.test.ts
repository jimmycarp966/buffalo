import {
  createSale,
  updateSaleStatus,
  cancelSale,
  getSales,
  getSaleById,
  processPayment,
  getSalesBySession
} from '@/actions/saleActions'
import { saleSchema } from '@/lib/validations'

// Mock utilities
const mockRevalidatePath = jest.fn()
const mockValidateInventoryStock = jest.fn()

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  })),
  rpc: jest.fn(),
}

const mockCreateClient = jest.fn(() => Promise.resolve(mockSupabaseClient))

jest.doMock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

jest.doMock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

// Move mock to top of file
jest.doMock('../../../actions/productInventoryActions', () => ({
  validateInventoryStock: mockValidateInventoryStock,
}))

describe('Sale Actions - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset mock implementations
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    mockSupabaseClient.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    mockValidateInventoryStock.mockResolvedValue({ success: true })
  })

  describe('createSale', () => {
    const validSaleData = {
      cash_register_id: 'cash-123',
      area: 'shop' as const,
      items: [
        {
          product_id: 'product-1',
          quantity: 2,
          unit_price: 100,
        },
        {
          product_id: 'product-2',
          quantity: 1,
          unit_price: 50,
        },
      ],
      payments: [
        {
          payment_method_id: 'payment-1',
          amount: 250,
        },
      ],
      status: 'completed' as const,
    }

    it('should create sale successfully', async () => {
      const mockSale = {
        id: 'sale-123',
        sale_number: 'SALE1234567890ABCD',
        cash_register_session_id: 'session-123',
        user_id: 'user-123',
        total_amount: 250,
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
      }

      // Mock session lookup
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-123', status: 'open' },
            error: null,
          }),
        })
        // Mock RPC call
        .mockReturnValueOnce({
          data: 'sale-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'sale-123',
        error: null,
      })

      const result = await createSale(validSaleData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 'sale-123' })
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_sale', {
        p_sale_data: expect.objectContaining({
          sale_number: expect.stringMatching(/^SALE\d+[A-Z]+$/),
          cash_register_session_id: 'session-123',
          user_id: 'user-123',
          total_amount: 250,
          items: validSaleData.items,
          payments: validSaleData.payments,
          status: 'completed',
        }),
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/caja-shop')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ventas')
    })

    it('should create sale for bar area with table number', async () => {
      const barSaleData = {
        ...validSaleData,
        area: 'bar' as const,
        table_number: 5,
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-bar-123', status: 'open' },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          data: 'sale-bar-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'sale-bar-123',
        error: null,
      })

      const result = await createSale(barSaleData)

      expect(result.success).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_sale', {
        p_sale_data: expect.objectContaining({
          table_number: 5,
        }),
      })
    })

    it('should validate inventory stock before creating sale', async () => {
      mockValidateInventoryStock.mockResolvedValue({ success: true })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-123', status: 'open' },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          data: 'sale-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'sale-123',
        error: null,
      })

      await createSale(validSaleData)

      expect(mockValidateInventoryStock).toHaveBeenCalledWith(validSaleData.items)
    })

    it('should handle inventory validation failure', async () => {
      mockValidateInventoryStock.mockResolvedValue({
        success: false,
        message: 'Insufficient stock for product-1'
      })

      const result = await createSale(validSaleData)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Insufficient stock for product-1')
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should handle no open session', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null, // No open session
          error: null,
        }),
      })

      const result = await createSale(validSaleData)

      expect(result.success).toBe(false)
      expect(result.message).toBe('No hay sesión abierta')
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should handle pending sales without payments', async () => {
      const pendingSaleData = {
        ...validSaleData,
        status: 'pending' as const,
        payments: [], // Empty payments allowed for pending
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-123', status: 'open' },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          data: 'sale-pending-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'sale-pending-123',
        error: null,
      })

      const result = await createSale(pendingSaleData)

      expect(result.success).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_sale', {
        p_sale_data: expect.objectContaining({
          status: 'pending',
          payments: [],
        }),
      })
    })

    it('should handle validation errors', async () => {
      const invalidData = {
        cash_register_id: 'cash-123',
        items: [], // Invalid: empty items
        payments: [],
        status: 'completed' as const,
      }

      const result = await createSale(invalidData as any)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Debe agregar al menos un producto')
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled()
    })

    it('should handle RPC errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'session-123', status: 'open' },
          error: null,
        }),
      })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      })

      const result = await createSale(validSaleData)

      expect(result.success).toBe(false)
      expect(result.message).toBe('RPC failed')
    })

    it('should revalidate multiple paths', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-123', status: 'open' },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          data: 'sale-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'sale-123',
        error: null,
      })

      await createSale(validSaleData)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/caja-shop')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ventas')
    })
  })

  describe('updateSaleStatus', () => {
    it('should update sale status successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      })

      const result = await updateSaleStatus('sale-123', 'completed')

      expect(result.success).toBe(true)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sales')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ventas')
    })

    it('should handle update errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      })

      const result = await updateSaleStatus('sale-123', 'cancelled')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Update failed')
    })
  })

  describe('cancelSale', () => {
    it('should cancel sale successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      })

      const result = await cancelSale('sale-123')

      expect(result.success).toBe(true)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sales')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ventas')
    })

    it('should handle cancellation errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Cancellation failed' },
        }),
      })

      const result = await cancelSale('sale-123')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Cancellation failed')
    })
  })

  describe('getSales', () => {
    it('should fetch sales successfully', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          sale_number: 'SALE001',
          total_amount: 100,
          status: 'completed',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'sale-2',
          sale_number: 'SALE002',
          total_amount: 200,
          status: 'completed',
          created_at: '2024-01-15T11:00:00Z',
        },
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockSales,
          error: null,
        }),
      })

      const result = await getSales()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSales)
      expect(result.data).toHaveLength(2)
    })

    it('should handle fetch errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' },
        }),
      })

      const result = await getSales()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Fetch failed')
    })

    it('should apply filters correctly', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      await getSales({
        status: 'completed',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed')
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01')
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', '2024-01-31')
    })
  })

  describe('getSaleById', () => {
    it('should fetch sale by ID successfully', async () => {
      const mockSale = {
        id: 'sale-123',
        sale_number: 'SALE123',
        total_amount: 150,
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
        sale_items: [
          {
            id: 'item-1',
            product_id: 'product-1',
            quantity: 2,
            unit_price: 50,
            subtotal: 100,
          },
        ],
        sale_payments: [
          {
            id: 'payment-1',
            payment_method_id: 'method-1',
            amount: 150,
          },
        ],
      }

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockSale,
          error: null,
        }),
      })

      const result = await getSaleById('sale-123')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSale)
      expect(result.data?.sale_items).toHaveLength(1)
      expect(result.data?.sale_payments).toHaveLength(1)
    })

    it('should handle sale not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Sale not found' },
        }),
      })

      const result = await getSaleById('nonexistent-sale')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sale not found')
    })
  })

  describe('processPayment', () => {
    const paymentData = {
      sale_id: 'sale-123',
      payment_method_id: 'method-1',
      amount: 100,
    }

    it('should process payment successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'payment-123' },
          error: null,
        }),
      })

      const result = await processPayment(paymentData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 'payment-123' })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ventas')
    })

    it('should handle payment processing errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Payment failed' },
        }),
      })

      const result = await processPayment(paymentData)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Payment failed')
    })
  })

  describe('getSalesBySession', () => {
    it('should fetch sales by session successfully', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          sale_number: 'SALE001',
          total_amount: 100,
        },
        {
          id: 'sale-2',
          sale_number: 'SALE002',
          total_amount: 200,
        },
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockSales,
          error: null,
        }),
      })

      const result = await getSalesBySession('session-123')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSales)
      expect(result.data).toHaveLength(2)
    })

    it('should handle session fetch errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Session not found' },
        }),
      })

      const result = await getSalesBySession('invalid-session')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Session not found')
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle authentication errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Auth failed'))

      const result = await createSale({
        cash_register_id: 'cash-123',
        items: [{ product_id: 'prod-1', quantity: 1, unit_price: 100 }],
        payments: [{ payment_method_id: 'pay-1', amount: 100 }],
        status: 'completed',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Auth failed')
    })

    it('should handle complex sale with multiple payments', async () => {
      const complexSaleData = {
        cash_register_id: 'cash-123',
        area: 'shop',
        items: [
          { product_id: 'prod-1', quantity: 2, unit_price: 50 },
          { product_id: 'prod-2', quantity: 3, unit_price: 30 },
        ],
        payments: [
          { payment_method_id: 'cash', amount: 100 },
          { payment_method_id: 'card', amount: 110 },
        ],
        status: 'completed' as const,
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-123', status: 'open' },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          data: 'complex-sale-123',
          error: null,
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'complex-sale-123',
        error: null,
      })

      const result = await createSale(complexSaleData)

      expect(result.success).toBe(true)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_sale', {
        p_sale_data: expect.objectContaining({
          total_amount: 190, // (2*50) + (3*30)
          items: complexSaleData.items,
          payments: complexSaleData.payments,
        }),
      })
    })

    it('should validate total payment amount matches sale total', async () => {
      const invalidPaymentData = {
        cash_register_id: 'cash-123',
        area: 'shop',
        items: [{ product_id: 'prod-1', quantity: 1, unit_price: 100 }],
        payments: [
          { payment_method_id: 'cash', amount: 50 }, // Insufficient payment
        ],
        status: 'completed' as const,
      }

      // This would be handled by the saleSchema validation
      const result = await createSale(invalidPaymentData)

      // The validation happens in the schema, so we expect it to fail
      // because completed sales require full payment
      expect(result.success).toBe(false)
    })
  })
})
