import React, { useState, useCallback, useMemo } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { FileService } from '@/services/FileService'
import { DotArtService } from '@/services/DotArtService'
import { parseCSVContent } from '@/utils/CSVParser'
import type { DotPattern } from '@/types'

interface ParsedData {
  type: 'csv' | 'image'
  file: File
  timestamp: Date
  details: {
    size: string
    dimensions?: { width: number; height: number }
    preview?: string
    dotPattern?: DotPattern
    parseErrors?: string[]
    parseWarnings?: string[]
  }
}

export const ImageLoadPage: React.FC = () => {
  const [uploadHistory, setUploadHistory] = useState<ParsedData[]>([])
  const [selectedData, setSelectedData] = useState<ParsedData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState('')

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true)
    setProcessingStage('Processing file...')

    try {
      const parsedData: ParsedData = {
        type: FileService.isCSV(file) ? 'csv' : 'image',
        file,
        timestamp: new Date(),
        details: {
          size: FileService.formatFileSize(file.size)
        }
      }

      if (FileService.isCSV(file)) {
        await processCSVFile(file, parsedData)
      } else if (FileService.isImage(file)) {
        await processImageFile(file, parsedData)
      }

      // Add to history
      setUploadHistory(prev => [parsedData, ...prev])
      setSelectedData(parsedData)

    } catch (error) {
      console.error('File processing error:', error)
      
      // Still add to history with error info
      const errorData: ParsedData = {
        type: FileService.isCSV(file) ? 'csv' : 'image',
        file,
        timestamp: new Date(),
        details: {
          size: FileService.formatFileSize(file.size),
          parseErrors: [error instanceof Error ? error.message : 'Unknown processing error']
        }
      }
      setUploadHistory(prev => [errorData, ...prev])
      setSelectedData(errorData)
    } finally {
      setIsProcessing(false)
      setProcessingStage('')
    }
  }, [])

  const processCSVFile = async (file: File, parsedData: ParsedData) => {
    setProcessingStage('Reading CSV file...')
    
    try {
      const result = await FileService.readFileAsText(file)
      
      if (result.error) {
        throw new Error(result.error.userMessage || result.error.message)
      }
      
      if (!result.data) {
        throw new Error('Failed to read file content')
      }
      
      setProcessingStage('Parsing CSV data...')
      
      const dotPattern = parseCSVContent(result.data)
      
      parsedData.details.dimensions = {
        width: dotPattern.width,
        height: dotPattern.height
      }
      parsedData.details.dotPattern = dotPattern
      
      // Generate statistics
      const stats = DotArtService.getPatternStats(dotPattern)
      parsedData.details.parseWarnings = []
      
      if (stats.fillPercentage < 5) {
        parsedData.details.parseWarnings.push('Pattern appears mostly empty (< 5% filled)')
      } else if (stats.fillPercentage > 90) {
        parsedData.details.parseWarnings.push('Pattern is very dense (> 90% filled)')
      }
      
      if (dotPattern.width * dotPattern.height > 50000) {
        parsedData.details.parseWarnings.push('Large pattern may impact performance')
      }

    } catch (error) {
      parsedData.details.parseErrors = [
        error instanceof Error ? error.message : 'CSV parsing failed'
      ]
    }
  }

  const processImageFile = async (file: File, parsedData: ParsedData) => {
    setProcessingStage('Reading image file...')
    
    try {
      const dataURL = await FileService.readFileAsDataURL(file)
      parsedData.details.preview = dataURL
      
      setProcessingStage('Analyzing image dimensions...')
      
      // Get image dimensions
      const dimensions = await getImageDimensions(dataURL)
      parsedData.details.dimensions = dimensions
      
      parsedData.details.parseWarnings = []
      
      // Add analysis warnings
      if (dimensions.width > 1000 || dimensions.height > 1000) {
        parsedData.details.parseWarnings.push('Large image dimensions may require conversion optimization')
      }
      
      if (dimensions.width * dimensions.height > 1000000) {
        parsedData.details.parseWarnings.push('High resolution image - consider resizing for faster processing')
      }
      
      const aspectRatio = dimensions.width / dimensions.height
      if (aspectRatio > 5 || aspectRatio < 0.2) {
        parsedData.details.parseWarnings.push('Extreme aspect ratio may not be suitable for 3D printing')
      }

    } catch (error) {
      parsedData.details.parseErrors = [
        error instanceof Error ? error.message : 'Image processing failed'
      ]
    }
  }

  const getImageDimensions = (dataURL: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = dataURL
    })
  }

  const clearHistory = useCallback(() => {
    setUploadHistory([])
    setSelectedData(null)
  }, [])

  const downloadSampleCSV = useCallback(() => {
    // Create a sample 10x10 pattern
    const samplePattern = `true,false,true,false,true,false,true,false,true,false
false,true,false,true,false,true,false,true,false,true
true,false,true,false,true,false,true,false,true,false
false,true,false,true,false,true,false,true,false,true
true,false,true,false,true,false,true,false,true,false
false,true,false,true,false,true,false,true,false,true
true,false,true,false,true,false,true,false,true,false
false,true,false,true,false,true,false,true,false,true
true,false,true,false,true,false,true,false,true,false
false,true,false,true,false,true,false,true,false,true`

    const blob = FileService.createTextBlob(samplePattern, 'text/csv')
    FileService.downloadFile(blob, 'sample-pattern.csv')
  }, [])

  const summary = useMemo(() => {
    const csvFiles = uploadHistory.filter(item => item.type === 'csv')
    const imageFiles = uploadHistory.filter(item => item.type === 'image')
    const successfulUploads = uploadHistory.filter(item => !item.details.parseErrors)
    const failedUploads = uploadHistory.filter(item => item.details.parseErrors)

    return {
      total: uploadHistory.length,
      csvCount: csvFiles.length,
      imageCount: imageFiles.length,
      successCount: successfulUploads.length,
      failureCount: failedUploads.length
    }
  }, [uploadHistory])

  return (
    <div className="image-load-page">
      <header className="page-header">
        <h1>Image Load Testing Page</h1>
        <p>Test file upload, validation, and parsing functionality in isolation</p>
      </header>

      {/* File Upload Section */}
      <section className="upload-section">
        <h2>File Upload</h2>
        <FileUpload
          onFileSelect={handleFileSelect}
          acceptedTypes=".csv,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          maxSize={10 * 1024 * 1024} // 10MB
        />

        <div className="upload-actions">
          <button onClick={downloadSampleCSV} className="sample-button">
            📄 Download Sample CSV
          </button>
        </div>

        {isProcessing && (
          <div className="processing-status">
            <div className="spinner"></div>
            <span>{processingStage}</span>
          </div>
        )}
      </section>

      {/* Summary Statistics */}
      {uploadHistory.length > 0 && (
        <section className="summary-section">
          <h2>Upload Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Uploads:</span>
              <span className="summary-value">{summary.total}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">CSV Files:</span>
              <span className="summary-value">{summary.csvCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Image Files:</span>
              <span className="summary-value">{summary.imageCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Successful:</span>
              <span className="summary-value success">{summary.successCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Failed:</span>
              <span className="summary-value error">{summary.failureCount}</span>
            </div>
          </div>
          
          <button onClick={clearHistory} className="clear-button">
            🗑️ Clear History
          </button>
        </section>
      )}

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <section className="history-section">
          <h2>Upload History</h2>
          <div className="history-list">
            {uploadHistory.map((item, index) => (
              <div
                key={index}
                className={`history-item ${selectedData === item ? 'selected' : ''} ${
                  item.details.parseErrors ? 'error' : ''
                }`}
                onClick={() => setSelectedData(item)}
              >
                <div className="history-header">
                  <span className="file-icon">
                    {item.type === 'csv' ? '📄' : '🖼️'}
                  </span>
                  <span className="file-name">{item.file.name}</span>
                  <span className="file-size">{item.details.size}</span>
                  <span className="timestamp">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                {item.details.dimensions && (
                  <div className="dimensions">
                    {item.details.dimensions.width} × {item.details.dimensions.height}
                  </div>
                )}
                
                {item.details.parseErrors && (
                  <div className="error-indicator">❌ Parse Error</div>
                )}
                
                {item.details.parseWarnings && item.details.parseWarnings.length > 0 && (
                  <div className="warning-indicator">⚠️ {item.details.parseWarnings.length} warnings</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Selected File Details */}
      {selectedData && (
        <section className="details-section">
          <h2>File Details: {selectedData.file.name}</h2>
          
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{selectedData.type.toUpperCase()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Size:</span>
              <span className="detail-value">{selectedData.details.size}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">MIME Type:</span>
              <span className="detail-value">{selectedData.file.type || 'unknown'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Modified:</span>
              <span className="detail-value">
                {new Date(selectedData.file.lastModified).toLocaleString()}
              </span>
            </div>
            {selectedData.details.dimensions && (
              <div className="detail-item">
                <span className="detail-label">Dimensions:</span>
                <span className="detail-value">
                  {selectedData.details.dimensions.width} × {selectedData.details.dimensions.height}
                </span>
              </div>
            )}
          </div>

          {/* Parse Errors */}
          {selectedData.details.parseErrors && selectedData.details.parseErrors.length > 0 && (
            <div className="parse-errors">
              <h3>❌ Parse Errors</h3>
              <ul>
                {selectedData.details.parseErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Parse Warnings */}
          {selectedData.details.parseWarnings && selectedData.details.parseWarnings.length > 0 && (
            <div className="parse-warnings">
              <h3>⚠️ Warnings</h3>
              <ul>
                {selectedData.details.parseWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dot Pattern Preview for CSV */}
          {selectedData.details.dotPattern && (
            <div className="dot-pattern-preview">
              <h3>📊 Pattern Statistics</h3>
              <div className="pattern-stats">
                {(() => {
                  const stats = DotArtService.getPatternStats(selectedData.details.dotPattern)
                  return (
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Total Dots:</span>
                        <span className="stat-value">{stats.totalDots}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Active Dots:</span>
                        <span className="stat-value">{stats.activeDots}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Fill Percentage:</span>
                        <span className="stat-value">{stats.fillPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Image Preview */}
          {selectedData.details.preview && (
            <div className="image-preview">
              <h3>🖼️ Image Preview</h3>
              <div className="preview-container">
                <img
                  src={selectedData.details.preview}
                  alt={selectedData.file.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="test-help">
        <h2>Testing Instructions</h2>
        <div className="help-content">
          <h3>📄 CSV File Testing</h3>
          <ul>
            <li>Upload CSV files with true/false or 1/0 values</li>
            <li>Test various delimiters (comma, semicolon, tab)</li>
            <li>Try files with different dimensions and patterns</li>
            <li>Test edge cases: empty files, malformed data, very large patterns</li>
          </ul>

          <h3>🖼️ Image File Testing</h3>
          <ul>
            <li>Upload various image formats (JPG, PNG, GIF, BMP, WebP)</li>
            <li>Test different image sizes and resolutions</li>
            <li>Try images with different aspect ratios</li>
            <li>Test very large images and small thumbnails</li>
          </ul>

          <h3>🔍 Validation Testing</h3>
          <ul>
            <li>Try uploading unsupported file types</li>
            <li>Test file size limits with very large files</li>
            <li>Upload corrupted or incomplete files</li>
            <li>Test drag-and-drop vs click-to-browse functionality</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

export default ImageLoadPage