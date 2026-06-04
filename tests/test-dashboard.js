#!/usr/bin/env node

/**
 * Test Dashboard - Comprehensive Testing Suite
 *
 * This script runs all tests and generates a comprehensive report
 * covering unit tests, integration tests, E2E tests, performance tests,
 * accessibility tests, and responsive design tests.
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

class TestDashboard {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, total: 0, time: 0 },
      integration: { passed: 0, failed: 0, total: 0, time: 0 },
      e2e: { passed: 0, failed: 0, total: 0, time: 0 },
      performance: { passed: 0, failed: 0, total: 0, time: 0 },
      accessibility: { passed: 0, failed: 0, total: 0, time: 0 },
      responsive: { passed: 0, failed: 0, total: 0, time: 0 },
      flow: { passed: 0, failed: 0, total: 0, time: 0 },
      edge: { passed: 0, failed: 0, total: 0, time: 0 },
      total: { passed: 0, failed: 0, total: 0, time: 0 }
    }

    this.startTime = Date.now()
    this.output = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const formattedMessage = `[${timestamp}] ${message}`

    console.log(formattedMessage)
    this.output.push({ timestamp, message, type })
  }

  async runCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      try {
        const result = execSync(command, {
          cwd,
          encoding: 'utf8',
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        })

        const endTime = Date.now()
        const duration = endTime - startTime

        resolve({
          success: true,
          output: result,
          duration
        })
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime

        resolve({
          success: false,
          error: error.message,
          output: error.stdout || '',
          stderr: error.stderr || '',
          duration
        })
      }
    })
  }

  parseJestOutput(output, category) {
    const lines = output.split('\n')
    let passed = 0
    let failed = 0
    let total = 0
    let time = 0

    // Parse Jest output format
    for (const line of lines) {
      // Tests:       15 passed, 0 failed, 15 total
      const testMatch = line.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/)
      if (testMatch) {
        passed = parseInt(testMatch[1])
        failed = parseInt(testMatch[2])
        total = parseInt(testMatch[3])
      }

      // Time:        2.341 s
      const timeMatch = line.match(/Time:\s+([\d.]+)\s+s/)
      if (timeMatch) {
        time = parseFloat(timeMatch[1])
      }
    }

    this.results[category] = { passed, failed, total, time }
    this.results.total.passed += passed
    this.results.total.failed += failed
    this.results.total.total += total
    this.results.total.time += time
  }

  async runUnitTests() {
    this.log('🚀 Running Unit Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/unit --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'unit')
      this.log(`✅ Unit Tests: ${this.results.unit.passed}/${this.results.unit.total} passed (${this.results.unit.time}s)`, 'success')
    } else {
      this.log(`❌ Unit Tests Failed: ${result.error}`, 'error')
      this.results.unit.failed = 1
    }
  }

  async runIntegrationTests() {
    this.log('🔗 Running Integration Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/integration --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'integration')
      this.log(`✅ Integration Tests: ${this.results.integration.passed}/${this.results.integration.total} passed (${this.results.integration.time}s)`, 'success')
    } else {
      this.log(`❌ Integration Tests Failed: ${result.error}`, 'error')
      this.results.integration.failed = 1
    }
  }

  async runE2ETests() {
    this.log('🌐 Running E2E Tests...', 'start')

    // Check if Playwright is installed
    try {
      execSync('npx playwright --version', { stdio: 'ignore' })

      const result = await this.runCommand('npx playwright test --headed')

      if (result.success) {
        this.parseJestOutput(result.output, 'e2e')
        this.log(`✅ E2E Tests: ${this.results.e2e.passed}/${this.results.e2e.total} passed (${this.results.e2e.time}s)`, 'success')
      } else {
        this.log(`❌ E2E Tests Failed: ${result.error}`, 'error')
        this.results.e2e.failed = 1
      }
    } catch (e) {
      this.log('⚠️  Playwright not available, skipping E2E tests', 'warning')
      this.results.e2e.passed = 0
      this.results.e2e.failed = 0
      this.results.e2e.total = 0
    }
  }

  async runPerformanceTests() {
    this.log('⚡ Running Performance Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/performance --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'performance')
      this.log(`✅ Performance Tests: ${this.results.performance.passed}/${this.results.performance.total} passed (${this.results.performance.time}s)`, 'success')
    } else {
      this.log(`❌ Performance Tests Failed: ${result.error}`, 'error')
      this.results.performance.failed = 1
    }
  }

  async runAccessibilityTests() {
    this.log('♿ Running Accessibility Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/accessibility --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'accessibility')
      this.log(`✅ Accessibility Tests: ${this.results.accessibility.passed}/${this.results.accessibility.total} passed (${this.results.accessibility.time}s)`, 'success')
    } else {
      this.log(`❌ Accessibility Tests Failed: ${result.error}`, 'error')
      this.results.accessibility.failed = 1
    }
  }

  async runResponsiveTests() {
    this.log('📱 Running Responsive Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/responsive --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'responsive')
      this.log(`✅ Responsive Tests: ${this.results.responsive.passed}/${this.results.responsive.total} passed (${this.results.responsive.time}s)`, 'success')
    } else {
      this.log(`❌ Responsive Tests Failed: ${result.error}`, 'error')
      this.results.responsive.failed = 1
    }
  }

  async runFlowTests() {
    this.log('🔄 Running Flow Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/integration/flows --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'flow')
      this.log(`✅ Flow Tests: ${this.results.flow.passed}/${this.results.flow.total} passed (${this.results.flow.time}s)`, 'success')
    } else {
      this.log(`❌ Flow Tests Failed: ${result.error}`, 'error')
      this.results.flow.failed = 1
    }
  }

  async runEdgeCaseTests() {
    this.log('⚠️  Running Edge Case Tests...', 'start')

    const result = await this.runCommand('npm test -- tests/integration/edge-cases --passWithNoTests')

    if (result.success) {
      this.parseJestOutput(result.output, 'edge')
      this.log(`✅ Edge Case Tests: ${this.results.edge.passed}/${this.results.edge.total} passed (${this.results.edge.time}s)`, 'success')
    } else {
      this.log(`❌ Edge Case Tests Failed: ${result.error}`, 'error')
      this.results.edge.failed = 1
    }
  }

  generateReport() {
    const endTime = Date.now()
    const totalTime = (endTime - this.startTime) / 1000

    const report = {
      timestamp: new Date().toISOString(),
      duration: totalTime,
      summary: {
        total: this.results.total.total,
        passed: this.results.total.passed,
        failed: this.results.total.failed,
        successRate: this.results.total.total > 0 ?
          ((this.results.total.passed / this.results.total.total) * 100).toFixed(1) : '0'
      },
      categories: this.results,
      coverage: this.calculateCoverage(),
      recommendations: this.generateRecommendations()
    }

    return report
  }

  calculateCoverage() {
    const categories = Object.keys(this.results).filter(key => key !== 'total')
    const coveredCategories = categories.filter(cat => this.results[cat].total > 0)
    const coveragePercentage = (coveredCategories.length / categories.length) * 100

    return {
      percentage: coveragePercentage.toFixed(1),
      coveredCategories,
      missingCategories: categories.filter(cat => this.results[cat].total === 0)
    }
  }

  generateRecommendations() {
    const recommendations = []

    if (this.results.total.failed > 0) {
      recommendations.push('Fix failing tests to ensure code reliability')
    }

    if (this.results.e2e.total === 0) {
      recommendations.push('Implement E2E tests for critical user journeys')
    }

    if (this.results.performance.total === 0) {
      recommendations.push('Add performance tests to ensure good user experience')
    }

    if (this.results.accessibility.total === 0) {
      recommendations.push('Implement accessibility tests for inclusive design')
    }

    if (this.results.total.total < 50) {
      recommendations.push('Increase test coverage with more comprehensive test suites')
    }

    const successRate = this.results.total.total > 0 ?
      (this.results.total.passed / this.results.total.total) * 100 : 0

    if (successRate < 80) {
      recommendations.push('Improve test stability and fix flaky tests')
    }

    return recommendations
  }

  printReport() {
    const report = this.generateReport()

    console.log('\n' + '='.repeat(80))
    console.log('🧪 SHELL SHOP - COMPREHENSIVE TEST REPORT')
    console.log('='.repeat(80))
    console.log(`📅 Generated: ${report.timestamp}`)
    console.log(`⏱️  Duration: ${report.duration.toFixed(1)}s`)
    console.log(`📊 Success Rate: ${report.summary.successRate}%`)
    console.log(`✅ Passed: ${report.summary.passed}`)
    console.log(`❌ Failed: ${report.summary.failed}`)
    console.log(`📈 Total: ${report.summary.total}`)
    console.log('\n📋 CATEGORY BREAKDOWN:')

    const categories = Object.keys(report.categories).filter(key => key !== 'total')
    for (const category of categories) {
      const data = report.categories[category]
      const status = data.failed > 0 ? '❌' : data.total === 0 ? '⚠️' : '✅'
      const successRate = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(1) : '0'
      console.log(`  ${status} ${category.padEnd(15)}: ${data.passed}/${data.total} (${successRate}%) - ${data.time.toFixed(1)}s`)
    }

    console.log('\n🎯 COVERAGE:')
    console.log(`  📊 Test Coverage: ${report.coverage.percentage}%`)
    console.log(`  ✅ Covered: ${report.coverage.coveredCategories.join(', ')}`)
    if (report.coverage.missingCategories.length > 0) {
      console.log(`  ⚠️  Missing: ${report.coverage.missingCategories.join(', ')}`)
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(80))

    // Save report to file
    const reportPath = path.join(process.cwd(), 'test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Detailed report saved to: ${reportPath}`)
  }

  async runAllTests() {
    this.log('🎯 Starting Comprehensive Test Suite', 'start')

    try {
      // Run all test categories
      await this.runUnitTests()
      await this.runIntegrationTests()
      await this.runE2ETests()
      await this.runPerformanceTests()
      await this.runAccessibilityTests()
      await this.runResponsiveTests()
      await this.runFlowTests()
      await this.runEdgeCaseTests()

      this.printReport()

      // Exit with appropriate code
      const successRate = this.results.total.total > 0 ?
        (this.results.total.passed / this.results.total.total) : 0

      if (successRate >= 0.8 && this.results.total.failed === 0) {
        this.log('🎉 All tests completed successfully!', 'success')
        process.exit(0)
      } else {
        this.log('⚠️  Tests completed with issues', 'warning')
        process.exit(1)
      }

    } catch (error) {
      this.log(`💥 Test suite failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }
}

// Run the test dashboard
if (require.main === module) {
  const dashboard = new TestDashboard()
  dashboard.runAllTests()
}

module.exports = TestDashboard
