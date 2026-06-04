import { test, expect } from '@playwright/test';

/**
 * 🧪 Test Suite: Operaciones Integrales de Caja Bar (v3.4.2)
 * Cubre Mesas, Mostrador y Delivery, incluyendo el blindaje contra IDs temporales.
 */

test.describe('Caja Bar - Operaciones Integrales', () => {

    test.beforeEach(async ({ page }) => {
        // 1. LOGIN
        await page.goto('/login');
        await page.fill('#email', 'juan@almendra.com');
        await page.fill('#password', 'juan123');
        await page.click('button[type="submit"]');

        // Esperar a la redirección post-login
        await page.waitForURL(/.*dashboard|.*caja-bar/, { timeout: 15000 });

        // 2. NAVEGAR A CAJA BAR Y ASEGURAR CAJA ABIERTA
        console.log('Navegando a /caja-bar...');
        await page.goto('/caja-bar', { waitUntil: 'networkidle' });
        await page.waitForURL(/.*caja-bar/);

        // Si la caja está cerrada, abrirla
        const btnAbrirCaja = page.getByRole('button', { name: /Abrir Caja/i });
        if (await btnAbrirCaja.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('Caja cerrada detectada. Abriendo caja...');
            await btnAbrirCaja.click();
            await page.fill('#opening_amount', '1000');
            await page.selectOption('#shift', 'morning');
            await page.getByRole('button', { name: /Abrir Caja/i }).last().click();
            // Esperar a que la caja se abra y el modal desaparezca
            await page.waitForSelector('text=Cerrada', { state: 'hidden', timeout: 10000 });
            console.log('Caja abierta exitosamente.');
        }

        // Esperar a que cargue el layout de mesas (Salón o Vereda) como señal de que la página está lista
        await page.waitForSelector('text=Mesas', { timeout: 20000 });
    });

    test('Debería abrir una mesa y bloquear botones durante la sincronización', async ({ page }) => {
        // 1. Buscar una mesa libre
        const mesaLibre = page.locator('.table-card:has-text("Libre")').first();
        if (await mesaLibre.isVisible()) {
            await mesaLibre.click();

            // 2. Click en "Abrir Mesa" o similar para iniciar flujo optimista
            const abrirBtn = page.getByRole('button', { name: /Abrir Mesa|Confirmar/i });
            if (await abrirBtn.isVisible()) {
                await abrirBtn.click();
            }

            // 3. VERIFICAR BLINDAJE (ID Temporal)
            const btnAgregar = page.getByRole('button', { name: /Sincronizando|Agregar Productos/i });
            await expect(btnAgregar).toBeDisabled();

            const btnCerrar = page.getByRole('button', { name: /CERRAR MESA|Sincronizando/i });
            await expect(btnCerrar).toBeDisabled();

            // 4. Esperar a que la sincronización termine
            await expect(btnAgregar).toBeEnabled({ timeout: 15000 });
            await expect(btnAgregar).toContainText('Agregar Productos');
        }
    });

    test('Debería cargar productos y realizar un pago parcial', async ({ page }) => {
        const mesaOcupada = page.locator('.table-card:has-text("$")').first();
        if (await mesaOcupada.isVisible()) {
            await mesaOcupada.click();
            await page.getByRole('button', { name: /Agregar Productos/i }).click();

            // Buscar producto
            const searchInput = page.getByPlaceholder(/Escribe para buscar productos|Buscar producto/i);
            await searchInput.fill('a');
            await page.waitForTimeout(1000);
            await page.locator('[data-product-index="0"]').or(page.locator('.cursor-pointer')).first().click();

            await page.getByRole('button', { name: /Confirmar|Agregar/i }).last().click();
            await expect(page.locator('text=guardado con éxito').or(page.locator('text=agregado'))).toBeVisible();

            // Pago Parcial
            await page.getByRole('button', { name: /Pago Parcial/i }).click();
            await page.locator('input[type="number"]').first().fill('100');
            await page.getByRole('button', { name: /Registrar Pago/i }).click();
            await expect(page.locator('text=exitosamente')).toBeVisible();
        }
    });

    test('Debería realizar un cambio de mesa', async ({ page }) => {
        const mesaOcupada = page.locator('.table-card:has-text("$")').first();
        if (await mesaOcupada.isVisible()) {
            await mesaOcupada.click();
            await page.getByRole('button', { name: /Cambiar Mesa/i }).click();

            // Seleccionar mesa destino
            await page.locator('select').or(page.locator('.mesa-selector-item')).first().click();
            await page.getByRole('button', { name: /Confirmar Cambio/i }).click();
            await expect(page.locator('text=Cambio realizado').or(page.locator('text=exitosa'))).toBeVisible();
        }
    });

    test('Debería realizar una venta en Mostrador', async ({ page }) => {
        await page.getByRole('tab', { name: /MOSTRADOR/i }).click();

        const btnNuevoPedido = page.locator('button:has-text("Nuevo Pedido")').first();
        await btnNuevoPedido.waitFor({ state: 'visible' });
        await btnNuevoPedido.click();

        const searchInput = page.getByPlaceholder(/Escribe para buscar productos|Buscar producto/i);
        await searchInput.waitFor({ state: 'visible' });
        await searchInput.fill('a');
        await page.waitForTimeout(1000);
        await page.locator('[data-product-index="0"]').or(page.locator('.cursor-pointer')).first().click();

        // Finalizar venta
        console.log('Finalizando venta de mostrador...');
        await page.getByRole('button', { name: /Crear Pedido/i }).click();

        await expect(page.locator('text=exitosamente').or(page.locator('text=creado'))).toBeVisible({ timeout: 15000 });
        console.log('Venta de mostrador exitosa.');
    });

    test('Debería gestionar un pedido de Delivery', async ({ page }) => {
        await page.getByRole('tab', { name: /DELIVERY/i }).click();

        const btnNuevoPedido = page.locator('button:has-text("Nuevo Pedido")').first();
        await btnNuevoPedido.waitFor({ state: 'visible' });
        await btnNuevoPedido.click();

        await page.fill('input[placeholder*="Nombre"]', 'Cliente Playwright');
        await page.fill('input[placeholder*="Dirección"]', 'Calle Falsa 123');

        const searchInput = page.getByPlaceholder(/Escribe para buscar productos|Buscar producto/i);
        await searchInput.fill('a');
        await page.waitForTimeout(1000);
        await page.locator('[data-product-index="0"]').or(page.locator('.cursor-pointer')).first().click();

        // Confirmar pedido
        console.log('Creando pedido de delivery...');
        await page.getByRole('button', { name: /Crear Pedido/i }).click();

        await expect(page.locator('text=exitosamente').or(page.locator('text=creado'))).toBeVisible({ timeout: 15000 });
        console.log('Pedido de delivery creado exitosamente.');
    });
});
