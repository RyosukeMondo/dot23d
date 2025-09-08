/**
 * Comprehensive testing utilities for 3D model generation testing workflows
 * Provides helper functions for performance calculation, data transformation,
 * validation utilities and data export functions
 */

import { 
  TestSession, 
  TestResult, 
  PerformanceMetrics, 
  PerformanceSnapshot,
  MeshStats, 
  QualityReport,
  ParameterPreset,
  TestSuite,
  TestSuiteResult,
  BulkTestConfig,
  SweepConfig,
  SweepResult,
  ComparisonResult,
  CIReport,
  Measurement
} from '@/types'
import { DotPattern, Model3DParams, ValidationResult } from '@/types'

// ================================================================
// PERFORMANCE CALCULATION UTILITIES
// ================================================================

/**
 * Calculate performance score based on multiple metrics
 */
export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const weights = {
    memory: 0.3,
    cpu: 0.3,
    timing: 0.4
  }
  
  // Normalize memory score (lower is better, 0-100 scale)
  const memoryScore = Math.max(0, 100 - (metrics.memoryUsage.used / metrics.memoryUsage.available * 100))
  
  // Normalize CPU score (lower is better, 0-100 scale)
  const totalCpu = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering
  const cpuScore = Math.max(0, 100 - totalCpu)
  
  // Normalize timing score (faster is better)
  const totalTime = Object.values(metrics.timings).reduce((sum, time) => sum + time, 0)
  const timingScore = Math.max(0, 100 - Math.min(100, totalTime / 10000 * 100)) // 10s = 0 score
  
  return Math.round(
    memoryScore * weights.memory +
    cpuScore * weights.cpu +
    timingScore * weights.timing
  )
}

/**
 * Calculate processing speed in operations per second
 */
export function calculateProcessingSpeed(
  vertices: number, 
  processingTime: number
): number {
  return vertices / (processingTime / 1000) // vertices per second
}

/**
 * Calculate efficiency ratio based on input complexity vs processing time
 */
export function calculateEfficiencyRatio(
  pattern: DotPattern, 
  processingTime: number
): number {
  const complexity = pattern.width * pattern.height
  const dotCount = pattern.data.flat().filter(dot => dot).length
  const adjustedComplexity = complexity * (dotCount / complexity) // Density adjustment
  
  // Higher complexity with lower time = higher efficiency
  return adjustedComplexity / processingTime
}

/**
 * Compare performance metrics between two test results
 */
export function comparePerformanceMetrics(
  baseline: TestResult,
  current: TestResult
): {
  processingTimeChange: number
  memoryUsageChange: number
  qualityScoreChange: number
  overallImprovement: boolean
} {
  const processingTimeChange = (current.processingTime - baseline.processingTime) / baseline.processingTime * 100
  const memoryUsageChange = (current.performanceMetrics.memoryUsed - baseline.performanceMetrics.memoryUsed) / baseline.performanceMetrics.memoryUsed * 100
  const qualityScoreChange = (current.qualityScore - baseline.qualityScore) / baseline.qualityScore * 100
  
  // Overall improvement if processing time and memory decreased OR quality increased significantly
  const overallImprovement = 
    (processingTimeChange < -10 && memoryUsageChange < 10) || 
    qualityScoreChange > 15
  
  return {
    processingTimeChange,
    memoryUsageChange,
    qualityScoreChange,
    overallImprovement
  }
}

/**
 * Calculate trend analysis for performance metrics over time
 */
