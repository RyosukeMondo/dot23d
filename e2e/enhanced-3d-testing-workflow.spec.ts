import { test, expect, testFiles, HomePage, Model3DPage } from './fixtures';
import { Page } from '@playwright/test';

// Extended Page Object Models for enhanced testing interface
class TestingDashboardPage {
  constructor(public page: Page) {}

  async navigateToTestingDashboard() {
    await this.page.goto('/testing');
    await this.page.waitForLoadState('networkidle');
  }

  async selectPatternManagement() {
    await this.page.getByRole('tab', { name: /pattern.*management/i }).click();
  }

  async selectParameterTesting() {
    await this.page.getByRole('tab', { name: /parameter.*testing/i }).click();
  }

  async selectPerformanceMonitoring() {
    await this.page.getByRole('tab', { name: /performance.*monitoring/i }).click();
  }

  async selectResultsDashboard() {
    await this.page.getByRole('tab', { name: /results.*dashboard/i }).click();
  }

  async selectAutomatedTesting() {
    await this.page.getByRole('tab', { name: /automated.*testing/i }).click();
  }

  async waitForTestingInterface() {
    await this.page.waitForSelector('[data-testid="testing-dashboard"]', { state: 'visible' });
  }
}

class PatternManagementPanel {
  constructor(public page: Page) {}

  async createNewPattern(name: string, description: string) {
    await this.page.getByRole('button', { name: /create.*pattern/i }).click();
    await this.page.getByLabel(/pattern.*name/i).fill(name);
    await this.page.getByLabel(/description/i).fill(description);
    await this.page.getByRole('button', { name: /save.*pattern/i }).click();
  }

  async uploadPatternFile(filepath: string) {
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filepath);
  }

  async editPattern(patternName: string, newDescription: string) {
    await this.page.getByText(patternName).locator('..').getByRole('button', { name: /edit/i }).click();
    await this.page.getByLabel(/description/i).fill(newDescription);
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async deletePattern(patternName: string) {
    await this.page.getByText(patternName).locator('..').getByRole('button', { name: /delete/i }).click();
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }

  async bulkSelectPatterns(count: number) {
    const checkboxes = this.page.locator('[data-testid="pattern-checkbox"]');
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
  }

  async bulkDeleteSelected() {
    await this.page.getByRole('button', { name: /delete.*selected/i }).click();
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }
}

class ParameterTestingPanel {
  constructor(public page: Page) {}

  async setHeightParameter(value: string) {
    await this.page.getByLabel(/height/i).fill(value);
  }

  async setExtrusionParameter(value: string) {
    await this.page.getByLabel(/extrusion/i).fill(value);
  }

  async setQualityParameter(value: string) {
    await this.page.getByLabel(/quality/i).fill(value);
  }

  async enableBackgroundLayer() {
    await this.page.getByLabel(/background.*layer/i).check();
  }

  async savePreset(name: string) {
    await this.page.getByRole('button', { name: /save.*preset/i }).click();
    await this.page.getByLabel(/preset.*name/i).fill(name);
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async loadPreset(name: string) {
    await this.page.getByRole('combobox', { name: /preset/i }).click();
    await this.page.getByRole('option', { name }).click();
  }

  async runBulkTest() {
    await this.page.getByRole('button', { name: /run.*bulk.*test/i }).click();
  }

  async waitForTestCompletion() {
    await this.page.waitForSelector('[data-testid="test-complete"]', { 
      state: 'visible',
      timeout: 30000 
    });
  }
}

class PerformanceMonitoringPanel {
  constructor(public page: Page) {}

  async setRenderTimeThreshold(value: string) {
    await this.page.getByLabel(/render.*time.*threshold/i).fill(value);
  }

  async setMemoryUsageThreshold(value: string) {
    await this.page.getByLabel(/memory.*usage.*threshold/i).fill(value);
  }

  async startMonitoring() {
    await this.page.getByRole('button', { name: /start.*monitoring/i }).click();
  }

  async stopMonitoring() {
    await this.page.getByRole('button', { name: /stop.*monitoring/i }).click();
  }

  async getPerformanceMetric(metric: string): Promise<string> {
    const element = this.page.locator(`[data-testid="metric-${metric}"]`);
    return await element.textContent() || '0';
  }

  async waitForMetricsUpdate() {
    await this.page.waitForTimeout(2000); // Allow metrics to update
  }
}

class ResultsDashboardPanel {
  constructor(public page: Page) {}

  async filterResultsByStatus(status: string) {
    await this.page.getByRole('combobox', { name: /status.*filter/i }).click();
    await this.page.getByRole('option', { name: status }).click();
  }

