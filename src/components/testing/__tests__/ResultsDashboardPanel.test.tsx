import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultsDashboardPanel } from '../ResultsDashboardPanel'
import { TestSession, TestResult } from '@/types'
import * as testingUtils from '@/utils/testingUtils'

// Mock child components
vi.mock('../TestStatistics', () => ({
  TestStatistics: ({ results, onFilterChange }: any) => (
    <div data-testid="test-statistics">
      <div>Total Results: {results.length}</div>
      <button onClick={() => onFilterChange({ status: 'success' })}>Filter Success</button>
    </div>
  )
}))

vi.mock('../TrendAnalysis', () => ({
  TrendAnalysis: ({ data, onTrendSelect }: any) => (
    <div data-testid="trend-analysis">
      <div>Trend Data Points: {data?.length || 0}</div>
      <button onClick={() => onTrendSelect('performance')}>Select Performance Trend</button>
    </div>
  )
}))

vi.mock('../ReportGenerator', () => ({
  ReportGenerator: ({ session, results, onReportGenerate }: any) => (
    <div data-testid="report-generator">
      <div>Session: {session.name}</div>
      <button onClick={() => onReportGenerate('pdf')}>Generate PDF Report</button>
    </div>
  )
}))

// Mock testing utilities
vi.mock('@/utils/testingUtils')

const mockTestSession: TestSession = {
  id: 'test-session',
  name: 'Test Session',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  status: 'active',
  patterns: [
    {
      data: [[true, false], [false, true]],
      width: 2,
      height: 2,
      metadata: { filename: 'pattern1.csv' }
    }
  ],
  parameterSets: [],
  testResults: [],
  performanceMetrics: [],
  tags: ['regression', 'performance'],
  notes: 'Test session notes',
  author: 'test-user'
}

const mockTestResults: TestResult[] = [
  {
    id: 'result-1',
    testSessionId: 'test-session',
    timestamp: new Date('2024-01-01T10:00:00'),
    pattern: mockTestSession.patterns[0],
    parameters: { height: 5, depth: 2 } as any,
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
  },
  {
    id: 'result-2',
    testSessionId: 'test-session',
    timestamp: new Date('2024-01-01T11:00:00'),
    pattern: mockTestSession.patterns[0],
    parameters: { height: 7, depth: 2 } as any,
    success: false,
    processingTime: 3000,
    meshStats: {
      vertexCount: 0,
      faceCount: 0,
      edgeCount: 0,
      boundingBox: { width: 0, height: 0, depth: 0 },
      surfaceArea: 0,
      volume: 0,
      memoryUsage: 0
    },
    qualityScore: 0,
    performanceMetrics: {
      memoryUsed: 200,
      cpuUsage: 80,
      generationSpeed: 0,
      elapsedTime: 3000
    },
    error: 'Generation failed',
    warnings: ['High memory usage'],
    exportedFormats: []
  }
]

