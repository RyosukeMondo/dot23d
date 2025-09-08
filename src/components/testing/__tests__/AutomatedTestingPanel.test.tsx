import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutomatedTestingPanel } from '../AutomatedTestingPanel'
import { TestSession, TestSuite, TestSuiteResult } from '@/types'

// Mock child components
vi.mock('../TestSuiteManager', () => ({
  TestSuiteManager: ({ onSuiteCreate, onSuiteRun }: any) => (
    <div data-testid="test-suite-manager">
      <button onClick={() => onSuiteCreate({ name: 'New Suite', tests: [] })}>Create Suite</button>
      <button onClick={() => onSuiteRun('suite-1')}>Run Suite</button>
    </div>
  )
}))

vi.mock('../ContinuousIntegration', () => ({
  ContinuousIntegration: ({ onCISetup, onWebhookCreate }: any) => (
    <div data-testid="continuous-integration">
      <button onClick={() => onCISetup({ platform: 'github' })}>Setup CI</button>
      <button onClick={() => onWebhookCreate({ url: 'webhook' })}>Create Webhook</button>
    </div>
  )
}))

const mockTestSession: TestSession = {
  id: 'test-session',
  name: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active',
  patterns: [
    {
      data: [[true, false], [false, true]],
      width: 2,
      height: 2,
      metadata: { filename: 'pattern1.csv' }
    }
  ],
  parameterSets: [
    { height: 5, depth: 2 } as any
  ],
  testResults: [],
  performanceMetrics: [],
  tags: [],
  notes: '',
  author: 'test-user'
}

const mockTestSuite: TestSuite = {
  id: 'suite-1',
  name: 'Regression Suite',
  description: 'Basic regression tests',
  tests: [
    {
      id: 'test-1',
      name: 'Basic Pattern Test',
      pattern: mockTestSession.patterns[0],
      parameters: mockTestSession.parameterSets[0] as any,
      expectations: {
        shouldSucceed: true,
        minQualityScore: 80,
        maxProcessingTime: 5000
      }
    }
  ],
  author: 'test-user',
  createdAt: new Date(),
  version: '1.0.0',
  settings: {
    timeout: 300000,
    failFast: false,
    parallel: true,
    maxParallel: 4
  }
}

const mockSuiteResult: TestSuiteResult = {
  suiteId: 'suite-1',
  timestamp: new Date(),
  success: true,
  testResults: [
    {
      id: 'result-1',
      testSessionId: 'test-session',
      timestamp: new Date(),
      pattern: mockTestSession.patterns[0],
      parameters: mockTestSession.parameterSets[0] as any,
      success: true,
      processingTime: 1500,
      meshStats: {
        vertexCount: 1000,
        faceCount: 2000,
        edgeCount: 3000,
        boundingBox: { width: 10, height: 5, depth: 2 },
        surfaceArea: 100,
        volume: 50,
        memoryUsage: 1024
      },
      qualityScore: 85,
      performanceMetrics: {
        memoryUsed: 150,
        cpuUsage: 45,
        generationSpeed: 500,
        elapsedTime: 1500
      },
      warnings: [],
      exportedFormats: []
    }
  ],
  statistics: {
    totalTests: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    totalTime: 1500
  },
  performanceSummary: {
    averageProcessingTime: 1500,
    peakMemoryUsage: 150,
    averageQualityScore: 85
  }
}

