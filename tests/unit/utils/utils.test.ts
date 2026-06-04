import {
  cn,
  getCurrentDate,
  formatCurrency,
  formatDate,
  generateTransactionCode
} from '@/lib/utils'

describe('Utils Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge Tailwind classes correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white')
    })

    it('should handle conflicting classes by keeping the last one', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    })

    it('should handle undefined and null values', () => {
      expect(cn('bg-red-500', undefined, null, 'text-white')).toBe('bg-red-500 text-white')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const isDisabled = false
      expect(cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class'
      )).toBe('base-class active-class')
    })

    it('should handle array inputs', () => {
      expect(cn(['bg-red-500', 'text-white'], 'font-bold')).toBe('bg-red-500 text-white font-bold')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('', '  ', undefined)).toBe('')
    })

    it('should handle complex Tailwind merges', () => {
      expect(cn(
        'px-2 py-1 bg-red hover:bg-dark-red',
        'p-3 bg-[#B91C1C]'
      )).toBe('hover:bg-dark-red p-3 bg-[#B91C1C]')
    })
  })

  describe('getCurrentDate', () => {
    it('should return a Date object', () => {
      const result = getCurrentDate()
      expect(result).toBeInstanceOf(Date)
    })

    it('should return current date and time', () => {
      const before = new Date()
      const result = getCurrentDate()
      const after = new Date()

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should be consistent with system time', () => {
      const systemTime = Date.now()
      const result = getCurrentDate()

      // Allow for small timing differences (within 10ms)
      const diff = Math.abs(result.getTime() - systemTime)
      expect(diff).toBeLessThan(10)
    })
  })

  describe('formatCurrency', () => {
    it('should format positive numbers as Argentine pesos', () => {
      const result1000 = formatCurrency(1000)
      const result1234 = formatCurrency(1234.56)
      const result50000 = formatCurrency(50000)

      expect(result1000).toMatch(/^\$[\s\u00A0]1\.000,00$/)
      expect(result1234).toMatch(/^\$[\s\u00A0]1\.234,56$/)
      expect(result50000).toMatch(/^\$[\s\u00A0]50\.000,00$/)
    })

    it('should format zero', () => {
      const result = formatCurrency(0)
      expect(result).toMatch(/^\$[\s\u00A0]0,00$/)
    })

    it('should format negative numbers', () => {
      const resultNeg1000 = formatCurrency(-1000)
      const resultNeg1234 = formatCurrency(-1234.56)

      expect(resultNeg1000).toMatch(/^-\$[\s\u00A0]1\.000,00$/)
      expect(resultNeg1234).toMatch(/^-\$[\s\u00A0]1\.234,56$/)
    })

    it('should format decimal numbers correctly', () => {
      const result1_5 = formatCurrency(1.5)
      const result0_99 = formatCurrency(0.99)
      const result100 = formatCurrency(100.00)

      expect(result1_5).toMatch(/^\$[\s\u00A0]1,50$/)
      expect(result0_99).toMatch(/^\$[\s\u00A0]0,99$/)
      expect(result100).toMatch(/^\$[\s\u00A0]100,00$/)
    })

    it('should handle large numbers', () => {
      const result1M = formatCurrency(1000000)
      const result1_2M = formatCurrency(1234567.89)

      expect(result1M).toMatch(/^\$[\s\u00A0]1\.000\.000,00$/)
      expect(result1_2M).toMatch(/^\$[\s\u00A0]1\.234\.567,89$/)
    })

    it('should handle very small decimals', () => {
      const result0_01 = formatCurrency(0.01)
      const result0_001 = formatCurrency(0.001)

      expect(result0_01).toMatch(/^\$[\s\u00A0]0,01$/)
      expect(result0_001).toMatch(/^\$[\s\u00A0]0,00$/)
    })

    it('should use Argentine locale formatting', () => {
      // Test that it uses comma as decimal separator and period as thousand separator
      const result = formatCurrency(1234.56)
      expect(result).toContain(',')
      expect(result).toContain('.')
      expect(result).toMatch(/^\$[\s\u00A0]1\.234,56$/)
    })
  })

  describe('formatDate', () => {
    it('should format Date objects', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45) // Jan 15, 2024, 14:30:45
      const result = formatDate(date)

      // Should contain date and time in Argentine format
      expect(result).toContain('15 ene 2024') // Date part
      expect(result).toContain('2:30') // Time part
      expect(result).toMatch(/[ap]\.\s*m\./) // AM/PM indicator (with space)
    })

    it('should format string dates', () => {
      const dateString = '2024-01-15T14:30:45'
      const result = formatDate(dateString)

      expect(result).toContain('15 ene 2024')
      expect(result).toContain('2:30')
    })

    it('should handle different date formats', () => {
      expect(() => formatDate('invalid')).toThrow()
      expect(() => formatDate('')).toThrow()
      // Note: formatDate converts null to new Date(null) which is a valid date
      expect(() => formatDate(null as any)).not.toThrow()
      expect(() => formatDate(undefined as any)).not.toThrow()
    })

    it('should format current date', () => {
      const now = new Date()
      const result = formatDate(now)

      // Should contain current date elements
      expect(result).toMatch(/\d{1,2} \w{3} \d{4}/) // dd mmm yyyy
      expect(result).toMatch(/\d{1,2}:\d{1,2}/) // hh:mm
      expect(result).toMatch(/[ap]\.\s*m\./) // AM/PM indicator
    })

    it('should use Argentine locale', () => {
      const date = new Date(2024, 0, 15, 14, 30)
      const result = formatDate(date)

      // Should contain Spanish month abbreviation and time format
      expect(result).toContain('ene') // January in Spanish
      expect(result).toContain('2024')
      expect(result).toMatch(/\d{1,2}:\d{1,2} [ap]\.\s*m\./) // Time with AM/PM
    })
  })

  describe('generateTransactionCode', () => {
    it('should generate codes with the correct prefix', () => {
      const code = generateTransactionCode('SALE')
      expect(code.startsWith('SALE-')).toBe(true)
    })

    it('should include timestamp in the code', () => {
      const before = Date.now()
      const code = generateTransactionCode('TEST')
      const after = Date.now()

      // Extract timestamp from code
      const parts = code.split('-')
      const timestamp = parseInt(parts[1])

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should include random number in the code', () => {
      const codes = Array.from({ length: 10 }, () => generateTransactionCode('TEST'))

      // Check that not all codes are identical (highly unlikely)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBeGreaterThan(1)
    })

    it('should generate codes with consistent format', () => {
      const code = generateTransactionCode('INV')
      const parts = code.split('-')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('INV')
      expect(typeof parseInt(parts[1])).toBe('number') // timestamp
      expect(typeof parseInt(parts[2])).toBe('number') // random
    })

    it('should handle different prefixes', () => {
      expect(generateTransactionCode('SALE')).toMatch(/^SALE-\d+-\d+$/)
      expect(generateTransactionCode('PURCHASE')).toMatch(/^PURCHASE-\d+-\d+$/)
      expect(generateTransactionCode('EXPENSE')).toMatch(/^EXPENSE-\d+-\d+$/)
    })

    it('should generate unique codes in sequence', () => {
      const code1 = generateTransactionCode('TEST')
      const code2 = generateTransactionCode('TEST')

      expect(code1).not.toBe(code2)
    })

    it('should handle empty prefix', () => {
      const code = generateTransactionCode('')
      expect(code).toMatch(/^-\d+-\d+$/)
    })

    it('should handle special characters in prefix', () => {
      const code = generateTransactionCode('TEST-123')
      expect(code).toMatch(/^TEST-123-\d+-\d+$/)
    })
  })
})
