/**
 * Enhanced error handling for 3D model testing workflows
 * Extends base error handling with testing-specific error categories and recovery strategies
 */

import { ErrorHandler, ErrorCategory, ProcessedError, ErrorContext } from './errorHandler'

export enum TestingErrorCategory {
  PATTERN_VALIDATION = 'pattern_validation',
  PARAMETER_VALIDATION = 'parameter_validation', 
  TEST_EXECUTION = 'test_execution',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  QUALITY_ASSESSMENT = 'quality_assessment',
  BATCH_TESTING = 'batch_testing',
  RESULT_EXPORT = 'result_export',
  SESSION_MANAGEMENT = 'session_management',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  CONCURRENT_TESTING = 'concurrent_testing'
}

export interface TestingErrorContext extends ErrorContext {
  testId?: string
  testSessionId?: string
  patternId?: string
  parameterSetId?: string
  batchId?: string
  testPhase?: 'setup' | 'execution' | 'validation' | 'cleanup'
  resourceUsage?: {
    memory: number
    cpu: number
    concurrent_tests: number
  }
}

export interface TestingProcessedError extends ProcessedError {
  category: ErrorCategory | TestingErrorCategory
  context: TestingErrorContext
  testingSpecific: {
    retryable: boolean
    maxRetries: number
    retryDelay: number
    alternativeApproaches?: string[]
    resourceCleanupNeeded: boolean
    affectsOtherTests: boolean
  }
}

/**
 * Enhanced error handler for testing workflows
 */
export class TestingErrorHandler extends ErrorHandler {
  private static testingErrorQueue: TestingProcessedError[] = []
  private static activeTests = new Map<string, TestingErrorContext>()
  private static maxRetries = 3

  /**
   * Process testing-specific errors with enhanced context and recovery strategies
   */
  static processTestingError(
    error: Error | unknown,
    context: Partial<TestingErrorContext> = {}
  ): TestingProcessedError {
    const baseProcessedError = super.processError(error, context)
    const testingCategory = this.categorizeTestingError(error)
    const severity = this.determineTestingSeverity(error, testingCategory)
    
    const testingError: TestingProcessedError = {
      ...baseProcessedError,
      category: testingCategory,
      severity,
      context: {
        ...baseProcessedError.context,
        ...context
      } as TestingErrorContext,
      testingSpecific: {
        retryable: this.isRetryable(testingCategory),
        maxRetries: this.getMaxRetries(testingCategory),
        retryDelay: this.getRetryDelay(testingCategory),
        alternativeApproaches: this.getAlternativeApproaches(testingCategory),
        resourceCleanupNeeded: this.needsResourceCleanup(testingCategory),
        affectsOtherTests: this.affectsOtherTests(testingCategory)
      }
    }

    // Enhanced user message for testing scenarios
    testingError.userMessage = this.getTestingUserFriendlyMessage(error, testingCategory)
    testingError.recoveryActions = this.getTestingRecoveryActions(testingCategory)

    this.logTestingError(testingError)
    this.addToTestingQueue(testingError)

    // Trigger cleanup if needed
    if (testingError.testingSpecific.resourceCleanupNeeded) {
      this.triggerResourceCleanup(testingError.context)
    }

    return testingError
  }

