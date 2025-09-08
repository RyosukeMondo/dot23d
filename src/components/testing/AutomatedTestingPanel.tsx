import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { TestSuiteManager } from './TestSuiteManager'
import { ContinuousIntegration } from './ContinuousIntegration'
import { TestSessionService } from '@/services/TestSessionService'
import type { 
  TestSuite, 
  TestSuiteResult, 
  CIReport,
  DotPattern,
  Model3DParams
} from '@/types'
import styles from './AutomatedTestingPanel.module.css'

export interface AutomatedTestingPanelProps {
  /** Available patterns for automated testing */
  availablePatterns?: DotPattern[]
  /** Available parameter presets */
  availableParams?: Model3DParams[]
  /** Callback when automated test completes */
  onAutomatedTestComplete?: (result: TestSuiteResult) => void
  /** Callback when CI report is generated */
  onCIReportGenerated?: (report: CIReport) => void
}

type PanelView = 'suites' | 'ci' | 'scheduling' | 'history' | 'monitoring'

interface ScheduledTest {
  id: string
  name: string
  suiteId: string
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron'
    time?: string
    days?: string[]
    cronExpression?: string
  }
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
  results: TestSuiteResult[]
}

interface AutomationSettings {
  maxConcurrentTests: number
  testTimeout: number
  retryFailedTests: boolean
  maxRetries: number
  generateReportsAutomatically: boolean
  notificationSettings: {
    email: string[]
    webhook?: string
    onFailure: boolean
    onSuccess: boolean
  }
}

