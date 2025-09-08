import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileUpload } from '../FileUpload'
import { FileService } from '@/services/FileService'
import { sampleFiles, sampleValidationResults } from '@/test/fixtures'

// Mock FileService
vi.mock('@/services/FileService')

describe('FileUpload', () => {
  const mockOnFileSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(FileService.validateFile).mockResolvedValue({
      data: sampleValidationResults.valid,
      error: undefined
    })
    vi.mocked(FileService.formatFileSize).mockImplementation((size) => `${Math.round(size / 1024)} KB`)
  })

  it('should render upload interface with default props', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    expect(screen.getByText('Upload File')).toBeInTheDocument()
    expect(screen.getByText('Drag and drop a file here or click to browse')).toBeInTheDocument()
    expect(screen.getByText('Supported: CSV,JPG,JPEG,PNG,GIF,BMP,WEBP')).toBeInTheDocument()
    expect(screen.getByText('Max size: 10240 KB')).toBeInTheDocument()
  })

  it('should render with custom accepted types', () => {
    render(
      <FileUpload 
        onFileSelect={mockOnFileSelect} 
        acceptedTypes=".jpg,.png"
      />
    )
    
    expect(screen.getByText('Supported: JPG,PNG')).toBeInTheDocument()
  })

  it('should render with custom max size', () => {
    render(
      <FileUpload 
        onFileSelect={mockOnFileSelect} 
        maxSize={5 * 1024 * 1024}
      />
    )
    
    expect(screen.getByText('Max size: 5120 KB')).toBeInTheDocument()
  })

  it('should handle file selection via input', async () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(FileService.validateFile).toHaveBeenCalledWith(file, {
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
      })
      expect(mockOnFileSelect).toHaveBeenCalledWith(file)
    })
  })

  it('should handle drag and drop', async () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    const file = sampleFiles.validImage
    
    // Create drag event with file
    const dragEvent = new Event('drop', { bubbles: true }) as any
    dragEvent.dataTransfer = {
      files: [file]
    }
    
    fireEvent(dropZone!, dragEvent)
    
    await waitFor(() => {
      expect(FileService.validateFile).toHaveBeenCalledWith(file, expect.any(Object))
      expect(mockOnFileSelect).toHaveBeenCalledWith(file)
    })
  })

  it('should show drag over state when dragging', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    
    // Simulate drag over
    fireEvent.dragOver(dropZone!)
    
    expect(dropZone).toHaveClass('drag-over')
    
    // Simulate drag leave
    fireEvent.dragLeave(dropZone!)
    
    expect(dropZone).not.toHaveClass('drag-over')
  })

  it('should show processing state during validation', async () => {
    // Make validation take time
    vi.mocked(FileService.validateFile).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        data: sampleValidationResults.valid,
        error: undefined
      }), 100))
    )
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Should show processing state
    expect(screen.getByText('Processing file...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.queryByText('Processing file...')).not.toBeInTheDocument()
    })
  })

  it('should show validation success message', async () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('✅ File validated successfully!')).toBeInTheDocument()
    })
  })

  it('should show validation errors', async () => {
    vi.mocked(FileService.validateFile).mockResolvedValue({
      data: sampleValidationResults.invalid,
      error: undefined
    })
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.unsupportedFile
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Errors:')).toBeInTheDocument()
      expect(screen.getByText('File size exceeds maximum allowed size')).toBeInTheDocument()
      expect(screen.getByText('Unsupported file type')).toBeInTheDocument()
      expect(mockOnFileSelect).not.toHaveBeenCalled()
    })
  })

  it('should show validation warnings', async () => {
    vi.mocked(FileService.validateFile).mockResolvedValue({
      data: sampleValidationResults.withWarnings,
      error: undefined
    })
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('⚠️ Warnings:')).toBeInTheDocument()
      expect(screen.getByText('File size is large and may impact performance')).toBeInTheDocument()
      expect(screen.getByText('✅ File validated successfully!')).toBeInTheDocument()
      expect(mockOnFileSelect).toHaveBeenCalled()
    })
  })

  it('should handle validation service errors', async () => {
    vi.mocked(FileService.validateFile).mockRejectedValue(new Error('Validation service error'))
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Errors:')).toBeInTheDocument()
      expect(screen.getByText('Validation service error')).toBeInTheDocument()
      expect(mockOnFileSelect).not.toHaveBeenCalled()
    })
  })

  it('should handle unknown validation errors', async () => {
    vi.mocked(FileService.validateFile).mockRejectedValue('String error')
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Errors:')).toBeInTheDocument()
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })
  })

  it('should disable input during processing', async () => {
    vi.mocked(FileService.validateFile).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        data: sampleValidationResults.valid,
        error: undefined
      }), 100))
    )
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    const file = sampleFiles.validCSV
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Input should be disabled during processing
    expect(fileInput).toBeDisabled()
    
    await waitFor(() => {
      expect(fileInput).not.toBeDisabled()
    })
  })

  it('should handle drop zone with no files', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    
    // Create drag event with no files
    const dragEvent = new Event('drop', { bubbles: true }) as any
    dragEvent.dataTransfer = {
      files: []
    }
    
    fireEvent(dropZone!, dragEvent)
    
    expect(FileService.validateFile).not.toHaveBeenCalled()
    expect(mockOnFileSelect).not.toHaveBeenCalled()
  })

  it('should handle drag over with preventDefault', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    
    const dragOverEvent = new Event('dragover', { bubbles: true }) as any
    const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault')
    
    fireEvent(dropZone!, dragOverEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(dropZone).toHaveClass('drag-over')
  })

  it('should handle drop with preventDefault', async () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    const file = sampleFiles.validCSV
    
    const dropEvent = new Event('drop', { bubbles: true }) as any
    dropEvent.dataTransfer = { files: [file] }
    const preventDefaultSpy = vi.spyOn(dropEvent, 'preventDefault')
    
    fireEvent(dropZone!, dropEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
    
    await waitFor(() => {
      expect(FileService.validateFile).toHaveBeenCalled()
    })
  })

  it('should apply correct CSS classes', async () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const dropZone = screen.getByLabelText('Upload File').parentElement
    
    // Normal state
    expect(dropZone).toHaveClass('drop-zone')
    expect(dropZone).not.toHaveClass('drag-over')
    expect(dropZone).not.toHaveClass('processing')
    
    // Drag over state
    fireEvent.dragOver(dropZone!)
    expect(dropZone).toHaveClass('drag-over')
    
    // Processing state (simulate by making validation slow)
    vi.mocked(FileService.validateFile).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        data: sampleValidationResults.valid,
        error: undefined
      }), 50))
    )
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    expect(dropZone).toHaveClass('processing')
    
    await waitFor(() => {
      expect(dropZone).not.toHaveClass('processing')
    })
  })

  it('should clear validation state when processing new file', async () => {
    vi.mocked(FileService.validateFile)
      .mockResolvedValueOnce({
        data: sampleValidationResults.invalid,
        error: undefined
      })
      .mockResolvedValueOnce({
        data: sampleValidationResults.valid,
        error: undefined
      })
    
    render(<FileUpload onFileSelect={mockOnFileSelect} />)
    
    const fileInput = screen.getByRole('button', { hidden: true }) as HTMLInputElement
    
    // First file with validation errors
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.unsupportedFile],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Errors:')).toBeInTheDocument()
    })
    
    // Second file should clear previous validation
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    // During processing, validation should be cleared
    expect(screen.queryByText('❌ Errors:')).not.toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('✅ File validated successfully!')).toBeInTheDocument()
    })
  })
})