  async filterResultsByDateRange(startDate: string, endDate: string) {
    await this.page.getByLabel(/start.*date/i).fill(startDate);
    await this.page.getByLabel(/end.*date/i).fill(endDate);
    await this.page.getByRole('button', { name: /apply.*filter/i }).click();
  }

  async exportResults(format: string) {
    await this.page.getByRole('button', { name: /export/i }).click();
    await this.page.getByRole('menuitem', { name: format }).click();
  }

  async viewResultDetails(resultId: string) {
    await this.page.getByTestId(`result-${resultId}`).click();
  }

  async generateTrendReport() {
    await this.page.getByRole('button', { name: /generate.*trend.*report/i }).click();
  }
}

class AutomatedTestingPanel {
  constructor(public page: Page) {}

  async createTestSuite(name: string, description: string) {
    await this.page.getByRole('button', { name: /create.*suite/i }).click();
    await this.page.getByLabel(/suite.*name/i).fill(name);
    await this.page.getByLabel(/description/i).fill(description);
    await this.page.getByRole('button', { name: /create/i }).click();
  }

  async addTestToSuite(suiteName: string, testType: string) {
    await this.page.getByText(suiteName).locator('..').getByRole('button', { name: /add.*test/i }).click();
    await this.page.getByRole('combobox', { name: /test.*type/i }).click();
    await this.page.getByRole('option', { name: testType }).click();
    await this.page.getByRole('button', { name: /add/i }).click();
  }

  async runTestSuite(suiteName: string) {
    await this.page.getByText(suiteName).locator('..').getByRole('button', { name: /run/i }).click();
  }

  async scheduleTestSuite(suiteName: string, schedule: string) {
    await this.page.getByText(suiteName).locator('..').getByRole('button', { name: /schedule/i }).click();
    await this.page.getByLabel(/schedule/i).fill(schedule);
    await this.page.getByRole('button', { name: /save.*schedule/i }).click();
  }

