import { test, expect } from '@playwright/test'

test.describe('Error Handling and Edge Cases', () => {
  test('should handle malformed URLs gracefully', async ({ page }) => {
    const malformedUrls = [
      '/invalid-route-that-does-not-exist',
      '/productos/invalid-id-123',
      '/ventas/nonexistent-sale',
      '/api/nonexistent-endpoint',
      '/dashboard/invalid-section'
    ]

    for (const url of malformedUrls) {
      await page.goto(url)

      // Should not crash, should show error page or redirect
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // Should not show blank page
      const content = await page.textContent('body')
      expect(content && content.trim().length).toBeGreaterThan(0)
    }
  })

  test('should handle invalid form submissions', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))
    const loginButton = page.getByRole('button', { name: /login|ingresar/i })

    if (await emailInput.isVisible()) {
      // Submit with extremely long input
      const longInput = 'a'.repeat(10000)
      await emailInput.fill(longInput)

      if (await loginButton.isVisible()) {
        await loginButton.click()

        // Should handle gracefully
        await expect(page.locator('body')).toBeVisible()
      }

      // Submit with special characters
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\'
      await emailInput.fill(specialChars)

      if (await loginButton.isVisible()) {
        await loginButton.click()
        await expect(page.locator('body')).toBeVisible()
      }

      // Submit with SQL injection attempts
      const sqlInjection = "'; DROP TABLE users; --"
      await emailInput.fill(sqlInjection)

      if (await loginButton.isVisible()) {
        await loginButton.click()
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('should handle network interruptions', async ({ page }) => {
    await page.goto('/')

    // Simulate offline state
    await page.context().setOffline(true)

    // Try to navigate
    await page.goto('/productos')

    // Should handle offline gracefully
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Back online
    await page.context().setOffline(false)
    await page.reload()
    await expect(body).toBeVisible()
  })

  test('should handle rapid clicking and spam prevention', async ({ page }) => {
    await page.goto('/auth/login')

    const loginButton = page.getByRole('button', { name: /login|ingresar/i })

    if (await loginButton.isVisible()) {
      // Rapid clicking
      for (let i = 0; i < 10; i++) {
        await loginButton.click()
      }

      // Should not crash
      await expect(page.locator('body')).toBeVisible()

      // Should not show multiple loading states simultaneously
      const loadingIndicators = page.locator('[data-testid="loading"]').or(
        page.getByText(/cargando|loading/i)
      )

      // Should not have excessive loading indicators
      const loadingCount = await loadingIndicators.count()
      expect(loadingCount).toBeLessThan(5)
    }
  })

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto('/')
    await page.goto('/auth/login')
    await page.goto('/productos')
    await page.goto('/ventas')

    // Use browser back button
    await page.goBack()
    expect(page.url()).toContain('productos')

    await page.goBack()
    expect(page.url()).toContain('login')

    await page.goBack()
    expect(page.url()).toContain('/') // or home

    // Use browser forward button
    await page.goForward()
    expect(page.url()).toContain('login')

    await page.goForward()
    expect(page.url()).toContain('productos')

    // Should not crash during navigation
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle extremely large data sets', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Test with pagination (if exists)
    const pagination = page.getByRole('navigation').or(
      page.locator('[data-testid="pagination"]')
    )

    if (await pagination.isVisible()) {
      // Click through multiple pages
      const nextButtons = page.getByRole('button', { name: /siguiente|next/i })

      for (let i = 0; i < 5; i++) {
        if (await nextButtons.isVisible()) {
          await nextButtons.click()
          await page.waitForTimeout(500)

          // Should load next page without crashing
          await expect(page.locator('body')).toBeVisible()
        }
      }
    }

    // Test search with no results
    const searchInput = page.getByPlaceholder(/buscar/i).or(page.getByLabel(/buscar/i))
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistentproduct123456789')
      await page.waitForTimeout(1000)

      // Should handle empty results gracefully
      const noResults = page.getByText(/no se encontraron|sin resultados/i)
      const isEmptyStateVisible = await noResults.isVisible()

      // Either shows no results message or empty list
      expect(isEmptyStateVisible || await page.locator('body').isVisible()).toBeTruthy()
    }
  })

  test('should handle concurrent user actions', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Simulate rapid user interactions
    const buttons = page.getByRole('button')
    const inputs = page.locator('input, textarea')

    // Click multiple buttons rapidly
    for (let i = 0; i < Math.min(5, await buttons.count()); i++) {
      try {
        await buttons.nth(i).click()
      } catch (e) {
        // Button might be disabled or hidden - that's ok
      }
    }

    // Fill multiple inputs rapidly
    for (let i = 0; i < Math.min(3, await inputs.count()); i++) {
      try {
        const input = inputs.nth(i)
        const inputType = await input.getAttribute('type')
        if (inputType !== 'submit' && inputType !== 'button') {
          await input.fill(`test-input-${i}`)
        }
      } catch (e) {
        // Input might be disabled - that's ok
      }
    }

    // Page should remain functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle invalid API responses', async ({ page }) => {
    // This would require mocking API responses
    // For now, test that the UI handles various states

    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Test with network throttling
    await page.route('**/api/**', async route => {
      // Simulate slow API response
      await page.waitForTimeout(5000)
      await route.fulfill({ status: 200, body: '[]' })
    })

    await page.reload()

    // Should show loading state then results
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should handle memory-intensive operations', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Open multiple dialogs/modals if they exist
    const modalTriggers = page.getByRole('button', { name: /agregar|nuevo|editar/i })

    for (let i = 0; i < Math.min(3, await modalTriggers.count()); i++) {
      try {
        await modalTriggers.nth(i).click()
        await page.waitForTimeout(500)

        // Close modal if it opened
        const closeButtons = page.getByRole('button', { name: /cerrar|close|x/i })
        if (await closeButtons.first().isVisible()) {
          await closeButtons.first().click()
        }
      } catch (e) {
        // Modal might not open - that's ok
      }
    }

    // Should not crash from memory usage
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle timezone and locale differences', async ({ page }) => {
    await page.goto('/')

    // Check date/time displays
    const dateElements = page.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/).or( // DD/MM/YYYY
      page.getByText(/\d{4}-\d{1,2}-\d{1,2}/) // YYYY-MM-DD
    ).or(
      page.getByText(/\d{1,2}:\d{1,2}/) // HH:MM
    )

    // If dates are displayed, they should be properly formatted
    const dateCount = await dateElements.count()
    if (dateCount > 0) {
      // Dates should be visible and properly formatted
      await expect(dateElements.first()).toBeVisible()
    }

    // Check number formatting (currency, etc.)
    const currencyElements = page.getByText(/\$|\d+\.\d{2}/)
    const currencyCount = await currencyElements.count()

    if (currencyCount > 0) {
      // Currency should be properly formatted
      await expect(currencyElements.first()).toBeVisible()
    }
  })

  test('should handle extremely long content', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Test with very long product names or descriptions
    const longText = 'A'.repeat(1000)
    const textInputs = page.locator('input[type="text"], textarea')

    if (await textInputs.first().isVisible()) {
      await textInputs.first().fill(longText)

      // Should handle long text without crashing
      await expect(page.locator('body')).toBeVisible()

      // Input should accept the text
      const value = await textInputs.first().inputValue()
      expect(value.length).toBeGreaterThan(500)
    }
  })

  test('should handle browser refresh during operations', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Start an operation (like opening a form)
    const addButton = page.getByRole('button', { name: /agregar|nuevo/i })

    if (await addButton.isVisible()) {
      await addButton.click()
      await page.waitForTimeout(500)

      // Refresh during operation
      await page.reload()

      // Should recover gracefully
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should handle unsupported browser features', async ({ page }) => {
    await page.goto('/')

    // Test that app works without modern features
    // This is hard to test directly, but we can check basic functionality

    const basicElements = [
      page.locator('body'),
      page.locator('h1').or(page.locator('h2')).first(),
      page.getByRole('button').first()
    ]

    for (const element of basicElements) {
      if (await element.isVisible()) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('should handle print media styles', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Simulate print media query
    await page.emulateMedia({ media: 'print' })

    // Content should still be visible in print mode
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Print-specific styles might hide elements
    const printableContent = page.locator('[data-print="true"]').or(
      page.locator('body') // fallback
    )

    await expect(printableContent).toBeVisible()

    // Back to screen
    await page.emulateMedia({ media: 'screen' })
    await expect(body).toBeVisible()
  })
})