  /**
   * Categorize testing-specific errors
   */
  private static categorizeTestingError(error: Error | unknown): TestingErrorCategory | ErrorCategory {
    const actualError = error instanceof Error ? error : new Error(String(error))
    const message = actualError.message.toLowerCase()
    
    // Testing-specific categorization
    if (message.includes('pattern') && (message.includes('invalid') || message.includes('malformed'))) {
      return TestingErrorCategory.PATTERN_VALIDATION
    }
    
    if (message.includes('parameter') && (message.includes('invalid') || message.includes('range'))) {
      return TestingErrorCategory.PARAMETER_VALIDATION
    }
    
    if (message.includes('test execution') || message.includes('test failed')) {
      return TestingErrorCategory.TEST_EXECUTION
    }
    
    if (message.includes('monitoring') || message.includes('metrics')) {
      return TestingErrorCategory.PERFORMANCE_MONITORING
    }
    
    if (message.includes('quality') || message.includes('assessment')) {
      return TestingErrorCategory.QUALITY_ASSESSMENT
    }
    
    if (message.includes('batch') || message.includes('bulk')) {
      return TestingErrorCategory.BATCH_TESTING
    }
    
    if (message.includes('export') || message.includes('report')) {
      return TestingErrorCategory.RESULT_EXPORT
    }
    
    if (message.includes('session') || message.includes('state')) {
      return TestingErrorCategory.SESSION_MANAGEMENT
    }
    
    if (message.includes('memory') || message.includes('resource') || message.includes('quota')) {
      return TestingErrorCategory.RESOURCE_EXHAUSTION
    }
    
    if (message.includes('concurrent') || message.includes('conflict')) {
      return TestingErrorCategory.CONCURRENT_TESTING
    }
    
    // Fall back to base categorization
    return super.categorizeError(actualError)
  }

