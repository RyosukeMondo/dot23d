import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PerformanceService } from '@/services/PerformanceService'
import type { PerformanceMetrics, PerformanceSnapshot } from '@/types'
import styles from './RealTimeMetrics.module.css'

export interface RealTimeMetricsProps {
  /** Active test ID being monitored */
  testId?: string | null
  /** Whether monitoring is active */
  isMonitoring?: boolean
  /** Update interval in milliseconds */
  updateInterval?: number
  /** Maximum data points to keep in memory */
  maxDataPoints?: number
  /** Custom thresholds for alerts */
  thresholds?: {
    memoryWarning: number
    memoryCritical: number
    cpuWarning: number
    cpuCritical: number
  }
  /** Callback when threshold is exceeded */
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => void
}

interface MetricDataPoint {
  timestamp: number
  memoryUsed: number
  cpuTotal: number
  generationTime: number
  qualityScore: number
}

type AlertLevel = 'info' | 'warning' | 'critical'

interface PerformanceAlert {
  id: string
  level: AlertLevel
  message: string
  timestamp: number
  metric: string
  value: number
  threshold?: number
}

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  testId,
  isMonitoring = false,
  updateInterval = 1000,
  maxDataPoints = 60,
  thresholds = {
    memoryWarning: 256,
    memoryCritical: 512,
    cpuWarning: 70,
    cpuCritical: 90
  },
  onThresholdExceeded
}) => {
  const [metrics, setMetrics] = useState<MetricDataPoint[]>([])
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceSnapshot | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected')
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '5m' | '15m' | 'all'>('1m')
  const [selectedMetric, setSelectedMetric] = useState<'memory' | 'cpu' | 'time' | 'quality'>('memory')

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const alertIdCounter = useRef(0)

  // Start/stop monitoring based on props
  useEffect(() => {
    if (isMonitoring && testId) {
      startMonitoring()
      setConnectionStatus('connected')
    } else {
      stopMonitoring()
      setConnectionStatus('disconnected')
    }

    return () => stopMonitoring()
  }, [isMonitoring, testId, updateInterval])

  // Start real-time monitoring
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return

    intervalRef.current = setInterval(() => {
      try {
        // Get real-time snapshot
        const snapshot = PerformanceService.getRealtimeSnapshot()
        setCurrentMetrics(snapshot)

        // Get detailed metrics if session exists
        if (testId) {
          const detailed = PerformanceService.getCurrentMetrics(testId)
          if (detailed) {
            const dataPoint: MetricDataPoint = {
              timestamp: Date.now(),
              memoryUsed: detailed.memoryUsage.used,
              cpuTotal: detailed.cpuUsage.generation + detailed.cpuUsage.optimization + detailed.cpuUsage.rendering,
              generationTime: detailed.timings.generation + detailed.timings.optimization,
              qualityScore: detailed.qualityMetrics.optimizationRatio * 100
            }

            setMetrics(prev => {
              const updated = [...prev, dataPoint].slice(-maxDataPoints)
              return updated
            })

            // Check thresholds
            checkThresholds(detailed)
          }
        } else {
          // Use snapshot data for basic monitoring
          const dataPoint: MetricDataPoint = {
            timestamp: Date.now(),
            memoryUsed: snapshot.memoryUsed,
            cpuTotal: snapshot.cpuUsage,
            generationTime: 0,
            qualityScore: 0
          }

          setMetrics(prev => {
            const updated = [...prev, dataPoint].slice(-maxDataPoints)
            return updated
          })

          // Check snapshot thresholds
          checkSnapshotThresholds(snapshot)
        }

        setConnectionStatus('connected')
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
        setConnectionStatus('error')
      }
    }, updateInterval)
  }, [testId, updateInterval, maxDataPoints, thresholds, onThresholdExceeded])

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Check performance thresholds
  const checkThresholds = useCallback((metrics: PerformanceMetrics) => {
    const memoryUsed = metrics.memoryUsage.used
    const cpuTotal = metrics.cpuUsage.generation + metrics.cpuUsage.optimization + metrics.cpuUsage.rendering

    // Memory thresholds
    if (memoryUsed >= thresholds.memoryCritical) {
      addAlert('critical', `Memory usage critical: ${memoryUsed.toFixed(1)}MB`, 'memory', memoryUsed, thresholds.memoryCritical)
    } else if (memoryUsed >= thresholds.memoryWarning) {
      addAlert('warning', `Memory usage high: ${memoryUsed.toFixed(1)}MB`, 'memory', memoryUsed, thresholds.memoryWarning)
    }

    // CPU thresholds
    if (cpuTotal >= thresholds.cpuCritical) {
      addAlert('critical', `CPU usage critical: ${cpuTotal.toFixed(1)}%`, 'cpu', cpuTotal, thresholds.cpuCritical)
    } else if (cpuTotal >= thresholds.cpuWarning) {
      addAlert('warning', `CPU usage high: ${cpuTotal.toFixed(1)}%`, 'cpu', cpuTotal, thresholds.cpuWarning)
    }
  }, [thresholds, onThresholdExceeded])

  // Check snapshot thresholds (simplified)
  const checkSnapshotThresholds = useCallback((snapshot: PerformanceSnapshot) => {
    if (snapshot.memoryUsed >= thresholds.memoryCritical) {
      addAlert('critical', `Memory usage critical: ${snapshot.memoryUsed.toFixed(1)}MB`, 'memory', snapshot.memoryUsed, thresholds.memoryCritical)
    } else if (snapshot.memoryUsed >= thresholds.memoryWarning) {
      addAlert('warning', `Memory usage high: ${snapshot.memoryUsed.toFixed(1)}MB`, 'memory', snapshot.memoryUsed, thresholds.memoryWarning)
    }

    if (snapshot.cpuUsage >= thresholds.cpuCritical) {
      addAlert('critical', `CPU usage critical: ${snapshot.cpuUsage.toFixed(1)}%`, 'cpu', snapshot.cpuUsage, thresholds.cpuCritical)
    } else if (snapshot.cpuUsage >= thresholds.cpuWarning) {
      addAlert('warning', `CPU usage high: ${snapshot.cpuUsage.toFixed(1)}%`, 'cpu', snapshot.cpuUsage, thresholds.cpuWarning)
    }
  }, [thresholds, onThresholdExceeded])

  // Add performance alert
  const addAlert = useCallback((level: AlertLevel, message: string, metric: string, value: number, threshold?: number) => {
    const alert: PerformanceAlert = {
      id: `alert-${++alertIdCounter.current}`,
      level,
      message,
      timestamp: Date.now(),
      metric,
      value,
      threshold
    }

    setAlerts(prev => [alert, ...prev.slice(0, 9)]) // Keep last 10 alerts
    onThresholdExceeded?.(metric, value, threshold || 0)
  }, [onThresholdExceeded])

  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Filter metrics by time range
  const filteredMetrics = useMemo(() => {
    if (metrics.length === 0) return []

    const now = Date.now()
    let timeWindow: number

    switch (selectedTimeRange) {
      case '1m': timeWindow = 60 * 1000; break
      case '5m': timeWindow = 5 * 60 * 1000; break
      case '15m': timeWindow = 15 * 60 * 1000; break
      default: return metrics
    }

    return metrics.filter(m => now - m.timestamp <= timeWindow)
  }, [metrics, selectedTimeRange])

  // Get current metric value
  const getCurrentValue = (metric: keyof MetricDataPoint): number => {
    const latest = filteredMetrics[filteredMetrics.length - 1]
    return latest ? latest[metric] as number : 0
  }

  // Get metric statistics
  const getMetricStats = (metric: keyof MetricDataPoint) => {
    if (filteredMetrics.length === 0) return { min: 0, max: 0, avg: 0 }

    const values = filteredMetrics.map(m => m[metric] as number)
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length
    }
  }

  // Render mini chart
  const renderMiniChart = (metric: keyof MetricDataPoint) => {
    if (filteredMetrics.length < 2) {
      return <div className={styles.noData}>No data</div>
    }

    const values = filteredMetrics.map(m => m[metric] as number)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min

    return (
      <svg className={styles.miniChart} viewBox="0 0 100 30">
        <polyline
          points={values.map((val, index) => {
            const x = (index / (values.length - 1)) * 100
            const y = range > 0 ? 30 - ((val - min) / range) * 30 : 15
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    )
  }

  // Get metric color based on thresholds
  const getMetricColor = (metric: string, value: number): string => {
    switch (metric) {
      case 'memory':
        if (value >= thresholds.memoryCritical) return '#cf222e'
        if (value >= thresholds.memoryWarning) return '#fb8500'
        return '#2da44e'
      case 'cpu':
        if (value >= thresholds.cpuCritical) return '#cf222e'
        if (value >= thresholds.cpuWarning) return '#fb8500'
        return '#2da44e'
      default:
        return '#656d76'
    }
  }

  const memoryStats = getMetricStats('memoryUsed')
  const cpuStats = getMetricStats('cpuTotal')
  const timeStats = getMetricStats('generationTime')
  const qualityStats = getMetricStats('qualityScore')

  return (
    <div className={styles.realTimeMetrics}>
      <div className={styles.header}>
        <h3>Real-Time Performance</h3>
        <div className={styles.controls}>
          <div className={styles.connectionStatus}>
            <div className={`${styles.statusIndicator} ${styles[connectionStatus]}`} />
            <span className={styles.statusText}>
              {connectionStatus === 'connected' ? 'Live' : 
               connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className={styles.timeRangeSelect}
          >
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <span>⚠️ Performance Alerts ({alerts.length})</span>
            <button onClick={clearAlerts} className={styles.clearAlertsButton}>
              Clear All
            </button>
          </div>
          <div className={styles.alertsList}>
            {alerts.slice(0, 3).map(alert => (
              <div key={alert.id} className={`${styles.alert} ${styles[alert.level]}`}>
                <div className={styles.alertMessage}>{alert.message}</div>
                <div className={styles.alertMeta}>
                  <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  <button onClick={() => dismissAlert(alert.id)} className={styles.dismissButton}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${selectedMetric === 'memory' ? styles.selected : ''}`}
             onClick={() => setSelectedMetric('memory')}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Memory Usage</span>
            <span className={styles.metricUnit}>MB</span>
          </div>
          <div className={styles.metricValue} style={{ color: getMetricColor('memory', getCurrentValue('memoryUsed')) }}>
            {getCurrentValue('memoryUsed').toFixed(1)}
          </div>
          <div className={styles.metricChart}>
            {renderMiniChart('memoryUsed')}
          </div>
          <div className={styles.metricStats}>
            <span>Min: {memoryStats.min.toFixed(1)}</span>
            <span>Avg: {memoryStats.avg.toFixed(1)}</span>
            <span>Max: {memoryStats.max.toFixed(1)}</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${selectedMetric === 'cpu' ? styles.selected : ''}`}
             onClick={() => setSelectedMetric('cpu')}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>CPU Usage</span>
            <span className={styles.metricUnit}>%</span>
          </div>
          <div className={styles.metricValue} style={{ color: getMetricColor('cpu', getCurrentValue('cpuTotal')) }}>
            {getCurrentValue('cpuTotal').toFixed(1)}
          </div>
          <div className={styles.metricChart}>
            {renderMiniChart('cpuTotal')}
          </div>
          <div className={styles.metricStats}>
            <span>Min: {cpuStats.min.toFixed(1)}</span>
            <span>Avg: {cpuStats.avg.toFixed(1)}</span>
            <span>Max: {cpuStats.max.toFixed(1)}</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${selectedMetric === 'time' ? styles.selected : ''}`}
             onClick={() => setSelectedMetric('time')}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Generation Time</span>
            <span className={styles.metricUnit}>ms</span>
          </div>
          <div className={styles.metricValue}>
            {getCurrentValue('generationTime').toFixed(0)}
          </div>
          <div className={styles.metricChart}>
            {renderMiniChart('generationTime')}
          </div>
          <div className={styles.metricStats}>
            <span>Min: {timeStats.min.toFixed(0)}</span>
            <span>Avg: {timeStats.avg.toFixed(0)}</span>
            <span>Max: {timeStats.max.toFixed(0)}</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${selectedMetric === 'quality' ? styles.selected : ''}`}
             onClick={() => setSelectedMetric('quality')}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Quality Score</span>
            <span className={styles.metricUnit}>%</span>
          </div>
          <div className={styles.metricValue}>
            {getCurrentValue('qualityScore').toFixed(1)}
          </div>
          <div className={styles.metricChart}>
            {renderMiniChart('qualityScore')}
          </div>
          <div className={styles.metricStats}>
            <span>Min: {qualityStats.min.toFixed(1)}</span>
            <span>Avg: {qualityStats.avg.toFixed(1)}</span>
            <span>Max: {qualityStats.max.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {currentMetrics && (
        <div className={styles.systemInfo}>
          <h4>System Status</h4>
          <div className={styles.systemStats}>
            <div className={styles.systemStat}>
              <span className={styles.statLabel}>Elapsed Time:</span>
              <span className={styles.statValue}>{currentMetrics.elapsedTime.toFixed(1)}s</span>
            </div>
            <div className={styles.systemStat}>
              <span className={styles.statLabel}>Generation Speed:</span>
              <span className={styles.statValue}>
                {currentMetrics.generationSpeed > 0 ? `${currentMetrics.generationSpeed.toFixed(1)} ops/s` : 'N/A'}
              </span>
            </div>
            <div className={styles.systemStat}>
              <span className={styles.statLabel}>Data Points:</span>
              <span className={styles.statValue}>{filteredMetrics.length}</span>
            </div>
          </div>
        </div>
      )}

      {!isMonitoring && (
        <div className={styles.inactiveState}>
          <div className={styles.inactiveIcon}>📊</div>
          <div className={styles.inactiveMessage}>
            Start a test to see real-time performance metrics
          </div>
        </div>
      )}
    </div>
  )
}

export default RealTimeMetrics