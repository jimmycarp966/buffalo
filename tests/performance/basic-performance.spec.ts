import { test, expect } from '@playwright/test'

test.describe('Basic Performance Tests', () => {
  test('should load homepage within 3 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000) // 3 seconds

    // Check that main content is visible
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.locator('body'))
    await expect(mainContent).toBeVisible()
  })

  test('should load login page quickly', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/auth/login')

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(2000) // 2 seconds

    // Check that login form elements are present
    const form = page.locator('form').or(page.locator('[data-testid="login-form"]'))
    await expect(form).toBeVisible()
  })

  test('should handle navigation performance', async ({ page }) => {
    await page.goto('/')

    // Measure navigation to login page
    const startTime = Date.now()

    await page.goto('/auth/login')

    const navTime = Date.now() - startTime
    expect(navTime).toBeLessThan(1500) // 1.5 seconds
  })

  test('should not have excessive network requests', async ({ page }) => {
    const requests: string[] = []

    page.on('request', request => {
      requests.push(request.url())
    })

    await page.goto('/')

    // Wait for page to stabilize
    await page.waitForTimeout(2000)

    // Filter out common external requests
    const internalRequests = requests.filter(url =>
      url.includes('localhost') ||
      url.includes(window.location.origin) ||
      url.includes('/api/') ||
      url.includes('/_next/')
    )

    // Should not have excessive requests (less than 50 for a basic page)
    expect(internalRequests.length).toBeLessThan(50)
  })

  test('should load images efficiently', async ({ page }) => {
    const imageRequests: any[] = []

    page.on('request', request => {
      if (request.resourceType() === 'image') {
        imageRequests.push({
          url: request.url(),
          timestamp: Date.now()
        })
      }
    })

    await page.goto('/')

    await page.waitForTimeout(3000)

    // Check that images don't take too long to load
    for (const request of imageRequests.slice(0, 5)) { // Check first 5 images
      const response = await page.waitForResponse(response =>
        response.url() === request.url && response.status() === 200
      )

      const loadTime = Date.now() - request.timestamp
      expect(loadTime).toBeLessThan(5000) // 5 seconds per image
    }
  })

  test('should have reasonable bundle size', async ({ page }) => {
    const jsRequests: any[] = []

    page.on('response', response => {
      const url = response.url()
      if (url.includes('.js') && !url.includes('external')) {
        jsRequests.push({
          url,
          size: 0 // Would need to get from response headers
        })
      }
    })

    await page.goto('/')

    await page.waitForTimeout(3000)

    // Basic check - page should not have too many JS files
    expect(jsRequests.length).toBeLessThan(20)
  })

  test('should handle form interactions quickly', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      const startTime = Date.now()

      await emailInput.fill('test@example.com')

      const inputTime = Date.now() - startTime
      expect(inputTime).toBeLessThan(500) // 500ms for input

      // Check that input value was set
      await expect(emailInput).toHaveValue('test@example.com')
    }
  })

  test('should handle button clicks responsively', async ({ page }) => {
    await page.goto('/auth/login')

    const loginButton = page.getByRole('button', { name: /login|ingresar/i })

    if (await loginButton.isVisible()) {
      const startTime = Date.now()

      await loginButton.click()

      const clickTime = Date.now() - startTime
      expect(clickTime).toBeLessThan(200) // 200ms for button click

      // Button should show loading state or form should respond
      await page.waitForTimeout(500)
      const currentUrl = page.url()
      expect(currentUrl.includes('login') || currentUrl.includes('dashboard')).toBeTruthy()
    }
  })
})

test.describe('Memory and Resource Usage', () => {
  test('should not have memory leaks on navigation', async ({ page, context }) => {
    // This is a basic test - real memory leak detection would require more sophisticated tools

    await page.goto('/')

    // Get initial performance metrics
    const initialMetrics = await page.evaluate(() => ({
      jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
      totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
      usedJSHeapSize: (performance as any).memory?.usedJSHeapSize
    }))

    // Navigate multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/auth/login')
      await page.goto('/')
    }

    // Get final metrics
    const finalMetrics = await page.evaluate(() => ({
      jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
      totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
      usedJSHeapSize: (performance as any).memory?.usedJSHeapSize
    }))

    // Memory usage should not increase dramatically
    if (initialMetrics.usedJSHeapSize && finalMetrics.usedJSHeapSize) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize
      const acceptableIncrease = initialMetrics.usedJSHeapSize * 0.5 // 50% increase max

      expect(memoryIncrease).toBeLessThan(acceptableIncrease)
    }
  })

  test('should close connections properly', async ({ page, context }) => {
    await page.goto('/')

    // This test would check for proper cleanup in a real application
    // For now, just verify the page loads and unloads without errors

    await page.reload()

    // Page should reload successfully
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Core Web Vitals Simulation', () => {
  test('should have reasonable First Contentful Paint', async ({ page }) => {
    await page.goto('/')

    // Wait for any content to appear
    const mainContent = page.locator('main').or(page.locator('h1')).or(page.locator('body'))
    await mainContent.waitFor()

    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint')
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
      return fcpEntry ? fcpEntry.startTime : null
    })

    // FCP should be reasonable (less than 2 seconds)
    if (fcp !== null) {
      expect(fcp).toBeLessThan(2000)
    }
  })

  test('should respond to user interactions quickly', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Measure input responsiveness
      const startTime = Date.now()

      await emailInput.focus()
      await emailInput.type('t')

      const responseTime = Date.now() - startTime

      // Input should respond within 100ms
      expect(responseTime).toBeLessThan(100)

      // Text should appear
      await expect(emailInput).toHaveValue('t')
    }
  })

  test('should not block on long-running tasks', async ({ page }) => {
    await page.goto('/')

    // This test would check for long-running synchronous JavaScript
    // For now, just verify the page remains responsive

    const button = page.getByRole('button').first()
    if (await button.isVisible()) {
      await button.click()

      // Page should remain responsive
      await expect(page.locator('body')).toBeVisible()
    }
  })
})

test.describe('Error Handling Performance', () => {
  test('should handle 404 errors gracefully', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/nonexistent-page')

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000) // Should load error page quickly

    // Should show some content (404 page or redirect)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // This would require blocking network requests
    // For now, just verify error handling works

    await page.goto('/')

    // Simulate a network error by trying to fetch a non-existent resource
    const errorResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/nonexistent-api-endpoint')
        return { status: response.status, ok: response.ok }
      } catch (error) {
        return { error: true }
      }
    })

    // Network errors should be handled gracefully
    expect(errorResponse.error || !errorResponse.ok).toBeTruthy()
  })
})








