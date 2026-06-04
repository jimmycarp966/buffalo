import { test, expect } from '@playwright/test'

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('should display mobile layout correctly', async ({ page }) => {
    await page.goto('/')

    // Check that content fits mobile screen
    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(375)

    // Main content should be visible and not overflow
    const body = page.locator('body')
    const bodyWidth = await body.evaluate(el => el.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(375)

    // No horizontal scrollbar should be present
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)
  })

  test('should have readable text on mobile', async ({ page }) => {
    await page.goto('/')

    // Check font sizes are readable on mobile
    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6')
    const smallTextCount = await textElements.filter('css=font-size: 12px').count()
    const tinyTextCount = await textElements.filter('css=font-size: 10px').count()

    // Should not have too much tiny text
    expect(smallTextCount + tinyTextCount).toBeLessThan(20)
  })

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/')

    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()

      if (box) {
        // Buttons should be at least 44px for touch accessibility
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
  })

  test('should handle mobile navigation', async ({ page }) => {
    await page.goto('/')

    // Look for mobile menu button
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
      page.locator('button[aria-label*="menu"]').or(
        page.locator('button').filter({ hasText: /☰|≡|menu/i })
      )
    )

    if (await mobileMenu.isVisible()) {
      // Mobile menu should be clickable
      await mobileMenu.click()

      // Menu should open or navigation should be visible
      const navMenu = page.locator('[data-testid="nav-menu"]').or(
        page.locator('nav').or(
          page.locator('.mobile-nav')
        )
      )

      await expect(navMenu).toBeVisible()
    } else {
      // If no mobile menu, navigation should be visible
      const nav = page.locator('nav')
      await expect(nav).toBeVisible()
    }
  })

  test('should adapt forms for mobile', async ({ page }) => {
    await page.goto('/auth/login')

    const form = page.locator('form').or(page.locator('[data-testid="login-form"]'))

    if (await form.isVisible()) {
      // Form inputs should be properly sized for mobile
      const inputs = form.locator('input, textarea')
      const inputCount = await inputs.count()

      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i)
        const box = await input.boundingBox()

        if (box) {
          // Inputs should be wide enough for mobile typing
          expect(box.width).toBeGreaterThanOrEqual(280)
          expect(box.height).toBeGreaterThanOrEqual(40)
        }
      }
    }
  })

  test('should handle mobile scrolling', async ({ page }) => {
    await page.goto('/')

    // Check if page has scrollable content
    const hasScroll = await page.evaluate(() => {
      return document.body.scrollHeight > window.innerHeight
    })

    if (hasScroll) {
      // Should be able to scroll down
      await page.mouse.wheel(0, 100)

      // Content should have moved
      const scrollTop = await page.evaluate(() => window.scrollY)
      expect(scrollTop).toBeGreaterThan(0)
    }
  })
})