  /**
   * Determine severity for testing-specific errors
   */
  private static determineTestingSeverity(
    error: Error | unknown, 
    category: TestingErrorCategory | ErrorCategory
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
      case TestingErrorCategory.SESSION_MANAGEMENT:
        return 'critical'
        
      case TestingErrorCategory.BATCH_TESTING:
      case TestingErrorCategory.CONCURRENT_TESTING:
      case TestingErrorCategory.TEST_EXECUTION:
        return 'high'
        
      case TestingErrorCategory.PATTERN_VALIDATION:
      case TestingErrorCategory.PARAMETER_VALIDATION:
      case TestingErrorCategory.PERFORMANCE_MONITORING:
        return 'medium'
        
      case TestingErrorCategory.QUALITY_ASSESSMENT:
      case TestingErrorCategory.RESULT_EXPORT:
        return 'low'
        
      default:
        return super.determineSeverity(error as Error, category as ErrorCategory)
    }
  }

  /**
   * Generate testing-specific user-friendly messages
   */
  private static getTestingUserFriendlyMessage(
    error: Error | unknown, 
    category: TestingErrorCategory | ErrorCategory
  ): string {
    const actualError = error instanceof Error ? error : new Error(String(error))
    const message = actualError.message.toLowerCase()
    
    switch (category) {
      case TestingErrorCategory.PATTERN_VALIDATION:
        if (message.includes('size')) return 'Pattern size is invalid. Please check dimensions and complexity'
        if (message.includes('format')) return 'Pattern format is not supported. Please use a valid pattern file'
        if (message.includes('density')) return 'Pattern density is too high. Please reduce dot count or increase spacing'
        return 'Pattern validation failed. Please check pattern file and try again'
        
      case TestingErrorCategory.PARAMETER_VALIDATION:
        if (message.includes('range')) return 'Parameter value is outside allowed range. Please check parameter limits'
        if (message.includes('combination')) return 'Invalid parameter combination. Some parameters conflict with each other'
        if (message.includes('preset')) return 'Parameter preset is corrupted or missing. Please select a different preset'
        return 'Parameter validation failed. Please check your parameter values'
        
      case TestingErrorCategory.TEST_EXECUTION:
        if (message.includes('timeout')) return 'Test execution timed out. Try reducing complexity or increasing timeout'
        if (message.includes('cancelled')) return 'Test was cancelled. You can restart the test when ready'
        if (message.includes('dependency')) return 'Test dependency failed. Please check prerequisite tests'
        return 'Test execution failed. Please check test configuration and retry'
        
      case TestingErrorCategory.PERFORMANCE_MONITORING:
        if (message.includes('metrics')) return 'Performance metrics collection failed. Test will continue with basic monitoring'
        if (message.includes('threshold')) return 'Performance thresholds exceeded. Consider optimizing test parameters'
        return 'Performance monitoring encountered issues. Test results may have limited metrics'
        
      case TestingErrorCategory.QUALITY_ASSESSMENT:
        if (message.includes('analysis')) return 'Quality analysis failed. Model may have structural issues'
        if (message.includes('mesh')) return 'Mesh quality assessment failed. Generated model may need manual inspection'
        return 'Quality assessment incomplete. Please review model manually'
        
      case TestingErrorCategory.BATCH_TESTING:
        if (message.includes('queue')) return 'Batch test queue is full. Please wait for current tests to complete'
        if (message.includes('partial')) return 'Batch test completed with some failures. Check individual test results'
        return 'Batch testing encountered errors. Some tests may not have completed'
        
      case TestingErrorCategory.RESULT_EXPORT:
        if (message.includes('format')) return 'Export format not supported. Please choose a different format'
        if (message.includes('size')) return 'Export file too large. Consider splitting results or reducing data'
        return 'Result export failed. Please try exporting in a different format'
        
      case TestingErrorCategory.SESSION_MANAGEMENT:
        if (message.includes('save')) return 'Failed to save test session. Changes may be lost'
        if (message.includes('load')) return 'Failed to load test session. Session data may be corrupted'
        return 'Session management error. Please save your work and restart the session'
        
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
        if (message.includes('memory')) return 'System memory is full. Please close other applications and reduce test complexity'
        if (message.includes('cpu')) return 'CPU usage is too high. Please reduce concurrent tests or wait for completion'
        return 'System resources exhausted. Please optimize test parameters or wait for resources to free up'
        
      case TestingErrorCategory.CONCURRENT_TESTING:
        if (message.includes('limit')) return 'Maximum concurrent tests reached. Please wait for tests to complete'
        if (message.includes('conflict')) return 'Test conflicts with another running test. Please try different parameters'
        return 'Concurrent testing limit reached. Please wait or cancel other tests'
        
      default:
        return super.getUserFriendlyMessage(actualError, category as ErrorCategory)
    }
  }

  /**
   * Get testing-specific recovery actions
   */
  private static getTestingRecoveryActions(category: TestingErrorCategory | ErrorCategory): string[] {
    switch (category) {
      case TestingErrorCategory.PATTERN_VALIDATION:
        return [
          'Verify pattern file format (JSON, CSV, or image)',
          'Check pattern dimensions and complexity',
          'Reduce dot density if pattern is too complex',
          'Try with a simpler pattern for testing'
        ]
        
      case TestingErrorCategory.PARAMETER_VALIDATION:
        return [
          'Check parameter ranges in documentation',
          'Use parameter presets for known-good configurations',
          'Validate parameter combinations',
          'Reset to default parameters and adjust gradually'
        ]
        
      case TestingErrorCategory.TEST_EXECUTION:
        return [
          'Increase test timeout in settings',
          'Reduce test complexity or pattern size',
          'Check system resources and close other applications',
          'Retry with different parameter values',
          'Run individual tests instead of batch testing'
        ]
        
      case TestingErrorCategory.PERFORMANCE_MONITORING:
        return [
          'Disable detailed performance monitoring if not needed',
          'Reduce monitoring frequency in settings',
          'Clear performance monitoring cache',
          'Restart the test session'
        ]
        
      case TestingErrorCategory.QUALITY_ASSESSMENT:
        return [
          'Skip quality assessment for this test',
          'Check if generated model is valid',
          'Reduce quality assessment depth',
          'Review model manually in 3D viewer'
        ]
        
      case TestingErrorCategory.BATCH_TESTING:
        return [
          'Reduce batch size and test in smaller groups',
          'Check individual test configurations',
          'Increase resource limits if available',
          'Wait for current batch to complete before starting new one'
        ]
        
      case TestingErrorCategory.RESULT_EXPORT:
        return [
          'Try exporting in different format (JSON, CSV, PDF)',
          'Reduce result data size by filtering',
          'Export results in smaller chunks',
          'Clear browser cache and try again'
        ]
        
      case TestingErrorCategory.SESSION_MANAGEMENT:
        return [
          'Export current results before restarting',
          'Clear session data and start fresh',
          'Check browser storage permissions',
          'Use different browser or incognito mode'
        ]
        
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
        return [
          'Close other browser tabs and applications',
          'Reduce concurrent test count',
          'Clear browser cache and temporary files',
          'Restart browser to free memory',
          'Use smaller patterns or simpler parameters'
        ]
        
      case TestingErrorCategory.CONCURRENT_TESTING:
        return [
          'Wait for current tests to complete',
          'Cancel non-essential tests',
          'Reduce maximum concurrent test limit',
          'Schedule tests to run sequentially'
        ]
        
      default:
        return super.getRecoveryActions(category as ErrorCategory)
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryable(category: TestingErrorCategory | ErrorCategory): boolean {
    const nonRetryableCategories = [
      TestingErrorCategory.PATTERN_VALIDATION,
      TestingErrorCategory.PARAMETER_VALIDATION,
      ErrorCategory.VALIDATION
    ]
    
    return !nonRetryableCategories.includes(category as any)
  }

  /**
   * Get maximum retry attempts for category
   */
  private static getMaxRetries(category: TestingErrorCategory | ErrorCategory): number {
    switch (category) {
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
      case TestingErrorCategory.CONCURRENT_TESTING:
        return 5
        
      case TestingErrorCategory.PERFORMANCE_MONITORING:
      case TestingErrorCategory.QUALITY_ASSESSMENT:
        return 2
        
      case TestingErrorCategory.TEST_EXECUTION:
      case TestingErrorCategory.BATCH_TESTING:
        return 3
        
      default:
        return this.maxRetries
    }
  }

  /**
   * Get retry delay in milliseconds
   */
  private static getRetryDelay(category: TestingErrorCategory | ErrorCategory): number {
    switch (category) {
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
        return 10000 // 10 seconds
        
      case TestingErrorCategory.CONCURRENT_TESTING:
        return 5000 // 5 seconds
        
      case TestingErrorCategory.PERFORMANCE_MONITORING:
        return 2000 // 2 seconds
        
      default:
        return 1000 // 1 second
    }
  }

  /**
   * Get alternative approaches for different error categories
   */
  private static getAlternativeApproaches(category: TestingErrorCategory | ErrorCategory): string[] {
    switch (category) {
      case TestingErrorCategory.BATCH_TESTING:
        return ['Run tests individually', 'Use smaller batch sizes', 'Schedule tests sequentially']
        
      case TestingErrorCategory.PERFORMANCE_MONITORING:
        return ['Use basic monitoring', 'Sample metrics less frequently', 'Skip detailed performance analysis']
        
      case TestingErrorCategory.QUALITY_ASSESSMENT:
        return ['Skip quality assessment', 'Use basic quality checks', 'Manual model inspection']
        
      case TestingErrorCategory.RESOURCE_EXHAUSTION:
        return ['Reduce test complexity', 'Use simpler patterns', 'Test with fewer parameters']
        
      default:
        return []
    }
  }

  /**
   * Check if error needs resource cleanup
   */
  private static needsResourceCleanup(category: TestingErrorCategory | ErrorCategory): boolean {
    return [
      TestingErrorCategory.RESOURCE_EXHAUSTION,
      TestingErrorCategory.BATCH_TESTING,
      TestingErrorCategory.CONCURRENT_TESTING,
      TestingErrorCategory.SESSION_MANAGEMENT
    ].includes(category as any)
  }

  /**
   * Check if error affects other running tests
   */
  private static affectsOtherTests(category: TestingErrorCategory | ErrorCategory): boolean {
    return [
      TestingErrorCategory.RESOURCE_EXHAUSTION,
      TestingErrorCategory.SESSION_MANAGEMENT,
      ErrorCategory.RENDERING
    ].includes(category as any)
  }

  /**
   * Trigger resource cleanup after error
   */
  private static triggerResourceCleanup(context: TestingErrorContext): void {
    try {
      // Clear test-specific resources
      if (context.testId) {
        this.cleanupTestResources(context.testId)
      }
      
      // Clear session resources if session management error
      if (context.testSessionId) {
        this.cleanupSessionResources(context.testSessionId)
      }
      
      // Clear batch resources if batch error
      if (context.batchId) {
        this.cleanupBatchResources(context.batchId)
      }
      
      console.info('Resource cleanup triggered for context:', context)
    } catch (cleanupError) {
      console.warn('Resource cleanup failed:', cleanupError)
    }
  }

  /**
   * Clean up test-specific resources
   */
  private static cleanupTestResources(testId: string): void {
    // Remove from active tests
    this.activeTests.delete(testId)
    
    // Trigger garbage collection hint
    if (window.gc) {
      window.gc()
    }
    
    console.info(`Cleaned up resources for test: ${testId}`)
  }

  /**
   * Clean up session-specific resources
   */
  private static cleanupSessionResources(sessionId: string): void {
    // Clear session-related active tests
    for (const [testId, context] of this.activeTests) {
      if (context.testSessionId === sessionId) {
        this.activeTests.delete(testId)
      }
    }
    
    console.info(`Cleaned up session resources: ${sessionId}`)
  }

  /**
   * Clean up batch-specific resources
   */
  private static cleanupBatchResources(batchId: string): void {
    // Clear batch-related active tests
    for (const [testId, context] of this.activeTests) {
      if (context.batchId === batchId) {
        this.activeTests.delete(testId)
      }
    }
    
    console.info(`Cleaned up batch resources: ${batchId}`)
  }

  /**
   * Register an active test for resource tracking
   */
  static registerActiveTest(testId: string, context: TestingErrorContext): void {
    this.activeTests.set(testId, context)
  }

  /**
   * Unregister a completed test
   */
  static unregisterActiveTest(testId: string): void {
    this.activeTests.delete(testId)
  }

  /**
   * Get active test count
   */
  static getActiveTestCount(): number {
    return this.activeTests.size
  }

  /**
   * Get active tests by session
   */
  static getActiveTestsBySession(sessionId: string): string[] {
    const testIds: string[] = []
    for (const [testId, context] of this.activeTests) {
      if (context.testSessionId === sessionId) {
        testIds.push(testId)
      }
    }
    return testIds
  }

  /**
   * Enhanced error logging with testing context
   */
  private static logTestingError(processedError: TestingProcessedError): void {
    const logLevel = this.getLogLevel(processedError.severity)
    
    console[logLevel](`[TESTING-${processedError.category.toUpperCase()}] ${processedError.message}`, {
      id: processedError.id,
      severity: processedError.severity,
      context: processedError.context,
      testingSpecific: processedError.testingSpecific,
      stack: processedError.originalError.stack
    })

    // Send to testing-specific error tracking if available
    if (import.meta.env.PROD) {
      this.sendToTestingErrorService(processedError)
    }
  }

  /**
   * Send testing error to specialized tracking service
   */
  private static sendToTestingErrorService(error: TestingProcessedError): void {
    try {
      // Specialized tracking for testing errors
      console.info('Testing error sent to tracking service:', {
        id: error.id,
        category: error.category,
        testId: error.context.testId,
        sessionId: error.context.testSessionId,
        phase: error.context.testPhase
      })
    } catch (e) {
      console.warn('Failed to send testing error to tracking service:', e)
    }
  }

  /**
   * Add testing error to specialized queue
   */
  private static addToTestingQueue(error: TestingProcessedError): void {
    this.testingErrorQueue.push(error)
    
    // Also add to base queue for general error tracking
    super.addToQueue(error)
    
    if (this.testingErrorQueue.length > 50) {
      this.testingErrorQueue.shift()
    }
  }

  /**
   * Get recent testing errors
   */
  static getRecentTestingErrors(limit = 10): TestingProcessedError[] {
    return this.testingErrorQueue.slice(-limit)
  }

  /**
   * Get testing errors by category
   */
  static getTestingErrorsByCategory(category: TestingErrorCategory): TestingProcessedError[] {
    return this.testingErrorQueue.filter(error => error.category === category)
  }

  /**
   * Get testing errors by session
   */
  static getTestingErrorsBySession(sessionId: string): TestingProcessedError[] {
    return this.testingErrorQueue.filter(error => error.context.testSessionId === sessionId)
  }

  /**
   * Clear testing error queue
   */
  static clearTestingErrorQueue(): void {
    this.testingErrorQueue = []
  }

  /**
   * Get comprehensive testing error statistics
   */
  static getTestingErrorStats(): Record<string, any> {
    const baseStats = super.getErrorStats()
    
    const testingStats = {
      ...baseStats,
      testing: {
        total: this.testingErrorQueue.length,
        activeTests: this.activeTests.size,
        byTestingCategory: {} as Record<TestingErrorCategory, number>,
        retryableErrors: this.testingErrorQueue.filter(e => e.testingSpecific.retryable).length,
        criticalErrors: this.testingErrorQueue.filter(e => e.severity === 'critical').length,
        recentTesting: this.testingErrorQueue.slice(-3).map(e => ({
          id: e.id,
          category: e.category,
          testId: e.context.testId,
          sessionId: e.context.testSessionId,
          retryable: e.testingSpecific.retryable,
          timestamp: e.context.timestamp
        }))
      }
    }

    this.testingErrorQueue.forEach(error => {
      if (Object.values(TestingErrorCategory).includes(error.category as TestingErrorCategory)) {
        const category = error.category as TestingErrorCategory
        testingStats.testing.byTestingCategory[category] = (testingStats.testing.byTestingCategory[category] || 0) + 1
      }
    })

    return testingStats
  }
}

/**
 * Utility function for handling testing operations with enhanced error processing
 */
export async function withTestingErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<TestingErrorContext> = {}
): Promise<{ data?: T; error?: TestingProcessedError }> {
  try {
    const data = await operation()
    return { data }
  } catch (error) {
    const processedError = TestingErrorHandler.processTestingError(error, context)
    return { error: processedError }
  }
}

/**
 * Utility function for handling sync testing operations
 */
export function withSyncTestingErrorHandling<T>(
  operation: () => T,
  context: Partial<TestingErrorContext> = {}
): { data?: T; error?: TestingProcessedError } {
  try {
    const data = operation()
    return { data }
  } catch (error) {
    const processedError = TestingErrorHandler.processTestingError(error, context)
    return { error: processedError }
  }
}

/**
 * React hook for testing error handling
 */
export function useTestingErrorHandler(componentName: string, testContext: Partial<TestingErrorContext> = {}) {
  const handleTestingError = (
    error: Error | unknown, 
    action?: string, 
    metadata?: Record<string, any>
  ) => {
    return TestingErrorHandler.processTestingError(error, {
      component: componentName,
      action,
      metadata,
      ...testContext
    })
  }

  return { 
    handleTestingError, 
    getRecentTestingErrors: TestingErrorHandler.getRecentTestingErrors,
    getTestingErrorStats: TestingErrorHandler.getTestingErrorStats,
    registerActiveTest: TestingErrorHandler.registerActiveTest,
    unregisterActiveTest: TestingErrorHandler.unregisterActiveTest
  }
}

export default TestingErrorHandler