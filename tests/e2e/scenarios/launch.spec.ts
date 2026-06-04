import { test } from '@playwright/test';

test('Launch browser test', async ({ page }) => {
    console.log('--- STARTING BROWSER LAUNCH TEST ---');
    try {
        await page.goto('about:blank', { timeout: 10000 });
        console.log('--- BROWSER LAUNCHED SUCCESSFULLY ---');
    } catch (e) {
        console.error('--- BROWSER LAUNCH FAILED ---', e);
        throw e;
    }
});
