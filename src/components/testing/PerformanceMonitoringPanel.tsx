import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { RealTimeMetrics } from './RealTimeMetrics'
import { PerformanceCharts } from './PerformanceCharts'
import { PerformanceService, type OptimizationSuggestion } from '@/services/PerformanceService'
import type { PerformanceMetrics, TestSession } from '@/types'
import styles from './PerformanceMonitoringPanel.module.css'

export interface PerformanceMonitoringPanelProps {
  /** Current test session */
  testSession?: TestSession
  /** Whether monitoring is currently active */
  isMonitoring?: boolean
  /** Current test ID being monitored */
  currentTestId?: string | null
  /** Callback when monitoring starts/stops */
  onMonitoringChange?: (isMonitoring: boolean) => void
  /** Callback when performance alert is triggered */
  onPerformanceAlert?: (message: string, severity: 'low' | 'medium' | 'high') => void
}

type ViewMode = 'realtime' | 'charts' | 'recommendations' | 'comparison'

interface PerformanceAlert {
  id: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: number
  metric: string
  dismissed: boolean
}

interface MonitoringConfig {
  samplingInterval: number
  enableAlerts: boolean
  thresholds: {
    memoryWarning: number
    memoryCritical: number
    cpuWarning: number
    cpuCritical: number
  }
  autoExport: boolean
}