  async configureCIIntegration() {
    await this.page.getByRole('button', { name: /ci.*integration/i }).click();
    await this.page.getByLabel(/webhook.*url/i).fill('https://api.github.com/webhook');
    await this.page.getByRole('button', { name: /save.*integration/i }).click();
  }
}

test.describe('Enhanced 3D Testing Workflow', () => {
  let homePage: HomePage;
  let model3DPage: Model3DPage;
  let testingDashboard: TestingDashboardPage;
  let patternPanel: PatternManagementPanel;
  let parameterPanel: ParameterTestingPanel;
  let performancePanel: PerformanceMonitoringPanel;
  let resultsPanel: ResultsDashboardPanel;
  let automatedPanel: AutomatedTestingPanel;

  test.beforeEach(async ({ page, uploadTestFile }) => {
    homePage = new HomePage(page);
    model3DPage = new Model3DPage(page);
    testingDashboard = new TestingDashboardPage(page);
    patternPanel = new PatternManagementPanel(page);
    parameterPanel = new ParameterTestingPanel(page);
    performancePanel = new PerformanceMonitoringPanel(page);
    resultsPanel = new ResultsDashboardPanel(page);
    automatedPanel = new AutomatedTestingPanel(page);

    // Navigate to testing dashboard
    await testingDashboard.navigateToTestingDashboard();
    await testingDashboard.waitForTestingInterface();
  });

  test('should complete pattern management workflow', async ({ 
    page, 
    uploadTestFile,
    compareScreenshots 
  }) => {
    await testingDashboard.selectPatternManagement();
    
    // Create new pattern
    await patternPanel.createNewPattern('Test Pattern 1', 'Complex geometric pattern for testing');
    
    // Upload pattern file
    const testFile = await uploadTestFile(testFiles.complexDots, 'test-pattern.csv');
    await patternPanel.uploadPatternFile(testFile);
    
    // Verify pattern appears in list
    await expect(page.getByText('Test Pattern 1')).toBeVisible();
    
    // Edit pattern
    await patternPanel.editPattern('Test Pattern 1', 'Updated description for testing');
    
    // Take screenshot for visual regression
    await compareScreenshots('pattern-management-complete');
    
    // Test bulk operations
    const testFile2 = await uploadTestFile(testFiles.simpleDots, 'simple-pattern.csv');
    await patternPanel.uploadPatternFile(testFile2);
    await patternPanel.createNewPattern('Test Pattern 2', 'Simple pattern');
    
    await patternPanel.bulkSelectPatterns(2);
    await patternPanel.bulkDeleteSelected();
    
    // Verify patterns are deleted
    await expect(page.getByText('Test Pattern 1')).not.toBeVisible();
    await expect(page.getByText('Test Pattern 2')).not.toBeVisible();
  });

  test('should execute parameter testing workflow', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Set up test pattern first
    await testingDashboard.selectPatternManagement();
    const testFile = await uploadTestFile(testFiles.complexDots, 'param-test.csv');
    await patternPanel.uploadPatternFile(testFile);
    
    // Switch to parameter testing
    await testingDashboard.selectParameterTesting();
    
    // Configure parameters
    await parameterPanel.setHeightParameter('5.0');
    await parameterPanel.setExtrusionParameter('2.5');
    await parameterPanel.setQualityParameter('high');
    await parameterPanel.enableBackgroundLayer();
    
    // Save as preset
    await parameterPanel.savePreset('High Quality Preset');
    
    // Run bulk test
    const startTime = Date.now();
    await parameterPanel.runBulkTest();
    await parameterPanel.waitForTestCompletion();
    const endTime = Date.now();
    
    // Verify test completed within reasonable time
    expect(endTime - startTime).toBeLessThan(60000); // 1 minute max
    
    // Test preset loading
    await parameterPanel.loadPreset('High Quality Preset');
    
    // Verify parameters are loaded correctly
    await expect(page.getByLabel(/height/i)).toHaveValue('5.0');
    await expect(page.getByLabel(/extrusion/i)).toHaveValue('2.5');
    await expect(page.getByLabel(/background.*layer/i)).toBeChecked();
  });

  test('should monitor performance in real-time', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Set up test pattern
    await testingDashboard.selectPatternManagement();
    const testFile = await uploadTestFile(testFiles.largeDots, 'performance-test.csv');
    await patternPanel.uploadPatternFile(testFile);
    
    // Switch to performance monitoring
    await testingDashboard.selectPerformanceMonitoring();
    
    // Configure thresholds
    await performancePanel.setRenderTimeThreshold('1000');
    await performancePanel.setMemoryUsageThreshold('100');
    
    // Start monitoring
    await performancePanel.startMonitoring();
    
    // Trigger 3D model generation to generate performance data
    await homePage.goto();
    const testPattern = await uploadTestFile(testFiles.largeDots, 'perf-model.csv');
    await homePage.uploadFile(testPattern);
    await homePage.waitForUpload();
    
    const generate3DButton = page.getByRole('button', { name: /generate.*3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      await model3DPage.waitForModel();
    }
    
    // Return to performance monitoring
    await testingDashboard.navigateToTestingDashboard();
    await testingDashboard.selectPerformanceMonitoring();
    
    // Wait for metrics to update
    await performancePanel.waitForMetricsUpdate();
    
    // Verify metrics are being collected
    const renderTime = await performancePanel.getPerformanceMetric('render-time');
    const memoryUsage = await performancePanel.getPerformanceMetric('memory-usage');
    
    expect(parseFloat(renderTime)).toBeGreaterThan(0);
    expect(parseFloat(memoryUsage)).toBeGreaterThan(0);
    
    // Stop monitoring
    await performancePanel.stopMonitoring();
  });

  test('should manage results dashboard workflow', async ({ 
    page, 
    uploadTestFile,
    waitForFileDownload 
  }) => {
    // Generate some test results first by running a quick test
    await testingDashboard.selectParameterTesting();
    const testFile = await uploadTestFile(testFiles.simpleDots, 'results-test.csv');
    
    // Switch to parameter testing panel to generate results
    await testingDashboard.selectPatternManagement();
    await patternPanel.uploadPatternFile(testFile);
    
    await testingDashboard.selectParameterTesting();
    await parameterPanel.runBulkTest();
    await parameterPanel.waitForTestCompletion();
    
    // Switch to results dashboard
    await testingDashboard.selectResultsDashboard();
    
    // Test filtering by status
    await resultsPanel.filterResultsByStatus('Completed');
    await expect(page.getByTestId('results-table')).toBeVisible();
    
    // Test date range filtering
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await resultsPanel.filterResultsByDateRange(yesterday, today);
    
    // Test export functionality
    const exportPromise = waitForFileDownload();
    await resultsPanel.exportResults('CSV');
    const download = await exportPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    
    // Test trend report generation
    await resultsPanel.generateTrendReport();
    await expect(page.getByTestId('trend-chart')).toBeVisible();
  });

  test('should configure automated testing workflow', async ({ 
    page, 
    uploadTestFile 
  }) => {
    await testingDashboard.selectAutomatedTesting();
    
    // Create test suite
    await automatedPanel.createTestSuite('Regression Suite', 'Automated regression testing suite');
    
    // Add tests to suite
    await automatedPanel.addTestToSuite('Regression Suite', 'Performance Test');
    await automatedPanel.addTestToSuite('Regression Suite', 'Quality Assessment');
    await automatedPanel.addTestToSuite('Regression Suite', 'Export Validation');
    
    // Configure CI integration
    await automatedPanel.configureCIIntegration();
    
    // Schedule test suite
    await automatedPanel.scheduleTestSuite('Regression Suite', '0 2 * * *'); // Daily at 2 AM
    
    // Run test suite immediately
    await automatedPanel.runTestSuite('Regression Suite');
    
    // Verify suite is running
    await expect(page.getByText('Running')).toBeVisible();
    
    // Wait for completion (with timeout)
    await expect(page.getByText('Completed')).toBeVisible({ timeout: 30000 });
  });

  test('should handle complete end-to-end testing workflow', async ({ 
    page, 
    uploadTestFile,
    compareScreenshots 
  }) => {
    // Complete workflow test: Pattern → Parameters → Performance → Results → Automation
    
    // 1. Pattern Management
    await testingDashboard.selectPatternManagement();
    const testFile = await uploadTestFile(testFiles.complexDots, 'e2e-test.csv');
    await patternPanel.uploadPatternFile(testFile);
    await patternPanel.createNewPattern('E2E Test Pattern', 'End-to-end workflow test');
    
    // 2. Parameter Testing
    await testingDashboard.selectParameterTesting();
    await parameterPanel.setHeightParameter('3.0');
    await parameterPanel.setExtrusionParameter('1.5');
    await parameterPanel.setQualityParameter('medium');
    await parameterPanel.savePreset('E2E Preset');
    await parameterPanel.runBulkTest();
    await parameterPanel.waitForTestCompletion();
    
    // 3. Performance Monitoring
    await testingDashboard.selectPerformanceMonitoring();
    await performancePanel.setRenderTimeThreshold('2000');
    await performancePanel.startMonitoring();
    await performancePanel.waitForMetricsUpdate();
    await performancePanel.stopMonitoring();
    
    // 4. Results Dashboard
    await testingDashboard.selectResultsDashboard();
    await resultsPanel.filterResultsByStatus('Completed');
    await resultsPanel.generateTrendReport();
    
    // 5. Automated Testing
    await testingDashboard.selectAutomatedTesting();
    await automatedPanel.createTestSuite('E2E Suite', 'Complete end-to-end test suite');
    await automatedPanel.addTestToSuite('E2E Suite', 'Full Workflow Test');
    
    // Take final screenshot for visual regression
    await compareScreenshots('complete-e2e-workflow');
    
    // Verify all components are functioning
    await expect(page.getByTestId('testing-dashboard')).toBeVisible();
    await expect(page.getByText('E2E Suite')).toBeVisible();
  });

  test('should validate visual regression across all panels', async ({ 
    page, 
    compareScreenshots,
    uploadTestFile 
  }) => {
    const testFile = await uploadTestFile(testFiles.simpleDots, 'visual-test.csv');
    
    // Test each panel's visual appearance
    await testingDashboard.selectPatternManagement();
    await patternPanel.uploadPatternFile(testFile);
    await compareScreenshots('pattern-management-panel');
    
    await testingDashboard.selectParameterTesting();
    await compareScreenshots('parameter-testing-panel');
    
    await testingDashboard.selectPerformanceMonitoring();
    await compareScreenshots('performance-monitoring-panel');
    
    await testingDashboard.selectResultsDashboard();
    await compareScreenshots('results-dashboard-panel');
    
    await testingDashboard.selectAutomatedTesting();
    await compareScreenshots('automated-testing-panel');
  });

  test('should handle error scenarios gracefully', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Test error handling in different scenarios
    
    // Invalid file upload
    await testingDashboard.selectPatternManagement();
    const invalidFile = await uploadTestFile('invalid,data,format\nbroken', 'invalid.csv');
    await patternPanel.uploadPatternFile(invalidFile);
    
    // Should show error message
    await expect(page.getByText(/error.*invalid.*format/i)).toBeVisible();
    
    // Parameter validation errors
    await testingDashboard.selectParameterTesting();
    await parameterPanel.setHeightParameter('-5.0'); // Invalid negative value
    await parameterPanel.runBulkTest();
    
    // Should show validation error
    await expect(page.getByText(/error.*invalid.*parameter/i)).toBeVisible();
    
    // Network error simulation (if possible)
    await page.route('**/api/test/**', route => route.abort());
    await parameterPanel.runBulkTest();
    
    // Should show network error
    await expect(page.getByText(/error.*network|connection/i)).toBeVisible();
  });

  test('should perform accessibility compliance validation', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Should activate focused element
    
    // Test screen reader compatibility
    const patternTab = page.getByRole('tab', { name: /pattern.*management/i });
    await expect(patternTab).toHaveAttribute('aria-selected');
    
    // Test color contrast and WCAG compliance
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    }
    
    // Test form labels
    await testingDashboard.selectParameterTesting();
    const heightInput = page.getByLabel(/height/i);
    await expect(heightInput).toHaveAttribute('aria-label');
  });
});