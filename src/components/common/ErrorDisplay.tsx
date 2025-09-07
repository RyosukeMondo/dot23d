import React from 'react'
import type { ProcessedError } from '@/utils/errorHandler'

interface ErrorDisplayProps {
  error: ProcessedError
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false
}) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'high':
        return '⚠️'
      case 'medium':
        return '⚠️'
      default:
        return 'ℹ️'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#d32f2f'
      case 'high':
        return '#f57c00'
      case 'medium':
        return '#fbc02d'
      default:
        return '#1976d2'
    }
  }

  return (
    <div className="error-display" style={{ borderLeftColor: getSeverityColor(error.severity) }}>
      <div className="error-header">
        <div className="error-title">
          <span className="error-icon">{getSeverityIcon(error.severity)}</span>
          <span className="error-message">{error.userMessage}</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="dismiss-button" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>

      {error.actionable && error.recoveryActions && (
        <div className="recovery-actions">
          <p>Try the following:</p>
          <ul>
            {error.recoveryActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="error-actions">
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            Try Again
          </button>
        )}
      </div>

      {showDetails && import.meta.env.DEV && (
        <details className="error-technical-details">
          <summary>Technical Details (Development Mode)</summary>
          <div className="technical-info">
            <div className="error-metadata">
              <strong>Error ID:</strong> {error.id}<br/>
              <strong>Category:</strong> {error.category}<br/>
              <strong>Severity:</strong> {error.severity}<br/>
              <strong>Timestamp:</strong> {error.context.timestamp.toLocaleString()}
              {error.context.component && (
                <>
                  <br/><strong>Component:</strong> {error.context.component}
                </>
              )}
              {error.context.action && (
                <>
                  <br/><strong>Action:</strong> {error.context.action}
                </>
              )}
            </div>
            
            <div className="original-error">
              <strong>Original Message:</strong>
              <pre>{error.message}</pre>
            </div>
            
            {error.originalError.stack && (
              <div className="error-stack">
                <strong>Stack Trace:</strong>
                <pre>{error.originalError.stack}</pre>
              </div>
            )}

            {error.context.metadata && (
              <div className="error-context">
                <strong>Context:</strong>
                <pre>{JSON.stringify(error.context.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </details>
      )}

      <style>{`
        .error-display {
          background: #fef7f0;
          border: 1px solid #ffcc02;
          border-left: 4px solid #f57c00;
          border-radius: 6px;
          padding: 16px;
          margin: 8px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .error-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .error-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .error-message {
          color: #333;
          font-weight: 500;
          line-height: 1.4;
        }

        .dismiss-button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .dismiss-button:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .recovery-actions {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .recovery-actions p {
          margin: 0 0 8px 0;
          font-weight: 500;
          color: #495057;
        }

        .recovery-actions ul {
          margin: 0;
          padding-left: 20px;
          color: #6c757d;
        }

        .recovery-actions li {
          margin-bottom: 4px;
          line-height: 1.4;
        }

        .error-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .retry-button {
          background: #1976d2;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          transition: background-color 0.2s;
        }

        .retry-button:hover {
          background: #1565c0;
        }

        .error-technical-details {
          border-top: 1px solid #e9ecef;
          padding-top: 12px;
        }

        .error-technical-details summary {
          cursor: pointer;
          font-weight: 500;
          color: #6c757d;
          margin-bottom: 12px;
        }

        .error-technical-details summary:hover {
          color: #495057;
        }

        .technical-info {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 12px;
          font-size: 12px;
        }

        .error-metadata,
        .original-error,
        .error-stack,
        .error-context {
          margin-bottom: 12px;
        }

        .error-metadata strong,
        .original-error strong,
        .error-stack strong,
        .error-context strong {
          color: #495057;
        }

        .technical-info pre {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 3px;
          padding: 8px;
          margin-top: 4px;
          overflow-x: auto;
          color: #d32f2f;
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  )
}

export default ErrorDisplay