export function calculatePerformanceTrends(results: TestResult[]): {
  processingTimeTrend: 'improving' | 'degrading' | 'stable'
  memoryUsageTrend: 'improving' | 'degrading' | 'stable'
  qualityTrend: 'improving' | 'degrading' | 'stable'
  trendSlopes: {
    processingTime: number
    memoryUsage: number
    quality: number
  }
} {
  if (results.length < 3) {
    return {
      processingTimeTrend: 'stable',
      memoryUsageTrend: 'stable',
      qualityTrend: 'stable',
      trendSlopes: { processingTime: 0, memoryUsage: 0, quality: 0 }
    }
  }

  const sortedResults = [...results].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  
  // Calculate linear regression slopes
  const processingTimeSlope = calculateLinearRegressionSlope(
    sortedResults.map((r, i) => ({ x: i, y: r.processingTime }))
  )
  const memoryUsageSlope = calculateLinearRegressionSlope(
    sortedResults.map((r, i) => ({ x: i, y: r.performanceMetrics.memoryUsed }))
  )
  const qualitySlope = calculateLinearRegressionSlope(
    sortedResults.map((r, i) => ({ x: i, y: r.qualityScore }))
  )

  const classifyTrend = (slope: number) => {
    if (Math.abs(slope) < 0.1) return 'stable'
    return slope > 0 ? 'degrading' : 'improving' // For processing time and memory, negative is good
  }

  return {
    processingTimeTrend: classifyTrend(processingTimeSlope),
    memoryUsageTrend: classifyTrend(memoryUsageSlope),
    qualityTrend: qualitySlope > 0.1 ? 'improving' : qualitySlope < -0.1 ? 'degrading' : 'stable',
    trendSlopes: {
      processingTime: processingTimeSlope,
      memoryUsage: memoryUsageSlope,
      quality: qualitySlope
    }
  }
}

/**
 * Calculate linear regression slope for trend analysis
 */
function calculateLinearRegressionSlope(points: Array<{x: number, y: number}>): number {
  const n = points.length
  const sumX = points.reduce((sum, p) => sum + p.x, 0)
  const sumY = points.reduce((sum, p) => sum + p.y, 0)
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
}

// ================================================================
// DATA TRANSFORMATION UTILITIES
// ================================================================

/**
 * Transform test results into chart-ready data format
 */
export function transformResultsForCharting(
  results: TestResult[],
  metric: 'processingTime' | 'memoryUsage' | 'qualityScore'
): Array<{ x: string, y: number, label: string }> {
  return results.map((result, index) => ({
    x: result.timestamp.toISOString(),
    y: metric === 'processingTime' 
      ? result.processingTime 
      : metric === 'memoryUsage' 
        ? result.performanceMetrics.memoryUsed
        : result.qualityScore,
    label: `Test ${index + 1}: ${result.pattern.metadata?.filename || 'Unknown Pattern'}`
  }))
}

/**
 * Aggregate test results by time periods
 */
export function aggregateResultsByTimePeriod(
  results: TestResult[],
  period: 'hour' | 'day' | 'week' | 'month'
): Array<{
  period: string
  count: number
  averageProcessingTime: number
  averageQualityScore: number
  successRate: number
}> {
  const getPeriodKey = (date: Date): string => {
    switch (period) {
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`
      case 'day':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`
      case 'month':
        return `${date.getFullYear()}-${date.getMonth() + 1}`
      default:
        return date.toISOString().split('T')[0]
    }
  }

  const groups = new Map<string, TestResult[]>()
  
  results.forEach(result => {
    const key = getPeriodKey(result.timestamp)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(result)
  })

  return Array.from(groups.entries()).map(([period, periodResults]) => ({
    period,
    count: periodResults.length,
    averageProcessingTime: periodResults.reduce((sum, r) => sum + r.processingTime, 0) / periodResults.length,
    averageQualityScore: periodResults.reduce((sum, r) => sum + r.qualityScore, 0) / periodResults.length,
    successRate: periodResults.filter(r => r.success).length / periodResults.length * 100
  }))
}

/**
 * Transform performance metrics for real-time display
 */
