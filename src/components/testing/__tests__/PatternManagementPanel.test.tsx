import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatternManagementPanel } from '../PatternManagementPanel'
import { DotPattern, TestSession } from '@/types'

// Mock the testing utilities and error handler
vi.mock('@/utils/testingUtils')
vi.mock('@/utils/testingErrorHandler')
vi.mock('@/services/FileService')

// Mock child components
vi.mock('../PatternEditor', () => ({
  PatternEditor: ({ pattern, onPatternChange, onPatternSave }: any) => (
    <div data-testid="pattern-editor">
      <button onClick={() => onPatternChange(pattern)}>Change Pattern</button>
      <button onClick={() => onPatternSave(pattern)}>Save Pattern</button>
    </div>
  )
}))

vi.mock('../PatternLibrary', () => ({
  PatternLibrary: ({ onPatternSelect }: any) => (
    <div data-testid="pattern-library">
      <button onClick={() => onPatternSelect({ id: 'test-pattern', name: 'Test Pattern' })}>
        Select Pattern
      </button>
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

const mockPattern: DotPattern = {
  data: [[true, false], [false, true]],
  width: 2,
  height: 2,
  metadata: {
    filename: 'test-pattern.csv',
    createdAt: new Date(),
    modifiedAt: new Date()
  }
}

describe('PatternManagementPanel', () => {
  const mockOnSessionUpdate = vi.fn()
  const mockOnPatternSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render pattern management interface', () => {
    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    expect(screen.getByText('Pattern Management')).toBeInTheDocument()
    expect(screen.getByText('Create & Edit Patterns')).toBeInTheDocument()
    expect(screen.getByText('Pattern Library')).toBeInTheDocument()
    expect(screen.getByTestId('pattern-editor')).toBeInTheDocument()
    expect(screen.getByTestId('pattern-library')).toBeInTheDocument()
  })

  it('should handle pattern creation', async () => {
    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const createButton = screen.getByText('Create New Pattern')
    fireEvent.click(createButton)

    expect(screen.getByDisplayValue('New Pattern')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument() // default width
    expect(screen.getByDisplayValue('10')).toBeInTheDocument() // default height
  })

  it('should handle file upload for patterns', async () => {
    const user = userEvent.setup()
    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const fileInput = screen.getByLabelText('Upload pattern file')
    const file = new File(['1,0\n0,1'], 'test.csv', { type: 'text/csv' })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalled()
    })
  })

  it('should display pattern preview', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    expect(screen.getByText('test-pattern.csv')).toBeInTheDocument()
    expect(screen.getByText('2×2')).toBeInTheDocument()
    expect(screen.getByText('2 dots (50%)')).toBeInTheDocument()
  })

  it('should handle pattern selection for testing', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const selectButton = screen.getByText('Use for Testing')
    fireEvent.click(selectButton)

    expect(mockOnPatternSelect).toHaveBeenCalledWith(mockPattern)
  })

  it('should handle pattern deletion', async () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    // Should show confirmation dialog
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
    
    const confirmButton = screen.getByText('Delete Pattern')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockOnSessionUpdate).toHaveBeenCalledWith({
        ...sessionWithPattern,
        patterns: [],
        updatedAt: expect.any(Date)
      })
    })
  })

  it('should handle pattern editing', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const editButton = screen.getByText('Edit')
    fireEvent.click(editButton)

    // Should activate editing mode
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('should validate pattern dimensions', async () => {
    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const createButton = screen.getByText('Create New Pattern')
    fireEvent.click(createButton)

    const widthInput = screen.getByDisplayValue('10')
    fireEvent.change(widthInput, { target: { value: '0' } })

    const createPatternButton = screen.getByText('Create Pattern')
    fireEvent.click(createPatternButton)

    expect(screen.getByText('Width must be between 1 and 1000')).toBeInTheDocument()
  })

  it('should show pattern complexity score', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    expect(screen.getByText('Complexity:')).toBeInTheDocument()
    expect(screen.getByText(/\d+/)).toBeInTheDocument() // Should show complexity score
  })

  it('should handle pattern export', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const exportButton = screen.getByText('Export')
    fireEvent.click(exportButton)

    expect(screen.getByText('Export Pattern')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Image')).toBeInTheDocument()
  })

  it('should handle bulk pattern operations', async () => {
    const sessionWithPatterns = {
      ...mockTestSession,
      patterns: [mockPattern, { ...mockPattern, metadata: { ...mockPattern.metadata!, filename: 'pattern2.csv' } }]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPatterns}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    // Select multiple patterns
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    expect(screen.getByText('2 patterns selected')).toBeInTheDocument()
    expect(screen.getByText('Bulk Actions')).toBeInTheDocument()
    expect(screen.getByText('Export Selected')).toBeInTheDocument()
    expect(screen.getByText('Delete Selected')).toBeInTheDocument()
  })

  it('should show loading state during operations', async () => {
    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const createButton = screen.getByText('Create New Pattern')
    fireEvent.click(createButton)

    const createPatternButton = screen.getByText('Create Pattern')
    fireEvent.click(createPatternButton)

    expect(screen.getByText('Creating pattern...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should handle error states gracefully', async () => {
    // Mock an error in session update
    mockOnSessionUpdate.mockRejectedValueOnce(new Error('Session update failed'))

    render(
      <PatternManagementPanel 
        testSession={mockTestSession}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    const createButton = screen.getByText('Create New Pattern')
    fireEvent.click(createButton)

    const createPatternButton = screen.getByText('Create Pattern')
    fireEvent.click(createPatternButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to update session')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('should provide pattern usage statistics', () => {
    const sessionWithPattern = {
      ...mockTestSession,
      patterns: [mockPattern],
      testResults: [
        {
          id: 'test1',
          pattern: mockPattern,
          success: true,
          timestamp: new Date()
        }
      ]
    }

    render(
      <PatternManagementPanel 
        testSession={sessionWithPattern as any}
        onSessionUpdate={mockOnSessionUpdate}
        onPatternSelect={mockOnPatternSelect}
      />
    )

    expect(screen.getByText('Used in 1 test')).toBeInTheDocument()
  })
})