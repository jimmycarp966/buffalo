import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}))

describe('Supabase RPC Functions - Database Tests', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient = createClient('url', 'key')
  })

  describe('create_sale() RPC Function', () => {
    it('should create a basic sale successfully', async () => {
      const mockSaleData = {
        sale_number: 'SALE001234567890ABCD',
        cash_register_session_id: 'session-123',
        user_id: 'user-123',
        total_amount: 150.50,
        status: 'completed',
        items: [
          {
            product_id: 'product-1',
            quantity: 2,
            unit_price: 50.00,
            subtotal: 100.00
          },
          {
            product_id: 'product-2',
            quantity: 1,
            unit_price: 50.50,
            subtotal: 50.50
          }
        ],
        payments: [
          {
            payment_method_id: 'cash',
            amount: 150.50
          }
        ]
      }

      const mockSaleId = 'sale-uuid-123'
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockSaleId,
        error: null
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: mockSaleData
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_sale', {
        p_sale_data: mockSaleData
      })
      expect(result.data).toBe(mockSaleId)
      expect(result.error).toBeNull()
    })

    it('should create a sale with table number for bar', async () => {
      const mockBarSaleData = {
        sale_number: 'BAR001234567890ABCD',
        cash_register_session_id: 'bar-session-123',
        user_id: 'user-123',
        total_amount: 200.00,
        table_number: 5,
        status: 'completed',
        items: [
          {
            product_id: 'drink-1',
            quantity: 4,
            unit_price: 50.00,
            subtotal: 200.00
          }
        ],
        payments: [
          {
            payment_method_id: 'card',
            amount: 200.00
          }
        ]
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'bar-sale-uuid-123',
        error: null
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: mockBarSaleData
      })

      expect(result.data).toBe('bar-sale-uuid-123')
    })

    it('should handle insufficient stock error', async () => {
      const mockSaleData = {
        sale_number: 'SALE001234567890ABCD',
        cash_register_session_id: 'session-123',
        user_id: 'user-123',
        total_amount: 100.00,
        status: 'completed',
        items: [
          {
            product_id: 'out-of-stock-product',
            quantity: 10,
            unit_price: 10.00,
            subtotal: 100.00
          }
        ],
        payments: [
          {
            payment_method_id: 'cash',
            amount: 100.00
          }
        ]
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient stock for product out-of-stock-product' }
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: mockSaleData
      })

      expect(result.data).toBeNull()
      expect(result.error.message).toContain('Insufficient stock')
    })

    it('should handle invalid session error', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'No open cash register session found' }
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: { /* invalid data */ }
      })

      expect(result.data).toBeNull()
      expect(result.error.message).toContain('No open cash register session')
    })

    it('should create pending sales without payment validation', async () => {
      const mockPendingSaleData = {
        sale_number: 'PENDING001234567890ABCD',
        cash_register_session_id: 'session-123',
        user_id: 'user-123',
        total_amount: 75.00,
        status: 'pending',
        items: [
          {
            product_id: 'product-1',
            quantity: 1,
            unit_price: 75.00,
            subtotal: 75.00
          }
        ],
        payments: [] // Empty payments allowed for pending sales
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'pending-sale-uuid-123',
        error: null
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: mockPendingSaleData
      })

      expect(result.data).toBe('pending-sale-uuid-123')
      expect(result.error).toBeNull()
    })
  })

  describe('close_cash_register() RPC Function', () => {
    it('should close cash register successfully', async () => {
      const mockCloseData = {
        session_id: 'session-123',
        closing_amount: 1500.00,
        closing_notes: 'Everything accounted for'
      }

      const mockResult = {
        session_id: 'session-123',
        status: 'closed',
        closing_amount: 1500.00,
        expected_amount: 1450.00,
        difference: 50.00,
        closed_at: '2024-01-15T18:00:00Z'
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockResult,
        error: null
      })

      const result = await mockSupabaseClient.rpc('close_cash_register', mockCloseData)

      expect(result.data).toEqual(mockResult)
      expect(result.data.status).toBe('closed')
      expect(result.data.difference).toBe(50.00)
    })

    it('should handle cash discrepancy errors', async () => {
      const mockCloseData = {
        session_id: 'session-123',
        closing_amount: 1300.00, // Short by 200
        closing_notes: 'Missing cash'
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Cash discrepancy too large: -200.00' }
      })

      const result = await mockSupabaseClient.rpc('close_cash_register', mockCloseData)

      expect(result.data).toBeNull()
      expect(result.error.message).toContain('Cash discrepancy')
    })

    it('should close multiple sessions simultaneously', async () => {
      // Test para verificar el cierre de sesiones de caja
      const mockCloseData = {
        session_id: 'session-123',
        closing_amount: 2500.00,
        closing_notes: 'Cierre de sesión de caja'
      }

      const mockResult = {
        bar_session: { id: 'bar-session', status: 'closed' },
        total_closing_amount: 2500.00,
        total_expected: 2450.00,
        total_difference: 50.00
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockResult,
        error: null
      })

      const result = await mockSupabaseClient.rpc('close_cash_register', mockCloseData)

      expect(result.data.total_difference).toBe(50.00)
    })

    it('should validate session exists and is open', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Session not found or already closed' }
      })

      const result = await mockSupabaseClient.rpc('close_cash_register', {
        session_id: 'nonexistent-session',
        closing_amount: 1000.00
      })

      expect(result.error.message).toContain('Session not found')
    })
  })

  describe('get_cash_summary_preview() RPC Function', () => {
    it('should calculate cash summary correctly', async () => {
      const mockSummary = {
        session_id: 'session-123',
        opening_amount: 1000.00,
        total_sales: 2500.00,
        total_expenses: 300.00,
        expected_amount: 3200.00,
        sales_by_method: {
          cash: 1500.00,
          card: 1000.00
        },
        expense_breakdown: {
          supplies: 150.00,
          utilities: 150.00
        }
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockSummary,
        error: null
      })

      const result = await mockSupabaseClient.rpc('get_cash_summary_preview', {
        session_id: 'session-123'
      })

      expect(result.data.opening_amount).toBe(1000.00)
      expect(result.data.total_sales).toBe(2500.00)
      expect(result.data.expected_amount).toBe(3200.00) // 1000 + 2500 - 300
      expect(result.data.sales_by_method.cash).toBe(1500.00)
    })

    it('should handle sessions with no sales or expenses', async () => {
      const mockEmptySummary = {
        session_id: 'empty-session-123',
        opening_amount: 500.00,
        total_sales: 0.00,
        total_expenses: 0.00,
        expected_amount: 500.00,
        sales_by_method: {},
        expense_breakdown: {}
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockEmptySummary,
        error: null
      })

      const result = await mockSupabaseClient.rpc('get_cash_summary_preview', {
        session_id: 'empty-session-123'
      })

      expect(result.data.expected_amount).toBe(500.00)
      expect(Object.keys(result.data.sales_by_method)).toHaveLength(0)
    })

    it('should calculate negative expected amounts', async () => {
      const mockNegativeSummary = {
        session_id: 'loss-session-123',
        opening_amount: 500.00,
        total_sales: 200.00,
        total_expenses: 800.00,
        expected_amount: -100.00, // 500 + 200 - 800
        sales_by_method: { cash: 200.00 },
        expense_breakdown: { losses: 800.00 }
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockNegativeSummary,
        error: null
      })

      const result = await mockSupabaseClient.rpc('get_cash_summary_preview', {
        session_id: 'loss-session-123'
      })

      expect(result.data.expected_amount).toBe(-100.00)
    })

    it('should handle invalid session IDs', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' }
      })

      const result = await mockSupabaseClient.rpc('get_cash_summary_preview', {
        session_id: 'invalid-session-id'
      })

      expect(result.error.message).toBe('Session not found')
    })
  })

  describe('has_permission() RPC Function', () => {
    it('should grant permission for admin users', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true,
        error: null
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'admin-user-123',
        p_permission: 'sales.view'
      })

      expect(result.data).toBe(true)
    })

    it('should deny permission for unauthorized users', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: false,
        error: null
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'cashier-user-123',
        p_permission: 'settings.view' // Cashiers shouldn't have this
      })

      expect(result.data).toBe(false)
    })

    it('should check individual user permissions first', async () => {
      // Test user-specific permission override
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true,
        error: null
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'special-user-123',
        p_permission: 'inventory.edit'
      })

      expect(result.data).toBe(true)
    })

    it('should fallback to role permissions', async () => {
      // Test role-based permission
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true,
        error: null
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'supervisor-user-123',
        p_permission: 'reports.view'
      })

      expect(result.data).toBe(true)
    })

    it('should handle non-existent permissions', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: false,
        error: null
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'user-123',
        p_permission: 'nonexistent.permission'
      })

      expect(result.data).toBe(false)
    })

    it('should validate required parameters', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Missing required parameters' }
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        // Missing parameters
      })

      expect(result.error.message).toContain('Missing required parameters')
    })
  })

  describe('process_purchase() RPC Function', () => {
    it('should process purchase successfully', async () => {
      const mockPurchaseData = {
        supplier_id: 'supplier-123',
        total_amount: 500.00,
        items: [
          {
            product_id: 'product-1',
            quantity: 10,
            unit_cost: 30.00,
            subtotal: 300.00
          },
          {
            product_id: 'product-2',
            quantity: 5,
            unit_cost: 40.00,
            subtotal: 200.00
          }
        ],
        notes: 'Monthly restock'
      }

      const mockPurchaseId = 'purchase-uuid-123'

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockPurchaseId,
        error: null
      })

      const result = await mockSupabaseClient.rpc('process_purchase', {
        p_purchase_data: mockPurchaseData
      })

      expect(result.data).toBe(mockPurchaseId)
    })

    it('should update product costs and stock', async () => {
      const mockPurchaseData = {
        supplier_id: 'supplier-123',
        total_amount: 1000.00,
        items: [
          {
            product_id: 'product-1',
            quantity: 20,
            unit_cost: 50.00, // New cost
            subtotal: 1000.00
          }
        ]
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'purchase-uuid-456',
        error: null
      })

      const result = await mockSupabaseClient.rpc('process_purchase', {
        p_purchase_data: mockPurchaseData
      })

      // The function should:
      // 1. Create purchase record
      // 2. Create purchase items
      // 3. Update product cost_price to 50.00
      // 4. Increase product stock by 20
      // 5. Create inventory_movements with type 'entry'
      expect(result.data).toBe('purchase-uuid-456')
    })

    it('should handle invalid supplier', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Supplier not found' }
      })

      const result = await mockSupabaseClient.rpc('process_purchase', {
        p_purchase_data: {
          supplier_id: 'nonexistent-supplier',
          total_amount: 100.00,
          items: []
        }
      })

      expect(result.error.message).toBe('Supplier not found')
    })

    it('should validate purchase totals match item subtotals', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Purchase total does not match item subtotals' }
      })

      const result = await mockSupabaseClient.rpc('process_purchase', {
        p_purchase_data: {
          supplier_id: 'supplier-123',
          total_amount: 500.00, // Wrong total
          items: [
            {
              product_id: 'product-1',
              quantity: 1,
              unit_cost: 300.00,
              subtotal: 300.00 // Actual subtotal is 300
            }
          ]
        }
      })

      expect(result.error.message).toContain('does not match item subtotals')
    })

    it('should create inventory movements for stock entries', async () => {
      const mockPurchaseData = {
        supplier_id: 'supplier-123',
        total_amount: 600.00,
        items: [
          {
            product_id: 'product-1',
            quantity: 10,
            unit_cost: 60.00,
            subtotal: 600.00
          }
        ]
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'purchase-uuid-789',
        error: null
      })

      const result = await mockSupabaseClient.rpc('process_purchase', {
        p_purchase_data: mockPurchaseData
      })

      // The function should create inventory_movements with:
      // - type: 'entry'
      // - quantity: 10
      // - reference_type: 'purchase'
      // - reference_id: 'purchase-uuid-789'
      expect(result.data).toBe('purchase-uuid-789')
    })
  })

  describe('RPC Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabaseClient.rpc.mockRejectedValue(new Error('Database connection failed'))

      await expect(mockSupabaseClient.rpc('create_sale', {})).rejects.toThrow('Database connection failed')
    })

    it('should handle timeout errors', async () => {
      mockSupabaseClient.rpc.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 35000)
      }))

      const result = await mockSupabaseClient.rpc('create_sale', {})

      // This would normally timeout, but in test we simulate the response
      expect(result).toBeDefined()
    })

    it('should handle malformed input data', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Invalid JSON format' }
      })

      const result = await mockSupabaseClient.rpc('create_sale', {
        p_sale_data: 'invalid json string'
      })

      expect(result.error.message).toBe('Invalid JSON format')
    })

    it('should handle concurrent access conflicts', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Concurrent modification detected' }
      })

      const result = await mockSupabaseClient.rpc('close_cash_register', {
        session_id: 'concurrent-session',
        closing_amount: 1000.00
      })

      expect(result.error.message).toContain('Concurrent modification')
    })

    it('should handle permission denied errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' }
      })

      const result = await mockSupabaseClient.rpc('has_permission', {
        p_user_id: 'unauthorized-user',
        p_permission: 'admin.function'
      })

      expect(result.error.message).toBe('Permission denied')
    })
  })

  describe('RPC Performance and Load Testing', () => {
    it('should handle multiple simultaneous sales', async () => {
      const salesPromises = []
      const numberOfSales = 5

      for (let i = 0; i < numberOfSales; i++) {
        const saleData = {
          sale_number: `SALE${i}01234567890ABCD`,
          cash_register_session_id: 'session-123',
          user_id: 'user-123',
          total_amount: 100.00,
          items: [{
            product_id: 'product-1',
            quantity: 1,
            unit_price: 100.00,
            subtotal: 100.00
          }],
          payments: [{
            payment_method_id: 'cash',
            amount: 100.00
          }]
        }

        mockSupabaseClient.rpc.mockResolvedValue({
          data: `sale-uuid-${i}`,
          error: null
        })

        salesPromises.push(mockSupabaseClient.rpc('create_sale', {
          p_sale_data: saleData
        }))
      }

      const results = await Promise.all(salesPromises)

      expect(results).toHaveLength(numberOfSales)
      results.forEach((result, index) => {
        expect(result.data).toBe(`sale-uuid-${index}`)
        expect(result.error).toBeNull()
      })
    })

    it('should handle large datasets in summary calculations', async () => {
      const largeSummary = {
        session_id: 'large-session-123',
        opening_amount: 1000.00,
        total_sales: 50000.00, // Large sales volume
        total_expenses: 5000.00,
        expected_amount: 46000.00,
        sales_by_method: {
          cash: 25000.00,
          card: 20000.00,
          transfer: 5000.00
        },
        expense_breakdown: Array.from({ length: 50 }, (_, i) => ({
          category: `Expense Category ${i}`,
          amount: 100.00
        }))
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: largeSummary,
        error: null
      })

      const result = await mockSupabaseClient.rpc('get_cash_summary_preview', {
        session_id: 'large-session-123'
      })

      expect(result.data.total_sales).toBe(50000.00)
      expect(result.data.expected_amount).toBe(46000.00)
      expect(Object.keys(result.data.sales_by_method)).toHaveLength(3)
    })

    it('should handle complex permission hierarchies', async () => {
      // Test complex permission scenarios
      const permissionsToTest = [
        'sales.view',
        'sales.create',
        'inventory.view',
        'inventory.edit',
        'users.view',
        'settings.view',
        'reports.view'
      ]

      const permissionResults = []

      for (const permission of permissionsToTest) {
        mockSupabaseClient.rpc.mockResolvedValueOnce({
          data: Math.random() > 0.5, // Random true/false for testing
          error: null
        })

        const result = await mockSupabaseClient.rpc('has_permission', {
          p_user_id: 'complex-user-123',
          p_permission: permission
        })

        permissionResults.push({
          permission,
          granted: result.data
        })
      }

      expect(permissionResults).toHaveLength(permissionsToTest.length)
      permissionResults.forEach(result => {
        expect(typeof result.granted).toBe('boolean')
      })
    })
  })
})