describe('AutomatedTestingPanel', () => {
  const mockOnSessionUpdate = vi.fn()
  const mockOnSuiteExecute = vi.fn()
  const mockOnCIIntegration = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render automated testing interface', () => {
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    expect(screen.getByText('Automated Testing')).toBeInTheDocument()
    expect(screen.getByText('Test Suites')).toBeInTheDocument()
    expect(screen.getByText('CI/CD Integration')).toBeInTheDocument()
    expect(screen.getByTestId('test-suite-manager')).toBeInTheDocument()
    expect(screen.getByTestId('continuous-integration')).toBeInTheDocument()
  })

  it('should display available test suites', () => {
    const sessionWithSuites = {
      ...mockTestSession,
      testSuites: [mockTestSuite]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSuites}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    expect(screen.getByText('Regression Suite')).toBeInTheDocument()
    expect(screen.getByText('1 test')).toBeInTheDocument()
    expect(screen.getByText('Version: 1.0.0')).toBeInTheDocument()
    expect(screen.getByText('Author: test-user')).toBeInTheDocument()
  })

  it('should handle suite creation', async () => {
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const createButton = screen.getByText('Create Suite')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuites: expect.arrayContaining([
            expect.objectContaining({ name: 'New Suite' })
          ])
        })
      )
    })
  })

  it('should handle suite execution', async () => {
    const sessionWithSuites = {
      ...mockTestSession,
      testSuites: [mockTestSuite]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSuites}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const runButton = screen.getByText('Run Suite')
    fireEvent.click(runButton)

    expect(mockOnSuiteExecute).toHaveBeenCalledWith('suite-1')
  })

  it('should show suite execution status', () => {
    const sessionWithRunning = {
      ...mockTestSession,
      testSuites: [mockTestSuite],
      activeSuiteExecution: {
        suiteId: 'suite-1',
        status: 'running',
        progress: 50,
        currentTest: 'test-1'
      }
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithRunning}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    expect(screen.getByText('Running: 50%')).toBeInTheDocument()
    expect(screen.getByText('Current: test-1')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should display suite results', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testSuites: [mockTestSuite],
      suiteResults: [mockSuiteResult]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const resultsButton = screen.getByText('View Results')
    fireEvent.click(resultsButton)

    expect(screen.getByText('Suite Results')).toBeInTheDocument()
    expect(screen.getByText('Passed: 1')).toBeInTheDocument()
    expect(screen.getByText('Failed: 0')).toBeInTheDocument()
    expect(screen.getByText('Total Time: 1.5s')).toBeInTheDocument()
  })

  it('should handle CI/CD setup', async () => {
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const setupButton = screen.getByText('Setup CI')
    fireEvent.click(setupButton)

    await waitFor(() => {
      expect(mockOnCIIntegration).toHaveBeenCalledWith({
        platform: 'github',
        session: mockTestSession
      })
    })
  })

  it('should handle webhook creation', async () => {
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const webhookButton = screen.getByText('Create Webhook')
    fireEvent.click(webhookButton)

    await waitFor(() => {
      expect(mockOnCIIntegration).toHaveBeenCalledWith({
        type: 'webhook',
        url: 'webhook',
        session: mockTestSession
      })
    })
  })

  it('should show scheduled test runs', () => {
    const sessionWithSchedule = {
      ...mockTestSession,
      testSuites: [mockTestSuite],
      scheduledRuns: [
        {
          id: 'schedule-1',
          suiteId: 'suite-1',
          schedule: '0 0 * * *', // Daily at midnight
          nextRun: new Date(Date.now() + 86400000),
          enabled: true
        }
      ]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSchedule}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const scheduleButton = screen.getByText('Scheduled Runs')
    fireEvent.click(scheduleButton)

    expect(screen.getByText('Daily Tests')).toBeInTheDocument()
    expect(screen.getByText('Next run:')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('should handle suite editing', async () => {
    const user = userEvent.setup()
    const sessionWithSuites = {
      ...mockTestSession,
      testSuites: [mockTestSuite]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSuites}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const editButton = screen.getByText('Edit Suite')
    await user.click(editButton)

    expect(screen.getByText('Edit Test Suite')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Regression Suite')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Basic regression tests')).toBeInTheDocument()

    const nameInput = screen.getByDisplayValue('Regression Suite')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Suite')

    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuites: expect.arrayContaining([
            expect.objectContaining({ name: 'Updated Suite' })
          ])
        })
      )
    })
  })

  it('should handle suite deletion', async () => {
    const user = userEvent.setup()
    const sessionWithSuites = {
      ...mockTestSession,
      testSuites: [mockTestSuite]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSuites}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const deleteButton = screen.getByText('Delete Suite')
    await user.click(deleteButton)

    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
    
    const confirmButton = screen.getByText('Delete Test Suite')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuites: []
        })
      )
    })
  })

  it('should show test regression detection', () => {
    const regressionResult = {
      ...mockSuiteResult,
      success: false,
      testResults: [{
        ...mockSuiteResult.testResults[0],
        success: false,
        qualityScore: 60, // Down from expected 80
        error: 'Quality regression detected'
      }],
      statistics: {
        ...mockSuiteResult.statistics,
        passed: 0,
        failed: 1
      }
    }

    const sessionWithRegression = {
      ...mockTestSession,
      testSuites: [mockTestSuite],
      suiteResults: [regressionResult]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithRegression}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    expect(screen.getByText('⚠️ Regression Detected')).toBeInTheDocument()
    expect(screen.getByText('Quality dropped below threshold')).toBeInTheDocument()
    expect(screen.getByText('Expected: ≥80, Got: 60')).toBeInTheDocument()
  })

  it('should handle suite export', async () => {
    const user = userEvent.setup()
    const sessionWithSuites = {
      ...mockTestSession,
      testSuites: [mockTestSuite]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithSuites}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const exportButton = screen.getByText('Export Suite')
    await user.click(exportButton)

    expect(screen.getByText('Export Test Suite')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('YAML')).toBeInTheDocument()

    const jsonButton = screen.getByText('JSON')
    await user.click(jsonButton)

    // Should trigger download
    expect(screen.getByText('Download started')).toBeInTheDocument()
  })

  it('should show performance benchmarks', () => {
    const sessionWithBenchmarks = {
      ...mockTestSession,
      testSuites: [mockTestSuite],
      suiteResults: [mockSuiteResult, {
        ...mockSuiteResult,
        timestamp: new Date(Date.now() - 86400000),
        performanceSummary: {
          averageProcessingTime: 2000,
          peakMemoryUsage: 200,
          averageQualityScore: 82
        }
      }]
    } as any

    render(
      <AutomatedTestingPanel 
        testSession={sessionWithBenchmarks}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const benchmarkButton = screen.getByText('Performance Trends')
    fireEvent.click(benchmarkButton)

    expect(screen.getByText('Performance Comparison')).toBeInTheDocument()
    expect(screen.getByText('Processing Time: -25%')).toBeInTheDocument()
    expect(screen.getByText('Memory Usage: -25%')).toBeInTheDocument()
    expect(screen.getByText('Quality Score: +3.7%')).toBeInTheDocument()
  })

  it('should handle empty suite state', () => {
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    expect(screen.getByText('No test suites created yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first test suite to get started with automated testing')).toBeInTheDocument()
    expect(screen.getByText('Create Test Suite')).toBeInTheDocument()
  })

  it('should validate suite configuration', async () => {
    const user = userEvent.setup()
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const createButton = screen.getByText('Create Test Suite')
    await user.click(createButton)

    // Try to create suite without name
    const saveButton = screen.getByText('Create Suite')
    await user.click(saveButton)

    expect(screen.getByText('Suite name is required')).toBeInTheDocument()
    expect(screen.getByText('At least one test is required')).toBeInTheDocument()
  })

  it('should handle suite import', async () => {
    const user = userEvent.setup()
    render(
      <AutomatedTestingPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onSuiteExecute={mockOnSuiteExecute}
        onCIIntegration={mockOnCIIntegration}
      />
    )

    const importButton = screen.getByText('Import Suite')
    await user.click(importButton)

    const fileInput = screen.getByLabelText('Suite file')
    const file = new File([JSON.stringify(mockTestSuite)], 'suite.json', { type: 'application/json' })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuites: expect.arrayContaining([
            expect.objectContaining({ name: 'Regression Suite' })
          ])
        })
      )
    })
  })
})