test.describe('Tablet Responsiveness', () => {
  test.use({ viewport: { width: 768, height: 1024 } }) // iPad

  test('should display tablet layout correctly', async ({ page }) => {
    await page.goto('/')

    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(768)

    // Content should fit tablet screen
    const body = page.locator('body')
    const bodyWidth = await body.evaluate(el => el.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(768)
  })

  test('should show tablet-optimized navigation', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav')
    await expect(nav).toBeVisible()

    // Navigation should be more spacious on tablet
    const navBox = await nav.boundingBox()
    if (navBox) {
      expect(navBox.width).toBeGreaterThan(600)
    }
  })

  test('should handle tablet gestures', async ({ page }) => {
    await page.goto('/')

    // Test if swipe gestures work (basic touch simulation)
    await page.touchscreen.tap(100, 100)

    // Should not break the page
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Desktop Responsiveness', () => {
  test.use({ viewport: { width: 1920, height: 1080 } }) // Full HD

  test('should display desktop layout correctly', async ({ page }) => {
    await page.goto('/')

    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(1920)

    // Should utilize full screen width effectively
    const mainContent = page.locator('main').or(page.locator('body'))
    const contentWidth = await mainContent.evaluate(el => el.offsetWidth)

    // Should use significant portion of screen width
    expect(contentWidth).toBeGreaterThan(1000)
  })

  test('should show full desktop navigation', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav')
    await expect(nav).toBeVisible()

    // Desktop nav should show all menu items
    const navLinks = nav.getByRole('link')
    const linkCount = await navLinks.count()

    // Should have multiple navigation links
    expect(linkCount).toBeGreaterThan(3)
  })

  test('should handle desktop multi-column layouts', async ({ page }) => {
    await page.goto('/')

    // Check for grid or flexbox layouts that utilize screen width
    const gridElements = page.locator('[style*="display: grid"]').or(
      page.locator('[style*="display: flex"]').or(
        page.locator('.grid').or(page.locator('.flex'))
      )
    )

    // Should have some layout containers
    const layoutCount = await gridElements.count()
    expect(layoutCount).toBeGreaterThan(0)
  })
})

test.describe('Responsive Breakpoints', () => {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1200, height: 800 },
    { name: 'large', width: 1920, height: 1080 }
  ]

  breakpoints.forEach(({ name, width, height }) => {
    test(`should work at ${name} breakpoint (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height })

      await page.goto('/')

      // Basic functionality should work at all breakpoints
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // No horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })
      expect(hasOverflow).toBe(false)

      // Main interactive elements should be accessible
      const buttons = page.getByRole('button')
      const links = page.getByRole('link')

      // Should have some interactive elements
      const interactiveCount = await buttons.count() + await links.count()
      expect(interactiveCount).toBeGreaterThan(0)
    })
  })
})

test.describe('Responsive Images', () => {
  test('should load appropriate images for screen size', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const imageCount = await images.count()

    if (imageCount > 0) {
      // Images should have proper sizing
      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const image = images.nth(i)
        const box = await image.boundingBox()

        if (box) {
          // Images should not be too small on mobile
          expect(box.width).toBeGreaterThan(20)
          expect(box.height).toBeGreaterThan(20)
        }
      }
    }
  })

  test('should handle image responsiveness', async ({ page }) => {
    // Test different viewport sizes
    const sizes = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1200, height: 800 }
    ]

    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.goto('/')

      const images = page.locator('img')
      const imageCount = await images.count()

      // Images should still be visible and properly sized
      for (let i = 0; i < Math.min(imageCount, 2); i++) {
        const image = images.nth(i)
        await expect(image).toBeVisible()

        const box = await image.boundingBox()
        if (box) {
          expect(box.width).toBeGreaterThan(0)
          expect(box.height).toBeGreaterThan(0)
        }
      }
    }
  })
})

test.describe('Responsive Typography', () => {
  test('should scale text appropriately', async ({ page }) => {
    const sizes = [
      { width: 375, height: 667 }, // Mobile
      { width: 1920, height: 1080 } // Desktop
    ]

    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.goto('/')

      // Check heading sizes
      const h1 = page.locator('h1').first()
      if (await h1.isVisible()) {
        const fontSize = await h1.evaluate(el => {
          return parseFloat(getComputedStyle(el).fontSize)
        })

        // H1 should be readable at all sizes
        expect(fontSize).toBeGreaterThan(16) // At least 16px
        expect(fontSize).toBeLessThan(100) // Not too large
      }
    }
  })
})

test.describe('Responsive Interactions', () => {
  test('should handle touch vs mouse interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // Mobile

    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Touch interaction
      await page.touchscreen.tap(
        await emailInput.boundingBox().then(box => box!.x + 10),
        await emailInput.boundingBox().then(box => box!.y + 10)
      )

      // Should focus the input
      await expect(emailInput).toBeFocused()

      // Should be able to type
      await emailInput.fill('test@example.com')
      await expect(emailInput).toHaveValue('test@example.com')
    }
  })

  test('should handle hover states on larger screens', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 }) // Desktop

    await page.goto('/')

    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()

    if (buttonCount > 0) {
      const firstButton = buttons.first()

      // Hover should work on desktop
      await firstButton.hover()

      // Button should still be visible after hover
      await expect(firstButton).toBeVisible()
    }
  })
})








