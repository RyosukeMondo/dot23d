import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    this.setState({
      hasError: true,
      error,
      errorInfo
    })

    // In production, you might want to log this to an error reporting service
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined 
    })
  }

  render() {
    if (this.state.hasError) {
      // If a fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>An unexpected error occurred in the application.</p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Mode)</summary>
                <div className="error-message">
                  <h4>Error Message:</h4>
                  <pre>{this.state.error.message}</pre>
                </div>
                
                {this.state.error.stack && (
                  <div className="error-stack">
                    <h4>Stack Trace:</h4>
                    <pre>{this.state.error.stack}</pre>
                  </div>
                )}
                
                {this.state.errorInfo?.componentStack && (
                  <div className="component-stack">
                    <h4>Component Stack:</h4>
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </details>
            )}
            
            <div className="error-actions">
              <button 
                onClick={this.handleReset}
                className="retry-button"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="reload-button"
              >
                Reload Page
              </button>
            </div>
            
            <div className="error-help">
              <p>If this problem persists, try:</p>
              <ul>
                <li>Refreshing the page</li>
                <li>Clearing your browser cache</li>
                <li>Using a different browser</li>
                <li>Checking the browser console for more details</li>
              </ul>
            </div>
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 400px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
              margin: 20px;
            }

            .error-boundary-content {
              max-width: 600px;
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              border: 1px solid #e1e5e9;
            }

            .error-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }

            .error-boundary h2 {
              color: #d32f2f;
              margin-bottom: 12px;
              font-size: 24px;
            }

            .error-boundary p {
              color: #666;
              margin-bottom: 24px;
              line-height: 1.6;
            }

            .error-details {
              text-align: left;
              margin: 24px 0;
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 16px;
              background: #f8f9fa;
            }

            .error-details summary {
              cursor: pointer;
              font-weight: bold;
              color: #333;
              margin-bottom: 12px;
            }

            .error-details summary:hover {
              color: #d32f2f;
            }

            .error-message,
            .error-stack,
            .component-stack {
              margin-bottom: 16px;
            }

            .error-details h4 {
              color: #333;
              margin-bottom: 8px;
              font-size: 14px;
            }

            .error-details pre {
              background: #fff;
              padding: 12px;
              border-radius: 4px;
              border: 1px solid #ddd;
              overflow-x: auto;
              font-size: 12px;
              color: #d32f2f;
              white-space: pre-wrap;
              word-break: break-word;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              margin: 24px 0;
            }

            .retry-button,
            .reload-button {
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            }

            .retry-button {
              background: #1976d2;
              color: white;
            }

            .retry-button:hover {
              background: #1565c0;
            }

            .reload-button {
              background: #666;
              color: white;
            }

            .reload-button:hover {
              background: #555;
            }

            .error-help {
              text-align: left;
              margin-top: 24px;
              padding-top: 24px;
              border-top: 1px solid #eee;
            }

            .error-help p {
              margin-bottom: 12px;
              color: #666;
              font-size: 14px;
            }

            .error-help ul {
              margin: 0;
              padding-left: 20px;
              color: #666;
              font-size: 14px;
            }

            .error-help li {
              margin-bottom: 8px;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary