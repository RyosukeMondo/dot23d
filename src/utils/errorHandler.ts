/**
 * Comprehensive error handling utilities
 * Provides centralized error management, logging, and user-friendly error messages
 */

export enum ErrorCategory {
  VALIDATION = 'validation',
  FILE_IO = 'file_io', 
  NETWORK = 'network',
  PROCESSING = 'processing',
  RENDERING = 'rendering',
  STORAGE = 'storage',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  userId?: string
  sessionId?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface ProcessedError {
  id: string
  category: ErrorCategory
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  userMessage: string
  originalError: Error
  context: ErrorContext
  actionable: boolean
  recoveryActions?: string[]
}

/**
 * Central error handler class
 */
export class ErrorHandler {
  private static errorQueue: ProcessedError[] = []
  private static maxQueueSize = 100

  /**
   * Process and classify an error
   */
  static processError(
    error: Error | unknown, 
    context: Partial<ErrorContext> = {}
  ): ProcessedError {
    const actualError = error instanceof Error ? error : new Error(String(error))
    const category = this.categorizeError(actualError)
    const severity = this.determineSeverity(actualError, category)
    
    const processedError: ProcessedError = {
      id: this.generateErrorId(),
      category,
      severity,
      message: actualError.message,
      userMessage: this.getUserFriendlyMessage(actualError, category),
      originalError: actualError,
      context: {
        timestamp: new Date(),
        ...context
      },
      actionable: this.isActionable(category),
      recoveryActions: this.getRecoveryActions(category)
    }

    this.logError(processedError)
    this.addToQueue(processedError)

    return processedError
  }

  /**
   * Categorize error based on type and message
   */
  private static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    
    if (message.includes('invalid') || message.includes('validation')) {
      return ErrorCategory.VALIDATION
    }
    
    if (message.includes('file') || message.includes('upload') || message.includes('download')) {
      return ErrorCategory.FILE_IO
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('request')) {
      return ErrorCategory.NETWORK
    }
    
    if (message.includes('processing') || message.includes('conversion') || message.includes('generation')) {
      return ErrorCategory.PROCESSING
    }
    
    if (message.includes('render') || message.includes('canvas') || message.includes('webgl')) {
      return ErrorCategory.RENDERING
    }
    
    if (message.includes('storage') || message.includes('localstorage') || message.includes('quota')) {
      return ErrorCategory.STORAGE
    }
    
    return ErrorCategory.UNKNOWN
  }

  /**
   * Determine error severity
   */
  private static determineSeverity(error: Error, category: ErrorCategory): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors that prevent core functionality
    if (category === ErrorCategory.RENDERING && error.message.includes('webgl')) {
      return 'critical'
    }
    
    if (category === ErrorCategory.STORAGE && error.message.includes('quota')) {
      return 'high'
    }
    
    // High priority errors
    if (category === ErrorCategory.PROCESSING || category === ErrorCategory.FILE_IO) {
      return 'high'
    }
    
    // Medium priority errors
    if (category === ErrorCategory.VALIDATION || category === ErrorCategory.NETWORK) {
      return 'medium'
    }
    
