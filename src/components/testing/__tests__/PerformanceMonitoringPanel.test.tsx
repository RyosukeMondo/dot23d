import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PerformanceMonitoringPanel } from '../PerformanceMonitoringPanel'
import { TestSession, PerformanceMetrics } from '@/types'

// Mock child components
vi.mock('../RealTimeMetrics', () => ({
  RealTimeMetrics: ({ metrics, onMetricsUpdate }: any) => (
    <div data-testid="real-time-metrics">
      <div>Memory: {metrics?.memoryUsage?.used || 0}MB</div>
      <div>CPU: {metrics?.cpuUsage?.generation || 0}%</div>
      <button onClick={() => onMetricsUpdate({ memoryUsage: { used: 100 } })}>
        Update Metrics
      </button>
    </div>
  )
}))

vi.mock('../PerformanceCharts', () => ({
  PerformanceCharts: ({ data, onExport }: any) => (
    <div data-testid="performance-charts">
      <div>Chart Data Points: {data?.length || 0}</div>
      <button onClick={() => onExport('png')}>Export Chart</button>
    </div>
  )
}))

const mockTestSession: TestSession = {
  id: 'test-session',
  name: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active',
  patterns: [],
  parameterSets: [],
  testResults: [],
  performanceMetrics: [],
  tags: [],
  notes: '',
  author: 'test-user'
}

const mockPerformanceMetrics: PerformanceMetrics = {
  timestamp: new Date(),
  testId: 'test-1',
  memoryUsage: {
    used: 150,
    peak: 200,
    available: 8000
  },
  cpuUsage: {
    generation: 45,
    optimization: 20,
    rendering: 15
  },
  timings: {
    validation: 100,
    generation: 2000,
    optimization: 800,
    rendering: 300,
    export: 150
  },
  qualityMetrics: {
    meshComplexity: 75,
    optimizationRatio: 0.85,
    printability: 88
  }
}

