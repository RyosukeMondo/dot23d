import React, { useState, useCallback } from 'react'
import { FileService } from '@/services/FileService'
import type { ValidationResult } from '@/types'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  acceptedTypes?: string
  maxSize?: number
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  acceptedTypes = '.csv,.jpg,.jpeg,.png,.gif,.bmp,.webp',
  maxSize = 10 * 1024 * 1024
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileValidation = useCallback(async (file: File) => {
    setIsProcessing(true)
    setValidation(null)

    try {
      const result = FileService.validateFile(file, {
        maxSize,
        allowedTypes: acceptedTypes.split(',')
      })

      setValidation(result)

      if (result.isValid) {
        onFileSelect(file)
      }
    } catch (error) {
      setValidation({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      })
    } finally {
      setIsProcessing(false)
    }
  }, [maxSize, acceptedTypes, onFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileValidation(files[0])
    }
  }, [handleFileValidation])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileValidation(files[0])
    }
  }, [handleFileValidation])

  return (
    <div className="file-upload">
      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${isProcessing ? 'processing' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="file-input"
          accept={acceptedTypes}
          onChange={handleFileInput}
          disabled={isProcessing}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-input" className="upload-label">
          {isProcessing ? (
            <div className="processing">
              <div className="spinner"></div>
              <p>Processing file...</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">📁</div>
              <h3>Upload File</h3>
              <p>Drag and drop a file here or click to browse</p>
              <p className="file-types">
                Supported: {acceptedTypes.replace(/\./g, '').toUpperCase()}
              </p>
              <p className="file-size">
                Max size: {FileService.formatFileSize(maxSize)}
              </p>
            </>
          )}
        </label>
      </div>

      {validation && (
        <div className={`validation-result ${validation.isValid ? 'valid' : 'invalid'}`}>
          {validation.errors.length > 0 && (
            <div className="errors">
              <h4>❌ Errors:</h4>
              <ul>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="warnings">
              <h4>⚠️ Warnings:</h4>
              <ul>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.isValid && (
            <div className="success">
              <h4>✅ File validated successfully!</h4>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FileUpload