export const PerformanceMonitoringPanel: React.FC<PerformanceMonitoringPanelProps> = ({
  testSession,
  isMonitoring = false,
  currentTestId,
  onMonitoringChange,
  onPerformanceAlert
}) => {
  const { state } = useAppContext()
  const [viewMode, setViewMode] = useState<ViewMode>('realtime')
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([])
  const [monitoringConfig, setMonitoringConfig] = useState<MonitoringConfig>({
    samplingInterval: 1000,
    enableAlerts: true,
    thresholds: {
      memoryWarning: 256,
      memoryCritical: 512,
      cpuWarning: 70,
      cpuCritical: 90
    },
    autoExport: false
  })
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([])
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false)
  const [comparisonSession, setComparisonSession] = useState<TestSession | null>(null)

  const currentSession = testSession || state.testSession
  const testId = currentTestId || (currentSession ? currentSession.id : null)

  // Handle threshold exceeded events
  const handleThresholdExceeded = useCallback((metric: string, value: number, threshold: number) => {
    const severity: 'info' | 'warning' | 'critical' = value > threshold * 1.5 ? 'critical' : 'warning'
    
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: `${metric.charAt(0).toUpperCase() + metric.slice(1)} exceeded threshold: ${value.toFixed(1)} > ${threshold}`,
      severity,
      timestamp: Date.now(),
      metric,
      dismissed: false
    }

    setAlerts(prev => [alert, ...prev.slice(0, 19)]) // Keep last 20 alerts
    
    // Notify parent component
    const severityLevel = severity === 'critical' ? 'high' : severity === 'warning' ? 'medium' : 'low'
    onPerformanceAlert?.(alert.message, severityLevel)
  }, [onPerformanceAlert])

  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    ))
  }, [])

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Generate optimization suggestions
  const generateOptimizationSuggestions = useCallback(async () => {
    if (performanceHistory.length < 3) return

    try {
      const suggestions = PerformanceService.getOptimizationSuggestions(performanceHistory)
      setOptimizationSuggestions(suggestions)
    } catch (error) {
      console.error('Failed to generate optimization suggestions:', error)
    }
  }, [performanceHistory])

  // Export performance data
  const exportPerformanceData = useCallback((format: 'json' | 'csv') => {
    if (performanceHistory.length === 0) return

    try {
      const { data, filename } = PerformanceService.exportPerformanceData(performanceHistory, format)
      
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export performance data:', error)
    }
  }, [performanceHistory])

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!testId) return

    try {
      PerformanceService.startMonitoring(testId, {
        samplingInterval: monitoringConfig.samplingInterval,
        thresholds: monitoringConfig.thresholds
      })
      onMonitoringChange?.(true)
    } catch (error) {
      console.error('Failed to start performance monitoring:', error)
    }
  }, [testId, monitoringConfig, onMonitoringChange])

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!testId) return

    try {
      onMonitoringChange?.(false)
    } catch (error) {
      console.error('Failed to stop performance monitoring:', error)
    }
  }, [testId, onMonitoringChange])

  // Update performance history periodically when monitoring
  useEffect(() => {
    if (!isMonitoring || !testId) return

    const interval = setInterval(() => {
      try {
        const metrics = PerformanceService.getCurrentMetrics(testId)
        if (metrics) {
          setPerformanceHistory(prev => [...prev.slice(-99), metrics]) // Keep last 100 metrics
        }
      } catch (error) {
        console.error('Failed to get current metrics:', error)
      }
    }, monitoringConfig.samplingInterval)

    return () => clearInterval(interval)
  }, [isMonitoring, testId, monitoringConfig.samplingInterval])

  // Generate suggestions when performance history changes
  useEffect(() => {
    if (performanceHistory.length >= 3) {
      generateOptimizationSuggestions()
    }
  }, [performanceHistory, generateOptimizationSuggestions])

  // Get active alerts
  const activeAlerts = useMemo(() => 
    alerts.filter(alert => !alert.dismissed).slice(0, 5)
  , [alerts])

  // Get performance health status
  const performanceHealth = useMemo(() => {
    if (performanceHistory.length === 0) return null
    
    const latestMetrics = performanceHistory[performanceHistory.length - 1]
    return PerformanceService.checkPerformanceHealth(latestMetrics)
  }, [performanceHistory])

  // Calculate monitoring statistics
  const monitoringStats = useMemo(() => {
    if (performanceHistory.length === 0) return null

    const avgMemory = performanceHistory.reduce((sum, m) => sum + m.memoryUsage.used, 0) / performanceHistory.length
    const avgCpu = performanceHistory.reduce((sum, m) => 
      sum + m.cpuUsage.generation + m.cpuUsage.optimization + m.cpuUsage.rendering, 0
    ) / performanceHistory.length
    const peakMemory = Math.max(...performanceHistory.map(m => m.memoryUsage.peak))

    return {
      avgMemory,
      avgCpu,
      peakMemory,
      sampleCount: performanceHistory.length,
      duration: performanceHistory.length > 0 ? 
        performanceHistory[performanceHistory.length - 1].timestamp.getTime() - performanceHistory[0].timestamp.getTime()
        : 0
    }
  }, [performanceHistory])

  // Apply optimization suggestion
  const applyOptimizationSuggestion = useCallback((suggestion: OptimizationSuggestion) => {
    // This would typically update application settings based on the suggestion
    console.log('Applying optimization suggestion:', suggestion)
    // In a real implementation, this might update model parameters or system settings
  }, [])

  // View mode tabs configuration
  const viewTabs = [
    { id: 'realtime' as const, label: 'Real-Time', icon: '📊', description: 'Live performance metrics' },
    { id: 'charts' as const, label: 'Analysis', icon: '📈', description: 'Historical performance charts' },
    { id: 'recommendations' as const, label: 'Optimize', icon: '🚀', description: 'Performance recommendations', badge: optimizationSuggestions.length > 0 ? optimizationSuggestions.length.toString() : undefined },
    { id: 'comparison' as const, label: 'Compare', icon: '⚖️', description: 'Session comparison' }
  ]

  return (
    <div className={styles.performanceMonitoringPanel}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Performance Monitoring</h2>
          <p className={styles.subtitle}>
            Real-time monitoring and optimization for 3D generation performance
          </p>
        </div>

        <div className={styles.headerControls}>
          {performanceHealth && (
            <div className={`${styles.healthIndicator} ${styles[performanceHealth.severity]}`}>
              <div className={styles.healthIcon}>
                {performanceHealth.isHealthy ? '✅' : 
                 performanceHealth.severity === 'high' ? '🔴' : 
                 performanceHealth.severity === 'medium' ? '🟡' : '🟢'}
              </div>
              <div className={styles.healthStatus}>
                <span className={styles.healthLabel}>
                  {performanceHealth.isHealthy ? 'Healthy' : `${performanceHealth.issues.length} issues`}
                </span>
                {!performanceHealth.isHealthy && (
                  <span className={styles.healthDetails}>
                    {performanceHealth.severity} severity
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={styles.monitoringControls}>
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              disabled={!testId}
              className={`${styles.monitoringButton} ${isMonitoring ? styles.stop : styles.start}`}
            >
              {isMonitoring ? '⏸️ Stop' : '▶️ Start'}
            </button>
            <button
              onClick={() => setIsConfigPanelOpen(true)}
              className={styles.configButton}
              title="Monitoring Configuration"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <div className={styles.alertsBar}>
          <div className={styles.alertsHeader}>
            <span className={styles.alertsTitle}>
              ⚠️ Performance Alerts ({activeAlerts.length})
            </span>
            <button onClick={clearAllAlerts} className={styles.clearAlertsButton}>
              Clear All
            </button>
          </div>
          <div className={styles.alertsList}>
            {activeAlerts.map(alert => (
              <div key={alert.id} className={`${styles.alert} ${styles[alert.severity]}`}>
                <div className={styles.alertContent}>
                  <span className={styles.alertMessage}>{alert.message}</span>
                  <span className={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className={styles.dismissAlertButton}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {monitoringStats && (
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{monitoringStats.avgMemory.toFixed(1)}MB</span>
            <span className={styles.statLabel}>Avg Memory</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{monitoringStats.avgCpu.toFixed(1)}%</span>
            <span className={styles.statLabel}>Avg CPU</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{monitoringStats.peakMemory.toFixed(1)}MB</span>
            <span className={styles.statLabel}>Peak Memory</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{monitoringStats.sampleCount}</span>
            <span className={styles.statLabel}>Samples</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{(monitoringStats.duration / 1000).toFixed(1)}s</span>
            <span className={styles.statLabel}>Duration</span>
          </div>
        </div>
      )}

      <div className={styles.tabNavigation}>
        {viewTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`${styles.tabButton} ${viewMode === tab.id ? styles.active : ''}`}
            title={tab.description}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.badge && <span className={styles.tabBadge}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {viewMode === 'realtime' && (
          <div className={styles.realtimeView}>
            <RealTimeMetrics
              testId={testId}
              isMonitoring={isMonitoring}
              updateInterval={monitoringConfig.samplingInterval}
              thresholds={monitoringConfig.thresholds}
              onThresholdExceeded={monitoringConfig.enableAlerts ? handleThresholdExceeded : undefined}
            />
          </div>
        )}

        {viewMode === 'charts' && (
          <div className={styles.chartsView}>
            <div className={styles.chartsControls}>
              <div className={styles.exportControls}>
                <span>Export Data:</span>
                <button 
                  onClick={() => exportPerformanceData('json')}
                  disabled={performanceHistory.length === 0}
                  className={styles.exportButton}
                >
                  JSON
                </button>
                <button 
                  onClick={() => exportPerformanceData('csv')}
                  disabled={performanceHistory.length === 0}
                  className={styles.exportButton}
                >
                  CSV
                </button>
              </div>
            </div>
            <PerformanceCharts
              testSession={currentSession}
              chartHeight={400}
              showComparison={false}
            />
          </div>
        )}

        {viewMode === 'recommendations' && (
          <div className={styles.recommendationsView}>
            <div className={styles.recommendationsHeader}>
              <h3>Performance Optimization Recommendations</h3>
              <button
                onClick={generateOptimizationSuggestions}
                disabled={performanceHistory.length < 3}
                className={styles.refreshRecommendationsButton}
              >
                🔄 Refresh
              </button>
            </div>

            {performanceHistory.length < 3 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📊</div>
                <h4>Insufficient Data</h4>
                <p>Run some tests to collect performance data for optimization recommendations.</p>
              </div>
            ) : optimizationSuggestions.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✅</div>
                <h4>Performance Looks Good</h4>
                <p>No specific optimization recommendations at this time. Your current performance is acceptable.</p>
              </div>
            ) : (
              <div className={styles.suggestionsList}>
                {optimizationSuggestions.map((suggestion, index) => (
                  <div key={index} className={`${styles.suggestionCard} ${styles[suggestion.category]} ${styles[suggestion.priority]}`}>
                    <div className={styles.suggestionHeader}>
                      <div className={styles.suggestionTitle}>
                        <span className={styles.categoryIcon}>
                          {suggestion.category === 'memory' ? '💾' : 
                           suggestion.category === 'cpu' ? '⚡' : 
                           suggestion.category === 'time' ? '⏱️' : '🎯'}
                        </span>
                        <span className={styles.categoryName}>
                          {suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1)} Optimization
                        </span>
                        <span className={`${styles.priorityBadge} ${styles[suggestion.priority]}`}>
                          {suggestion.priority} priority
                        </span>
                      </div>
                    </div>
                    
                    <div className={styles.suggestionContent}>
                      <p className={styles.suggestionText}>
                        {suggestion.suggestion}
                      </p>
                      <div className={styles.expectedImprovement}>
                        <strong>Expected improvement:</strong> {suggestion.expectedImprovement}
                      </div>
                    </div>

                    <div className={styles.suggestionActions}>
                      <button
                        onClick={() => applyOptimizationSuggestion(suggestion)}
                        className={styles.applySuggestionButton}
                      >
                        Apply Suggestion
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'comparison' && (
          <div className={styles.comparisonView}>
            <div className={styles.comparisonControls}>
              <h3>Session Comparison</h3>
              <select
                value={comparisonSession?.id || ''}
                onChange={(e) => {
                  const sessionId = e.target.value
                  // In a real implementation, you'd fetch the session by ID
                  setComparisonSession(null) // Placeholder
                }}
                className={styles.sessionSelect}
              >
                <option value="">Select session to compare...</option>
                {/* In real implementation, populate with available sessions */}
              </select>
            </div>
            
            {comparisonSession ? (
              <PerformanceCharts
                testSession={currentSession}
                showComparison={true}
                chartHeight={350}
              />
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>⚖️</div>
                <h4>Select Session to Compare</h4>
                <p>Choose a previous test session to compare performance metrics.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Panel Modal */}
      {isConfigPanelOpen && (
        <div className={styles.configModal}>
          <div className={styles.configPanel}>
            <div className={styles.configHeader}>
              <h3>Monitoring Configuration</h3>
              <button
                onClick={() => setIsConfigPanelOpen(false)}
                className={styles.closeConfigButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.configContent}>
              <div className={styles.configSection}>
                <label>
                  Sampling Interval (ms):
                  <input
                    type="number"
                    value={monitoringConfig.samplingInterval}
                    onChange={(e) => setMonitoringConfig(prev => ({
                      ...prev,
                      samplingInterval: Math.max(100, parseInt(e.target.value) || 100)
                    }))}
                    min="100"
                    max="5000"
                    step="100"
                    className={styles.configInput}
                  />
                </label>
              </div>

              <div className={styles.configSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={monitoringConfig.enableAlerts}
                    onChange={(e) => setMonitoringConfig(prev => ({
                      ...prev,
                      enableAlerts: e.target.checked
                    }))}
                  />
                  Enable Performance Alerts
                </label>
              </div>

              <div className={styles.configSection}>
                <h4>Alert Thresholds</h4>
                <div className={styles.thresholdInputs}>
                  <label>
                    Memory Warning (MB):
                    <input
                      type="number"
                      value={monitoringConfig.thresholds.memoryWarning}
                      onChange={(e) => setMonitoringConfig(prev => ({
                        ...prev,
                        thresholds: {
                          ...prev.thresholds,
                          memoryWarning: Math.max(50, parseInt(e.target.value) || 50)
                        }
                      }))}
                      className={styles.configInput}
                    />
                  </label>
                  <label>
                    Memory Critical (MB):
                    <input
                      type="number"
                      value={monitoringConfig.thresholds.memoryCritical}
                      onChange={(e) => setMonitoringConfig(prev => ({
                        ...prev,
                        thresholds: {
                          ...prev.thresholds,
                          memoryCritical: Math.max(100, parseInt(e.target.value) || 100)
                        }
                      }))}
                      className={styles.configInput}
                    />
                  </label>
                  <label>
                    CPU Warning (%):
                    <input
                      type="number"
                      value={monitoringConfig.thresholds.cpuWarning}
                      onChange={(e) => setMonitoringConfig(prev => ({
                        ...prev,
                        thresholds: {
                          ...prev.thresholds,
                          cpuWarning: Math.max(10, Math.min(100, parseInt(e.target.value) || 10))
                        }
                      }))}
                      className={styles.configInput}
                    />
                  </label>
                  <label>
                    CPU Critical (%):
                    <input
                      type="number"
                      value={monitoringConfig.thresholds.cpuCritical}
                      onChange={(e) => setMonitoringConfig(prev => ({
                        ...prev,
                        thresholds: {
                          ...prev.thresholds,
                          cpuCritical: Math.max(10, Math.min(100, parseInt(e.target.value) || 10))
                        }
                      }))}
                      className={styles.configInput}
                    />
                  </label>
                </div>
              </div>

              <div className={styles.configActions}>
                <button
                  onClick={() => setIsConfigPanelOpen(false)}
                  className={styles.saveConfigButton}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceMonitoringPanel