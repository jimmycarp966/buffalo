import {
  loginSchema,
  productSchema,
  saleSchema,
  openCashRegisterSchema,
  closeCashRegisterSchema,
  expenseSchema,
  incomeSchema,
  comboSchema,
  userSchema,
  inventoryEntrySchema,
  inventoryItemSchema,
  inventoryItemMovementSchema,
  productInventoryItemSchema,
  EMPLOYEES,
  EMPLOYEES_BY_ROLE,
  type LoginInput,
  type ProductInput,
  type SaleInput,
  type OpenCashRegisterInput,
  type CloseCashRegisterInput,
  type ExpenseInput,
  type IncomeInput,
  type ComboInput,
  type UserInput,
  type InventoryEntryInput,
  type InventoryItemInput,
  type InventoryItemMovementInput,
  type ProductInventoryItemInput
} from '@/lib/validations'

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: '123456'
      }

      expect(() => loginSchema.parse(validData)).not.toThrow()
      const result = loginSchema.parse(validData)
      expect(result).toEqual(validData)
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123456'
      }

      expect(() => loginSchema.parse(invalidData)).toThrow()
    })

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '123'
      }

      expect(() => loginSchema.parse(invalidData)).toThrow()
    })

    it('should reject empty fields', () => {
      expect(() => loginSchema.parse({ email: '', password: '' })).toThrow()
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow()
      expect(() => loginSchema.parse({ email: '', password: '123456' })).toThrow()
    })

    it('should handle edge cases', () => {
      // Very long email
      const longEmail = 'a'.repeat(200) + '@example.com'
      expect(() => loginSchema.parse({ email: longEmail, password: '123456' })).not.toThrow()

      // Password with special characters
      expect(() => loginSchema.parse({ email: 'test@example.com', password: 'p@ssw0rd!' })).not.toThrow()
    })
  })

  describe('productSchema', () => {
    const validProduct = {
      name: 'Test Product',
      code: '123456789',
      description: 'Test description',
      category_id: '123e4567-e89b-12d3-a456-426614174000',
      cost_price: 100,
      sale_price: 150,
      profit_margin: 50,
      use_auto_price: false,
      stock: 10,
      min_stock: 5,
      supplier_id: '123e4567-e89b-12d3-a456-426614174000',
      unlimited_stock: false
    }

    it('should validate valid product data', () => {
      expect(() => productSchema.parse(validProduct)).not.toThrow()
      const result = productSchema.parse(validProduct)
      expect(result.name).toBe(validProduct.name)
    })

    it('should require name', () => {
      const invalidProduct = { ...validProduct, name: '' }
      expect(() => productSchema.parse(invalidProduct)).toThrow()
    })

    it('should validate cost_price >= 0', () => {
      expect(() => productSchema.parse({ ...validProduct, cost_price: -1 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, cost_price: 0 })).not.toThrow()
    })

    it('should validate sale_price >= 0', () => {
      expect(() => productSchema.parse({ ...validProduct, sale_price: -1 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, sale_price: 0 })).not.toThrow()
    })

    it('should validate stock as integer >= 0', () => {
      expect(() => productSchema.parse({ ...validProduct, stock: -1 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, stock: 1.5 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, stock: 0 })).not.toThrow()
    })

    it('should validate min_stock as integer >= 0', () => {
      expect(() => productSchema.parse({ ...validProduct, min_stock: -1 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, min_stock: 1.5 })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, min_stock: 0 })).not.toThrow()
    })

    it('should validate UUIDs when provided', () => {
      expect(() => productSchema.parse({ ...validProduct, category_id: 'invalid-uuid' })).toThrow()
      expect(() => productSchema.parse({ ...validProduct, supplier_id: 'invalid-uuid' })).toThrow()
    })

    it('should handle optional fields', () => {
      const minimalProduct = {
        name: 'Test Product',
        cost_price: 100,
        sale_price: 150,
        use_auto_price: false,
        stock: 10,
        min_stock: 5
      }

      expect(() => productSchema.parse(minimalProduct)).not.toThrow()
    })

    it('should handle unlimited stock products', () => {
      const unlimitedProduct = { ...validProduct, unlimited_stock: true, stock: 0, min_stock: 0 }
      expect(() => productSchema.parse(unlimitedProduct)).not.toThrow()
    })
  })

  describe('saleSchema', () => {
    const validSale = {
      cash_register_id: '123e4567-e89b-12d3-a456-426614174000',
      area: 'bar' as const,
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 2,
          unit_price: 100
        }
      ],
      payments: [
        {
          payment_method_id: '123e4567-e89b-12d3-a456-426614174000',
          amount: 200
        }
      ],
      table_number: 5,
      status: 'completed' as const
    }

    it('should validate valid sale data', () => {
      expect(() => saleSchema.parse(validSale)).not.toThrow()
    })

    it('should require at least one item', () => {
      const invalidSale = { ...validSale, items: [] }
      expect(() => saleSchema.parse(invalidSale)).toThrow()
    })

    it('should validate item quantities >= 1', () => {
      const invalidSale = {
        ...validSale,
        items: [{ product_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 0, unit_price: 100 }]
      }
      expect(() => saleSchema.parse(invalidSale)).toThrow()
    })

    it('should validate payment amounts >= 0', () => {
      const invalidSale = {
        ...validSale,
        payments: [{ payment_method_id: '123e4567-e89b-12d3-a456-426614174000', amount: -1 }]
      }
      expect(() => saleSchema.parse(invalidSale)).toThrow()
    })

    it('should require payments for completed sales', () => {
      const invalidSale = { ...validSale, payments: [] }
      expect(() => saleSchema.parse(invalidSale)).toThrow()
    })

    it('should allow pending sales without payments', () => {
      const pendingSale = { ...validSale, status: 'pending' as const, payments: [] }
      expect(() => saleSchema.parse(pendingSale)).not.toThrow()
    })

    it('should validate table_number range', () => {
      expect(() => saleSchema.parse({ ...validSale, table_number: 0 })).toThrow()
      expect(() => saleSchema.parse({ ...validSale, table_number: 101 })).toThrow()
      expect(() => saleSchema.parse({ ...validSale, table_number: 1 })).not.toThrow()
      expect(() => saleSchema.parse({ ...validSale, table_number: 100 })).not.toThrow()
    })

    it('should validate area enum', () => {
      expect(() => saleSchema.parse({ ...validSale, area: 'invalid' })).toThrow()
      expect(() => saleSchema.parse({ ...validSale, area: 'bar' })).not.toThrow()
    })

    it('should validate status enum', () => {
      expect(() => saleSchema.parse({ ...validSale, status: 'invalid' })).toThrow()
      expect(() => saleSchema.parse({ ...validSale, status: 'completed' })).not.toThrow()
      expect(() => saleSchema.parse({ ...validSale, status: 'pending' })).not.toThrow()
    })
  })

  describe('openCashRegisterSchema', () => {
    const validOpenCash = {
      cash_register_id: '123e4567-e89b-12d3-a456-426614174000',
      opening_amount: 1000,
      shift: 'morning' as const,
      area: 'bar' as const,
      opening_notes: 'Test notes',
      employees: ['emp1', 'emp2']
    }

    it('should validate valid open cash data', () => {
      expect(() => openCashRegisterSchema.parse(validOpenCash)).not.toThrow()
    })

    it('should validate opening_amount >= 0', () => {
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, opening_amount: -1 })).toThrow()
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, opening_amount: 0 })).not.toThrow()
    })

    it('should validate shift enum', () => {
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, shift: 'invalid' })).toThrow()
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, shift: 'morning' })).not.toThrow()
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, shift: 'afternoon' })).not.toThrow()
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, shift: 'night' })).toThrow()
    })

    it('should validate area enum', () => {
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, area: 'invalid' })).toThrow()
      expect(() => openCashRegisterSchema.parse({ ...validOpenCash, area: 'bar' })).not.toThrow()
    })
  })

  describe('closeCashRegisterSchema', () => {
    const validCloseCash = {
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      closing_amount: 1500,
      closing_notes: 'Test close notes'
    }

    it('should validate valid close cash data', () => {
      expect(() => closeCashRegisterSchema.parse(validCloseCash)).not.toThrow()
    })

    it('should validate closing_amount >= 0', () => {
      expect(() => closeCashRegisterSchema.parse({ ...validCloseCash, closing_amount: -1 })).toThrow()
      expect(() => closeCashRegisterSchema.parse({ ...validCloseCash, closing_amount: 0 })).not.toThrow()
    })
  })

  describe('expenseSchema', () => {
    const validExpense = {
      description: 'Test expense',
      amount: 500,
      category: 'services' as const,
      cash_register_session_id: '123e4567-e89b-12d3-a456-426614174000'
    }

    it('should validate valid expense data', () => {
      expect(() => expenseSchema.parse(validExpense)).not.toThrow()
    })

    it('should require description', () => {
      expect(() => expenseSchema.parse({ ...validExpense, description: '' })).toThrow()
    })

    it('should validate amount >= 0', () => {
      expect(() => expenseSchema.parse({ ...validExpense, amount: -1 })).toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, amount: 0 })).not.toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, amount: 0.01 })).not.toThrow()
    })

    it('should validate category enum', () => {
      expect(() => expenseSchema.parse({ ...validExpense, category: 'invalid' })).toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, category: 'services' })).not.toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, category: 'supplies' })).not.toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, category: 'maintenance' })).not.toThrow()
      expect(() => expenseSchema.parse({ ...validExpense, category: 'other' })).not.toThrow()
    })
  })

  describe('incomeSchema', () => {
    const validIncome = {
      description: 'Test income description',
      amount: 1000,
      cash_register_session_id: '123e4567-e89b-12d3-a456-426614174000'
    }

    it('should validate valid income data', () => {
      expect(() => incomeSchema.parse(validIncome)).not.toThrow()
    })

    it('should require description with minimum length', () => {
      expect(() => incomeSchema.parse({ ...validIncome, description: '1234' })).toThrow()
      expect(() => incomeSchema.parse({ ...validIncome, description: '12345' })).not.toThrow()
    })

    it('should validate amount > 0', () => {
      expect(() => incomeSchema.parse({ ...validIncome, amount: 0 })).toThrow()
      expect(() => incomeSchema.parse({ ...validIncome, amount: 0.005 })).toThrow()
      expect(() => incomeSchema.parse({ ...validIncome, amount: 0.01 })).not.toThrow()
    })
  })

  describe('comboSchema', () => {
    const validCombo = {
      name: 'Test Combo',
      description: 'Test combo description',
      price: 250,
      is_active: true,
      items: [
        { product_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 },
        { product_id: '456e7890-e89b-12d3-a456-426614174001', quantity: 1 }
      ]
    }

    it('should validate valid combo data', () => {
      expect(() => comboSchema.parse(validCombo)).not.toThrow()
    })

    it('should require name', () => {
      expect(() => comboSchema.parse({ ...validCombo, name: '' })).toThrow()
    })

    it('should validate price >= 0', () => {
      expect(() => comboSchema.parse({ ...validCombo, price: -1 })).toThrow()
      expect(() => comboSchema.parse({ ...validCombo, price: 0 })).not.toThrow()
    })

    it('should require at least 2 items', () => {
      const invalidCombo = { ...validCombo, items: [{ product_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }] }
      expect(() => comboSchema.parse(invalidCombo)).toThrow()
    })

    it('should validate item quantities >= 1', () => {
      const invalidCombo = {
        ...validCombo,
        items: [
          { product_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 0 },
          { product_id: '456e7890-e89b-12d3-a456-426614174001', quantity: 1 }
        ]
      }
      expect(() => comboSchema.parse(invalidCombo)).toThrow()
    })
  })

  describe('userSchema', () => {
    const validUser = {
      email: 'user@example.com',
      name: 'Test User',
      role: 'cashier' as const,
      is_active: true
    }

    it('should validate valid user data', () => {
      expect(() => userSchema.parse(validUser)).not.toThrow()
    })

    it('should require valid email', () => {
      expect(() => userSchema.parse({ ...validUser, email: 'invalid-email' })).toThrow()
    })

    it('should require name', () => {
      expect(() => userSchema.parse({ ...validUser, name: '' })).toThrow()
    })

    it('should validate role enum', () => {
      expect(() => userSchema.parse({ ...validUser, role: 'invalid' })).toThrow()
      expect(() => userSchema.parse({ ...validUser, role: 'admin' })).not.toThrow()
      expect(() => userSchema.parse({ ...validUser, role: 'supervisor' })).not.toThrow()
      expect(() => userSchema.parse({ ...validUser, role: 'cashier' })).not.toThrow()
    })
  })

  describe('inventoryEntrySchema', () => {
    const validEntry = {
      product_id: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 10,
      reason: 'Test entry',
      supplier_id: '123e4567-e89b-12d3-a456-426614174000'
    }

    it('should validate valid inventory entry data', () => {
      expect(() => inventoryEntrySchema.parse(validEntry)).not.toThrow()
    })

    it('should validate quantity >= 1', () => {
      expect(() => inventoryEntrySchema.parse({ ...validEntry, quantity: 0 })).toThrow()
      expect(() => inventoryEntrySchema.parse({ ...validEntry, quantity: 1 })).not.toThrow()
    })

    it('should require reason', () => {
      expect(() => inventoryEntrySchema.parse({ ...validEntry, reason: '' })).toThrow()
    })
  })

  describe('inventoryItemSchema', () => {
    const validItem = {
      name: 'Test Item',
      description: 'Test description',
      category: 'limpieza' as const,
      unit: 'unidad' as const,
      stock: 100,
      min_stock: 10,
      supplier_id: '123e4567-e89b-12d3-a456-426614174000',
      location: 'almacen' as const,
      is_active: true
    }

    it('should validate valid inventory item data', () => {
      expect(() => inventoryItemSchema.parse(validItem)).not.toThrow()
    })

    it('should require name', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, name: '' })).toThrow()
    })

    it('should validate category enum', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, category: 'invalid' })).toThrow()
      const validCategories = ['limpieza', 'insumos', 'mantenimiento', 'oficina', 'otros']
      validCategories.forEach(category => {
        expect(() => inventoryItemSchema.parse({ ...validItem, category: category as any })).not.toThrow()
      })
    })

    it('should validate unit enum', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, unit: 'invalid' })).toThrow()
      const validUnits = ['unidad', 'kg', 'litro', 'paquete', 'botella', 'caja', 'otro']
      validUnits.forEach(unit => {
        expect(() => inventoryItemSchema.parse({ ...validItem, unit: unit as any })).not.toThrow()
      })
    })

    it('should validate stock >= 0', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, stock: -1 })).toThrow()
      expect(() => inventoryItemSchema.parse({ ...validItem, stock: 0 })).not.toThrow()
    })

    it('should validate min_stock >= 0', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, min_stock: -1 })).toThrow()
      expect(() => inventoryItemSchema.parse({ ...validItem, min_stock: 0 })).not.toThrow()
    })

    it('should validate location enum', () => {
      expect(() => inventoryItemSchema.parse({ ...validItem, location: 'invalid' })).toThrow()
      const validLocations = ['almacen', 'cocina', 'barra', 'baños', 'oficina', 'otro']
      validLocations.forEach(location => {
        expect(() => inventoryItemSchema.parse({ ...validItem, location: location as any })).not.toThrow()
      })
    })
  })

  describe('inventoryItemMovementSchema', () => {
    const validMovement = {
      inventory_item_id: '123e4567-e89b-12d3-a456-426614174000',
      movement_type: 'entry' as const,
      quantity: 5,
      reason: 'Test movement'
    }

    it('should validate valid movement data', () => {
      expect(() => inventoryItemMovementSchema.parse(validMovement)).not.toThrow()
    })

    it('should validate movement_type enum', () => {
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, movement_type: 'invalid' })).toThrow()
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, movement_type: 'entry' })).not.toThrow()
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, movement_type: 'exit' })).not.toThrow()
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, movement_type: 'adjustment' })).not.toThrow()
    })

    it('should validate quantity >= 1', () => {
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, quantity: 0 })).toThrow()
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, quantity: 1 })).not.toThrow()
    })

    it('should require reason', () => {
      expect(() => inventoryItemMovementSchema.parse({ ...validMovement, reason: '' })).toThrow()
    })
  })

  describe('productInventoryItemSchema', () => {
    const validLink = {
      product_id: '123e4567-e89b-12d3-a456-426614174000',
      inventory_item_id: '123e4567-e89b-12d3-a456-426614174001',
      quantity: 0.5
    }

    it('should validate valid link data', () => {
      expect(() => productInventoryItemSchema.parse(validLink)).not.toThrow()
    })

    it('should validate quantity > 0', () => {
      expect(() => productInventoryItemSchema.parse({ ...validLink, quantity: 0 })).toThrow()
      expect(() => productInventoryItemSchema.parse({ ...validLink, quantity: -1 })).toThrow()
      expect(() => productInventoryItemSchema.parse({ ...validLink, quantity: 0.1 })).not.toThrow()
    })
  })

  describe('EMPLOYEES data structure', () => {
    it('should have correct employee structure', () => {
      expect(Array.isArray(EMPLOYEES)).toBe(true)
      expect(EMPLOYEES.length).toBeGreaterThan(0)

      EMPLOYEES.forEach(employee => {
        expect(employee).toHaveProperty('id')
        expect(employee).toHaveProperty('name')
        expect(employee).toHaveProperty('role')
        expect(['mozo', 'cantinero', 'cajero']).toContain(employee.role)
      })
    })

    it('should have unique employee IDs', () => {
      const ids = EMPLOYEES.map(emp => emp.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('EMPLOYEES_BY_ROLE', () => {
    it('should correctly group employees by role', () => {
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('mozo')
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('cantinero')
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('cajero')

      Object.entries(EMPLOYEES_BY_ROLE).forEach(([role, employees]) => {
        employees.forEach(employee => {
          expect(employee.role).toBe(role)
        })
      })
    })

    it('should include all employees in their respective groups', () => {
      const totalGrouped = Object.values(EMPLOYEES_BY_ROLE).reduce((sum, group) => sum + group.length, 0)
      expect(totalGrouped).toBe(EMPLOYEES.length)
    })
  })

  describe('Type exports', () => {
    it('should export all input types (TypeScript compilation check)', () => {
      // This test passes if the file compiles without errors
      // The types are exported and available for TypeScript usage
      expect(true).toBe(true)
    })

    it('should export EMPLOYEES data', () => {
      expect(EMPLOYEES).toBeDefined()
      expect(Array.isArray(EMPLOYEES)).toBe(true)
      expect(EMPLOYEES.length).toBeGreaterThan(0)
    })

    it('should export EMPLOYEES_BY_ROLE data', () => {
      expect(EMPLOYEES_BY_ROLE).toBeDefined()
      expect(typeof EMPLOYEES_BY_ROLE).toBe('object')
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('mozo')
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('cantinero')
      expect(EMPLOYEES_BY_ROLE).toHaveProperty('cajero')
    })
  })
})
