#!/usr/bin/env node

/**
 * Production health check script
 * Validates that the deployed application is functioning correctly
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  url: process.env.HEALTH_CHECK_URL || 'https://username.github.io/dot-art-3d-converter/',
  timeout: 30000,
  retries: 3,
  checks: {
    pageLoad: true,
    jsExecution: true,
    uiElements: true,
    consoleErrors: true,
    performance: true,
    accessibility: true
  }
};

class HealthChecker {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      checks: [],
      startTime: Date.now()
    };
  }

  /**
   * Run all health checks
   */
  async runAll() {
    console.log('🏥 Starting health check for:', config.url);
    console.log('=' .repeat(50));

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    try {
      // Set up error collection
      const consoleErrors = [];
      const networkErrors = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('requestfailed', request => {
        networkErrors.push({
          url: request.url(),
          error: request.failure()?.errorText || 'Unknown error'
        });
      });

      // Run checks
      await this.checkPageLoad(page);
      await this.checkJavaScriptExecution(page);
      await this.checkUIElements(page);
      await this.checkConsoleErrors(consoleErrors);
      await this.checkNetworkErrors(networkErrors);
      await this.checkPerformance(page);
      await this.checkAccessibility(page);

      // Generate report
      this.generateReport();

    } catch (error) {
      this.addResult('CRITICAL', 'Health Check Failed', error.message);
    } finally {
      await browser.close();
    }

    return this.results.failed === 0;
  }

  /**
   * Check if page loads successfully
   */
  async checkPageLoad(page) {
    try {
      console.log('🔍 Checking page load...');
      
      const startTime = Date.now();
      const response = await page.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.timeout
      });
      const loadTime = Date.now() - startTime;

      if (response && response.ok()) {
        this.addResult('PASS', 'Page Load', `Loaded successfully in ${loadTime}ms`);
      } else {
        this.addResult('FAIL', 'Page Load', `Failed to load: ${response?.status()}`);
        return;
      }

      // Check page title
      const title = await page.title();
      if (title && title.trim()) {
        this.addResult('PASS', 'Page Title', `Title present: "${title}"`);
      } else {
        this.addResult('WARN', 'Page Title', 'Page title is empty or missing');
      }

    } catch (error) {
      this.addResult('FAIL', 'Page Load', error.message);
    }
  }

  /**
   * Check JavaScript execution
   */
  async checkJavaScriptExecution(page) {
    try {
      console.log('🔍 Checking JavaScript execution...');

      // Check if React is loaded
      const reactLoaded = await page.evaluate(() => {
        return typeof window.React !== 'undefined' || 
               document.querySelector('[data-reactroot]') !== null ||
               document.querySelector('#root') !== null;
      });

      if (reactLoaded) {
        this.addResult('PASS', 'React Loading', 'React application loaded successfully');
      } else {
        this.addResult('FAIL', 'React Loading', 'React not detected');
      }

      // Check if main app element exists
      const appElement = await page.locator('#root, [data-reactroot]').first();
      if (await appElement.isVisible()) {
        this.addResult('PASS', 'App Mount', 'Application mounted successfully');
      } else {
        this.addResult('FAIL', 'App Mount', 'App element not found or not visible');
      }

    } catch (error) {
      this.addResult('FAIL', 'JavaScript Execution', error.message);
    }
  }

  /**
   * Check UI elements are present
   */
  async checkUIElements(page) {
    try {
      console.log('🔍 Checking UI elements...');

      const checks = [
        {
          selector: 'input[type="file"]',
          name: 'File Upload',
          required: true
        },
        {
          selector: 'button',
          name: 'Interactive Buttons',
          required: true
        },
        {
          selector: 'nav, header, .navigation',
          name: 'Navigation',
          required: false
        }
      ];

      for (const check of checks) {
        const element = page.locator(check.selector).first();
        const visible = await element.isVisible().catch(() => false);
        
        if (visible) {
          this.addResult('PASS', check.name, 'Element found and visible');
        } else if (check.required) {
          this.addResult('FAIL', check.name, 'Required element not found');
        } else {
          this.addResult('WARN', check.name, 'Optional element not found');
        }
      }

    } catch (error) {
      this.addResult('FAIL', 'UI Elements', error.message);
    }
  }

  /**
   * Check for console errors
   */
  async checkConsoleErrors(consoleErrors) {
    console.log('🔍 Checking console errors...');

    if (consoleErrors.length === 0) {
      this.addResult('PASS', 'Console Errors', 'No console errors detected');
    } else {
      // Filter out non-critical errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('favicon.ico') &&
        !error.includes('ServiceWorker') &&
        !error.includes('manifest.json')
      );

      if (criticalErrors.length === 0) {
        this.addResult('WARN', 'Console Errors', `${consoleErrors.length} minor errors (ignored)`);
      } else {
        this.addResult('FAIL', 'Console Errors', 
          `${criticalErrors.length} critical errors: ${criticalErrors.slice(0, 3).join(', ')}`
        );
      }
    }
  }

  /**
   * Check for network errors
   */
  async checkNetworkErrors(networkErrors) {
    console.log('🔍 Checking network errors...');

    if (networkErrors.length === 0) {
      this.addResult('PASS', 'Network Requests', 'All network requests successful');
    } else {
      const criticalNetworkErrors = networkErrors.filter(error => 
        !error.url.includes('favicon.ico') &&
        !error.url.includes('manifest.json')
      );

      if (criticalNetworkErrors.length === 0) {
        this.addResult('WARN', 'Network Requests', 'Minor network errors (ignored)');
      } else {
        this.addResult('FAIL', 'Network Requests', 
          `${criticalNetworkErrors.length} failed requests`
        );
      }
    }
  }

  /**
   * Check performance metrics
   */
  async checkPerformance(page) {
    try {
      console.log('🔍 Checking performance...');

      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });

      // Check DOM Content Loaded time
      if (performanceMetrics.domContentLoaded < 2000) {
        this.addResult('PASS', 'DOM Load Time', `${performanceMetrics.domContentLoaded.toFixed(0)}ms`);
      } else {
        this.addResult('WARN', 'DOM Load Time', `${performanceMetrics.domContentLoaded.toFixed(0)}ms (>2s)`);
      }

      // Check First Contentful Paint
      if (performanceMetrics.firstContentfulPaint && performanceMetrics.firstContentfulPaint < 1800) {
        this.addResult('PASS', 'First Contentful Paint', `${performanceMetrics.firstContentfulPaint.toFixed(0)}ms`);
      } else if (performanceMetrics.firstContentfulPaint) {
        this.addResult('WARN', 'First Contentful Paint', `${performanceMetrics.firstContentfulPaint.toFixed(0)}ms (>1.8s)`);
      } else {
        this.addResult('WARN', 'First Contentful Paint', 'Not measured');
      }

    } catch (error) {
      this.addResult('WARN', 'Performance Check', error.message);
    }
  }

  /**
   * Check basic accessibility
   */
  async checkAccessibility(page) {
    try {
      console.log('🔍 Checking accessibility...');

      // Check for alt text on images
      const imagesWithoutAlt = await page.locator('img:not([alt])').count();
      if (imagesWithoutAlt === 0) {
        this.addResult('PASS', 'Image Alt Text', 'All images have alt text');
      } else {
        this.addResult('WARN', 'Image Alt Text', `${imagesWithoutAlt} images without alt text`);
      }

      // Check for heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
      if (headings > 0) {
        this.addResult('PASS', 'Heading Structure', `${headings} headings found`);
      } else {
        this.addResult('WARN', 'Heading Structure', 'No headings found');
      }

      // Check for focus indicators (basic check)
      const focusableElements = await page.locator('button, input, select, textarea, a[href]').count();
      if (focusableElements > 0) {
        this.addResult('PASS', 'Focusable Elements', `${focusableElements} focusable elements`);
      } else {
        this.addResult('WARN', 'Focusable Elements', 'No focusable elements found');
      }

    } catch (error) {
      this.addResult('WARN', 'Accessibility Check', error.message);
    }
  }

  /**
   * Add a check result
   */
  addResult(status, check, message) {
    const result = { status, check, message, timestamp: new Date().toISOString() };
    this.results.checks.push(result);

    const icon = {
      'PASS': '✅',
      'WARN': '⚠️',
      'FAIL': '❌',
      'CRITICAL': '🚨'
    }[status];

    console.log(`  ${icon} ${check}: ${message}`);

    if (status === 'PASS') {
      this.results.passed++;
    } else if (status === 'WARN') {
      this.results.warnings++;
    } else {
      this.results.failed++;
    }
  }

  /**
   * Generate final report
   */
  generateReport() {
    const duration = Date.now() - this.results.startTime;
    const total = this.results.passed + this.results.failed + this.results.warnings;

    console.log('\n' + '=' .repeat(50));
    console.log('📊 HEALTH CHECK SUMMARY');
    console.log('=' .repeat(50));
    console.log(`URL: ${config.url}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Checks: ${total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`❌ Failed: ${this.results.failed}`);

    if (this.results.failed === 0) {
      console.log('\n🎉 All critical health checks passed!');
      if (this.results.warnings > 0) {
        console.log(`⚠️  ${this.results.warnings} warnings to address`);
      }
    } else {
      console.log(`\n🚨 ${this.results.failed} critical issues found!`);
    }

    // Save detailed results
    const reportPath = join(__dirname, '..', 'health-check-results.json');
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`\n📋 Detailed report saved to: health-check-results.json`);
    } catch (error) {
      console.warn('⚠️  Could not save detailed report:', error.message);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const checker = new HealthChecker();
  
  try {
    const success = await checker.runAll();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('🚨 Health check crashed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export default HealthChecker;