export function transformMetricsForRealTimeDisplay(metrics: PerformanceMetrics): {
  memoryUsage: { used: string, available: string, percentage: number }
  cpuBreakdown: Array<{ name: string, value: number, color: string }>
  timingBreakdown: Array<{ phase: string, duration: number, percentage: number }>
} {
  const formatMemory = (mb: number) => mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
  
  const totalCpu = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering
  const totalTiming = Object.values(metrics.timings).reduce((sum, time) => sum + time, 0)

  return {
    memoryUsage: {
      used: formatMemory(metrics.memoryUsage.used),
      available: formatMemory(metrics.memoryUsage.available),
      percentage: (metrics.memoryUsage.used / metrics.memoryUsage.available) * 100
    },
    cpuBreakdown: [
      { name: 'Generation', value: metrics.cpuUsage.generation, color: '#3b82f6' },
      { name: 'Optimization', value: metrics.cpuUsage.optimization, color: '#ef4444' },
      { name: 'Rendering', value: metrics.cpuUsage.rendering, color: '#10b981' }
    ],
    timingBreakdown: Object.entries(metrics.timings).map(([phase, duration]) => ({
      phase: phase.charAt(0).toUpperCase() + phase.slice(1),
      duration,
      percentage: (duration / totalTiming) * 100
    }))
  }
}

// ================================================================
// VALIDATION UTILITIES
// ================================================================

/**
 * Validate test session configuration
 */