describe('PerformanceMonitoringPanel', () => {
  const mockOnSessionUpdate = vi.fn()
  const mockOnMetricsExport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock performance API
    Object.defineProperty(window, 'performance', {
      value: {
        now: vi.fn(() => Date.now()),
        memory: {
          usedJSHeapSize: 50000000,
          totalJSHeapSize: 100000000,
          jsHeapSizeLimit: 2000000000
        }
      }
    })
  })

  it('should render performance monitoring interface', () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    expect(screen.getByText('Performance Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
    expect(screen.getByText('Performance Charts')).toBeInTheDocument()
    expect(screen.getByTestId('real-time-metrics')).toBeInTheDocument()
    expect(screen.getByTestId('performance-charts')).toBeInTheDocument()
  })

  it('should start and stop monitoring', async () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const startButton = screen.getByText('Start Monitoring')
    fireEvent.click(startButton)

    expect(screen.getByText('Stop Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Monitoring Active')).toBeInTheDocument()

    const stopButton = screen.getByText('Stop Monitoring')
    fireEvent.click(stopButton)

    expect(screen.getByText('Start Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Monitoring Inactive')).toBeInTheDocument()
  })

  it('should display current performance metrics', () => {
    const sessionWithMetrics = {
      ...mockTestSession,
      performanceMetrics: [mockPerformanceMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithMetrics}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    expect(screen.getByText('Memory: 150MB')).toBeInTheDocument()
    expect(screen.getByText('CPU: 45%')).toBeInTheDocument()
  })

  it('should handle metrics update', async () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const updateButton = screen.getByText('Update Metrics')
    fireEvent.click(updateButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalled()
    })
  })

  it('should show performance thresholds', () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const thresholdsButton = screen.getByText('Thresholds')
    fireEvent.click(thresholdsButton)

    expect(screen.getByText('Performance Thresholds')).toBeInTheDocument()
    expect(screen.getByLabelText('Memory Warning (MB)')).toBeInTheDocument()
    expect(screen.getByLabelText('CPU Warning (%)')).toBeInTheDocument()
    expect(screen.getByLabelText('Processing Time Warning (ms)')).toBeInTheDocument()
  })

  it('should show threshold warnings', () => {
    const highUsageMetrics = {
      ...mockPerformanceMetrics,
      memoryUsage: { ...mockPerformanceMetrics.memoryUsage, used: 7000 },
      cpuUsage: { ...mockPerformanceMetrics.cpuUsage, generation: 90 }
    }

    const sessionWithHighUsage = {
      ...mockTestSession,
      performanceMetrics: [highUsageMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithHighUsage}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    expect(screen.getByText('⚠️ High memory usage detected')).toBeInTheDocument()
    expect(screen.getByText('⚠️ High CPU usage detected')).toBeInTheDocument()
  })

  it('should handle performance report generation', async () => {
    const sessionWithMetrics = {
      ...mockTestSession,
      performanceMetrics: [mockPerformanceMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithMetrics}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const reportButton = screen.getByText('Generate Report')
    fireEvent.click(reportButton)

    await waitFor(() => {
      expect(mockOnMetricsExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'html',
          metrics: [mockPerformanceMetrics]
        })
      )
    })
  })

  it('should show performance trends', () => {
    const metricsOverTime = [
      { ...mockPerformanceMetrics, timestamp: new Date(Date.now() - 3600000) },
      { ...mockPerformanceMetrics, timestamp: new Date(Date.now() - 1800000) },
      mockPerformanceMetrics
    ]

    const sessionWithTrends = {
      ...mockTestSession,
      performanceMetrics: metricsOverTime
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithTrends}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const trendsButton = screen.getByText('View Trends')
    fireEvent.click(trendsButton)

    expect(screen.getByText('Performance Trends')).toBeInTheDocument()
    expect(screen.getByText('Memory Usage Trend')).toBeInTheDocument()
    expect(screen.getByText('CPU Usage Trend')).toBeInTheDocument()
    expect(screen.getByText('Processing Time Trend')).toBeInTheDocument()
  })

  it('should handle monitoring frequency settings', async () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const settingsButton = screen.getByText('Settings')
    fireEvent.click(settingsButton)

    expect(screen.getByText('Monitoring Settings')).toBeInTheDocument()
    expect(screen.getByLabelText('Update Frequency (ms)')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Detailed Metrics')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Alerts')).toBeInTheDocument()

    const frequencyInput = screen.getByDisplayValue('1000')
    fireEvent.change(frequencyInput, { target: { value: '500' } })

    const saveButton = screen.getByText('Save Settings')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Settings saved')).toBeInTheDocument()
    })
  })

  it('should show memory usage breakdown', () => {
    const sessionWithMetrics = {
      ...mockTestSession,
      performanceMetrics: [mockPerformanceMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithMetrics}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const memoryButton = screen.getByText('Memory Details')
    fireEvent.click(memoryButton)

    expect(screen.getByText('Memory Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Current: 150 MB')).toBeInTheDocument()
    expect(screen.getByText('Peak: 200 MB')).toBeInTheDocument()
    expect(screen.getByText('Available: 8000 MB')).toBeInTheDocument()
    expect(screen.getByText('Usage: 1.9%')).toBeInTheDocument()
  })

  it('should show CPU usage breakdown', () => {
    const sessionWithMetrics = {
      ...mockTestSession,
      performanceMetrics: [mockPerformanceMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithMetrics}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const cpuButton = screen.getByText('CPU Details')
    fireEvent.click(cpuButton)

    expect(screen.getByText('CPU Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Generation: 45%')).toBeInTheDocument()
    expect(screen.getByText('Optimization: 20%')).toBeInTheDocument()
    expect(screen.getByText('Rendering: 15%')).toBeInTheDocument()
    expect(screen.getByText('Total: 80%')).toBeInTheDocument()
  })

  it('should handle chart export', async () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const exportChartButton = screen.getByText('Export Chart')
    fireEvent.click(exportChartButton)

    await waitFor(() => {
      expect(mockOnMetricsExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'png'
        })
      )
    })
  })

  it('should show quality metrics correlation', () => {
    const sessionWithMetrics = {
      ...mockTestSession,
      performanceMetrics: [mockPerformanceMetrics]
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithMetrics}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const qualityButton = screen.getByText('Quality Metrics')
    fireEvent.click(qualityButton)

    expect(screen.getByText('Quality Correlation')).toBeInTheDocument()
    expect(screen.getByText('Mesh Complexity: 75')).toBeInTheDocument()
    expect(screen.getByText('Optimization Ratio: 0.85')).toBeInTheDocument()
    expect(screen.getByText('Printability: 88')).toBeInTheDocument()
  })

  it('should handle performance comparison', () => {
    const comparisonMetrics = [
      mockPerformanceMetrics,
      {
        ...mockPerformanceMetrics,
        testId: 'test-2',
        cpuUsage: { generation: 60, optimization: 25, rendering: 20 }
      }
    ]

    const sessionWithComparison = {
      ...mockTestSession,
      performanceMetrics: comparisonMetrics
    }

    render(
      <PerformanceMonitoringPanel 
        testSession={sessionWithComparison}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    const compareButton = screen.getByText('Compare Tests')
    fireEvent.click(compareButton)

    expect(screen.getByText('Performance Comparison')).toBeInTheDocument()
    expect(screen.getByText('Test 1 vs Test 2')).toBeInTheDocument()
    expect(screen.getByText('CPU Difference: +15%')).toBeInTheDocument()
  })

  it('should handle monitoring errors gracefully', async () => {
    // Mock console.error to prevent test output pollution
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    // Simulate monitoring error by making sessionUpdate fail
    mockOnSessionUpdate.mockRejectedValueOnce(new Error('Monitoring failed'))

    const updateButton = screen.getByText('Update Metrics')
    fireEvent.click(updateButton)

    await waitFor(() => {
      expect(screen.getByText('Monitoring Error')).toBeInTheDocument()
      expect(screen.getByText('Failed to update metrics')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })

  it('should show real-time status indicators', () => {
    render(
      <PerformanceMonitoringPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onMetricsExport={mockOnMetricsExport}
      />
    )

    // Initially not monitoring
    expect(screen.getByText('Monitoring Inactive')).toBeInTheDocument()
    expect(screen.getByText('🔴')).toBeInTheDocument()

    const startButton = screen.getByText('Start Monitoring')
    fireEvent.click(startButton)

    expect(screen.getByText('Monitoring Active')).toBeInTheDocument()
    expect(screen.getByText('🟢')).toBeInTheDocument()
  })
})