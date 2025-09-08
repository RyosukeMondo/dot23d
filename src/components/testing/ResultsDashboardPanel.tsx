import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { TestStatistics } from './TestStatistics'
import { TrendAnalysis } from './TrendAnalysis'
import { ReportGenerator } from './ReportGenerator'
import { TestSessionService } from '@/services/TestSessionService'
import type { 
  TestSession, 
  TestResult, 
  ReportConfig,
  GeneratedReport
} from '@/types'
import styles from './ResultsDashboardPanel.module.css'

export interface ResultsDashboardPanelProps {
  /** Current test session */
  testSession?: TestSession
  /** Available test sessions for analysis */
  availableSessions?: TestSession[]
  /** Callback when a session is selected for detailed view */
  onSessionSelect?: (session: TestSession) => void
  /** Callback when a report is generated */
  onReportGenerated?: (report: GeneratedReport) => void
  /** Default time range for analysis */
  defaultTimeRange?: '1d' | '7d' | '30d' | 'all'
}

type DashboardView = 'overview' | 'statistics' | 'trends' | 'reports' | 'detailed'

interface FilterConfig {
  timeRange: '1d' | '7d' | '30d' | 'all'
  sessionIds: string[]
  minQualityScore: number
  maxProcessingTime: number
  successOnly: boolean
  patterns: string[]
  dateRange?: {
    start: Date
    end: Date
  }
}

interface DrillDownContext {
  type: 'failure' | 'quality' | 'performance' | 'pattern'
  category: string
  relatedResults: TestResult[]
}

