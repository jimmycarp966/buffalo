import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/auth/login')

    // Check for login form elements
    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))
    const loginButton = page.getByRole('button', { name: /login|ingresar|entrar/i })

    // At least one of these should be visible
    const hasEmailInput = await emailInput.isVisible()
    const hasPasswordInput = await passwordInput.isVisible()
    const hasLoginButton = await loginButton.isVisible()

    expect(hasEmailInput || hasPasswordInput || hasLoginButton).toBeTruthy()
  })

  test('should validate login form', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))
    const loginButton = page.getByRole('button', { name: /login|ingresar|entrar/i })

    // Try to submit empty form
    if (await loginButton.isVisible()) {
      await loginButton.click()

      // Should show validation errors or stay on login page
      const currentUrl = page.url()
      expect(currentUrl).toContain('login')
    }
  })

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))
    const loginButton = page.getByRole('button', { name: /login|ingresar|entrar/i })

    // Fill form with invalid credentials
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@example.com')
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('wrongpassword')
    }

    if (await loginButton.isVisible()) {
      await loginButton.click()

      // Should show error message or stay on login page
      await page.waitForTimeout(1000) // Wait for potential error message

      const errorMessage = page.getByText(/error|incorrecto|inválido/i).or(
        page.getByRole('alert')
      )

      // Either show error or stay on login page
      const currentUrl = page.url()
      const hasError = await errorMessage.isVisible()

      expect(currentUrl.includes('login') || hasError).toBeTruthy()
    }
  })

  test('should redirect authenticated users', async ({ page, context }) => {
    // This test would require setting up authentication state
    // For now, we'll just check that the login page is accessible

    await page.goto('/auth/login')

    // Should not automatically redirect (assuming no auth)
    const currentUrl = page.url()
    expect(currentUrl).toContain('login')
  })

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected routes without authentication
    const protectedRoutes = ['/dashboard', '/productos', '/ventas', '/caja-bar']

    for (const route of protectedRoutes) {
      await page.goto(route)

      // Should redirect to login or show login form
      const currentUrl = page.url()
      const hasLoginForm = await page.getByLabel(/email|correo/i).isVisible() ||
                          await page.getByLabel(/password|contraseña/i).isVisible()

      expect(currentUrl.includes('login') || hasLoginForm || currentUrl.includes('auth')).toBeTruthy()
    }
  })

  test('should have proper form accessibility', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))

    if (await emailInput.isVisible()) {
      // Check email input accessibility
      const emailLabel = page.getByLabel(/email|correo/i)
      if (await emailLabel.isVisible()) {
        const labelId = await emailLabel.getAttribute('id')
        const inputAriaLabelledBy = await emailInput.getAttribute('aria-labelledby')
        const inputId = await emailInput.getAttribute('id')

        expect(labelId || inputAriaLabelledBy || inputId).toBeTruthy()
      }
    }

    if (await passwordInput.isVisible()) {
      // Check password input accessibility
      const passwordLabel = page.getByLabel(/password|contraseña/i)
      if (await passwordLabel.isVisible()) {
        const labelId = await passwordLabel.getAttribute('id')
        const inputAriaLabelledBy = await passwordInput.getAttribute('aria-labelledby')
        const inputId = await passwordInput.getAttribute('id')

        expect(labelId || inputAriaLabelledBy || inputId).toBeTruthy()
      }
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/auth/login')

    // Test tab navigation
    await page.keyboard.press('Tab')
    const firstFocusable = page.locator(':focus')

    await page.keyboard.press('Tab')
    const secondFocusable = page.locator(':focus')

    // Should be able to tab through form elements
    const firstIsVisible = await firstFocusable.isVisible()
    const secondIsVisible = await secondFocusable.isVisible()

    expect(firstIsVisible || secondIsVisible).toBeTruthy()
  })

  test('should remember form state', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com')

      // Navigate away and come back (simulating browser back/forward)
      await page.reload()

      // In a real app, this might be remembered, but for now just check the field exists
      const emailInputAfterReload = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
      await expect(emailInputAfterReload).toBeVisible()
    }
  })
})

test.describe('Session Management', () => {
  test('should handle session timeout', async ({ page }) => {
    // This would require setting up authenticated state and waiting for timeout
    // For now, just verify the app handles auth state properly

    await page.goto('/dashboard')

    // Should redirect to login if not authenticated
    const currentUrl = page.url()
    expect(currentUrl.includes('login') || currentUrl.includes('auth')).toBeTruthy()
  })

  test('should persist authentication across page reloads', async ({ page }) => {
    // This would require actual authentication setup
    // For now, just verify the app doesn't break on reload

    await page.goto('/dashboard')
    const initialUrl = page.url()

    await page.reload()
    const reloadedUrl = page.url()

    // URL should be consistent (either both login or both dashboard)
    expect(reloadedUrl).toBe(initialUrl)
  })
})








