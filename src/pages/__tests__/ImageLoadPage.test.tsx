import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageLoadPage } from '../ImageLoadPage'
import { FileService } from '@/services/FileService'
import { DotArtService } from '@/services/DotArtService'
import { sampleFiles, sampleDotPatterns } from '@/test/fixtures'

// Mock services
vi.mock('@/services/FileService')
vi.mock('@/services/DotArtService')
vi.mock('@/utils/CSVParser')

// Mock FileUpload component
vi.mock('@/components/FileUpload', () => ({
  FileUpload: ({ onFileSelect, acceptedTypes, maxSize }: any) => (
    <div data-testid="file-upload">
      <input
        data-testid="file-input"
        type="file"
        accept={acceptedTypes}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && onFileSelect) {
            onFileSelect(file)
          }
        }}
      />
      <div>Max size: {maxSize}</div>
      <div>Accepted: {acceptedTypes}</div>
    </div>
  )
}))

describe('ImageLoadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(FileService.isCSV).mockImplementation((file) => file.name.endsWith('.csv'))
    vi.mocked(FileService.isImage).mockImplementation((file) => file.type.startsWith('image/'))
    vi.mocked(FileService.formatFileSize).mockImplementation((size) => `${size} bytes`)
    vi.mocked(FileService.readFileAsText).mockResolvedValue({ 
      data: 'true,false,true\nfalse,true,false', 
      error: undefined 
    })
    vi.mocked(FileService.readFileAsDataURL).mockResolvedValue('data:image/jpeg;base64,fake-data')
    vi.mocked(FileService.createTextBlob).mockReturnValue(new Blob())
    vi.mocked(FileService.downloadFile).mockImplementation(() => {})
    
    vi.mocked(DotArtService.getPatternStats).mockReturnValue({
      totalDots: 9,
      activeDots: 5,
      fillPercentage: 55.6
    })

    // Mock parseCSVContent
    const { parseCSVContent } = vi.mocked(await import('@/utils/CSVParser'))
    parseCSVContent.mockReturnValue(sampleDotPatterns.small)
  })

  it('should render page header and description', () => {
    render(<ImageLoadPage />)
    
    expect(screen.getByText('Image Load Testing Page')).toBeInTheDocument()
    expect(screen.getByText('Test file upload, validation, and parsing functionality in isolation')).toBeInTheDocument()
  })

  it('should render file upload component with correct props', () => {
    render(<ImageLoadPage />)
    
    const fileUpload = screen.getByTestId('file-upload')
    expect(fileUpload).toBeInTheDocument()
    expect(screen.getByText('Max size: 10485760')).toBeInTheDocument()
    expect(screen.getByText('Accepted: .csv,.jpg,.jpeg,.png,.gif,.bmp,.webp')).toBeInTheDocument()
  })

  it('should render download sample CSV button', () => {
    render(<ImageLoadPage />)
    
    const sampleButton = screen.getByText('📄 Download Sample CSV')
    expect(sampleButton).toBeInTheDocument()
  })

  it('should handle CSV file upload successfully', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Simulate file selection
    const file = sampleFiles.validCSV
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(FileService.readFileAsText).toHaveBeenCalledWith(file)
      expect(screen.getByText('Upload Summary')).toBeInTheDocument()
    })
  })

  it('should handle image file upload successfully', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Mock Image constructor for dimensions
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      width: 100,
      height: 100
    }
    global.Image = vi.fn(() => mockImage)
    
    // Simulate file selection
    const file = sampleFiles.validImage
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Trigger image load
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload()
      }
    }, 0)
    
    await waitFor(() => {
      expect(FileService.readFileAsDataURL).toHaveBeenCalledWith(file)
      expect(screen.getByText('Upload Summary')).toBeInTheDocument()
    })
  })

  it('should show processing status during file processing', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Delay the readFileAsText mock
    vi.mocked(FileService.readFileAsText).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ 
        data: 'true,false\nfalse,true', 
        error: undefined 
      }), 100))
    )
    
    // Simulate file selection
    const file = sampleFiles.validCSV
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Should show processing status
    expect(screen.getByText('Processing file...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.queryByText('Processing file...')).not.toBeInTheDocument()
    })
  })

  it('should handle file processing errors gracefully', async () => {
    render(<ImageLoadPage />)
    
    // Mock error
    vi.mocked(FileService.readFileAsText).mockResolvedValue({
      data: undefined,
      error: { userMessage: 'Failed to read file', message: 'Read error' }
    })
    
    const fileInput = screen.getByTestId('file-input')
    
    // Simulate file selection
    const file = sampleFiles.validCSV
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('Upload Summary')).toBeInTheDocument()
      expect(screen.getByText('❌ Parse Error')).toBeInTheDocument()
    })
  })

  it('should download sample CSV when button is clicked', () => {
    render(<ImageLoadPage />)
    
    const sampleButton = screen.getByText('📄 Download Sample CSV')
    fireEvent.click(sampleButton)
    
    expect(FileService.createTextBlob).toHaveBeenCalledWith(
      expect.stringContaining('true,false,true'),
      'text/csv'
    )
    expect(FileService.downloadFile).toHaveBeenCalledWith(
      expect.any(Blob),
      'sample-pattern.csv'
    )
  })

  it('should display upload summary after successful uploads', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Upload CSV file
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('Upload Summary')).toBeInTheDocument()
      expect(screen.getByText('Total Uploads:')).toBeInTheDocument()
      expect(screen.getByText('CSV Files:')).toBeInTheDocument()
      expect(screen.getByText('Image Files:')).toBeInTheDocument()
      expect(screen.getByText('Successful:')).toBeInTheDocument()
      expect(screen.getByText('Failed:')).toBeInTheDocument()
    })
  })

  it('should display upload history with file details', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Upload CSV file
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('Upload History')).toBeInTheDocument()
      expect(screen.getByText('test.csv')).toBeInTheDocument()
      expect(screen.getByText('📄')).toBeInTheDocument() // CSV icon
    })
  })

  it('should show selected file details when history item is clicked', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Upload CSV file
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      const historyItem = screen.getByText('test.csv').closest('.history-item')
      expect(historyItem).toBeInTheDocument()
      
      if (historyItem) {
        fireEvent.click(historyItem)
      }
      
      expect(screen.getByText('File Details: test.csv')).toBeInTheDocument()
      expect(screen.getByText('Type:')).toBeInTheDocument()
      expect(screen.getByText('Size:')).toBeInTheDocument()
      expect(screen.getByText('MIME Type:')).toBeInTheDocument()
    })
  })

  it('should show pattern statistics for CSV files', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Upload CSV file
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('📊 Pattern Statistics')).toBeInTheDocument()
      expect(screen.getByText('Total Dots:')).toBeInTheDocument()
      expect(screen.getByText('Active Dots:')).toBeInTheDocument()
      expect(screen.getByText('Fill Percentage:')).toBeInTheDocument()
    })
  })

  it('should show image preview for image files', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Mock Image constructor
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      width: 100,
      height: 100
    }
    global.Image = vi.fn(() => mockImage)
    
    // Upload image file
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validImage],
      writable: false
    })
    fireEvent.change(fileInput)
    
    // Trigger image load
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload()
      }
    }, 0)
    
    await waitFor(() => {
      expect(screen.getByText('🖼️ Image Preview')).toBeInTheDocument()
      const previewImg = screen.getByAltText('test.jpg')
      expect(previewImg).toBeInTheDocument()
      expect(previewImg.getAttribute('src')).toBe('data:image/jpeg;base64,fake-data')
    })
  })

  it('should clear history when clear button is clicked', async () => {
    render(<ImageLoadPage />)
    
    const fileInput = screen.getByTestId('file-input')
    
    // Upload a file first
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('Upload Summary')).toBeInTheDocument()
    })
    
    // Click clear button
    const clearButton = screen.getByText('🗑️ Clear History')
    fireEvent.click(clearButton)
    
    expect(screen.queryByText('Upload Summary')).not.toBeInTheDocument()
    expect(screen.queryByText('Upload History')).not.toBeInTheDocument()
  })

  it('should show warnings for CSV files', async () => {
    render(<ImageLoadPage />)
    
    // Mock pattern stats to trigger warnings
    vi.mocked(DotArtService.getPatternStats).mockReturnValue({
      totalDots: 100,
      activeDots: 2,
      fillPercentage: 2 // Less than 5% - should trigger warning
    })
    
    const fileInput = screen.getByTestId('file-input')
    
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText(/warnings/)).toBeInTheDocument()
    })
  })

  it('should show warnings for large images', async () => {
    render(<ImageLoadPage />)
    
    // Mock large image dimensions
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      width: 2000,
      height: 2000
    }
    global.Image = vi.fn(() => mockImage)
    
    const fileInput = screen.getByTestId('file-input')
    
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validImage],
      writable: false
    })
    fireEvent.change(fileInput)
    
    // Trigger image load
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload()
      }
    }, 0)
    
    await waitFor(() => {
      expect(screen.getByText(/warnings/)).toBeInTheDocument()
    })
  })

  it('should render testing instructions', () => {
    render(<ImageLoadPage />)
    
    expect(screen.getByText('Testing Instructions')).toBeInTheDocument()
    expect(screen.getByText('📄 CSV File Testing')).toBeInTheDocument()
    expect(screen.getByText('🖼️ Image File Testing')).toBeInTheDocument()
    expect(screen.getByText('🔍 Validation Testing')).toBeInTheDocument()
  })

  it('should handle image dimension loading error', async () => {
    render(<ImageLoadPage />)
    
    // Mock Image constructor to simulate error
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      width: 100,
      height: 100
    }
    global.Image = vi.fn(() => mockImage)
    
    const fileInput = screen.getByTestId('file-input')
    
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validImage],
      writable: false
    })
    fireEvent.change(fileInput)
    
    // Trigger image error
    setTimeout(() => {
      if (mockImage.onerror) {
        mockImage.onerror(new Error('Failed to load image'))
      }
    }, 0)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Parse Error')).toBeInTheDocument()
    })
  })

  it('should show error when file read as data URL fails', async () => {
    render(<ImageLoadPage />)
    
    // Mock readFileAsDataURL to fail
    vi.mocked(FileService.readFileAsDataURL).mockRejectedValue(new Error('Failed to read file'))
    
    const fileInput = screen.getByTestId('file-input')
    
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validImage],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Parse Error')).toBeInTheDocument()
    })
  })

  it('should display parse errors in file details', async () => {
    render(<ImageLoadPage />)
    
    // Mock CSV parsing to fail
    const { parseCSVContent } = vi.mocked(await import('@/utils/CSVParser'))
    parseCSVContent.mockImplementation(() => {
      throw new Error('Invalid CSV format')
    })
    
    const fileInput = screen.getByTestId('file-input')
    
    Object.defineProperty(fileInput, 'files', {
      value: [sampleFiles.validCSV],
      writable: false
    })
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('❌ Parse Errors')).toBeInTheDocument()
      expect(screen.getByText('Invalid CSV format')).toBeInTheDocument()
    })
  })
})