export const ResultsDashboardPanel: React.FC<ResultsDashboardPanelProps> = ({
  testSession,
  availableSessions = [],
  onSessionSelect,
  onReportGenerated,
  defaultTimeRange = '7d'
}) => {
  const { state } = useAppContext()
  const [currentView, setCurrentView] = useState<DashboardView>('overview')
  const [selectedSessions, setSelectedSessions] = useState<TestSession[]>([])
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    timeRange: defaultTimeRange,
    sessionIds: [],
    minQualityScore: 0,
    maxProcessingTime: 60000, // 60 seconds
    successOnly: false,
    patterns: []
  })
  const [drillDownContext, setDrillDownContext] = useState<DrillDownContext | null>(null)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'success' | 'quality' | 'time'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const currentSession = testSession || state.testSession
  const allSessions = availableSessions.length > 0 ? availableSessions : 
    currentSession ? [currentSession] : []

  // Combine all test results from selected sessions
  const allTestResults = useMemo(() => {
    const sessionsToAnalyze = selectedSessions.length > 0 ? selectedSessions : allSessions
    return sessionsToAnalyze.flatMap(session => 
      session.testResults.map(result => ({
        ...result,
        sessionId: session.id,
        sessionName: session.name
      }))
    )
  }, [selectedSessions, allSessions])

  // Apply filters to test results
  const filteredResults = useMemo(() => {
    let results = allTestResults

    // Time range filter
    const now = new Date()
    let timeThreshold: Date | null = null
    switch (filterConfig.timeRange) {
      case '1d':
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    if (timeThreshold) {
      results = results.filter(result => result.timestamp >= timeThreshold!)
    }

    // Date range filter (if specified)
    if (filterConfig.dateRange) {
      results = results.filter(result => 
        result.timestamp >= filterConfig.dateRange!.start &&
        result.timestamp <= filterConfig.dateRange!.end
      )
    }

    // Quality score filter
    if (filterConfig.minQualityScore > 0) {
      results = results.filter(result => result.qualityScore >= filterConfig.minQualityScore)
    }

    // Processing time filter
    results = results.filter(result => result.processingTime <= filterConfig.maxProcessingTime)

    // Success only filter
    if (filterConfig.successOnly) {
      results = results.filter(result => result.success)
    }

    // Pattern filter
    if (filterConfig.patterns.length > 0) {
      results = results.filter(result => {
        const patternSize = `${result.pattern.width}x${result.pattern.height}`
        return filterConfig.patterns.some(pattern => 
          patternSize.includes(pattern) || pattern.includes(patternSize)
        )
      })
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      results = results.filter(result => 
        result.id.toLowerCase().includes(query) ||
        (result.error && result.error.toLowerCase().includes(query)) ||
        result.warnings.some(warning => warning.toLowerCase().includes(query))
      )
    }

    // Session filter
    if (filterConfig.sessionIds.length > 0) {
      results = results.filter(result => 
        filterConfig.sessionIds.includes((result as any).sessionId)
      )
    }

    return results
  }, [allTestResults, filterConfig, searchQuery])

  // Sort filtered results
  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults]
    
    sorted.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = a.timestamp.getTime() - b.timestamp.getTime()
          break
        case 'success':
          comparison = (a.success ? 1 : 0) - (b.success ? 1 : 0)
          break
        case 'quality':
          comparison = a.qualityScore - b.qualityScore
          break
        case 'time':
          comparison = a.processingTime - b.processingTime
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return sorted
  }, [filteredResults, sortBy, sortOrder])

  // Initialize with current session if available
  useEffect(() => {
    if (allSessions.length > 0 && selectedSessions.length === 0) {
      setSelectedSessions([allSessions[0]])
      setFilterConfig(prev => ({
        ...prev,
        sessionIds: [allSessions[0].id]
      }))
    }
  }, [allSessions, selectedSessions.length])

  // Handle session selection change
  const handleSessionSelectionChange = useCallback((sessionIds: string[]) => {
    const sessions = allSessions.filter(session => sessionIds.includes(session.id))
    setSelectedSessions(sessions)
    setFilterConfig(prev => ({ ...prev, sessionIds }))
  }, [allSessions])

  // Handle drill-down action
  const handleDrillDown = useCallback((context: DrillDownContext) => {
    setDrillDownContext(context)
    setCurrentView('detailed')
  }, [])

  // Handle report generation
  const handleReportGeneration = useCallback(async (config: ReportConfig) => {
    try {
      // In a real implementation, this would use the ReportGenerator service
      const report: GeneratedReport = {
        id: `report-${Date.now()}`,
        name: `Dashboard Report - ${new Date().toLocaleDateString()}`,
        generatedAt: new Date(),
        format: 'html',
        content: JSON.stringify(filteredResults, null, 2), // Simplified content
        size: filteredResults.length * 1024 // Rough estimate
      }

      onReportGenerated?.(report)
      return report
    } catch (error) {
      console.error('Failed to generate report:', error)
      throw error
    }
  }, [filteredResults, onReportGenerated])

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilterConfig({
      timeRange: '7d',
      sessionIds: allSessions.length > 0 ? [allSessions[0].id] : [],
      minQualityScore: 0,
      maxProcessingTime: 60000,
      successOnly: false,
      patterns: []
    })
    setSearchQuery('')
    setSortBy('date')
    setSortOrder('desc')
  }, [allSessions])

  // Export current view data
  const exportData = useCallback((format: 'json' | 'csv') => {
    const data = format === 'json' 
      ? JSON.stringify(sortedResults, null, 2)
      : convertToCSV(sortedResults)
    
    const blob = new Blob([data], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard-results-${new Date().toISOString().split('T')[0]}.${format}`
    link.click()
    
    URL.revokeObjectURL(url)
  }, [sortedResults])

  // Convert results to CSV format
  const convertToCSV = (results: TestResult[]): string => {
    const headers = [
      'Test ID', 'Timestamp', 'Success', 'Quality Score', 'Processing Time (ms)',
      'Pattern Size', 'Vertex Count', 'Face Count', 'Error', 'Session'
    ]
    
    const rows = results.map(result => [
      result.id,
      result.timestamp.toISOString(),
      result.success.toString(),
      result.qualityScore.toString(),
      result.processingTime.toString(),
      `${result.pattern.width}x${result.pattern.height}`,
      result.meshStats.vertexCount.toString(),
      result.meshStats.faceCount.toString(),
      result.error || '',
      (result as any).sessionName || ''
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  // Dashboard views configuration
  const dashboardViews = [
    { 
      id: 'overview' as const, 
      label: 'Overview', 
      icon: '📊', 
      description: 'High-level dashboard summary' 
    },
    { 
      id: 'statistics' as const, 
      label: 'Statistics', 
      icon: '📈', 
      description: 'Detailed test statistics and metrics' 
    },
    { 
      id: 'trends' as const, 
      label: 'Trends', 
      icon: '📉', 
      description: 'Performance trends and predictions' 
    },
    { 
      id: 'reports' as const, 
      label: 'Reports', 
      icon: '📄', 
      description: 'Generate and export custom reports' 
    },
    { 
      id: 'detailed' as const, 
      label: 'Details', 
      icon: '🔍', 
      description: 'Detailed analysis and drill-down view',
      badge: drillDownContext ? '1' : undefined
    }
  ]

  // Quick stats for overview
  const quickStats = useMemo(() => {
    const total = filteredResults.length
    const successful = filteredResults.filter(r => r.success).length
    const avgQuality = total > 0 
      ? filteredResults.reduce((sum, r) => sum + r.qualityScore, 0) / total 
      : 0
    const avgTime = total > 0 
      ? filteredResults.reduce((sum, r) => sum + r.processingTime, 0) / total 
      : 0

    return { total, successful, avgQuality, avgTime }
  }, [filteredResults])

  return (
    <div className={styles.resultsDashboardPanel}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Results Dashboard</h2>
          <p className={styles.subtitle}>
            Comprehensive analysis and reporting for test results and performance metrics
          </p>
        </div>

        <div className={styles.headerControls}>
          <div className={styles.quickStats}>
            <div className={styles.quickStat}>
              <span className={styles.statValue}>{quickStats.total}</span>
              <span className={styles.statLabel}>Total Tests</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.statValue}>
                {quickStats.total > 0 ? Math.round((quickStats.successful / quickStats.total) * 100) : 0}%
              </span>
              <span className={styles.statLabel}>Success Rate</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.statValue}>{quickStats.avgQuality.toFixed(1)}</span>
              <span className={styles.statLabel}>Avg Quality</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.statValue}>{quickStats.avgTime.toFixed(0)}ms</span>
              <span className={styles.statLabel}>Avg Time</span>
            </div>
          </div>

          <div className={styles.controlButtons}>
            <button
              onClick={() => setIsFilterPanelOpen(true)}
              className={styles.filterButton}
            >
              🔍 Filters
              {(filterConfig.minQualityScore > 0 || filterConfig.successOnly || searchQuery) && (
                <span className={styles.filterBadge}>!</span>
              )}
            </button>
            <button onClick={clearFilters} className={styles.clearButton}>
              Clear
            </button>
            <div className={styles.exportButtons}>
              <button onClick={() => exportData('json')} className={styles.exportButton}>
                JSON
              </button>
              <button onClick={() => exportData('csv')} className={styles.exportButton}>
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="Search tests by ID, error, or warning..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.sortSection}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="date">Sort by Date</option>
            <option value="success">Sort by Success</option>
            <option value="quality">Sort by Quality</option>
            <option value="time">Sort by Time</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className={styles.sortOrderButton}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className={styles.viewTabs}>
        {dashboardViews.map(view => (
          <button
            key={view.id}
            onClick={() => setCurrentView(view.id)}
            className={`${styles.viewTab} ${currentView === view.id ? styles.active : ''}`}
            title={view.description}
          >
            <span className={styles.viewIcon}>{view.icon}</span>
            <span className={styles.viewLabel}>{view.label}</span>
            {view.badge && <span className={styles.viewBadge}>{view.badge}</span>}
          </button>
        ))}
      </div>

      <div className={styles.viewContent}>
        {currentView === 'overview' && (
          <div className={styles.overviewView}>
            <div className={styles.overviewGrid}>
              <div className={styles.statisticsPreview}>
                <TestStatistics
                  sessions={selectedSessions}
                  showTrends={false}
                  showFailureAnalysis={true}
                />
              </div>
              <div className={styles.trendsPreview}>
                <TrendAnalysis
                  sessions={selectedSessions}
                  showPredictions={false}
                  showRecommendations={true}
                />
              </div>
            </div>
          </div>
        )}

        {currentView === 'statistics' && (
          <div className={styles.statisticsView}>
            <TestStatistics
              sessions={selectedSessions}
              showTrends={true}
              showFailureAnalysis={true}
              onExportReport={(report) => console.log('Statistics report:', report)}
            />
          </div>
        )}

        {currentView === 'trends' && (
          <div className={styles.trendsView}>
            <TrendAnalysis
              sessions={selectedSessions}
              showPredictions={true}
              showRecommendations={true}
              onTrendDetected={(trend) => console.log('Trend detected:', trend)}
              onPredictionUpdate={(prediction) => console.log('Prediction update:', prediction)}
            />
          </div>
        )}

        {currentView === 'reports' && (
          <div className={styles.reportsView}>
            <ReportGenerator
              availableSessions={selectedSessions}
              availableResults={sortedResults}
              onReportGenerated={handleReportGeneration}
            />
          </div>
        )}

        {currentView === 'detailed' && (
          <div className={styles.detailedView}>
            {drillDownContext ? (
              <div className={styles.drillDownView}>
                <div className={styles.drillDownHeader}>
                  <h3>Detailed Analysis: {drillDownContext.category}</h3>
                  <button
                    onClick={() => setDrillDownContext(null)}
                    className={styles.closeDrillDownButton}
                  >
                    ← Back to Overview
                  </button>
                </div>
                <div className={styles.drillDownContent}>
                  <div className={styles.relatedResults}>
                    <h4>Related Test Results ({drillDownContext.relatedResults.length})</h4>
                    <div className={styles.resultsList}>
                      {drillDownContext.relatedResults.map(result => (
                        <div key={result.id} className={styles.resultCard}>
                          <div className={styles.resultHeader}>
                            <span className={styles.resultId}>{result.id}</span>
                            <span className={`${styles.resultStatus} ${result.success ? styles.success : styles.failure}`}>
                              {result.success ? '✅' : '❌'}
                            </span>
                          </div>
                          <div className={styles.resultDetails}>
                            <span>Quality: {result.qualityScore}</span>
                            <span>Time: {result.processingTime}ms</span>
                            <span>Pattern: {result.pattern.width}×{result.pattern.height}</span>
                          </div>
                          {result.error && (
                            <div className={styles.resultError}>
                              {result.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noSelection}>
                <div className={styles.noSelectionIcon}>🔍</div>
                <h3>Detailed Analysis</h3>
                <p>Select a category from statistics or trends to view detailed analysis</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel Modal */}
      {isFilterPanelOpen && (
        <div className={styles.filterModal}>
          <div className={styles.filterPanel}>
            <div className={styles.filterHeader}>
              <h3>Filter Configuration</h3>
              <button
                onClick={() => setIsFilterPanelOpen(false)}
                className={styles.closeFilterButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.filterContent}>
              <div className={styles.filterSection}>
                <label>Time Range:</label>
                <select
                  value={filterConfig.timeRange}
                  onChange={(e) => setFilterConfig(prev => ({
                    ...prev,
                    timeRange: e.target.value as any
                  }))}
                  className={styles.filterSelect}
                >
                  <option value="1d">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div className={styles.filterSection}>
                <label>
                  Minimum Quality Score:
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={filterConfig.minQualityScore}
                    onChange={(e) => setFilterConfig(prev => ({
                      ...prev,
                      minQualityScore: parseFloat(e.target.value)
                    }))}
                    className={styles.filterRange}
                  />
                  <span>{filterConfig.minQualityScore}</span>
                </label>
              </div>

              <div className={styles.filterSection}>
                <label>
                  Maximum Processing Time (ms):
                  <input
                    type="number"
                    value={filterConfig.maxProcessingTime}
                    onChange={(e) => setFilterConfig(prev => ({
                      ...prev,
                      maxProcessingTime: parseInt(e.target.value) || 0
                    }))}
                    className={styles.filterInput}
                    min="0"
                  />
                </label>
              </div>

              <div className={styles.filterSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filterConfig.successOnly}
                    onChange={(e) => setFilterConfig(prev => ({
                      ...prev,
                      successOnly: e.target.checked
                    }))}
                  />
                  Show only successful tests
                </label>
              </div>

              <div className={styles.filterSection}>
                <label>Sessions to Include:</label>
                <div className={styles.sessionCheckboxes}>
                  {allSessions.map(session => (
                    <label key={session.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={filterConfig.sessionIds.includes(session.id)}
                        onChange={(e) => {
                          const sessionIds = e.target.checked
                            ? [...filterConfig.sessionIds, session.id]
                            : filterConfig.sessionIds.filter(id => id !== session.id)
                          setFilterConfig(prev => ({ ...prev, sessionIds }))
                          handleSessionSelectionChange(sessionIds)
                        }}
                      />
                      {session.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.filterActions}>
                <button onClick={clearFilters} className={styles.clearFiltersButton}>
                  Clear All Filters
                </button>
                <button
                  onClick={() => setIsFilterPanelOpen(false)}
                  className={styles.applyFiltersButton}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsDashboardPanel