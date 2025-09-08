import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { TestSessionService } from '@/services/TestSessionService'
import type { TestSession, TestResult, QualityReport } from '@/types'
import styles from './TestStatistics.module.css'

interface TestStatisticsProps {
  sessionId?: string
  sessions?: TestSession[]
  onSessionSelect?: (sessionId: string) => void
  onExportReport?: (report: StatisticsReport) => void
  showTrends?: boolean
  showFailureAnalysis?: boolean
  refreshInterval?: number
}

interface StatisticsData {
  totalTests: number
  successRate: number
  averageScore: number
  failureCategories: { [category: string]: number }
  trends: Array<{
    date: Date
    successRate: number
    averageScore: number
    testCount: number
  }>
  topFailures: Array<{
    reason: string
    count: number
    percentage: number
    examples: string[]
  }>
  qualityDistribution: {
    excellent: number // 90-100
    good: number      // 70-89
    fair: number      // 50-69
    poor: number      // 0-49
  }
  performanceMetrics: {
    averageGenerationTime: number
    averageFileSize: number
    successfulExports: number
    failedExports: number
  }
}

interface StatisticsReport {
  generatedAt: Date
  sessionName?: string
  timeRange: { start: Date; end: Date }
  summary: StatisticsData
  recommendations: string[]
  insights: string[]
}