    return 'low'
  }

  /**
   * Generate user-friendly error messages
   */
  private static getUserFriendlyMessage(error: Error, category: ErrorCategory): string {
    const message = error.message.toLowerCase()
    
    switch (category) {
      case ErrorCategory.VALIDATION:
        if (message.includes('file')) return 'Please check your file format and try again'
        if (message.includes('size')) return 'The file is too large. Please use a smaller file'
        if (message.includes('format')) return 'Invalid file format. Please use a supported file type'
        return 'Please check your input and try again'
        
      case ErrorCategory.FILE_IO:
        if (message.includes('upload')) return 'File upload failed. Please try again'
        if (message.includes('download')) return 'Download failed. Please try again'
        if (message.includes('read')) return 'Unable to read the file. Please check if it\'s corrupted'
        return 'File operation failed. Please try again'
        
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again'
        
      case ErrorCategory.PROCESSING:
        if (message.includes('conversion')) return 'Image conversion failed. Please try a different image'
        if (message.includes('generation')) return '3D model generation failed. Please adjust parameters and try again'
        return 'Processing failed. Please try again with different settings'
        
      case ErrorCategory.RENDERING:
        if (message.includes('webgl')) return 'Your browser doesn\'t support WebGL. Please use a modern browser'
        if (message.includes('canvas')) return 'Canvas rendering failed. Please refresh the page'
        return 'Rendering failed. Please refresh the page'
        
      case ErrorCategory.STORAGE:
        if (message.includes('quota')) return 'Browser storage is full. Please clear some data and try again'
        return 'Storage operation failed. Please try again'
        
      default:
        return 'An unexpected error occurred. Please try again'
    }
  }

  /**
   * Check if error is actionable by user
   */
  private static isActionable(category: ErrorCategory): boolean {
    return [
      ErrorCategory.VALIDATION,
      ErrorCategory.FILE_IO,
      ErrorCategory.PROCESSING
    ].includes(category)
  }

  /**
   * Get recovery actions for different error categories
   */
  private static getRecoveryActions(category: ErrorCategory): string[] {
    switch (category) {
      case ErrorCategory.VALIDATION:
        return [
          'Check file format and size',
          'Verify input parameters',
          'Try with a different file'
        ]
        
      case ErrorCategory.FILE_IO:
        return [
          'Refresh the page and try again',
          'Check file permissions',
          'Try with a different file'
        ]
        
      case ErrorCategory.NETWORK:
        return [
          'Check your internet connection',
          'Try again in a few moments',
          'Refresh the page'
        ]
        
      case ErrorCategory.PROCESSING:
        return [
          'Try with a smaller file',
          'Adjust processing parameters', 
          'Use a different image format'
        ]
        
      case ErrorCategory.RENDERING:
        return [
          'Refresh the page',
          'Try a different browser',
          'Update your graphics drivers'
        ]
        
      case ErrorCategory.STORAGE:
        return [
          'Clear browser cache and data',
          'Free up storage space',
          'Try in private/incognito mode'
        ]
        
      default:
        return [
          'Refresh the page',
          'Try again',
          'Contact support if issue persists'
        ]
    }
  }

  /**
   * Log error to console and optionally to external service
   */
  private static logError(processedError: ProcessedError): void {
    const logLevel = this.getLogLevel(processedError.severity)
    
    console[logLevel](`[${processedError.category.toUpperCase()}] ${processedError.message}`, {
      id: processedError.id,
      severity: processedError.severity,
      context: processedError.context,
      stack: processedError.originalError.stack
    })

    // In production, send to error tracking service
    if (import.meta.env.PROD) {
      this.sendToErrorService(processedError)
    }
  }

  /**
   * Get appropriate console log level
   */
  private static getLogLevel(severity: string): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error'
      case 'medium':
        return 'warn'
      default:
        return 'info'
    }
  }

  /**
   * Send error to external tracking service (placeholder)
   */
  private static sendToErrorService(error: ProcessedError): void {
    // Placeholder for error tracking service integration
    // Example: Sentry, LogRocket, etc.
    try {
      // External service call would go here
      console.info('Error sent to tracking service:', error.id)
    } catch (e) {
      console.warn('Failed to send error to tracking service:', e)
    }
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add error to internal queue for analysis
   */
  private static addToQueue(error: ProcessedError): void {
    this.errorQueue.push(error)
    
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift() // Remove oldest error
    }
  }

  /**
   * Get recent errors for debugging
   */
  static getRecentErrors(limit = 10): ProcessedError[] {
    return this.errorQueue.slice(-limit)
  }

  /**
   * Clear error queue
   */
  static clearErrorQueue(): void {
    this.errorQueue = []
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): Record<string, any> {
    const stats = {
      total: this.errorQueue.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<string, number>,
      recent: this.errorQueue.slice(-5).map(e => ({
        id: e.id,
        category: e.category,
        severity: e.severity,
        timestamp: e.context.timestamp
      }))
    }

    this.errorQueue.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1
    })

    return stats
  }
}

/**
 * Utility function for handling async operations with error processing
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<ErrorContext> = {}
): Promise<{ data?: T; error?: ProcessedError }> {
  try {
    const data = await operation()
    return { data }
  } catch (error) {
    const processedError = ErrorHandler.processError(error, context)
    return { error: processedError }
  }
}

/**
 * Utility function for handling sync operations with error processing
 */
export function withSyncErrorHandling<T>(
  operation: () => T,
  context: Partial<ErrorContext> = {}
): { data?: T; error?: ProcessedError } {
  try {
    const data = operation()
    return { data }
  } catch (error) {
    const processedError = ErrorHandler.processError(error, context)
    return { error: processedError }
  }
}

/**
 * React hook for error handling in components
 */
export function useErrorHandler(componentName: string) {
  const handleError = (error: Error | unknown, action?: string, metadata?: Record<string, any>) => {
    return ErrorHandler.processError(error, {
      component: componentName,
      action,
      metadata
    })
  }

  return { handleError, getRecentErrors: ErrorHandler.getRecentErrors }
}

export default ErrorHandler