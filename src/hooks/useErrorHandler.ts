import { useState, useCallback } from 'react'
import { useErrorHandler as useBaseErrorHandler } from '@/utils/errorHandler'
import type { ProcessedError } from '@/utils/errorHandler'

interface UseErrorHandlerReturn {
  error: ProcessedError | null
  clearError: () => void
  handleError: (error: Error | unknown, action?: string, metadata?: Record<string, any>) => ProcessedError
  handleAsyncOperation: <T>(
    operation: () => Promise<T>,
    action?: string,
    metadata?: Record<string, any>
  ) => Promise<{ data?: T; error?: ProcessedError }>
  handleSyncOperation: <T>(
    operation: () => T,
    action?: string,
    metadata?: Record<string, any>
  ) => { data?: T; error?: ProcessedError }
}

/**
 * React hook for comprehensive error handling in components
 * Provides state management and utility functions for handling errors
 */
export function useErrorHandler(componentName: string): UseErrorHandlerReturn {
  const [error, setError] = useState<ProcessedError | null>(null)
  const { handleError: baseHandleError } = useBaseErrorHandler(componentName)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const handleError = useCallback((
    error: Error | unknown, 
    action?: string, 
    metadata?: Record<string, any>
  ) => {
    const processedError = baseHandleError(error, action, metadata)
    setError(processedError)
    return processedError
  }, [baseHandleError])

  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    action?: string,
    metadata?: Record<string, any>
  ): Promise<{ data?: T; error?: ProcessedError }> => {
    try {
      clearError()
      const data = await operation()
      return { data }
    } catch (err) {
      const processedError = handleError(err, action, metadata)
      return { error: processedError }
    }
  }, [handleError, clearError])

  const handleSyncOperation = useCallback(<T>(
    operation: () => T,
    action?: string,
    metadata?: Record<string, any>
  ): { data?: T; error?: ProcessedError } => {
    try {
      clearError()
      const data = operation()
      return { data }
    } catch (err) {
      const processedError = handleError(err, action, metadata)
      return { error: processedError }
    }
  }, [handleError, clearError])

  return {
    error,
    clearError,
    handleError,
    handleAsyncOperation,
    handleSyncOperation
  }
}

export default useErrorHandler