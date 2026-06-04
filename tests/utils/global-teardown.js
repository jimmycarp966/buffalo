/**
 * Global teardown for Playwright tests
 * This file runs after all E2E tests
 */

module.exports = async (config) => {
  // Cleanup global test environment
  console.log('🧹 Cleaning up Playwright test environment...')

  // You can add any global cleanup here:
  // - Database cleanup
  // - Cache cleanup
  // - Report generation
  // - Environment reset

  console.log('✅ Playwright test environment cleanup complete')
}








