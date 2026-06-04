import request from 'supertest'
import { createServer } from 'http'

// Mock Next.js app
jest.mock('next', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getRequestHandler: jest.fn(() => jest.fn()),
    prepare: jest.fn().mockResolvedValue(undefined),
  })),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Products API - Integration Tests', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn(),
      })),
    }

    const mockCreateClient = require('@/lib/supabase/server').createClient
    mockCreateClient.mockResolvedValue(mockSupabaseClient)
  })

  describe('GET /api/products', () => {
    it('should return products successfully', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          name: 'Product 1',
          price: 100,
          stock: 10,
          unlimited_stock: false,
          is_active: true,
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          price: 200,
          stock: 5,
          unlimited_stock: false,
          is_active: true,
        },
      ]

      // Mock the database query
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockProducts,
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      // Import the handler dynamically to avoid Next.js initialization issues
      const { GET } = require('@/app/api/products/route')

      // Create a mock request/response
      const mockRequest = new Request('http://localhost:3000/api/products', {
        method: 'GET',
      })

      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual(mockProducts)

      // Verify the query was constructed correctly
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockQuery.select).toHaveBeenCalledWith(`
        id,
        name,
        price,
        stock,
        unlimited_stock,
        is_active
      `)
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(mockQuery.order).toHaveBeenCalledWith('name')
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed')

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockRejectedValue(mockError),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        error: 'Error al cargar productos',
      })

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching products:', mockError)

      consoleSpy.mockRestore()
    })

    it('should handle Supabase query errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed', code: 'PGRST116' },
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        error: 'Error al cargar productos',
      })

      consoleSpy.mockRestore()
    })

    it('should return empty array when no products found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual([])
    })

    it('should filter only active products', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      await GET()

      // Verify that the query filters by is_active = true
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('should select correct fields', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      await GET()

      // Verify the exact fields being selected
      expect(mockQuery.select).toHaveBeenCalledWith(`
        id,
        name,
        price,
        stock,
        unlimited_stock,
        is_active
      `)
    })

    it('should order products by name', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      await GET()

      // Verify ordering by name
      expect(mockQuery.order).toHaveBeenCalledWith('name')
    })

    it('should handle client creation errors', async () => {
      const mockCreateClient = require('@/lib/supabase/server').createClient
      mockCreateClient.mockRejectedValue(new Error('Connection failed'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        error: 'Error al cargar productos',
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Response format', () => {
    it('should return JSON content type', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      const response = await GET()

      // NextResponse should set appropriate headers
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should handle large result sets', async () => {
      const largeProductSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Product ${i}`,
        price: 100 + i,
        stock: 10 + i,
        unlimited_stock: false,
        is_active: true,
      }))

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: largeProductSet,
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1000)
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle malformed Supabase response', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null, // Valid response but null data
          error: null,
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual([]) // Should return empty array for null data
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() => {
          throw new Error('Unexpected database error')
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockQuery)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const { GET } = require('@/app/api/products/route')
      const response = await GET()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        error: 'Error al cargar productos',
      })

      consoleSpy.mockRestore()
    })
  })
})








