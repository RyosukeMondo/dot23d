import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParameterTestingPanel } from '../ParameterTestingPanel'
import { TestSession, Model3DParams, ParameterPreset } from '@/types'

// Mock components
vi.mock('../ParameterPresets', () => ({
  ParameterPresets: ({ onPresetSelect, onPresetCreate }: any) => (
    <div data-testid="parameter-presets">
      <button onClick={() => onPresetSelect({ id: 'preset1', name: 'Quality', parameters: { height: 5 } })}>
        Select Preset
      </button>
      <button onClick={() => onPresetCreate({ name: 'Custom', parameters: { height: 10 } })}>
        Create Preset
      </button>
    </div>
  )
}))

vi.mock('../BulkTesting', () => ({
  BulkTesting: ({ onBulkTestStart }: any) => (
    <div data-testid="bulk-testing">
      <button onClick={() => onBulkTestStart()}>Start Bulk Test</button>
    </div>
  )
}))

vi.mock('../ParameterSweep', () => ({
  ParameterSweep: ({ onSweepStart }: any) => (
    <div data-testid="parameter-sweep">
      <button onClick={() => onSweepStart()}>Start Parameter Sweep</button>
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
      metadata: { filename: 'test-pattern.csv' }
    }
  ],
  parameterSets: [],
  testResults: [],
  performanceMetrics: [],
  tags: [],
  notes: '',
  author: 'test-user'
}

const defaultParameters: Model3DParams = {
  height: 5,
  depth: 2,
  resolution: 0.1,
  smoothing: true,
  hollowOut: false,
  wallThickness: 1
}

describe('ParameterTestingPanel', () => {
  const mockOnSessionUpdate = vi.fn()
  const mockOnParametersChange = vi.fn()
  const mockOnTestStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render parameter testing interface', () => {
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    expect(screen.getByText('Parameter Testing')).toBeInTheDocument()
    expect(screen.getByText('Manual Parameters')).toBeInTheDocument()
    expect(screen.getByText('Parameter Presets')).toBeInTheDocument()
    expect(screen.getByText('Bulk Testing')).toBeInTheDocument()
    expect(screen.getByText('Parameter Sweep')).toBeInTheDocument()
  })

  it('should display parameter controls', () => {
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    expect(screen.getByLabelText('Height (mm)')).toBeInTheDocument()
    expect(screen.getByLabelText('Depth (mm)')).toBeInTheDocument()
    expect(screen.getByLabelText('Resolution (mm)')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Smoothing')).toBeInTheDocument()
    expect(screen.getByLabelText('Hollow Out')).toBeInTheDocument()
    expect(screen.getByLabelText('Wall Thickness (mm)')).toBeInTheDocument()
  })

  it('should handle parameter changes', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const heightInput = screen.getByDisplayValue('5')
    await user.clear(heightInput)
    await user.type(heightInput, '10')

    expect(mockOnParametersChange).toHaveBeenCalledWith({
      ...defaultParameters,
      height: 10
    })
  })

  it('should validate parameter ranges', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const heightInput = screen.getByDisplayValue('5')
    await user.clear(heightInput)
    await user.type(heightInput, '0')

    expect(screen.getByText('Height must be between 0.1 and 100')).toBeInTheDocument()
    
    // Should not call onChange for invalid values
    expect(mockOnParametersChange).not.toHaveBeenCalledWith({
      ...defaultParameters,
      height: 0
    })
  })

  it('should handle preset selection', async () => {
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const selectPresetButton = screen.getByText('Select Preset')
    fireEvent.click(selectPresetButton)

    await waitFor(() => {
      expect(mockOnParametersChange).toHaveBeenCalledWith({
        ...defaultParameters,
        height: 5
      })
    })
  })

  it('should show parameter recommendations', () => {
    const sessionWithLargePattern = {
      ...mockTestSession,
      patterns: [{
        data: Array(100).fill(null).map(() => Array(100).fill(true)),
        width: 100,
        height: 100,
        metadata: { filename: 'large-pattern.csv' }
      }]
    }

    render(
      <ParameterTestingPanel 
        testSession={sessionWithLargePattern}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    expect(screen.getByText('Recommendations')).toBeInTheDocument()
    expect(screen.getByText(/Consider increasing resolution/)).toBeInTheDocument()
  })

  it('should handle parameter comparison', () => {
    const sessionWithResults = {
      ...mockTestSession,
      testResults: [
        {
          id: 'test1',
          parameters: { ...defaultParameters, height: 3 },
          success: true,
          qualityScore: 85,
          processingTime: 1000
        },
        {
          id: 'test2', 
          parameters: { ...defaultParameters, height: 7 },
          success: true,
          qualityScore: 92,
          processingTime: 1200
        }
      ]
    }

    render(
      <ParameterTestingPanel 
        testSession={sessionWithResults as any}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const compareButton = screen.getByText('Compare Results')
    fireEvent.click(compareButton)

    expect(screen.getByText('Parameter Comparison')).toBeInTheDocument()
    expect(screen.getByText('Height: 3mm → Quality: 85')).toBeInTheDocument()
    expect(screen.getByText('Height: 7mm → Quality: 92')).toBeInTheDocument()
  })

  it('should handle single test execution', async () => {
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const testButton = screen.getByText('Run Test')
    fireEvent.click(testButton)

    expect(mockOnTestStart).toHaveBeenCalledWith({
      pattern: mockTestSession.patterns[0],
      parameters: defaultParameters
    })
  })

  it('should show parameter history', () => {
    const sessionWithHistory = {
      ...mockTestSession,
      parameterSets: [
        { height: 3, depth: 2, resolution: 0.1 },
        { height: 5, depth: 2, resolution: 0.1 },
        { height: 7, depth: 2, resolution: 0.1 }
      ]
    }

    render(
      <ParameterTestingPanel 
        testSession={sessionWithHistory as any}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const historyButton = screen.getByText('Parameter History')
    fireEvent.click(historyButton)

    expect(screen.getByText('Recent Parameter Sets')).toBeInTheDocument()
    expect(screen.getByText('Height: 3, Depth: 2')).toBeInTheDocument()
    expect(screen.getByText('Height: 5, Depth: 2')).toBeInTheDocument()
    expect(screen.getByText('Height: 7, Depth: 2')).toBeInTheDocument()
  })

  it('should handle parameter export', () => {
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const exportButton = screen.getByText('Export Parameters')
    fireEvent.click(exportButton)

    expect(screen.getByText('Export Current Parameters')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
  })

  it('should show parameter conflicts', async () => {
    const conflictingParameters = {
      ...defaultParameters,
      hollowOut: true,
      wallThickness: 0.1
    }

    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={conflictingParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    expect(screen.getByText('Parameter Conflicts')).toBeInTheDocument()
    expect(screen.getByText(/Wall thickness too thin for hollow/)).toBeInTheDocument()
  })

  it('should handle advanced parameter controls', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const advancedButton = screen.getByText('Advanced Parameters')
    await user.click(advancedButton)

    expect(screen.getByLabelText('Mesh Optimization')).toBeInTheDocument()
    expect(screen.getByLabelText('Subdivision Level')).toBeInTheDocument()
    expect(screen.getByLabelText('Noise Reduction')).toBeInTheDocument()
  })

  it('should show estimated processing time', () => {
    const sessionWithLargePattern = {
      ...mockTestSession,
      patterns: [{
        data: Array(50).fill(null).map(() => Array(50).fill(true)),
        width: 50,
        height: 50,
        metadata: { filename: 'medium-pattern.csv' }
      }]
    }

    render(
      <ParameterTestingPanel 
        testSession={sessionWithLargePattern}
        currentParameters={{ ...defaultParameters, resolution: 0.05 }}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    expect(screen.getByText('Estimated Time:')).toBeInTheDocument()
    expect(screen.getByText(/\d+\.\d+s/)).toBeInTheDocument()
  })

  it('should handle parameter reset', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={{ ...defaultParameters, height: 20 }}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const resetButton = screen.getByText('Reset to Defaults')
    await user.click(resetButton)

    expect(mockOnParametersChange).toHaveBeenCalledWith({
      height: 5,
      depth: 2,
      resolution: 0.1,
      smoothing: true,
      hollowOut: false,
      wallThickness: 1
    })
  })

  it('should show parameter tooltips', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const heightLabel = screen.getByLabelText('Height (mm)')
    await user.hover(heightLabel)

    await waitFor(() => {
      expect(screen.getByText(/Controls the vertical size of the 3D model/)).toBeInTheDocument()
    })
  })

  it('should handle parameter validation errors', async () => {
    const user = userEvent.setup()
    render(
      <ParameterTestingPanel 
        testSession={mockTestSession}
        currentParameters={defaultParameters}
        onSessionUpdate={mockOnSessionUpdate}
        onParametersChange={mockOnParametersChange}
        onTestStart={mockOnTestStart}
      />
    )

    const resolutionInput = screen.getByDisplayValue('0.1')
    await user.clear(resolutionInput)
    await user.type(resolutionInput, '1.0')

    expect(screen.getByText('Resolution too high - may cause memory issues')).toBeInTheDocument()
    expect(screen.getByText('Run Test')).toBeDisabled()
  })
})