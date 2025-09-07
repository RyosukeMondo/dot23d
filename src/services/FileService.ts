import type { ValidationResult } from '@/types'
import { withErrorHandling, withSyncErrorHandling, ErrorHandler, ErrorCategory } from '@/utils/errorHandler'

/**
 * Error class for file operations
 */
export class FileServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'FileServiceError'
  }
}

/**
 * Supported file types
 */
export const SUPPORTED_FILE_TYPES = {
  CSV: '.csv',
  IMAGE: '.jpg,.jpeg,.png,.gif,.bmp,.webp'
} as const

/**
 * File validation options
 */
export interface FileValidationOptions {
  maxSize: number // in bytes
  allowedTypes: string[]
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION: FileValidationOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
}

/**
 * Service for handling file upload and download operations
 */
export class FileService {
  /**
   * Validate uploaded file
   */
  static validateFile(file: File, options: Partial<FileValidationOptions> = {}): ValidationResult {
    const opts = { ...DEFAULT_VALIDATION, ...options }
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check file size
    if (file.size > opts.maxSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(opts.maxSize)})`)
    }
    
    // Check file type
    const fileExtension = this.getFileExtension(file.name).toLowerCase()
    const isAllowedType = opts.allowedTypes.some(type => 
      type.toLowerCase() === fileExtension
    )
    
    if (!isAllowedType) {
      errors.push(`File type "${fileExtension}" is not supported. Allowed types: ${opts.allowedTypes.join(', ')}`)
    }
    
    // Additional checks for specific file types
    if (fileExtension === '.csv') {
      if (file.size === 0) {
        errors.push('CSV file appears to be empty')
      }
    }
    
    // Warnings for potentially problematic files
    if (file.size > 5 * 1024 * 1024) { // 5MB
      warnings.push('Large file size may impact processing performance')
    }
    
    if (fileExtension === '.bmp') {
      warnings.push('BMP files may have larger file sizes and slower processing')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Upload and validate file with comprehensive error handling
   */
  static async uploadFile(file: File, options: Partial<FileValidationOptions> = {}): Promise<{ data?: File; error?: any }> {
    return await withErrorHandling(
      async () => {
        // Validate the file
        const validation = this.validateFile(file, options)
        
        if (!validation.isValid) {
          throw new FileServiceError(
            `File validation failed: ${validation.errors.join(', ')}`,
            'VALIDATION_FAILED'
          )
        }
        
        // Log warnings if any
        if (validation.warnings.length > 0) {
          console.warn('File upload warnings:', validation.warnings)
        }
        
        return file
      },
      {
        component: 'FileService',
        action: 'uploadFile',
        metadata: { 
          fileName: file.name, 
          fileSize: file.size, 
          fileType: file.type 
        }
      }
    )
  }
  
  /**
   * Create download for blob data with error handling
   */
  static downloadFile(blob: Blob, filename: string): { error?: any } {
    const result = withSyncErrorHandling(
      () => {
        // Create download URL
        const url = URL.createObjectURL(blob)
        
        // Create temporary download link
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.style.display = 'none'
        
        // Trigger download
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up URL
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 100)
      },
      {
        component: 'FileService',
        action: 'downloadFile',
        metadata: { 
          filename,
          blobSize: blob.size,
          blobType: blob.type
        }
      }
    )
    
    if (result.error) {
      return { error: result.error }
    }
    
    return {}
  }
  
  /**
   * Read file as text with comprehensive error handling
   */
  static async readFileAsText(file: File): Promise<{ data?: string; error?: any }> {
    return await withErrorHandling(
      () => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        
        reader.onload = (event) => {
          const result = event.target?.result
          if (typeof result === 'string') {
            resolve(result)
          } else {
            reject(new FileServiceError('Failed to read file as text', 'READ_FAILED'))
          }
        }
        
        reader.onerror = () => {
          reject(new FileServiceError('File reader error', 'READ_ERROR'))
        }
        
        reader.readAsText(file)
      }),
      {
        component: 'FileService',
        action: 'readFileAsText',
        metadata: { 
          fileName: file.name, 
          fileSize: file.size 
        }
      }
    )
  }
  
  /**
   * Read file as ArrayBuffer
   */
  static async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const result = event.target?.result
        if (result instanceof ArrayBuffer) {
          resolve(result)
        } else {
          reject(new FileServiceError('Failed to read file as ArrayBuffer', 'READ_FAILED'))
        }
      }
      
      reader.onerror = () => {
        reject(new FileServiceError('File reader error', 'READ_ERROR'))
      }
      
      reader.readAsArrayBuffer(file)
    })
  }
  
  /**
   * Read file as Data URL
   */
  static async readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const result = event.target?.result
        if (typeof result === 'string') {
          resolve(result)
        } else {
          reject(new FileServiceError('Failed to read file as Data URL', 'READ_FAILED'))
        }
      }
      
      reader.onerror = () => {
        reject(new FileServiceError('File reader error', 'READ_ERROR'))
      }
      
      reader.readAsDataURL(file)
    })
  }
  
  /**
   * Check if file is an image
   */
  static isImage(file: File): boolean {
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const extension = this.getFileExtension(file.name).toLowerCase()
    return imageTypes.includes(extension)
  }
  
  /**
   * Check if file is CSV
   */
  static isCSV(file: File): boolean {
    const extension = this.getFileExtension(file.name).toLowerCase()
    return extension === '.csv' || file.type === 'text/csv'
  }
  
  /**
   * Get file extension from filename
   */
  static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot === -1 ? '' : filename.substring(lastDot)
  }
  
  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  /**
   * Generate unique filename with timestamp
   */
  static generateUniqueFilename(baseName: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_')
    return `${cleanBaseName}_${timestamp}${extension}`
  }
  
  /**
   * Create blob from text content
   */
  static createTextBlob(content: string, mimeType: string = 'text/plain'): Blob {
    return new Blob([content], { type: `${mimeType};charset=utf-8` })
  }
}