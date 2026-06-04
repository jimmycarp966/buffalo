#!/usr/bin/env node

/**
 * 🧪 Test Runner Maestro - Shell Shop
 * Ejecuta suites completas de tests con reportes detallados
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, time: 0 },
      integration: { passed: 0, failed: 0, time: 0 },
      e2e: { passed: 0, failed: 0, time: 0 },
      security: { passed: 0, failed: 0, time: 0 },
      performance: { passed: 0, failed: 0, time: 0 },
      accessibility: { passed: 0, failed: 0, time: 0 },
      responsive: { passed: 0, failed: 0, time: 0 }
    }
    this.startTime = Date.now()
  }

  log(message, emoji = '📝') {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`${emoji} [${timestamp}] ${message}`)
  }

  logHeader(title) {
    console.log('\n' + '='.repeat(60))
    console.log(`🎯 ${title}`)
    console.log('='.repeat(60))
  }

  logResult(type, result) {
    const { passed, failed, time } = result
    const total = passed + failed
    const success = failed === 0

    const emoji = success ? '✅' : '❌'
    const status = success ? 'PASÓ' : 'FALLÓ'

    console.log(`${emoji} ${type.toUpperCase()}: ${status} (${passed}/${total} tests, ${time}ms)`)
  }

  runCommand(command, description) {
    try {
      this.log(`Ejecutando: ${description}`, '⚡')
      const start = Date.now()
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000 // 5 minutos timeout
      })
      const time = Date.now() - start
      this.log(`Completado en ${time}ms`, '✅')
      return { success: true, output, time }
    } catch (error) {
      const time = Date.now() - error.start || 0
      this.log(`Falló en ${time}ms: ${error.message}`, '❌')
      return { success: false, error: error.message, time }
    }
  }

  parseJestOutput(output) {
    // Parse Jest output to extract test results
    const passedMatch = output.match(/Tests:\s*(\d+)\s*passed/)
    const failedMatch = output.match(/Tests:\s*(\d+)\s*failed/)
    const timeMatch = output.match(/Time:\s*([\d.]+)s/)

    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      time: timeMatch ? Math.round(parseFloat(timeMatch[1]) * 1000) : 0
    }
  }

  runUnitTests() {
    this.logHeader('TESTS UNITARIOS')

    const result = this.runCommand('npm run test:unit', 'Tests unitarios completos')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.unit = parsed
    this.logResult('unit', parsed)

    return result.success
  }

  runIntegrationTests() {
    this.logHeader('TESTS DE INTEGRACIÓN')

    const result = this.runCommand('npm run test:integration', 'Tests de integración')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.integration = parsed
    this.logResult('integration', parsed)

    return result.success
  }

  runSecurityTests() {
    this.logHeader('TESTS DE SEGURIDAD')

    const result = this.runCommand('npm run test:security', 'Tests de seguridad')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.security = parsed
    this.logResult('security', parsed)

    return result.success
  }

  runE2ETests() {
    this.logHeader('TESTS E2E (PLAYWRIGHT)')

    const result = this.runCommand('npm run test:e2e', 'Tests end-to-end')
    // Playwright output parsing would go here
    this.results.e2e = { passed: 0, failed: 0, time: result.time }
    this.logResult('e2e', this.results.e2e)

    return result.success
  }

  runPerformanceTests() {
    this.logHeader('TESTS DE PERFORMANCE')

    const result = this.runCommand('npm run test:performance', 'Tests de performance')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.performance = parsed
    this.logResult('performance', parsed)

    return result.success
  }

  runAccessibilityTests() {
    this.logHeader('TESTS DE ACCESIBILIDAD')

    const result = this.runCommand('npm run test:accessibility', 'Tests de accesibilidad')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.accessibility = parsed
    this.logResult('accessibility', parsed)

    return result.success
  }

  runResponsiveTests() {
    this.logHeader('TESTS RESPONSIVE')

    const result = this.runCommand('npm run test:responsive', 'Tests responsive')
    const parsed = this.parseJestOutput(result.success ? result.output : result.error)

    this.results.responsive = parsed
    this.logResult('responsive', parsed)

    return result.success
  }

  generateReport() {
    this.logHeader('REPORTE FINAL DE TESTS')

    const totalTime = Date.now() - this.startTime
    const allResults = Object.values(this.results)
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0)
    const totalTests = totalPassed + totalFailed

    console.log(`\n📊 ESTADÍSTICAS GENERALES:`)
    console.log(`   Total de Tests: ${totalTests}`)
    console.log(`   Tests Exitosos: ${totalPassed}`)
    console.log(`   Tests Fallidos: ${totalFailed}`)
    console.log(`   Tiempo Total: ${Math.round(totalTime / 1000)}s`)

    console.log(`\n📈 RESULTADOS POR CATEGORÍA:`)
    Object.entries(this.results).forEach(([category, result]) => {
      const { passed, failed, time } = result
      const total = passed + failed
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0
      const status = failed === 0 ? '✅' : '❌'

      console.log(`   ${status} ${category.toUpperCase()}: ${passed}/${total} (${percentage}%) - ${time}ms`)
    })

    // Overall status
    const overallSuccess = totalFailed === 0
    const overallEmoji = overallSuccess ? '🎉' : '⚠️'
    const overallStatus = overallSuccess ? 'TODOS LOS TESTS PASARON' : 'ALGUNOS TESTS FALLARON'

    console.log(`\n${overallEmoji} RESULTADO FINAL: ${overallStatus}`)

    if (overallSuccess) {
      console.log(`\n🏆 SISTEMA 100% FUNCIONAL Y LISTO PARA PRODUCCIÓN!`)
    } else {
      console.log(`\n🔧 REVISAR LOS TESTS FALLIDOS ANTES DE DEPLOY.`)
    }

    return overallSuccess
  }

  runAllTests() {
    this.log('🚀 INICIANDO SUITE COMPLETA DE TESTS', '🎯')

    const tests = [
      () => this.runUnitTests(),
      () => this.runIntegrationTests(),
      () => this.runSecurityTests(),
      () => this.runE2ETests(),
      () => this.runPerformanceTests(),
      () => this.runAccessibilityTests(),
      () => this.runResponsiveTests()
    ]

    let allPassed = true

    for (const test of tests) {
      const passed = test()
      if (!passed) allPassed = false
    }

    this.generateReport()
    return allPassed
  }

  runQuickTests() {
    this.log('⚡ EJECUTANDO TESTS RÁPIDOS (10 minutos)', '🎯')

    const tests = [
      () => this.runUnitTests(),
      () => this.runSecurityTests()
    ]

    let allPassed = true

    for (const test of tests) {
      const passed = test()
      if (!passed) allPassed = false
    }

    this.generateReport()
    return allPassed
  }
}

// CLI Interface
const args = process.argv.slice(2)
const mode = args[0] || 'all'

const runner = new TestRunner()

switch (mode) {
  case 'quick':
  case 'fast':
    runner.runQuickTests()
    break
  case 'unit':
    runner.runUnitTests()
    break
  case 'integration':
    runner.runIntegrationTests()
    break
  case 'security':
    runner.runSecurityTests()
    break
  case 'e2e':
    runner.runE2ETests()
    break
  case 'performance':
    runner.runPerformanceTests()
    break
  case 'accessibility':
    runner.runAccessibilityTests()
    break
  case 'responsive':
    runner.runResponsiveTests()
    break
  case 'all':
  default:
    runner.runAllTests()
    break
}

process.exit(runner.generateReport() ? 0 : 1)








