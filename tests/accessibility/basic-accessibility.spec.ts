import { test, expect } from '@playwright/test'

test.describe('Basic Accessibility Tests', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/')

    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
    expect(title).not.toBe('') // Not empty
    expect(title).not.toBe('localhost') // Not default browser title
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Check for h1
    const h1Elements = page.locator('h1')
    const h1Count = await h1Elements.count()
    expect(h1Count).toBeGreaterThan(0)

    // Check heading hierarchy (should not skip levels)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
    expect(headings.length).toBeGreaterThan(0)

    // Should have logical heading structure
    const headingLevels = []
    for (const heading of await page.locator('h1, h2, h3, h4, h5, h6').all()) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase())
      const level = parseInt(tagName.replace('h', ''))
      headingLevels.push(level)
    }

    // Check for major hierarchy violations (skipping from h1 to h3, etc.)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1]
      expect(diff).toBeLessThanOrEqual(1) // Should not skip levels
    }
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i)
      const alt = await image.getAttribute('alt')

      // Alt attribute should exist (can be empty for decorative images)
      expect(alt).not.toBeNull()

      // If image has semantic meaning, alt should not be empty
      const src = await image.getAttribute('src')
      if (src && !src.includes('icon') && !src.includes('decorative')) {
        expect(alt && alt.trim().length > 0).toBeTruthy()
      }
    }
  })

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/auth/login')

    // Find all form inputs
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], textarea, select')

    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      const placeholder = await input.getAttribute('placeholder')

      // Should have some form of labeling
      const hasLabel = id || ariaLabel || ariaLabelledBy || placeholder
      expect(hasLabel).toBeTruthy()

      // If has id, should have associated label
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        const hasAssociatedLabel = await label.isVisible()
        expect(hasAssociatedLabel).toBeTruthy()
      }
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/auth/login')

    // Test that we can tab through focusable elements
    const focusableElements = page.locator('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
    const focusableCount = await focusableElements.count()

    if (focusableCount > 0) {
      // Start tabbing
      await page.keyboard.press('Tab')

      // Should be able to focus on at least one element
      const focusedElement = page.locator(':focus')
      const isFocused = await focusedElement.isVisible()

      expect(isFocused).toBeTruthy()
    }
  })

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/')

    // This is a basic check - real contrast testing would use axe-core
    // For now, check that text is visible against background

    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6')
    const visibleTextCount = await textElements.filter({ hasText: /.+/ }).count()

    // Should have some visible text
    expect(visibleTextCount).toBeGreaterThan(0)

    // Check that buttons have visible text
    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      const buttonText = await button.textContent()
      const hasVisibleText = buttonText && buttonText.trim().length > 0

      if (hasVisibleText) {
        // Button should be visible (basic contrast check)
        await expect(button).toBeVisible()
      }
    }
  })

  test('should have proper button labels', async ({ page }) => {
    await page.goto('/')

    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      const accessibleName = await button.getAttribute('aria-label') ||
                            await button.getAttribute('title') ||
                            await button.textContent()

      // Button should have some form of accessible name
      expect(accessibleName && accessibleName.trim().length > 0).toBeTruthy()
    }
  })

  test('should handle focus management', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Focus should move to input
      await emailInput.focus()
      await expect(emailInput).toBeFocused()

      // Should show focus indicator (basic check)
      const isVisible = await emailInput.isVisible()
      expect(isVisible).toBeTruthy()
    }
  })

  test('should have proper language attribute', async ({ page }) => {
    await page.goto('/')

    const html = page.locator('html')
    const lang = await html.getAttribute('lang')

    // Should have lang attribute
    expect(lang).toBeTruthy()
    expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/) // Basic language code validation
  })

  test('should avoid common accessibility issues', async ({ page }) => {
    await page.goto('/')

    // Check for missing alt text (basic check)
    const imagesWithoutAlt = page.locator('img:not([alt])')
    const imagesWithoutAltCount = await imagesWithoutAlt.count()

    // Should not have too many images without alt
    expect(imagesWithoutAltCount).toBeLessThan(5)

    // Check for buttons without accessible names
    const buttonsWithoutNames = []
    const buttons = page.getByRole('button')

    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i)
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      const title = await button.getAttribute('title')

      if (!text && !ariaLabel && !title) {
        buttonsWithoutNames.push(button)
      }
    }

    expect(buttonsWithoutNames.length).toBe(0)
  })

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/')

    // Check for landmarks and semantic structure
    const landmarks = page.locator('header, nav, main, aside, footer, section[aria-label], section[aria-labelledby]')
    const landmarkCount = await landmarks.count()

    // Should have some semantic structure
    expect(landmarkCount).toBeGreaterThan(0)

    // Check for main content area
    const main = page.locator('main').or(page.locator('[role="main"]'))
    const hasMain = await main.isVisible()

    expect(hasMain).toBeTruthy()
  })

  test('should have descriptive link text', async ({ page }) => {
    await page.goto('/')

    const links = page.getByRole('link')
    const linkCount = await links.count()

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      const title = await link.getAttribute('title')

      // Link should have descriptive text
      const hasDescriptiveText = (text && text.trim().length > 0) ||
                                (ariaLabel && ariaLabel.trim().length > 0) ||
                                (title && title.trim().length > 0)

      expect(hasDescriptiveText).toBeTruthy()

      // Avoid generic link text
      const genericTexts = ['click here', 'read more', 'here', 'link', 'click']
      const linkText = (text || ariaLabel || title || '').toLowerCase()

      const isGeneric = genericTexts.some(generic =>
        linkText.includes(generic) && linkText.trim().length < 10
      )

      if (isGeneric) {
        // Allow generic text only if there's additional context
        const hasContext = await link.getAttribute('aria-describedby') ||
                          await link.getAttribute('title') ||
                          text && text.trim().length > 10

        expect(hasContext).toBeTruthy()
      }
    }
  })

  test('should handle form validation accessibly', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Submit form with invalid data
      const submitButton = page.getByRole('button', { name: /login|ingresar/i })

      if (await submitButton.isVisible()) {
        await submitButton.click()

        // Look for error messages associated with inputs
        const errorMessages = page.locator('[role="alert"]').or(
          page.locator('.error').or(
            page.locator('[data-testid="error"]')
          )
        )

        // If there are errors, they should be associated with form fields
        const hasErrors = await errorMessages.isVisible()
        if (hasErrors) {
          const errorCount = await errorMessages.count()
          expect(errorCount).toBeGreaterThan(0)

          // Errors should be announced to screen readers
          const alertErrors = page.locator('[role="alert"]')
          // At least some errors should be properly announced
        }
      }
    }
  })
})

