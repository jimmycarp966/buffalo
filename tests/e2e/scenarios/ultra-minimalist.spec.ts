import { test } from '@playwright/test';

test('Ultra-minimalist test', async () => {
    console.log('--- STARTING ULTRA MINIMALIST TEST ---');
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('--- ENDING ULTRA MINIMALIST TEST ---');
});