describe('ResultsDashboardPanel', () => {
  const mockOnSessionUpdate = vi.fn()
  const mockOnResultsExport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock testing utilities
    vi.mocked(testingUtils.aggregateResultsByTimePeriod).mockReturnValue([
      {
        period: '2024-1-1',
        count: 2,
        averageProcessingTime: 2250,
        averageQualityScore: 42.5,
        successRate: 50
      }
    ])

    vi.mocked(testingUtils.calculatePerformanceTrends).mockReturnValue({
      processingTimeTrend: 'stable',
      memoryUsageTrend: 'improving',
      qualityTrend: 'degrading',
      trendSlopes: { processingTime: 0.1, memoryUsage: -0.2, quality: -0.5 }
    })

    vi.mocked(testingUtils.transformResultsForCharting).mockReturnValue([
      { x: '2024-01-01T10:00:00.000Z', y: 1500, label: 'Test 1' },
      { x: '2024-01-01T11:00:00.000Z', y: 3000, label: 'Test 2' }
    ])

    vi.mocked(testingUtils.exportResultsToCSV).mockReturnValue('csv,data')
    vi.mocked(testingUtils.exportResultsToJSON).mockReturnValue('{"results": []}')
    vi.mocked(testingUtils.generateHTMLReport).mockReturnValue('<html>report</html>')
  })

  it('should render results dashboard interface', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    expect(screen.getByText('Test Results Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Statistics Overview')).toBeInTheDocument()
    expect(screen.getByText('Trend Analysis')).toBeInTheDocument()
    expect(screen.getByText('Export & Reports')).toBeInTheDocument()
    expect(screen.getByTestId('test-statistics')).toBeInTheDocument()
    expect(screen.getByTestId('trend-analysis')).toBeInTheDocument()
    expect(screen.getByTestId('report-generator')).toBeInTheDocument()
  })

  it('should display session overview', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    expect(screen.getByText('Test Session')).toBeInTheDocument()
    expect(screen.getByText('Total Results: 2')).toBeInTheDocument()
    expect(screen.getByText('Success Rate: 50%')).toBeInTheDocument()
    expect(screen.getByText('Average Quality: 42.5')).toBeInTheDocument()
    expect(screen.getByText('Average Time: 2.25s')).toBeInTheDocument()
  })

  it('should handle result filtering', async () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const filterButton = screen.getByText('Filter Success')
    fireEvent.click(filterButton)

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 2 results')).toBeInTheDocument()
    })
  })

  it('should display trend analysis', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    expect(screen.getByText('Trend Data Points: 2')).toBeInTheDocument()

    const trendButton = screen.getByText('Select Performance Trend')
    fireEvent.click(trendButton)

    expect(screen.getByText('Selected Trend: Performance')).toBeInTheDocument()
  })

  it('should handle time period filtering', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const periodSelect = screen.getByLabelText('Time Period')
    await user.selectOptions(periodSelect, 'day')

    expect(testingUtils.aggregateResultsByTimePeriod).toHaveBeenCalledWith(mockTestResults, 'day')
  })

  it('should generate and export reports', async () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const reportButton = screen.getByText('Generate PDF Report')
    fireEvent.click(reportButton)

    await waitFor(() => {
      expect(mockOnResultsExport).toHaveBeenCalledWith({
        format: 'pdf',
        session: sessionWithResults,
        results: mockTestResults
      })
    })
  })

  it('should export results in different formats', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const exportButton = screen.getByText('Export Results')
    await user.click(exportButton)

    expect(screen.getByText('Export Format')).toBeInTheDocument()

    const csvButton = screen.getByText('CSV')
    await user.click(csvButton)

    expect(testingUtils.exportResultsToCSV).toHaveBeenCalledWith(mockTestResults)
    expect(mockOnResultsExport).toHaveBeenCalledWith({
      format: 'csv',
      data: 'csv,data',
      filename: 'test-results.csv'
    })
  })

  it('should show detailed result information', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const resultRow = screen.getByText('result-1')
    await user.click(resultRow)

    expect(screen.getByText('Test Result Details')).toBeInTheDocument()
    expect(screen.getByText('Processing Time: 1500ms')).toBeInTheDocument()
    expect(screen.getByText('Quality Score: 85')).toBeInTheDocument()
    expect(screen.getByText('Vertices: 1000')).toBeInTheDocument()
    expect(screen.getByText('Faces: 2000')).toBeInTheDocument()
  })

  it('should handle result comparison', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    // Select multiple results for comparison
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    const compareButton = screen.getByText('Compare Selected')
    await user.click(compareButton)

    expect(screen.getByText('Result Comparison')).toBeInTheDocument()
    expect(screen.getByText('Processing Time Difference')).toBeInTheDocument()
    expect(screen.getByText('Quality Score Difference')).toBeInTheDocument()
  })

  it('should show error analysis', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const errorsButton = screen.getByText('Error Analysis')
    fireEvent.click(errorsButton)

    expect(screen.getByText('Error Summary')).toBeInTheDocument()
    expect(screen.getByText('Failed Tests: 1')).toBeInTheDocument()
    expect(screen.getByText('Generation failed')).toBeInTheDocument()
    expect(screen.getByText('High memory usage')).toBeInTheDocument()
  })

  it('should display performance insights', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const insightsButton = screen.getByText('Performance Insights')
    fireEvent.click(insightsButton)

    expect(screen.getByText('Key Insights')).toBeInTheDocument()
    expect(screen.getByText('Processing time is stable')).toBeInTheDocument()
    expect(screen.getByText('Memory usage is improving')).toBeInTheDocument()
    expect(screen.getByText('Quality is degrading')).toBeInTheDocument()
  })

  it('should handle result deletion', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const deleteButton = screen.getByLabelText('Delete result-1')
    await user.click(deleteButton)

    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()

    const confirmButton = screen.getByText('Delete Result')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith({
        ...sessionWithResults,
        testResults: mockTestResults.filter(r => r.id !== 'result-1'),
        updatedAt: expect.any(Date)
      })
    })
  })

  it('should show empty state when no results', () => {
    render(
      <ResultsDashboardPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    expect(screen.getByText('No test results yet')).toBeInTheDocument()
    expect(screen.getByText('Run some tests to see results here')).toBeInTheDocument()
    expect(screen.getByText('Start Testing')).toBeInTheDocument()
  })

  it('should handle search and filtering', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search results...')
    await user.type(searchInput, 'pattern1')

    expect(screen.getByText('Showing 2 of 2 results')).toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText('No matching results')).toBeInTheDocument()
  })

  it('should handle sorting', async () => {
    const user = userEvent.setup()
    const sessionWithResults = {
      ...mockTestSession,
      testResults: mockTestResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    const sortSelect = screen.getByLabelText('Sort by')
    await user.selectOptions(sortSelect, 'processing-time')

    expect(screen.getByText('Sorted by processing time')).toBeInTheDocument()

    await user.selectOptions(sortSelect, 'quality-score')

    expect(screen.getByText('Sorted by quality score')).toBeInTheDocument()
  })

  it('should show result pagination', async () => {
    const user = userEvent.setup()
    const manyResults = Array.from({ length: 25 }, (_, i) => ({
      ...mockTestResults[0],
      id: `result-${i + 1}`,
      timestamp: new Date(Date.now() + i * 1000)
    }))

    const sessionWithManyResults = {
      ...mockTestSession,
      testResults: manyResults
    }

    render(
      <ResultsDashboardPanel 
        testSession={sessionWithManyResults}
        onSessionUpdate={mockOnSessionUpdate}
        onResultsExport={mockOnResultsExport}
      />
    )

    expect(screen.getByText('Showing 1-20 of 25')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()

    const nextButton = screen.getByText('Next')
    await user.click(nextButton)

    expect(screen.getByText('Showing 21-25 of 25')).toBeInTheDocument()
    expect(screen.getByText('Previous')).toBeInTheDocument()
  })
})