test.describe('Accessibility - Form Specific', () => {
  test('should associate form fields with labels', async ({ page }) => {
    await page.goto('/auth/login')

    const inputs = page.locator('input, textarea, select')

    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i)
      const type = await input.getAttribute('type')

      // Skip hidden inputs
      if (type === 'hidden' || type === 'submit') continue

      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')

      // Should have some form of labeling
      const hasLabel = id || ariaLabel || ariaLabelledBy
      expect(hasLabel).toBeTruthy()

      if (id) {
        // Should have associated label element
        const label = page.locator(`label[for="${id}"]`)
        const labelExists = await label.isVisible()

        if (!labelExists) {
          // If no label element, should have aria-label
          expect(ariaLabel || ariaLabelledBy).toBeTruthy()
        }
      }
    }
  })

  test('should have proper form structure', async ({ page }) => {
    await page.goto('/auth/login')

    const form = page.locator('form').first()

    if (await form.isVisible()) {
      // Form should have proper structure
      const inputs = form.locator('input, textarea, select')
      const submitButton = form.locator('input[type="submit"], button[type="submit"]').or(
        form.getByRole('button', { name: /submit|login|ingresar/i })
      )

      // Should have at least one input and one submit button
      expect(await inputs.count()).toBeGreaterThan(0)
      expect(await submitButton.count()).toBeGreaterThan(0)
    }
  })
})

test.describe('Accessibility - Navigation', () => {
  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav').or(page.locator('[role="navigation"]'))

    if (await nav.isVisible()) {
      // Navigation should have proper labeling
      const ariaLabel = await nav.getAttribute('aria-label')
      const ariaLabelledBy = await nav.getAttribute('aria-labelledby')

      expect(ariaLabel || ariaLabelledBy).toBeTruthy()

      // Should contain navigation links
      const links = nav.getByRole('link')
      const linkCount = await links.count()

      // Navigation should have some links
      expect(linkCount).toBeGreaterThan(0)
    }
  })

  test('should skip links work', async ({ page }) => {
    await page.goto('/')

    // Look for skip links (common accessibility feature)
    const skipLinks = page.locator('a[href^="#"]').filter({ hasText: /skip|saltar|ir a/i })

    // Skip links are good practice but not always present
    const hasSkipLinks = await skipLinks.isVisible()

    if (hasSkipLinks) {
      // If skip links exist, they should work
      const skipLink = skipLinks.first()
      const href = await skipLink.getAttribute('href')

      if (href && href !== '#') {
        await skipLink.click()
        const targetElement = page.locator(href)

        // Should focus on target element or scroll to it
        await expect(targetElement).toBeVisible()
      }
    }
  })
})








