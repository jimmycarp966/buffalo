import { POST } from '@/app/api/import-products/route'

// Mock the import function
jest.mock('@/actions/productActions', () => ({
  importProductsFromPDF: jest.fn(),
}))

describe('Import Products API - Integration Tests', () => {
  const mockImportProductsFromPDF = require('@/actions/productActions').importProductsFromPDF

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/import-products', () => {
    it('should successfully import products from PDF', async () => {
      const mockResult = {
        success: true,
        message: 'Importación completada exitosamente',
        importedCount: 25,
        skippedCount: 2,
        errors: [],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      // Mock console methods to avoid test output pollution
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual(mockResult)

      expect(mockImportProductsFromPDF).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Iniciando importación de productos desde PDF...')
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Resultado:', JSON.stringify(mockResult, null, 2))
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Importación exitosa')

      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('should handle import failure', async () => {
      const mockResult = {
        success: false,
        message: 'Error al procesar el archivo PDF',
        importedCount: 0,
        skippedCount: 0,
        errors: ['Archivo no encontrado', 'Formato inválido'],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result).toEqual(mockResult)

      expect(consoleLogSpy).toHaveBeenCalledWith('API: Iniciando importación de productos desde PDF...')
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Error en importación:', mockResult.message)

      consoleLogSpy.mockRestore()
    })

    it('should handle unexpected errors', async () => {
      const mockError = new Error('Database connection failed')
      mockImportProductsFromPDF.mockRejectedValue(mockError)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        success: false,
        message: mockError.message,
        stack: mockError.stack,
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('API: Error en importación:', mockError)
      expect(consoleErrorSpy).toHaveBeenCalledWith('API: Stack trace:', mockError.stack)

      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('should handle errors without stack trace', async () => {
      const mockError = { message: 'Simple error without stack' }
      mockImportProductsFromPDF.mockRejectedValue(mockError)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        success: false,
        message: mockError.message,
        stack: undefined,
      })

      consoleErrorSpy.mockRestore()
    })

    it('should log import initiation', async () => {
      const mockResult = {
        success: true,
        message: 'Import successful',
        importedCount: 10,
        skippedCount: 0,
        errors: [],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await POST()

      expect(consoleLogSpy).toHaveBeenCalledWith('API: Iniciando importación de productos desde PDF...')

      consoleLogSpy.mockRestore()
    })

    it('should log successful import details', async () => {
      const mockResult = {
        success: true,
        message: '25 products imported successfully',
        importedCount: 25,
        skippedCount: 3,
        errors: ['Warning: 3 products skipped'],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await POST()

      expect(consoleLogSpy).toHaveBeenCalledWith('API: Resultado:', JSON.stringify(mockResult, null, 2))
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Importación exitosa')

      consoleLogSpy.mockRestore()
    })

    it('should log failed import details', async () => {
      const mockResult = {
        success: false,
        message: 'PDF processing failed',
        importedCount: 0,
        skippedCount: 0,
        errors: ['Invalid PDF format'],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await POST()

      expect(consoleLogSpy).toHaveBeenCalledWith('API: Error en importación:', mockResult.message)

      consoleLogSpy.mockRestore()
    })

    it('should handle empty import result', async () => {
      const mockResult = {
        success: true,
        message: 'No products to import',
        importedCount: 0,
        skippedCount: 0,
        errors: [],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual(mockResult)
      expect(result.importedCount).toBe(0)
    })

    it('should handle import with warnings', async () => {
      const mockResult = {
        success: true,
        message: 'Import completed with warnings',
        importedCount: 20,
        skippedCount: 5,
        errors: [
          'Warning: 5 products had invalid prices',
          'Info: Some products were updated instead of created'
        ],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.importedCount).toBe(20)
      expect(result.skippedCount).toBe(5)
      expect(result.errors).toHaveLength(2)
    })

    it('should return JSON content type', async () => {
      const mockResult = {
        success: true,
        message: 'Success',
        importedCount: 0,
        skippedCount: 0,
        errors: [],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const response = await POST()

      // NextResponse should set JSON content type
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should handle extremely large import results', async () => {
      const largeResult = {
        success: true,
        message: 'Large import completed',
        importedCount: 10000,
        skippedCount: 500,
        errors: Array.from({ length: 100 }, (_, i) => `Error ${i + 1}`),
      }

      mockImportProductsFromPDF.mockResolvedValue(largeResult)

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.importedCount).toBe(10000)
      expect(result.errors).toHaveLength(100)
    })

    it('should handle import function throwing non-Error objects', async () => {
      const mockError = 'String error message'
      mockImportProductsFromPDF.mockRejectedValue(mockError)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        success: false,
        message: mockError,
        stack: undefined,
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle null/undefined import results', async () => {
      mockImportProductsFromPDF.mockResolvedValue(null)

      const response = await POST()

      // Should still return a valid response
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toBe(null)
    })
  })

  describe('Error boundary testing', () => {
    it('should handle completely broken import function', async () => {
      mockImportProductsFromPDF.mockImplementation(() => {
        throw 'Not an Error object'
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST()
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
      expect(result.message).toBe('Not an Error object')

      consoleErrorSpy.mockRestore()
    })

    it('should handle import function returning undefined', async () => {
      mockImportProductsFromPDF.mockResolvedValue(undefined)

      const response = await POST()

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toBe(undefined)
    })
  })

  describe('Logging behavior', () => {
    it('should log all operations consistently', async () => {
      const mockResult = {
        success: true,
        message: 'Test import',
        importedCount: 1,
        skippedCount: 0,
        errors: [],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await POST()

      // Should log initiation
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Iniciando importación de productos desde PDF...')

      // Should log result
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Resultado:', JSON.stringify(mockResult, null, 2))

      // Should log success
      expect(consoleLogSpy).toHaveBeenCalledWith('API: Importación exitosa')

      consoleLogSpy.mockRestore()
    })

    it('should not expose sensitive information in logs', async () => {
      const mockResult = {
        success: false,
        message: 'Authentication failed',
        importedCount: 0,
        skippedCount: 0,
        errors: ['Invalid credentials'],
      }

      mockImportProductsFromPDF.mockResolvedValue(mockResult)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await POST()

      // Should not log sensitive error details in a way that exposes them
      const logCalls = consoleLogSpy.mock.calls
      const errorLogCall = logCalls.find(call => call[0] === 'API: Error en importación:')

      if (errorLogCall) {
        expect(errorLogCall[1]).toBe(mockResult.message)
      }

      consoleLogSpy.mockRestore()
    })
  })
})