export const TestStatistics: React.FC<TestStatisticsProps> = ({
  sessionId,
  sessions: externalSessions,
  onSessionSelect,
  onExportReport,
  showTrends = true,
  showFailureAnalysis = true,
  refreshInterval = 30000
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(sessionId)
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d' | 'all'>('24h')
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        if (externalSessions) {
          setSessions(externalSessions)
        } else {
          const loadedSessions = TestSessionService.getAllSessions()
          setSessions(loadedSessions)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [externalSessions])

  // Auto-refresh statistics
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(() => {
      setLastUpdated(new Date())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
    if (onSessionSelect) {
      onSessionSelect(sessionId)
    }
  }, [onSessionSelect])

  const filteredResults = useMemo(() => {
    const session = selectedSessionId 
      ? sessions.find(s => s.id === selectedSessionId)
      : null

    const allResults = session ? session.testResults : sessions.flatMap(s => s.testResults)
    
    if (timeRange === 'all') return allResults

    const now = new Date()
    const cutoff = new Date()
    
    switch (timeRange) {
      case '1h':
        cutoff.setHours(now.getHours() - 1)
        break
      case '24h':
        cutoff.setDate(now.getDate() - 1)
        break
      case '7d':
        cutoff.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoff.setDate(now.getDate() - 30)
        break
    }

    return allResults.filter(result => new Date(result.timestamp) >= cutoff)
  }, [sessions, selectedSessionId, timeRange])

  const statistics = useMemo((): StatisticsData => {
    if (filteredResults.length === 0) {
      return {
        totalTests: 0,
        successRate: 0,
        averageScore: 0,
        failureCategories: {},
        trends: [],
        topFailures: [],
        qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        performanceMetrics: {
          averageGenerationTime: 0,
          averageFileSize: 0,
          successfulExports: 0,
          failedExports: 0
        }
      }
    }

    const totalTests = filteredResults.length
    const successfulTests = filteredResults.filter(r => r.status === 'success').length
    const successRate = (successfulTests / totalTests) * 100

    // Calculate average quality score
    const testsWithQuality = filteredResults.filter(r => r.qualityReport)
    const averageScore = testsWithQuality.length > 0
      ? testsWithQuality.reduce((sum, r) => sum + r.qualityReport!.overallScore, 0) / testsWithQuality.length
      : 0

    // Categorize failures
    const failureCategories: { [category: string]: number } = {}
    const failedTests = filteredResults.filter(r => r.status === 'error')
    
    failedTests.forEach(test => {
      if (test.errorMessage) {
        let category = 'Unknown'
        const message = test.errorMessage.toLowerCase()
        
        if (message.includes('memory') || message.includes('heap')) {
          category = 'Memory Issues'
        } else if (message.includes('timeout')) {
          category = 'Timeout'
        } else if (message.includes('parameter')) {
          category = 'Parameter Validation'
        } else if (message.includes('geometry') || message.includes('mesh')) {
          category = 'Geometry Generation'
        } else if (message.includes('export')) {
          category = 'Export Failure'
        } else if (message.includes('quality')) {
          category = 'Quality Assessment'
        }
        
        failureCategories[category] = (failureCategories[category] || 0) + 1
      }
    })

    // Generate trends data (grouped by day for longer time ranges)
    const trends: Array<{ date: Date; successRate: number; averageScore: number; testCount: number }> = []
    
    if (showTrends && filteredResults.length > 0) {
      const groupedByDay: { [key: string]: TestResult[] } = {}
      
      filteredResults.forEach(result => {
        const date = new Date(result.timestamp)
        const dayKey = date.toISOString().split('T')[0]
        
        if (!groupedByDay[dayKey]) {
          groupedByDay[dayKey] = []
        }
        groupedByDay[dayKey].push(result)
      })

      Object.entries(groupedByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([dayKey, results]) => {
          const successful = results.filter(r => r.status === 'success').length
          const successRate = (successful / results.length) * 100
          
          const withQuality = results.filter(r => r.qualityReport)
          const avgScore = withQuality.length > 0
            ? withQuality.reduce((sum, r) => sum + r.qualityReport!.overallScore, 0) / withQuality.length
            : 0

          trends.push({
            date: new Date(dayKey),
            successRate,
            averageScore: avgScore,
            testCount: results.length
          })
        })
    }

    // Top failure reasons
    const topFailures = Object.entries(failureCategories)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / failedTests.length) * 100,
        examples: failedTests
          .filter(test => {
            const message = test.errorMessage?.toLowerCase() || ''
            return message.includes(reason.toLowerCase().split(' ')[0])
          })
          .slice(0, 3)
          .map(test => test.pattern?.name || 'Unknown Pattern')
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Quality distribution
    const qualityDistribution = {
      excellent: testsWithQuality.filter(r => r.qualityReport!.overallScore >= 90).length,
      good: testsWithQuality.filter(r => r.qualityReport!.overallScore >= 70 && r.qualityReport!.overallScore < 90).length,
      fair: testsWithQuality.filter(r => r.qualityReport!.overallScore >= 50 && r.qualityReport!.overallScore < 70).length,
      poor: testsWithQuality.filter(r => r.qualityReport!.overallScore < 50).length
    }

    // Performance metrics
    const testsWithTiming = filteredResults.filter(r => r.executionTime)
    const averageGenerationTime = testsWithTiming.length > 0
      ? testsWithTiming.reduce((sum, r) => sum + r.executionTime!, 0) / testsWithTiming.length
      : 0

    const testsWithFileSize = filteredResults.filter(r => r.outputFileSize)
    const averageFileSize = testsWithFileSize.length > 0
      ? testsWithFileSize.reduce((sum, r) => sum + r.outputFileSize!, 0) / testsWithFileSize.length
      : 0

    const successfulExports = filteredResults.filter(r => r.status === 'success' && r.outputFileSize).length
    const failedExports = filteredResults.filter(r => r.status === 'error' && r.errorMessage?.includes('export')).length

    return {
      totalTests,
      successRate,
      averageScore,
      failureCategories,
      trends,
      topFailures,
      qualityDistribution,
      performanceMetrics: {
        averageGenerationTime,
        averageFileSize,
        successfulExports,
        failedExports
      }
    }
  }, [filteredResults, showTrends, showFailureAnalysis])

  const generateReport = useCallback((): StatisticsReport => {
    const session = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : undefined
    
    // Generate insights
    const insights: string[] = []
    const recommendations: string[] = []

    if (statistics.successRate < 70) {
      insights.push(`Success rate is below average at ${statistics.successRate.toFixed(1)}%`)
      recommendations.push('Review common failure patterns and adjust parameter validation')
    }

    if (statistics.averageScore < 60) {
      insights.push(`Average quality score is low at ${statistics.averageScore.toFixed(1)}/100`)
      recommendations.push('Consider revising pattern generation algorithms or parameter ranges')
    }

    if (statistics.qualityDistribution.poor > statistics.qualityDistribution.excellent) {
      insights.push('More models have poor quality than excellent quality')
      recommendations.push('Focus on improving model generation quality before increasing test volume')
    }

    const topFailure = statistics.topFailures[0]
    if (topFailure && topFailure.percentage > 30) {
      insights.push(`${topFailure.reason} accounts for ${topFailure.percentage.toFixed(1)}% of failures`)
      recommendations.push(`Prioritize fixing ${topFailure.reason.toLowerCase()} issues`)
    }

    if (statistics.performanceMetrics.averageGenerationTime > 5000) {
      insights.push('Model generation is taking longer than optimal')
      recommendations.push('Consider optimizing generation algorithms or parameter complexity')
    }

    // Determine time range
    const now = new Date()
    let start = new Date()
    
    switch (timeRange) {
      case '1h':
        start.setHours(now.getHours() - 1)
        break
      case '24h':
        start.setDate(now.getDate() - 1)
        break
      case '7d':
        start.setDate(now.getDate() - 7)
        break
      case '30d':
        start.setDate(now.getDate() - 30)
        break
      case 'all':
        start = new Date(Math.min(...filteredResults.map(r => new Date(r.timestamp).getTime())))
        break
    }

    return {
      generatedAt: new Date(),
      sessionName: session?.name,
      timeRange: { start, end: now },
      summary: statistics,
      recommendations,
      insights
    }
  }, [statistics, selectedSessionId, sessions, timeRange, filteredResults])

  const handleExportReport = useCallback(() => {
    const report = generateReport()
    if (onExportReport) {
      onExportReport(report)
    }
  }, [generateReport, onExportReport])

  if (isLoading) {
    return (
      <div className={styles.testStatistics}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading statistics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.testStatistics}>
      <div className={styles.header}>
        <h3>Test Statistics</h3>
        <div className={styles.controls}>
          <div className={styles.sessionSelector}>
            <label>Session:</label>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => handleSessionSelect(e.target.value)}
              className={styles.sessionSelect}
            >
              <option value="">All Sessions</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.testResults.length} tests)
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.timeRangeSelector}>
            <label>Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className={styles.timeRangeSelect}
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button onClick={handleExportReport} className={styles.exportButton}>
            📊 Export Report
          </button>
        </div>
      </div>

      <div className={styles.lastUpdated}>
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      <div className={styles.content}>
        {filteredResults.length === 0 ? (
          <div className={styles.noData}>
            <p>No test data available for the selected time range</p>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className={styles.overviewStats}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statistics.totalTests}</div>
                <div className={styles.statLabel}>Total Tests</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${
                  statistics.successRate >= 90 ? styles.excellent :
                  statistics.successRate >= 70 ? styles.good :
                  statistics.successRate >= 50 ? styles.warning : styles.poor
                }`}>
                  {statistics.successRate.toFixed(1)}%
                </div>
                <div className={styles.statLabel}>Success Rate</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${
                  statistics.averageScore >= 80 ? styles.excellent :
                  statistics.averageScore >= 60 ? styles.good :
                  statistics.averageScore >= 40 ? styles.warning : styles.poor
                }`}>
                  {statistics.averageScore.toFixed(1)}
                </div>
                <div className={styles.statLabel}>Avg Quality Score</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {(statistics.performanceMetrics.averageGenerationTime / 1000).toFixed(1)}s
                </div>
                <div className={styles.statLabel}>Avg Generation Time</div>
              </div>
            </div>

            {/* Quality Distribution */}
            <div className={styles.qualityDistribution}>
              <h4>Quality Distribution</h4>
              <div className={styles.distributionChart}>
                {Object.entries(statistics.qualityDistribution).map(([level, count]) => {
                  const percentage = statistics.totalTests > 0 ? (count / statistics.totalTests) * 100 : 0
                  return (
                    <div key={level} className={styles.distributionBar}>
                      <div className={styles.distributionLabel}>
                        <span className={`${styles.distributionDot} ${styles[level]}`}></span>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </div>
                      <div className={styles.distributionProgress}>
                        <div 
                          className={`${styles.distributionFill} ${styles[level]}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className={styles.distributionValue}>
                        {count} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Failure Analysis */}
            {showFailureAnalysis && statistics.topFailures.length > 0 && (
              <div className={styles.failureAnalysis}>
                <h4>Top Failure Categories</h4>
                <div className={styles.failureList}>
                  {statistics.topFailures.map((failure, index) => (
                    <div key={failure.reason} className={styles.failureItem}>
                      <div className={styles.failureHeader}>
                        <span className={styles.failureRank}>#{index + 1}</span>
                        <span className={styles.failureReason}>{failure.reason}</span>
                        <span className={styles.failureCount}>
                          {failure.count} ({failure.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      {failure.examples.length > 0 && (
                        <div className={styles.failureExamples}>
                          <strong>Examples:</strong> {failure.examples.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trends Chart */}
            {showTrends && statistics.trends.length > 0 && (
              <div className={styles.trendsChart}>
                <h4>Success Rate Trend</h4>
                <div className={styles.chartContainer}>
                  <svg className={styles.chart} viewBox="0 0 800 200">
                    {/* Chart implementation would go here */}
                    {/* For now, showing a simplified version */}
                    <text x="400" y="100" textAnchor="middle" className={styles.chartPlaceholder}>
                      Trends chart visualization ({statistics.trends.length} data points)
                    </text>
                  </svg>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            <div className={styles.performanceMetrics}>
              <h4>Performance Overview</h4>
              <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>Successful Exports</div>
                  <div className={styles.metricValue}>
                    {statistics.performanceMetrics.successfulExports}
                  </div>
                </div>
                
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>Failed Exports</div>
                  <div className={styles.metricValue}>
                    {statistics.performanceMetrics.failedExports}
                  </div>
                </div>
                
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>Avg File Size</div>
                  <div className={styles.metricValue}>
                    {(statistics.performanceMetrics.averageFileSize / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TestStatistics