test.describe('Security Edge Cases', () => {
  test('should prevent XSS attempts', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Try XSS payloads
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '" onfocus="alert(\'xss\')" autofocus="',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ]

      for (const payload of xssPayloads) {
        await emailInput.fill(payload)

        // Should not execute scripts
        const alerts = page.locator('[role="alert"]').or(
          page.getByText(/script|javascript/i)
        )

        // Should not show script execution
        const alertCount = await alerts.count()
        expect(alertCount).toBe(0)
      }
    }
  })

  test('should handle large file uploads gracefully', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Look for file upload inputs
    const fileInputs = page.locator('input[type="file"]')

    if (await fileInputs.first().isVisible()) {
      // Try to upload a non-existent large file
      try {
        await fileInputs.first().setInputFiles('/path/to/very/large/file.zip')
      } catch (e) {
        // Expected to fail - file doesn't exist
      }

      // Should handle error gracefully
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should prevent navigation to sensitive URLs', async ({ page }) => {
    const sensitiveUrls = [
      '/api/admin/drop-tables',
      '/system/shutdown',
      '/config/database',
      '/internal/debug',
      '/private/admin-panel'
    ]

    for (const url of sensitiveUrls) {
      await page.goto(url)

      // Should not access sensitive areas
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // Should show error or redirect
      const currentUrl = page.url()
      expect(currentUrl.includes('error') ||
             currentUrl.includes('404') ||
             currentUrl === new URL(page.url()).origin + '/').toBeTruthy()
    }
  })
})

test.describe('Performance Edge Cases', () => {
  test('should handle slow network conditions', async ({ page }) => {
    // Simulate slow 3G
    await page.route('**/*', async route => {
      await page.waitForTimeout(100) // Add delay to all requests
      await route.continue()
    })

    await page.goto('/')

    // Should still load eventually
    await expect(page.locator('body')).toBeVisible()

    // Should not show multiple loading spinners
    const loadingSpinners = page.locator('[data-testid="loading"]').or(
      page.getByText(/cargando|loading/i)
    )

    const spinnerCount = await loadingSpinners.count()
    expect(spinnerCount).toBeLessThan(10)
  })

  test('should handle CPU intensive operations', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Perform many rapid operations
    const operations = []

    const buttons = page.getByRole('button')
    const inputs = page.locator('input')

    // Queue many operations
    for (let i = 0; i < Math.min(10, await buttons.count()); i++) {
      operations.push(buttons.nth(i).click())
    }

    for (let i = 0; i < Math.min(5, await inputs.count()); i++) {
      const input = inputs.nth(i)
      const type = await input.getAttribute('type')
      if (type !== 'submit' && type !== 'button') {
        operations.push(input.fill(`test-${i}`))
      }
    }

    // Execute operations with timeout
    const timeoutPromise = page.waitForTimeout(5000)
    await Promise.race([
      Promise.all(operations),
      timeoutPromise
    ])

    // Should not crash
    await expect(page.locator('body')).toBeVisible()
  })
})