export function validateTestSession(session: Partial<TestSession>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!session.name || session.name.trim().length === 0) {
    errors.push('Test session name is required')
  }

  if (!session.patterns || session.patterns.length === 0) {
    errors.push('At least one test pattern is required')
  } else {
    session.patterns.forEach((pattern, index) => {
      if (!pattern.data || pattern.data.length === 0) {
        errors.push(`Pattern ${index + 1} has no data`)
      }
      if (pattern.width <= 0 || pattern.height <= 0) {
        errors.push(`Pattern ${index + 1} has invalid dimensions`)
      }
    })
  }

  if (!session.parameterSets || session.parameterSets.length === 0) {
    errors.push('At least one parameter set is required')
  }

  if (session.patterns && session.parameterSets && 
      session.patterns.length * session.parameterSets.length > 100) {
    warnings.push('Large number of test combinations may take significant time to complete')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate parameter preset compatibility
 */
export function validateParameterPresetCompatibility(
  preset: ParameterPreset, 
  pattern: DotPattern
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check pattern size compatibility
  if (preset.compatiblePatterns.length > 0) {
    const isCompatible = preset.compatiblePatterns.some(filter => {
      const sizeOk = (!filter.minSize || (pattern.width >= filter.minSize.width && pattern.height >= filter.minSize.height)) &&
                     (!filter.maxSize || (pattern.width <= filter.maxSize.width && pattern.height <= filter.maxSize.height))
      
      const densityOk = !filter.densityRange || (() => {
        const density = pattern.data.flat().filter(dot => dot).length / (pattern.width * pattern.height)
        return density >= filter.densityRange.min && density <= filter.densityRange.max
      })()
      
      return sizeOk && densityOk
    })

    if (!isCompatible) {
      errors.push(`Pattern is not compatible with preset "${preset.name}"`)
    }
  }

  // Check for potentially problematic parameter combinations
  const params = preset.parameters
  if (params.height && params.depth && params.height < 1 && params.depth > 10) {
    warnings.push('Very thin, deep models may have structural issues')
  }

  if (params.resolution && params.resolution > 0.1 && pattern.width * pattern.height > 10000) {
    warnings.push('High resolution with large patterns may cause memory issues')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate bulk test configuration
 */
export function validateBulkTestConfig(config: BulkTestConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (config.patterns.length === 0) {
    errors.push('At least one pattern is required for bulk testing')
  }

  if (config.parameterSets.length === 0) {
    errors.push('At least one parameter set is required for bulk testing')
  }

  const totalCombinations = config.testAllCombinations 
    ? config.patterns.length * config.parameterSets.length
    : Math.max(config.patterns.length, config.parameterSets.length)

  if (totalCombinations > 1000) {
    errors.push('Too many test combinations (max: 1000)')
  } else if (totalCombinations > 100) {
    warnings.push('Large number of combinations may take significant time')
  }

  if (config.maxConcurrency > 10) {
    warnings.push('High concurrency may cause resource exhaustion')
  }

  if (config.testTimeout < 30000) {
    warnings.push('Short timeout may cause tests to fail prematurely')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ================================================================
// DATA EXPORT UTILITIES
// ================================================================

/**
 * Export test results to CSV format
 */
export function exportResultsToCSV(results: TestResult[]): string {
  const headers = [
    'Test ID',
    'Session ID',
    'Timestamp',
    'Pattern Name',
    'Success',
    'Processing Time (ms)',
    'Vertex Count',
    'Face Count',
    'Surface Area',
    'Volume',
    'Quality Score',
    'Memory Used (MB)',
    'CPU Usage (%)',
    'Warnings',
    'Error'
  ]

  const rows = results.map(result => [
    result.id,
    result.testSessionId,
    result.timestamp.toISOString(),
    result.pattern.metadata?.filename || 'Unknown',
    result.success ? 'Yes' : 'No',
    result.processingTime.toString(),
    result.meshStats.vertexCount.toString(),
    result.meshStats.faceCount.toString(),
    result.meshStats.surfaceArea.toFixed(2),
    result.meshStats.volume.toFixed(2),
    result.qualityScore.toString(),
    result.performanceMetrics.memoryUsed.toFixed(1),
    result.performanceMetrics.cpuUsage.toString(),
    result.warnings.join('; '),
    result.error || ''
  ])

  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
  ).join('\n')
}

/**
 * Export test results to JSON format with enhanced metadata
 */
export function exportResultsToJSON(
  results: TestResult[],
  includeMetadata = true
): string {
  const exportData = {
    ...(includeMetadata && {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        totalResults: results.length,
        timeRange: results.length > 0 ? {
          start: Math.min(...results.map(r => r.timestamp.getTime())),
          end: Math.max(...results.map(r => r.timestamp.getTime()))
        } : null
      }
    }),
    results: results.map(result => ({
      ...result,
      timestamp: result.timestamp.toISOString(),
      pattern: {
        ...result.pattern,
        metadata: result.pattern.metadata ? {
          ...result.pattern.metadata,
          createdAt: result.pattern.metadata.createdAt?.toISOString(),
          modifiedAt: result.pattern.metadata.modifiedAt?.toISOString()
        } : undefined
      }
    }))
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Generate comprehensive test report in HTML format
 */
export function generateHTMLReport(
  session: TestSession,
  results: TestResult[]
): string {
  const successRate = results.filter(r => r.success).length / results.length * 100
  const averageProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
  const averageQualityScore = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length

  const trends = calculatePerformanceTrends(results)
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${session.name}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; margin-top: 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .trend-improving { color: #28a745; }
        .trend-degrading { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>3D Model Generation Test Report</h1>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${session.name}</div>
                <div class="metric-label">Test Session</div>
            </div>
            <div class="metric">
                <div class="metric-value">${results.length}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value ${successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}">${successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${averageProcessingTime.toFixed(0)}ms</div>
                <div class="metric-label">Avg Processing Time</div>
            </div>
            <div class="metric">
                <div class="metric-value">${averageQualityScore.toFixed(1)}</div>
                <div class="metric-label">Avg Quality Score</div>
            </div>
        </div>

        <h2>Performance Trends</h2>
        <div class="summary">
            <div class="metric">
                <div class="metric-value trend-${trends.processingTimeTrend}">${trends.processingTimeTrend.toUpperCase()}</div>
                <div class="metric-label">Processing Time Trend</div>
            </div>
            <div class="metric">
                <div class="metric-value trend-${trends.memoryUsageTrend}">${trends.memoryUsageTrend.toUpperCase()}</div>
                <div class="metric-label">Memory Usage Trend</div>
            </div>
            <div class="metric">
                <div class="metric-value trend-${trends.qualityTrend}">${trends.qualityTrend.toUpperCase()}</div>
                <div class="metric-label">Quality Trend</div>
            </div>
        </div>

        <h2>Test Results Detail</h2>
        <table>
            <thead>
                <tr>
                    <th>Test ID</th>
                    <th>Pattern</th>
                    <th>Status</th>
                    <th>Processing Time</th>
                    <th>Quality Score</th>
                    <th>Memory Used</th>
                    <th>Warnings</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td>${result.id}</td>
                        <td>${result.pattern.metadata?.filename || 'Unknown'}</td>
                        <td class="${result.success ? 'success' : 'error'}">${result.success ? 'Success' : 'Failed'}</td>
                        <td>${result.processingTime}ms</td>
                        <td>${result.qualityScore.toFixed(1)}</td>
                        <td>${result.performanceMetrics.memoryUsed.toFixed(1)} MB</td>
                        <td>${result.warnings.length > 0 ? result.warnings.join(', ') : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>Session: ${session.id} | Author: ${session.author} | Created: ${session.createdAt.toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`
}

/**
 * Generate CI/CD report for automated testing integration
 */
export function generateCIReport(
  suiteResult: TestSuiteResult,
  buildInfo: { id: string, commit: string, branch: string }
): CIReport {
  const failures = suiteResult.testResults
    .filter(result => !result.success)
    .map(result => ({
      testId: result.id,
      testName: result.pattern.metadata?.filename || `Test ${result.id}`,
      error: result.error || 'Unknown error',
      details: `Processing time: ${result.processingTime}ms, Quality: ${result.qualityScore}, Warnings: ${result.warnings.join(', ')}`
    }))

  return {
    build: {
      ...buildInfo,
      timestamp: new Date()
    },
    summary: {
      totalTests: suiteResult.statistics.totalTests,
      passed: suiteResult.statistics.passed,
      failed: suiteResult.statistics.failed,
      duration: suiteResult.statistics.totalTime
    },
    failures,
    regressions: [], // Would need historical data to calculate
    status: suiteResult.success ? 'passed' : 'failed'
  }
}

// ================================================================
// UTILITY HELPER FUNCTIONS
// ================================================================

/**
 * Generate unique test ID
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  } else if (milliseconds < 3600000) {
    return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`
  } else {
    const hours = Math.floor(milliseconds / 3600000)
    const minutes = Math.floor((milliseconds % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }
}

/**
 * Format memory usage in human readable format
 */
export function formatMemoryUsage(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Calculate pattern complexity score
 */
export function calculatePatternComplexity(pattern: DotPattern): number {
  const totalCells = pattern.width * pattern.height
  const filledCells = pattern.data.flat().filter(dot => dot).length
  const density = filledCells / totalCells
  
  // Calculate edge complexity (how many transitions between filled/empty)
  let edgeCount = 0
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const current = pattern.data[y][x]
      // Check right neighbor
      if (x < pattern.width - 1 && current !== pattern.data[y][x + 1]) {
        edgeCount++
      }
      // Check bottom neighbor
      if (y < pattern.height - 1 && current !== pattern.data[y + 1][x]) {
        edgeCount++
      }
    }
  }
  
  const edgeComplexity = edgeCount / (totalCells * 2) // Normalized by max possible edges
  
  // Combine density and edge complexity for final score (0-100)
  return Math.round((density * 0.4 + edgeComplexity * 0.6) * 100)
}

/**
 * Deep clone object for safe data manipulation
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  
  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * Debounce function for performance-critical operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function for rate-limiting operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export default {
  // Performance utilities
  calculatePerformanceScore,
  calculateProcessingSpeed,
  calculateEfficiencyRatio,
  comparePerformanceMetrics,
  calculatePerformanceTrends,
  
  // Data transformation utilities
  transformResultsForCharting,
  aggregateResultsByTimePeriod,
  transformMetricsForRealTimeDisplay,
  
  // Validation utilities
  validateTestSession,
  validateParameterPresetCompatibility,
  validateBulkTestConfig,
  
  // Export utilities
  exportResultsToCSV,
  exportResultsToJSON,
  generateHTMLReport,
  generateCIReport,
  
  // Helper utilities
  generateTestId,
  generateSessionId,
  formatDuration,
  formatMemoryUsage,
  calculatePatternComplexity,
  deepClone,
  debounce,
  throttle
}