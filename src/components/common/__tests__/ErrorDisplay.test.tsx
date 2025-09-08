import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorDisplay } from '../ErrorDisplay'
import { ErrorHandler } from '@/utils/errorHandler'

describe('ErrorDisplay', () => {
  const mockError = new ErrorHandler.FileError('Test file error', 'FILE_VALIDATION_FAILED')

  it('should render error message', () => {
    render(<ErrorDisplay error={mockError} />)
    
    expect(screen.getByText('Test file error')).toBeInTheDocument()
  })

  it('should show error icon for error severity', () => {
    render(<ErrorDisplay error={mockError} />)
    
    const errorIcon = screen.getByText('❌')
    expect(errorIcon).toBeInTheDocument()
  })

  it('should show warning icon for warning severity', () => {
    const warningError = { ...mockError, severity: 'warning' as const }
    render(<ErrorDisplay error={warningError} />)
    
    const warningIcon = screen.getByText('⚠️')
    expect(warningIcon).toBeInTheDocument()
  })

  it('should show info icon for info severity', () => {
    const infoError = { ...mockError, severity: 'info' as const }
    render(<ErrorDisplay error={infoError} />)
    
    const infoIcon = screen.getByText('ℹ️')
    expect(infoIcon).toBeInTheDocument()
  })

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorDisplay error={mockError} onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)
    
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should call onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorDisplay error={mockError} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByText('Dismiss')
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('should not show retry button when onRetry is not provided', () => {
    render(<ErrorDisplay error={mockError} />)
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument()
  })

  it('should not show dismiss button when onDismiss is not provided', () => {
    render(<ErrorDisplay error={mockError} />)
    
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
  })

  it('should show technical details when showDetails is true', () => {
    const errorWithDetails = {
      ...mockError,
      technicalDetails: 'Technical error details'
    }
    render(<ErrorDisplay error={errorWithDetails} showDetails={true} />)
    
    expect(screen.getByText('Technical error details')).toBeInTheDocument()
  })

  it('should hide technical details when showDetails is false', () => {
    const errorWithDetails = {
      ...mockError,
      technicalDetails: 'Technical error details'
    }
    render(<ErrorDisplay error={errorWithDetails} showDetails={false} />)
    
    expect(screen.queryByText('Technical error details')).not.toBeInTheDocument()
  })

  it('should show expandable details section when showDetails is not provided', () => {
    const errorWithDetails = {
      ...mockError,
      technicalDetails: 'Technical error details'
    }
    render(<ErrorDisplay error={errorWithDetails} />)
    
    const detailsButton = screen.getByText('Show Details')
    expect(detailsButton).toBeInTheDocument()
    
    fireEvent.click(detailsButton)
    
    expect(screen.getByText('Technical error details')).toBeInTheDocument()
    expect(screen.getByText('Hide Details')).toBeInTheDocument()
  })

  it('should apply correct CSS classes for different severities', () => {
    const { rerender } = render(<ErrorDisplay error={mockError} />)
    
    const errorDisplay = screen.getByRole('alert')
    expect(errorDisplay).toHaveClass('error-display', 'error-display--error')
    
    const warningError = { ...mockError, severity: 'warning' as const }
    rerender(<ErrorDisplay error={warningError} />)
    expect(errorDisplay).toHaveClass('error-display', 'error-display--warning')
    
    const infoError = { ...mockError, severity: 'info' as const }
    rerender(<ErrorDisplay error={infoError} />)
    expect(errorDisplay).toHaveClass('error-display', 'error-display--info')
  })

  it('should render with proper accessibility attributes', () => {
    render(<ErrorDisplay error={mockError} />)
    
    const errorDisplay = screen.getByRole('alert')
    expect(errorDisplay).toHaveAttribute('role', 'alert')
    expect(errorDisplay).toHaveAttribute('aria-live', 'assertive')
  })

  it('should handle error without userMessage gracefully', () => {
    const errorWithoutMessage = {
      ...mockError,
      userMessage: undefined
    }
    render(<ErrorDisplay error={errorWithoutMessage} />)
    
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })

  it('should handle error without severity gracefully', () => {
    const errorWithoutSeverity = {
      userMessage: 'Test error',
      technicalDetails: 'Details'
    }
    render(<ErrorDisplay error={errorWithoutSeverity} />)
    
    const errorIcon = screen.getByText('❌')
    expect(errorIcon).toBeInTheDocument()
  })

  it('should show both retry and dismiss buttons when both callbacks are provided', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()
    render(<ErrorDisplay error={mockError} onRetry={onRetry} onDismiss={onDismiss} />)
    
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('should handle long error messages gracefully', () => {
    const longError = {
      ...mockError,
      userMessage: 'This is a very long error message that should wrap properly and not break the layout. It contains multiple sentences to test the display behavior.'
    }
    render(<ErrorDisplay error={longError} />)
    
    expect(screen.getByText(longError.userMessage)).toBeInTheDocument()
  })

  it('should handle error with recovery suggestion', () => {
    const errorWithSuggestion = {
      ...mockError,
      userMessage: 'File upload failed',
      recoverySuggestion: 'Please try selecting a different file'
    }
    render(<ErrorDisplay error={errorWithSuggestion} />)
    
    expect(screen.getByText('File upload failed')).toBeInTheDocument()
    expect(screen.getByText('Please try selecting a different file')).toBeInTheDocument()
  })
})