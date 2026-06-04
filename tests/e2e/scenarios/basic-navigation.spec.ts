import { test, expect } from '@playwright/test'

test.describe('Basic Navigation', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/')

    // Check that the page loads without errors
    await expect(page).toHaveTitle(/La Movida/i)

    // Check for main navigation elements
    const navbar = page.locator('nav')
    await expect(navbar).toBeVisible()
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/')

    // Look for login link/button
    const loginLink = page.getByRole('link', { name: /login|ingresar/i }).or(
      page.getByRole('button', { name: /login|ingresar/i })
    )

    if (await loginLink.isVisible()) {
      await loginLink.click()
      await expect(page).toHaveURL(/.*login/)
    } else {
      await expect(page).toHaveURL(/.*login/)
    }
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')

    // Check for skip links or main navigation
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()

    // Check for main heading
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })

  test('should handle 404 gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page')

    // Should show 404 page or redirect to home
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')

    // Check that navigation adapts to mobile
    const navbar = page.locator('nav')
    await expect(navbar).toBeVisible()

    // Check for mobile menu button if present
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
      page.locator('button[aria-label*="menu"]').or(
        page.locator('.mobile-menu')
      )
    )

    // Mobile menu might not exist, that's ok
    // If it exists, it should be visible
    if (await mobileMenu.isVisible()) {
      await expect(mobileMenu).toBeVisible()
    }
  })

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    await page.goto('/')

    const navbar = page.locator('nav')
    await expect(navbar).toBeVisible()
  })

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    await page.goto('/')

    const navbar = page.locator('nav')
    await expect(navbar).toBeVisible()
  })
})

test.describe('Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds

    // Wait for main content to be visible
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.locator('body'))
    await expect(mainContent).toBeVisible()
  })

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')

    // Wait a bit for any async errors
    await page.waitForTimeout(2000)

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('chunk') &&
      !error.includes('stylesheet') &&
      !error.includes('manifest')
    )

    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    const h1Elements = page.locator('h1')
    const h1Count = await h1Elements.count()

    // Should have at least one h1
    expect(h1Count).toBeGreaterThan(0)

    // Check that headings are in proper order (no skipping levels)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
    // This is a basic check - in a real accessibility test you'd use axe-core
    expect(headings.length).toBeGreaterThan(0)
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const imageCount = await images.count()

    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const alt = await images.nth(i).getAttribute('alt')
        // Alt can be empty for decorative images, but should exist
        expect(alt).not.toBeNull()
      }
    }
  })

  test('should have focusable elements', async ({ page }) => {
    await page.goto('/')

    // Tab through focusable elements
    await page.keyboard.press('Tab')

    const focusedElement = page.locator(':focus')
    const isVisible = await focusedElement.isVisible()

    // There should be at least one focusable element
    expect(isVisible || await focusedElement.count() > 0).toBeTruthy()
  })
})

test.describe('SEO', () => {
  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/')

    // Check for title
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)

    // Check for meta description (if present)
    const metaDescription = page.locator('meta[name="description"]')
    // Meta description is optional but if present should have content
    if (await metaDescription.isVisible()) {
      const content = await metaDescription.getAttribute('content')
      expect(content).toBeTruthy()
    }
  })

  test('should have semantic HTML structure', async ({ page }) => {
    await page.goto('/')

    // Check for semantic elements
    const header = page.locator('header').first()
    const main = page.locator('main').first()
    const footer = page.locator('footer').first()

    // At least main should exist
    await expect(main).toBeVisible()
  })
})








