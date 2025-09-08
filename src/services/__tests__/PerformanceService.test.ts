/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceService, PerformanceError } from '../PerformanceService'
import type { PerformanceMetrics, PerformanceSnapshot } from '@/types'

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50000000,
    totalJSHeapSize: 100000000,
    jsHeapSizeLimit: 2000000000
  },
  getEntriesByType: vi.fn(() => []),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    hardwareConcurrency: 8,
    deviceMemory: 8
  }
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))

describe('PerformanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformance.now.mockReturnValue(1000)
    PerformanceService.reset()
  })

  afterEach(() => {
    PerformanceService.stopMonitoring()
  })

  describe('startMonitoring', () => {
    it('should start performance monitoring', () => {
      const sessionId = PerformanceService.startMonitoring('test-session')
      
      expect(sessionId).toBeTruthy()
      expect(PerformanceService.isMonitoring()).toBe(true)
    })

    it('should throw error if already monitoring', () => {
      PerformanceService.startMonitoring('test-session')
      
      expect(() => {
        PerformanceService.startMonitoring('another-session')
      }).toThrow(PerformanceError)
    })

    it('should initialize performance baseline', () => {
      const sessionId = PerformanceService.startMonitoring('test-session')
      const baseline = PerformanceService.getBaseline()
      
      expect(baseline).toBeDefined()
      expect(baseline.memoryUsed).toBe(50) // 50MB from mock
      expect(baseline.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('stopMonitoring', () => {
    it('should stop performance monitoring', () => {
      PerformanceService.startMonitoring('test-session')
      const report = PerformanceService.stopMonitoring()
      
      expect(PerformanceService.isMonitoring()).toBe(false)
      expect(report).toBeDefined()
      expect(report.sessionId).toBe('test-session')
    })

    it('should return null if not monitoring', () => {
      const report = PerformanceService.stopMonitoring()
      expect(report).toBeNull()
    })

    it('should generate final performance report', () => {
      const sessionId = PerformanceService.startMonitoring('test-session')
      
      // Simulate some metrics collection
      PerformanceService.recordMetric('test-operation', 1500)
      
      const report = PerformanceService.stopMonitoring()
      
      expect(report?.totalDuration).toBeGreaterThan(0)
      expect(report?.operationCount).toBe(1)
      expect(report?.averageMemoryUsage).toBeGreaterThan(0)
    })
  })

  describe('getCurrentMetrics', () => {
    it('should get current performance metrics', () => {
      PerformanceService.startMonitoring('test-session')
      const metrics = PerformanceService.getCurrentMetrics()
      
      expect(metrics).toBeDefined()
      expect(metrics.memoryUsage).toBeDefined()
      expect(metrics.cpuUsage).toBeDefined()
      expect(metrics.timings).toBeDefined()
      expect(metrics.qualityMetrics).toBeDefined()
    })

    it('should return null if not monitoring', () => {
      const metrics = PerformanceService.getCurrentMetrics()
      expect(metrics).toBeNull()
    })

    it('should calculate memory usage correctly', () => {
      PerformanceService.startMonitoring('test-session')
      const metrics = PerformanceService.getCurrentMetrics()!
      
      expect(metrics.memoryUsage.used).toBe(50) // 50MB from mock
      expect(metrics.memoryUsage.available).toBeGreaterThan(0)
      expect(metrics.memoryUsage.peak).toBeGreaterThanOrEqual(metrics.memoryUsage.used)
    })
  })

  describe('recordMetric', () => {
    it('should record operation metrics', () => {
      PerformanceService.startMonitoring('test-session')
      
      PerformanceService.recordMetric('validation', 100)
      PerformanceService.recordMetric('generation', 2000)
      PerformanceService.recordMetric('optimization', 800)
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings.validation).toBe(100)
      expect(metrics.timings.generation).toBe(2000)
      expect(metrics.timings.optimization).toBe(800)
    })

    it('should accumulate metrics for repeated operations', () => {
      PerformanceService.startMonitoring('test-session')
      
      PerformanceService.recordMetric('generation', 1000)
      PerformanceService.recordMetric('generation', 1500)
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings.generation).toBe(2500)
    })

    it('should throw error if not monitoring', () => {
      expect(() => {
        PerformanceService.recordMetric('test', 100)
      }).toThrow(PerformanceError)
    })
  })

  describe('recordQualityMetrics', () => {
    it('should record quality metrics', () => {
      PerformanceService.startMonitoring('test-session')
      
      const qualityData = {
        meshComplexity: 75,
        optimizationRatio: 0.85,
        printability: 88
      }
      
      PerformanceService.recordQualityMetrics(qualityData)
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.qualityMetrics).toEqual(qualityData)
    })
  })

  describe('createSnapshot', () => {
    it('should create performance snapshot', () => {
      PerformanceService.startMonitoring('test-session')
      mockPerformance.now.mockReturnValue(2000) // 1 second later
      
      const snapshot = PerformanceService.createSnapshot()
      
      expect(snapshot).toBeDefined()
      expect(snapshot.memoryUsed).toBe(50)
      expect(snapshot.elapsedTime).toBe(1000) // 2000 - 1000
    })

    it('should calculate generation speed', () => {
      PerformanceService.startMonitoring('test-session')
      PerformanceService.recordMetric('generation', 2000)
      
      // Mock some vertex processing
      const snapshot = PerformanceService.createSnapshot()
      expect(snapshot.generationSpeed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getMetricsHistory', () => {
    it('should return metrics history', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Force some metrics collection
      PerformanceService.recordMetric('test', 100)
      PerformanceService.recordMetric('test', 200)
      
      const history = PerformanceService.getMetricsHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('should limit history size', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Record many metrics
      for (let i = 0; i < 200; i++) {
        PerformanceService.recordMetric('test', i)
      }
      
      const history = PerformanceService.getMetricsHistory()
      expect(history.length).toBeLessThanOrEqual(100) // Default limit
    })
  })

  describe('setThresholds', () => {
    it('should set performance thresholds', () => {
      const thresholds = {
        maxMemoryUsage: 1000, // 1GB
        maxCpuUsage: 80,
        maxProcessingTime: 5000
      }
      
      PerformanceService.setThresholds(thresholds)
      
      const currentThresholds = PerformanceService.getThresholds()
      expect(currentThresholds).toEqual(expect.objectContaining(thresholds))
    })

    it('should validate threshold values', () => {
      expect(() => {
        PerformanceService.setThresholds({ maxMemoryUsage: -100 })
      }).toThrow(PerformanceError)
      
      expect(() => {
        PerformanceService.setThresholds({ maxCpuUsage: 150 })
      }).toThrow(PerformanceError)
    })
  })

  describe('checkThresholds', () => {
    it('should detect threshold violations', () => {
      PerformanceService.setThresholds({
        maxMemoryUsage: 10, // Very low threshold
        maxCpuUsage: 50,
        maxProcessingTime: 1000
      })
      
      PerformanceService.startMonitoring('test-session')
      
      const violations = PerformanceService.checkThresholds()
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some(v => v.metric === 'memory')).toBe(true)
    })

    it('should return empty array when no violations', () => {
      PerformanceService.setThresholds({
        maxMemoryUsage: 10000, // Very high threshold
        maxCpuUsage: 100,
        maxProcessingTime: 60000
      })
      
      PerformanceService.startMonitoring('test-session')
      
      const violations = PerformanceService.checkThresholds()
      expect(violations).toEqual([])
    })
  })

  describe('measureOperation', () => {
    it('should measure async operation', async () => {
      PerformanceService.startMonitoring('test-session')
      
      const result = await PerformanceService.measureOperation(
        'test-op',
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      )
      
      expect(result).toBe('done')
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings['test-op']).toBeGreaterThan(90)
    })

    it('should measure sync operation', async () => {
      PerformanceService.startMonitoring('test-session')
      
      const result = await PerformanceService.measureOperation('sync-op', () => {
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      })
      
      expect(result).toBe(499500)
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings['sync-op']).toBeGreaterThan(0)
    })

    it('should handle operation errors', async () => {
      PerformanceService.startMonitoring('test-session')
      
      await expect(
        PerformanceService.measureOperation('error-op', () => {
          throw new Error('Operation failed')
        })
      ).rejects.toThrow('Operation failed')
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings['error-op']).toBeGreaterThan(0)
    })
  })

  describe('generateReport', () => {
    it('should generate performance report', () => {
      PerformanceService.startMonitoring('test-session')
      
      PerformanceService.recordMetric('validation', 100)
      PerformanceService.recordMetric('generation', 2000)
      PerformanceService.recordQualityMetrics({
        meshComplexity: 75,
        optimizationRatio: 0.85,
        printability: 88
      })
      
      const report = PerformanceService.generateReport()
      
      expect(report).toBeDefined()
      expect(report.sessionId).toBe('test-session')
      expect(report.summary).toBeDefined()
      expect(report.timeline).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should include performance recommendations', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Record high processing time
      PerformanceService.recordMetric('generation', 10000)
      
      const report = PerformanceService.generateReport()
      
      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations.some(r => 
        r.toLowerCase().includes('processing time')
      )).toBe(true)
    })
  })

  describe('real-time monitoring', () => {
    it('should collect metrics at regular intervals', async () => {
      const onUpdate = vi.fn()
      
      PerformanceService.startMonitoring('test-session', {
        interval: 50, // 50ms for fast test
        onUpdate
      })
      
      // Wait for a few updates
      await new Promise(resolve => setTimeout(resolve, 200))
      
      PerformanceService.stopMonitoring()
      
      expect(onUpdate).toHaveBeenCalledTimes(3) // Should have been called ~4 times
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        memoryUsage: expect.any(Object),
        cpuUsage: expect.any(Object)
      }))
    })

    it('should handle monitoring callback errors', async () => {
      const onUpdate = vi.fn(() => {
        throw new Error('Callback error')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      PerformanceService.startMonitoring('test-session', {
        interval: 50,
        onUpdate
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      PerformanceService.stopMonitoring()
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('memory pressure detection', () => {
    it('should detect memory pressure', () => {
      // Mock high memory usage
      mockPerformance.memory.usedJSHeapSize = 1800000000 // 1.8GB
      mockPerformance.memory.jsHeapSizeLimit = 2000000000 // 2GB
      
      PerformanceService.startMonitoring('test-session')
      
      const pressure = PerformanceService.getMemoryPressure()
      expect(pressure.level).toBe('high')
      expect(pressure.percentage).toBeGreaterThan(80)
    })

    it('should recommend memory optimization', () => {
      mockPerformance.memory.usedJSHeapSize = 1900000000 // 1.9GB
      
      PerformanceService.startMonitoring('test-session')
      
      const recommendations = PerformanceService.getOptimizationRecommendations()
      expect(recommendations.some(r => 
        r.type === 'memory' && r.action.includes('reduce')
      )).toBe(true)
    })
  })

  describe('CPU monitoring', () => {
    it('should estimate CPU usage', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Simulate CPU-intensive work
      PerformanceService.recordMetric('generation', 5000) // Long operation
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.cpuUsage.generation).toBeGreaterThan(0)
    })

    it('should track CPU usage by operation type', () => {
      PerformanceService.startMonitoring('test-session')
      
      PerformanceService.recordMetric('generation', 2000)
      PerformanceService.recordMetric('optimization', 1000)
      PerformanceService.recordMetric('rendering', 500)
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.cpuUsage.generation).toBeGreaterThan(metrics.cpuUsage.optimization)
      expect(metrics.cpuUsage.optimization).toBeGreaterThan(metrics.cpuUsage.rendering)
    })
  })

  describe('performance benchmarking', () => {
    it('should benchmark against baseline', () => {
      PerformanceService.startMonitoring('test-session')
      
      const baseline = PerformanceService.getBaseline()
      PerformanceService.recordMetric('generation', 2000)
      
      const current = PerformanceService.createSnapshot()
      const comparison = PerformanceService.compareWithBaseline(current)
      
      expect(comparison).toBeDefined()
      expect(comparison.memoryDelta).toBeDefined()
      expect(comparison.timeDelta).toBeGreaterThan(0)
    })

    it('should identify performance regressions', () => {
      const historicalBaseline = {
        memoryUsed: 30,
        cpuUsage: 20,
        generationSpeed: 1000,
        elapsedTime: 1000
      }
      
      PerformanceService.setHistoricalBaseline(historicalBaseline)
      PerformanceService.startMonitoring('test-session')
      
      // Simulate worse performance
      mockPerformance.memory.usedJSHeapSize = 100000000 // 100MB (vs 30MB baseline)
      PerformanceService.recordMetric('generation', 4000) // Slower than baseline
      
      const regressions = PerformanceService.detectRegressions()
      expect(regressions.length).toBeGreaterThan(0)
    })
  })

  describe('error scenarios', () => {
    it('should handle performance API unavailable', () => {
      const originalPerformance = global.performance
      // @ts-ignore
      global.performance = undefined
      
      expect(() => {
        PerformanceService.startMonitoring('test-session')
      }).toThrow(PerformanceError)
      
      global.performance = originalPerformance
    })

    it('should handle memory API unavailable', () => {
      const originalMemory = mockPerformance.memory
      // @ts-ignore
      mockPerformance.memory = undefined
      
      PerformanceService.startMonitoring('test-session')
      const metrics = PerformanceService.getCurrentMetrics()!
      
      expect(metrics.memoryUsage.used).toBe(0)
      expect(metrics.memoryUsage.available).toBe(0)
      
      mockPerformance.memory = originalMemory
    })

    it('should handle monitoring session conflicts', () => {
      PerformanceService.startMonitoring('session-1')
      
      expect(() => {
        PerformanceService.startMonitoring('session-2')
      }).toThrow('Performance monitoring already active')
    })

    it('should handle invalid threshold values', () => {
      expect(() => {
        PerformanceService.setThresholds({
          maxMemoryUsage: -100
        })
      }).toThrow('Invalid threshold value')
      
      expect(() => {
        PerformanceService.setThresholds({
          maxCpuUsage: 150
        })
      }).toThrow('CPU usage threshold must be between 0 and 100')
    })
  })

  describe('concurrent monitoring', () => {
    it('should handle rapid metric recording', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Record many metrics quickly
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          PerformanceService.recordMetric('rapid-test', i * 10)
        })
      )
      
      expect(() => Promise.all(promises)).not.toThrow()
    })

    it('should maintain data consistency', () => {
      PerformanceService.startMonitoring('test-session')
      
      // Simulate concurrent operations
      PerformanceService.recordMetric('concurrent-1', 1000)
      PerformanceService.recordMetric('concurrent-2', 2000)
      PerformanceService.recordMetric('concurrent-1', 500) // Should accumulate
      
      const metrics = PerformanceService.getCurrentMetrics()!
      expect(metrics.timings['concurrent-1']).toBe(1500)
      expect(metrics.timings['concurrent-2']).toBe(2000)
    })
  })
})