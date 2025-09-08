import type { PerformanceMetrics, PerformanceSnapshot } from '@/types'

/**
 * Custom error for performance monitoring operations
 */
export class PerformanceMonitoringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PerformanceMonitoringError'
  }
}

/**
 * Real-time performance monitoring session
 */
export interface MonitoringSession {
  id: string
  testId: string
  startTime: number
  isActive: boolean
  measurements: PerformanceMetrics[]
}

/**
 * Performance thresholds for alerting
 */
export interface PerformanceThresholds {
  maxMemoryUsageMB: number
  maxCpuUsagePercent: number
  maxProcessingTimeMs: number
  minQualityScore: number
}

/**
 * Service for real-time performance monitoring during 3D generation
 */
export class PerformanceService {
  private static activeSessions = new Map<string, MonitoringSession>()
  private static intervalHandles = new Map<string, number>()
  private static readonly DEFAULT_SAMPLING_INTERVAL = 500 // 500ms
  private static memoryBaseline = 0

  /**
   * Start performance monitoring for a test
   */
  static startMonitoring(
    testId: string,
    options: {
      samplingInterval?: number
      thresholds?: Partial<PerformanceThresholds>
    } = {}
  ): string {
    const sessionId = this.generateSessionId()
    const samplingInterval = options.samplingInterval || this.DEFAULT_SAMPLING_INTERVAL

    // Initialize memory baseline if not set
    if (this.memoryBaseline === 0) {
      this.captureMemoryBaseline()
    }

    const session: MonitoringSession = {
      id: sessionId,
      testId,
      startTime: performance.now(),
      isActive: true,
      measurements: []
    }

    this.activeSessions.set(sessionId, session)

    // Start periodic sampling
    const intervalHandle = window.setInterval(() => {
      if (session.isActive) {
        const metrics = this.captureMetrics(testId, session.startTime)
        session.measurements.push(metrics)

        // Check thresholds if provided
        if (options.thresholds) {
          this.checkThresholds(metrics, options.thresholds)
        }
      }
    }, samplingInterval)

    this.intervalHandles.set(sessionId, intervalHandle)

    return sessionId
  }

  /**
   * Stop performance monitoring and generate report
   */
  static stopMonitoring(sessionId: string): {
    session: MonitoringSession
    report: PerformanceReport
    recommendations: string[]
  } {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new PerformanceMonitoringError('Monitoring session not found')
    }

    session.isActive = false

    // Clean up interval
    const intervalHandle = this.intervalHandles.get(sessionId)
    if (intervalHandle) {
      clearInterval(intervalHandle)
      this.intervalHandles.delete(sessionId)
    }

    // Generate final metrics
    const finalMetrics = this.captureMetrics(session.testId, session.startTime)
    session.measurements.push(finalMetrics)

    // Generate report
    const report = this.generateReport(session.measurements)
    const recommendations = this.generateRecommendations(report)

    // Clean up session
    this.activeSessions.delete(sessionId)

    return { session, report, recommendations }
  }

  /**
   * Get current real-time metrics for an active session
   */
  static getCurrentMetrics(sessionId: string): PerformanceMetrics | null {
    const session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive) {
      return null
    }

    return this.captureMetrics(session.testId, session.startTime)
  }

  /**
   * Get real-time snapshot for immediate use
   */
  static getRealtimeSnapshot(): PerformanceSnapshot {
    const memoryInfo = this.getMemoryInfo()
    const cpuUsage = this.estimateCpuUsage()

    return {
      memoryUsed: memoryInfo.used,
      cpuUsage,
      generationSpeed: 0, // Will be calculated by caller
      elapsedTime: 0 // Will be set by caller
    }
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  static checkPerformanceHealth(metrics: PerformanceMetrics): {
    isHealthy: boolean
    issues: string[]
    severity: 'low' | 'medium' | 'high'
  } {
    const issues: string[] = []
    let maxSeverity: 'low' | 'medium' | 'high' = 'low'

    // Memory checks
    if (metrics.memoryUsage.used > 1000) {
      issues.push('High memory usage detected (>1GB)')
      maxSeverity = 'high'
    } else if (metrics.memoryUsage.used > 500) {
      issues.push('Moderate memory usage detected (>500MB)')
      if (maxSeverity === 'low') maxSeverity = 'medium'
    }

    // CPU checks
    const totalCpu = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering
    if (totalCpu > 90) {
      issues.push('Very high CPU usage detected (>90%)')
      maxSeverity = 'high'
    } else if (totalCpu > 70) {
      issues.push('High CPU usage detected (>70%)')
      if (maxSeverity === 'low') maxSeverity = 'medium'
    }

    // Timing checks
    const totalTime = Object.values(metrics.timings).reduce((sum, time) => sum + time, 0)
    if (totalTime > 30000) {
      issues.push('Processing taking very long (>30s)')
      maxSeverity = 'high'
    } else if (totalTime > 10000) {
      issues.push('Processing taking longer than expected (>10s)')
      if (maxSeverity === 'low') maxSeverity = 'medium'
    }

    // Quality checks
    if (metrics.qualityMetrics.printability < 50) {
      issues.push('Low printability score detected')
      if (maxSeverity === 'low') maxSeverity = 'medium'
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      severity: maxSeverity
    }
  }

  /**
   * Compare performance between different tests
   */
  static comparePerformance(
    baseline: PerformanceMetrics[],
    current: PerformanceMetrics[]
  ): PerformanceComparison {
    const baselineAvg = this.calculateAverageMetrics(baseline)
    const currentAvg = this.calculateAverageMetrics(current)

    return {
      memoryDelta: ((currentAvg.memoryUsage.used - baselineAvg.memoryUsage.used) / baselineAvg.memoryUsage.used) * 100,
      cpuDelta: this.calculateCpuDelta(baselineAvg, currentAvg),
      timeDelta: this.calculateTimeDelta(baselineAvg, currentAvg),
      qualityDelta: ((currentAvg.qualityMetrics.meshComplexity - baselineAvg.qualityMetrics.meshComplexity) / baselineAvg.qualityMetrics.meshComplexity) * 100,
      overall: this.calculateOverallPerformanceScore(currentAvg) - this.calculateOverallPerformanceScore(baselineAvg)
    }
  }

  /**
   * Export performance data for analysis
   */
  static exportPerformanceData(
    measurements: PerformanceMetrics[],
    format: 'json' | 'csv'
  ): { data: string; filename: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    if (format === 'json') {
      return {
        data: JSON.stringify(measurements, null, 2),
        filename: `performance-data-${timestamp}.json`
      }
    } else {
      // CSV format
      const headers = [
        'timestamp', 'testId', 'memoryUsed', 'memoryPeak', 'cpuGeneration',
        'cpuOptimization', 'cpuRendering', 'validationTime', 'generationTime',
        'optimizationTime', 'renderingTime', 'exportTime', 'meshComplexity',
        'optimizationRatio', 'printability'
      ]

      const rows = measurements.map(m => [
        m.timestamp.toISOString(),
        m.testId,
        m.memoryUsage.used,
        m.memoryUsage.peak,
        m.cpuUsage.generation,
        m.cpuUsage.optimization,
        m.cpuUsage.rendering,
        m.timings.validation,
        m.timings.generation,
        m.timings.optimization,
        m.timings.rendering,
        m.timings.export,
        m.qualityMetrics.meshComplexity,
        m.qualityMetrics.optimizationRatio,
        m.qualityMetrics.printability
      ])

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

      return {
        data: csv,
        filename: `performance-data-${timestamp}.csv`
      }
    }
  }

  /**
   * Get performance optimization suggestions
   */
  static getOptimizationSuggestions(metrics: PerformanceMetrics[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []
    const avgMetrics = this.calculateAverageMetrics(metrics)

    // Memory optimization suggestions
    if (avgMetrics.memoryUsage.used > 500) {
      suggestions.push({
        category: 'memory',
        priority: 'high',
        suggestion: 'Consider reducing pattern complexity or cube size to lower memory usage',
        expectedImprovement: '20-40% memory reduction'
      })
    }

    // CPU optimization suggestions
    const totalCpu = avgMetrics.cpuUsage.generation + avgMetrics.cpuUsage.optimization + avgMetrics.cpuUsage.rendering
    if (totalCpu > 70) {
      if (avgMetrics.cpuUsage.generation > 50) {
        suggestions.push({
          category: 'cpu',
          priority: 'medium',
          suggestion: 'Enable mesh optimization to reduce generation complexity',
          expectedImprovement: '15-30% CPU reduction'
        })
      }
      if (avgMetrics.cpuUsage.rendering > 30) {
        suggestions.push({
          category: 'cpu',
          priority: 'medium',
          suggestion: 'Reduce preview quality or disable real-time updates during generation',
          expectedImprovement: '10-25% CPU reduction'
        })
      }
    }

    // Time optimization suggestions
    if (avgMetrics.timings.generation > 5000) {
      suggestions.push({
        category: 'time',
        priority: 'high',
        suggestion: 'Consider using lower quality settings for testing, high quality for final generation',
        expectedImprovement: '50-70% time reduction'
      })
    }

    // Quality optimization suggestions
    if (avgMetrics.qualityMetrics.optimizationRatio < 0.3) {
      suggestions.push({
        category: 'quality',
        priority: 'medium',
        suggestion: 'Enable mesh merging and face optimization for better efficiency',
        expectedImprovement: 'Improved mesh quality and reduced file size'
      })
    }

    return suggestions
  }

  /**
   * Private helper methods
   */

  private static generateSessionId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private static captureMemoryBaseline(): void {
    const memInfo = this.getMemoryInfo()
    this.memoryBaseline = memInfo.used
  }

  private static captureMetrics(testId: string, startTime: number): PerformanceMetrics {
    const now = performance.now()
    const memoryInfo = this.getMemoryInfo()
    const cpuUsage = this.estimateCpuUsage()

    return {
      timestamp: new Date(),
      testId,
      memoryUsage: {
        used: memoryInfo.used,
        peak: memoryInfo.peak,
        available: memoryInfo.available
      },
      cpuUsage: {
        generation: cpuUsage * 0.6, // Estimate 60% for generation
        optimization: cpuUsage * 0.25, // Estimate 25% for optimization
        rendering: cpuUsage * 0.15 // Estimate 15% for rendering
      },
      timings: {
        validation: Math.max(0, now - startTime - 4000), // Rough estimates
        generation: Math.max(0, now - startTime - 3000),
        optimization: Math.max(0, now - startTime - 1000),
        rendering: Math.max(0, now - startTime - 500),
        export: 0 // Not exported yet
      },
      qualityMetrics: {
        meshComplexity: 50, // Default estimate
        optimizationRatio: 0.8, // Default estimate
        printability: 75 // Default estimate
      }
    }
  }

  private static getMemoryInfo(): { used: number; peak: number; available: number } {
    // Use Performance API if available
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: Math.round(memory.usedJSHeapSize / (1024 * 1024)), // MB
        peak: Math.round(memory.totalJSHeapSize / (1024 * 1024)), // MB
        available: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)) // MB
      }
    }

    // Fallback estimates
    return {
      used: Math.max(50, this.memoryBaseline + Math.random() * 100),
      peak: Math.max(100, this.memoryBaseline + Math.random() * 200),
      available: 2048 // Assume 2GB available
    }
  }

  private static estimateCpuUsage(): number {
    // Simple CPU usage estimation based on timing
    const start = performance.now()
    
    // Perform some work to measure CPU responsiveness
    let sum = 0
    for (let i = 0; i < 10000; i++) {
      sum += Math.sqrt(i)
    }
    
    const elapsed = performance.now() - start
    
    // Convert timing to rough CPU usage percentage
    // This is a very rough estimate
    return Math.min(100, Math.max(0, (elapsed - 1) * 10))
  }

  private static checkThresholds(metrics: PerformanceMetrics, thresholds: Partial<PerformanceThresholds>): void {
    const issues: string[] = []

    if (thresholds.maxMemoryUsageMB && metrics.memoryUsage.used > thresholds.maxMemoryUsageMB) {
      issues.push(`Memory usage exceeded threshold: ${metrics.memoryUsage.used}MB > ${thresholds.maxMemoryUsageMB}MB`)
    }

    const totalCpu = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering
    if (thresholds.maxCpuUsagePercent && totalCpu > thresholds.maxCpuUsagePercent) {
      issues.push(`CPU usage exceeded threshold: ${totalCpu.toFixed(1)}% > ${thresholds.maxCpuUsagePercent}%`)
    }

    if (issues.length > 0) {
      console.warn('Performance thresholds exceeded:', issues)
      // In a real application, you might emit events or show user notifications
    }
  }

  private static generateReport(measurements: PerformanceMetrics[]): PerformanceReport {
    if (measurements.length === 0) {
      throw new PerformanceMonitoringError('No measurements available for report generation')
    }

    const avgMetrics = this.calculateAverageMetrics(measurements)
    const peakMemory = Math.max(...measurements.map(m => m.memoryUsage.peak))
    const totalTime = measurements[measurements.length - 1].timestamp.getTime() - measurements[0].timestamp.getTime()

    return {
      duration: totalTime,
      sampleCount: measurements.length,
      averageMetrics: avgMetrics,
      peakMemoryUsage: peakMemory,
      performanceScore: this.calculateOverallPerformanceScore(avgMetrics),
      summary: this.generatePerformanceSummary(measurements)
    }
  }

  private static calculateAverageMetrics(measurements: PerformanceMetrics[]): PerformanceMetrics {
    if (measurements.length === 0) {
      throw new PerformanceMonitoringError('No measurements to average')
    }

    const sums = measurements.reduce((acc, m) => ({
      memoryUsed: acc.memoryUsed + m.memoryUsage.used,
      memoryPeak: acc.memoryPeak + m.memoryUsage.peak,
      cpuGeneration: acc.cpuGeneration + m.cpuUsage.generation,
      cpuOptimization: acc.cpuOptimization + m.cpuUsage.optimization,
      cpuRendering: acc.cpuRendering + m.cpuUsage.rendering,
      meshComplexity: acc.meshComplexity + m.qualityMetrics.meshComplexity,
      optimizationRatio: acc.optimizationRatio + m.qualityMetrics.optimizationRatio,
      printability: acc.printability + m.qualityMetrics.printability
    }), {
      memoryUsed: 0, memoryPeak: 0, cpuGeneration: 0, cpuOptimization: 0,
      cpuRendering: 0, meshComplexity: 0, optimizationRatio: 0, printability: 0
    })

    const count = measurements.length
    const latest = measurements[measurements.length - 1]

    return {
      ...latest,
      memoryUsage: {
        used: sums.memoryUsed / count,
        peak: sums.memoryPeak / count,
        available: latest.memoryUsage.available
      },
      cpuUsage: {
        generation: sums.cpuGeneration / count,
        optimization: sums.cpuOptimization / count,
        rendering: sums.cpuRendering / count
      },
      qualityMetrics: {
        meshComplexity: sums.meshComplexity / count,
        optimizationRatio: sums.optimizationRatio / count,
        printability: sums.printability / count
      }
    }
  }

  private static calculateOverallPerformanceScore(metrics: PerformanceMetrics): number {
    // Performance scoring algorithm (0-100)
    let score = 100

    // Memory score (30% weight)
    const memoryScore = Math.max(0, 100 - (metrics.memoryUsage.used / 10)) // Penalize high memory usage
    score = score * 0.7 + memoryScore * 0.3

    // CPU score (25% weight)  
    const totalCpu = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering
    const cpuScore = Math.max(0, 100 - totalCpu)
    score = score * 0.75 + cpuScore * 0.25

    // Quality score (45% weight)
    const qualityScore = (metrics.qualityMetrics.optimizationRatio * 50) + (metrics.qualityMetrics.printability * 0.5)
    score = score * 0.55 + qualityScore * 0.45

    return Math.max(0, Math.min(100, score))
  }

  private static calculateCpuDelta(baseline: PerformanceMetrics, current: PerformanceMetrics): number {
    const baselineCpu = baseline.cpuUsage.generation + baseline.cpuUsage.optimization + baseline.cpuUsage.rendering
    const currentCpu = current.cpuUsage.generation + current.cpuUsage.optimization + current.cpuUsage.rendering
    return ((currentCpu - baselineCpu) / baselineCpu) * 100
  }

  private static calculateTimeDelta(baseline: PerformanceMetrics, current: PerformanceMetrics): number {
    const baselineTime = Object.values(baseline.timings).reduce((sum, time) => sum + time, 0)
    const currentTime = Object.values(current.timings).reduce((sum, time) => sum + time, 0)
    return ((currentTime - baselineTime) / baselineTime) * 100
  }

  private static generateRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = []

    if (report.averageMetrics.memoryUsage.used > 500) {
      recommendations.push('Consider reducing model complexity to lower memory usage')
    }

    if (report.performanceScore < 70) {
      recommendations.push('Performance could be improved - check CPU and memory usage')
    }

    if (report.averageMetrics.qualityMetrics.optimizationRatio < 0.5) {
      recommendations.push('Enable mesh optimization for better performance')
    }

    return recommendations
  }

  private static generatePerformanceSummary(measurements: PerformanceMetrics[]): string {
    const avgMetrics = this.calculateAverageMetrics(measurements)
    const peakMemory = Math.max(...measurements.map(m => m.memoryUsage.peak))
    
    return `Performance Summary:
• Average Memory Usage: ${avgMetrics.memoryUsage.used.toFixed(1)}MB (Peak: ${peakMemory.toFixed(1)}MB)
• Average CPU Usage: ${(avgMetrics.cpuUsage.generation + avgMetrics.cpuUsage.optimization + avgMetrics.cpuUsage.rendering).toFixed(1)}%
• Quality Metrics: Complexity ${avgMetrics.qualityMetrics.meshComplexity.toFixed(1)}, Printability ${avgMetrics.qualityMetrics.printability.toFixed(1)}%
• Samples Collected: ${measurements.length}`
  }
}

/**
 * Supporting interfaces
 */
export interface PerformanceReport {
  duration: number
  sampleCount: number
  averageMetrics: PerformanceMetrics
  peakMemoryUsage: number
  performanceScore: number
  summary: string
}

export interface PerformanceComparison {
  memoryDelta: number
  cpuDelta: number
  timeDelta: number
  qualityDelta: number
  overall: number
}

export interface OptimizationSuggestion {
  category: 'memory' | 'cpu' | 'time' | 'quality'
  priority: 'low' | 'medium' | 'high'
  suggestion: string
  expectedImprovement: string
}