export const AutomatedTestingPanel: React.FC<AutomatedTestingPanelProps> = ({
  availablePatterns = [],
  availableParams = [],
  onAutomatedTestComplete,
  onCIReportGenerated
}) => {
  const { state } = useAppContext()
  const [currentView, setCurrentView] = useState<PanelView>('suites')
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([])
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    maxConcurrentTests: 3,
    testTimeout: 300000, // 5 minutes
    retryFailedTests: true,
    maxRetries: 2,
    generateReportsAutomatically: true,
    notificationSettings: {
      email: [],
      onFailure: true,
      onSuccess: false
    }
  })
  const [isRunning, setIsRunning] = useState(false)
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [testHistory, setTestHistory] = useState<TestSuiteResult[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load existing test suites
        const suites = await TestSessionService.getTestSuites()
        setTestSuites(suites || [])

        // Load scheduled tests from localStorage
        const savedSchedules = localStorage.getItem('dot23d-scheduled-tests')
        if (savedSchedules) {
          setScheduledTests(JSON.parse(savedSchedules))
        }

        // Load test history
        const history = await TestSessionService.getAutomatedTestHistory(50)
        setTestHistory(history || [])
      } catch (error) {
        console.error('Failed to load automation data:', error)
      }
    }

    loadData()
  }, [])

  // Save scheduled tests to localStorage when changed
  useEffect(() => {
    localStorage.setItem('dot23d-scheduled-tests', JSON.stringify(scheduledTests))
  }, [scheduledTests])

  // Handle test suite creation
  const handleSuiteCreated = useCallback((suite: TestSuite) => {
    setTestSuites(prev => [...prev, suite])
  }, [])

  // Handle test suite update
  const handleSuiteUpdated = useCallback((suite: TestSuite) => {
    setTestSuites(prev => prev.map(s => s.id === suite.id ? suite : s))
  }, [])

  // Handle test suite execution
  const handleSuiteExecuted = useCallback(async (result: TestSuiteResult) => {
    setTestHistory(prev => [result, ...prev.slice(0, 49)])
    onAutomatedTestComplete?.(result)

    // Generate CI report if enabled
    if (automationSettings.generateReportsAutomatically) {
      try {
        const ciReport: CIReport = {
          id: `ci-report-${Date.now()}`,
          timestamp: new Date(),
          testSuiteId: result.suiteId,
          result,
          status: result.success ? 'passed' : 'failed',
          duration: result.duration,
          summary: {
            total: result.testResults.length,
            passed: result.testResults.filter(r => r.success).length,
            failed: result.testResults.filter(r => !r.success).length,
            skipped: 0
          },
          artifacts: result.artifacts || [],
          environment: {
            system: 'web',
            browser: navigator.userAgent,
            timestamp: new Date()
          }
        }

        onCIReportGenerated?.(ciReport)
      } catch (error) {
        console.error('Failed to generate CI report:', error)
      }
    }
  }, [automationSettings.generateReportsAutomatically, onAutomatedTestComplete, onCIReportGenerated])

  // Run all active scheduled tests
  const runScheduledTests = useCallback(async () => {
    const activeSchedules = scheduledTests.filter(s => s.isActive && shouldRunNow(s))
    
    if (activeSchedules.length === 0) return

    setIsRunning(true)
    const newRunningTests = new Set(activeSchedules.map(s => s.id))
    setRunningTests(newRunningTests)

    try {
      const concurrentLimit = Math.min(automationSettings.maxConcurrentTests, activeSchedules.length)
      const batches = []
      
      for (let i = 0; i < activeSchedules.length; i += concurrentLimit) {
        batches.push(activeSchedules.slice(i, i + concurrentLimit))
      }

      for (const batch of batches) {
        const promises = batch.map(async (scheduled) => {
          const suite = testSuites.find(s => s.id === scheduled.suiteId)
          if (!suite) return

          try {
            const result = await TestSessionService.runTestSuite(suite.id, {
              timeout: automationSettings.testTimeout,
              retryFailedTests: automationSettings.retryFailedTests,
              maxRetries: automationSettings.maxRetries
            })

            // Update scheduled test with results
            setScheduledTests(prev => prev.map(s => 
              s.id === scheduled.id 
                ? { 
                    ...s, 
                    lastRun: new Date(),
                    nextRun: calculateNextRun(s.schedule),
                    results: [result, ...s.results.slice(0, 9)] // Keep last 10 results
                  }
                : s
            ))

            await handleSuiteExecuted(result)
          } catch (error) {
            console.error(`Scheduled test ${scheduled.id} failed:`, error)
          }
        })

        await Promise.all(promises)
      }
    } finally {
      setIsRunning(false)
      setRunningTests(new Set())
    }
  }, [scheduledTests, testSuites, automationSettings, handleSuiteExecuted])

  // Check if a scheduled test should run now
  const shouldRunNow = (scheduled: ScheduledTest): boolean => {
    if (!scheduled.nextRun) return false
    return new Date() >= scheduled.nextRun
  }

  // Calculate next run time for a schedule
  const calculateNextRun = (schedule: ScheduledTest['schedule']): Date => {
    const now = new Date()
    
    switch (schedule.type) {
      case 'once':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
      case 'daily':
        const daily = new Date(now)
        daily.setDate(daily.getDate() + 1)
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          daily.setHours(hours, minutes, 0, 0)
        }
        return daily
      case 'weekly':
        const weekly = new Date(now)
        weekly.setDate(weekly.getDate() + 7)
        return weekly
      case 'monthly':
        const monthly = new Date(now)
        monthly.setMonth(monthly.getMonth() + 1)
        return monthly
      default:
        return new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    }
  }

  // Create new scheduled test
  const createScheduledTest = useCallback((suiteId: string, schedule: ScheduledTest['schedule']) => {
    const suite = testSuites.find(s => s.id === suiteId)
    if (!suite) return

    const newScheduled: ScheduledTest = {
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Automated ${suite.name}`,
      suiteId,
      schedule,
      isActive: true,
      nextRun: calculateNextRun(schedule),
      results: []
    }

    setScheduledTests(prev => [...prev, newScheduled])
  }, [testSuites])

  // Toggle scheduled test status
  const toggleScheduledTest = useCallback((testId: string) => {
    setScheduledTests(prev => prev.map(t => 
      t.id === testId 
        ? { ...t, isActive: !t.isActive }
        : t
    ))
  }, [])

  // Delete scheduled test
  const deleteScheduledTest = useCallback((testId: string) => {
    setScheduledTests(prev => prev.filter(t => t.id !== testId))
  }, [])

  // Run scheduled tests manually
  const runScheduledTestsManually = useCallback(() => {
    runScheduledTests()
  }, [runScheduledTests])

  // Set up automatic scheduling check (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) {
        runScheduledTests()
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [runScheduledTests, isRunning])

  // Panel view configuration
  const panelViews = [
    { 
      id: 'suites' as const, 
      label: 'Test Suites', 
      icon: '📋',
      description: 'Manage test suites and automation configurations',
      count: testSuites.length
    },
    { 
      id: 'ci' as const, 
      label: 'CI/CD', 
      icon: '🔄',
      description: 'Continuous integration and deployment settings' 
    },
    { 
      id: 'scheduling' as const, 
      label: 'Scheduling', 
      icon: '⏰',
      description: 'Schedule automated test runs',
      count: scheduledTests.filter(s => s.isActive).length
    },
    { 
      id: 'history' as const, 
      label: 'History', 
      icon: '📊',
      description: 'Automated test execution history',
      count: testHistory.length
    },
    { 
      id: 'monitoring' as const, 
      label: 'Monitoring', 
      icon: '📈',
      description: 'Real-time monitoring and alerts' 
    }
  ]

  // Calculate automation statistics
  const automationStats = useMemo(() => {
    const activeSchedules = scheduledTests.filter(s => s.isActive).length
    const totalRuns = testHistory.length
    const successRate = totalRuns > 0 
      ? (testHistory.filter(r => r.success).length / totalRuns) * 100 
      : 0
    const avgDuration = totalRuns > 0 
      ? testHistory.reduce((sum, r) => sum + r.duration, 0) / totalRuns 
      : 0

    return { activeSchedules, totalRuns, successRate, avgDuration }
  }, [scheduledTests, testHistory])

  return (
    <div className={styles.automatedTestingPanel}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Automated Testing</h2>
          <p className={styles.subtitle}>
            Comprehensive test automation, scheduling, and continuous integration
          </p>
        </div>

        <div className={styles.headerControls}>
          <div className={styles.automationStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{automationStats.activeSchedules}</span>
              <span className={styles.statLabel}>Active Schedules</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{automationStats.totalRuns}</span>
              <span className={styles.statLabel}>Total Runs</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{automationStats.successRate.toFixed(1)}%</span>
              <span className={styles.statLabel}>Success Rate</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{(automationStats.avgDuration / 1000).toFixed(1)}s</span>
              <span className={styles.statLabel}>Avg Duration</span>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button
              onClick={runScheduledTestsManually}
              disabled={isRunning || scheduledTests.filter(s => s.isActive).length === 0}
              className={styles.runButton}
            >
              {isRunning ? 'Running...' : 'Run Scheduled'}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={styles.settingsButton}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className={styles.runningIndicator}>
          <div className={styles.runningText}>
            🔄 Running automated tests... ({runningTests.size} active)
          </div>
          <div className={styles.runningProgress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} />
            </div>
          </div>
        </div>
      )}

      <div className={styles.viewTabs}>
        {panelViews.map(view => (
          <button
            key={view.id}
            onClick={() => setCurrentView(view.id)}
            className={`${styles.viewTab} ${currentView === view.id ? styles.active : ''}`}
            title={view.description}
          >
            <span className={styles.viewIcon}>{view.icon}</span>
            <span className={styles.viewLabel}>{view.label}</span>
            {view.count !== undefined && (
              <span className={styles.viewCount}>({view.count})</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.viewContent}>
        {currentView === 'suites' && (
          <div className={styles.suitesView}>
            <TestSuiteManager
              availablePatterns={availablePatterns}
              availableParams={availableParams}
              onSuiteCreated={handleSuiteCreated}
              onSuiteUpdated={handleSuiteUpdated}
              onSuiteExecuted={handleSuiteExecuted}
            />
          </div>
        )}

        {currentView === 'ci' && (
          <div className={styles.ciView}>
            <ContinuousIntegration
              testSuites={testSuites}
              onReportGenerated={onCIReportGenerated}
            />
          </div>
        )}

        {currentView === 'scheduling' && (
          <div className={styles.schedulingView}>
            <div className={styles.schedulingHeader}>
              <h3>Scheduled Tests</h3>
              <button
                onClick={() => {
                  // In a real implementation, this would open a modal to create new scheduled test
                  const suiteId = testSuites[0]?.id
                  if (suiteId) {
                    createScheduledTest(suiteId, { type: 'daily', time: '09:00' })
                  }
                }}
                className={styles.createScheduleButton}
                disabled={testSuites.length === 0}
              >
                + Create Schedule
              </button>
            </div>

            <div className={styles.scheduledTestsList}>
              {scheduledTests.map(scheduled => (
                <div key={scheduled.id} className={styles.scheduledTestCard}>
                  <div className={styles.scheduledTestHeader}>
                    <div className={styles.scheduledTestInfo}>
                      <h4 className={styles.scheduledTestName}>{scheduled.name}</h4>
                      <span className={styles.scheduledTestSuite}>
                        {testSuites.find(s => s.id === scheduled.suiteId)?.name || 'Unknown Suite'}
                      </span>
                    </div>
                    <div className={styles.scheduledTestStatus}>
                      <span className={`${styles.statusBadge} ${scheduled.isActive ? styles.active : styles.inactive}`}>
                        {scheduled.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.scheduledTestDetails}>
                    <div className={styles.scheduleInfo}>
                      <span>Type: {scheduled.schedule.type}</span>
                      {scheduled.schedule.time && <span>Time: {scheduled.schedule.time}</span>}
                      {scheduled.lastRun && (
                        <span>Last Run: {scheduled.lastRun.toLocaleDateString()}</span>
                      )}
                      {scheduled.nextRun && (
                        <span>Next Run: {scheduled.nextRun.toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.scheduledTestActions}>
                    <button
                      onClick={() => toggleScheduledTest(scheduled.id)}
                      className={styles.toggleButton}
                    >
                      {scheduled.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteScheduledTest(scheduled.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {scheduledTests.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>⏰</div>
                <h4>No Scheduled Tests</h4>
                <p>Create automated test schedules to run tests at regular intervals.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'history' && (
          <div className={styles.historyView}>
            <div className={styles.historyHeader}>
              <h3>Automation History</h3>
              <div className={styles.historyFilters}>
                {/* Add filtering controls here */}
              </div>
            </div>

            <div className={styles.historyList}>
              {testHistory.map(result => (
                <div key={result.id} className={styles.historyCard}>
                  <div className={styles.historyHeader}>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyId}>{result.id}</span>
                      <span className={styles.historyTimestamp}>
                        {result.executedAt.toLocaleString()}
                      </span>
                    </div>
                    <div className={`${styles.historyStatus} ${result.success ? styles.success : styles.failure}`}>
                      {result.success ? '✅' : '❌'}
                    </div>
                  </div>
                  <div className={styles.historyDetails}>
                    <span>Duration: {(result.duration / 1000).toFixed(1)}s</span>
                    <span>Tests: {result.testResults.length}</span>
                    <span>Passed: {result.testResults.filter(r => r.success).length}</span>
                  </div>
                </div>
              ))}
            </div>

            {testHistory.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📊</div>
                <h4>No Test History</h4>
                <p>Automated test results will appear here once tests are executed.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'monitoring' && (
          <div className={styles.monitoringView}>
            <div className={styles.monitoringGrid}>
              <div className={styles.activeTests}>
                <h4>Active Tests</h4>
                <div className={styles.activeTestsList}>
                  {Array.from(runningTests).map(testId => (
                    <div key={testId} className={styles.activeTest}>
                      <span className={styles.testId}>{testId}</span>
                      <span className={styles.testStatus}>Running...</span>
                    </div>
                  ))}
                </div>
                {runningTests.size === 0 && (
                  <p className={styles.noActiveTests}>No tests currently running</p>
                )}
              </div>

              <div className={styles.upcomingTests}>
                <h4>Upcoming Tests</h4>
                <div className={styles.upcomingTestsList}>
                  {scheduledTests
                    .filter(s => s.isActive && s.nextRun)
                    .sort((a, b) => (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0))
                    .slice(0, 5)
                    .map(scheduled => (
                      <div key={scheduled.id} className={styles.upcomingTest}>
                        <span className={styles.testName}>{scheduled.name}</span>
                        <span className={styles.testTime}>
                          {scheduled.nextRun?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className={styles.settingsModal}>
          <div className={styles.settingsPanel}>
            <div className={styles.settingsHeader}>
              <h3>Automation Settings</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className={styles.closeSettingsButton}
              >
                ×
              </button>
            </div>

            <div className={styles.settingsContent}>
              <div className={styles.settingsSection}>
                <label>
                  Max Concurrent Tests:
                  <input
                    type="number"
                    value={automationSettings.maxConcurrentTests}
                    onChange={(e) => setAutomationSettings(prev => ({
                      ...prev,
                      maxConcurrentTests: Math.max(1, parseInt(e.target.value) || 1)
                    }))}
                    min="1"
                    max="10"
                    className={styles.settingsInput}
                  />
                </label>
              </div>

              <div className={styles.settingsSection}>
                <label>
                  Test Timeout (ms):
                  <input
                    type="number"
                    value={automationSettings.testTimeout}
                    onChange={(e) => setAutomationSettings(prev => ({
                      ...prev,
                      testTimeout: Math.max(1000, parseInt(e.target.value) || 1000)
                    }))}
                    min="1000"
                    className={styles.settingsInput}
                  />
                </label>
              </div>

              <div className={styles.settingsSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={automationSettings.retryFailedTests}
                    onChange={(e) => setAutomationSettings(prev => ({
                      ...prev,
                      retryFailedTests: e.target.checked
                    }))}
                  />
                  Retry Failed Tests
                </label>
              </div>

              <div className={styles.settingsSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={automationSettings.generateReportsAutomatically}
                    onChange={(e) => setAutomationSettings(prev => ({
                      ...prev,
                      generateReportsAutomatically: e.target.checked
                    }))}
                  />
                  Generate Reports Automatically
                </label>
              </div>

              <div className={styles.settingsActions}>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className={styles.saveSettingsButton}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutomatedTestingPanel