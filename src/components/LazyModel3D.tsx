/**
 * Lazy-loaded 3D Model component with dynamic Three.js loading
 * This component loads Three.js only when needed, reducing initial bundle size
 */

import { lazy, Suspense } from 'react';
import { DotPattern } from '../types/DotPattern';

// Lazy load the heavy 3D components
const Model3DComponent = lazy(() => import('./Model3D').then(module => ({
  default: module.Model3D || module.default
})));

const ModelViewerComponent = lazy(() => import('./ModelViewer').then(module => ({
  default: module.ModelViewer || module.default
})));

interface LazyModel3DProps {
  dotPattern: DotPattern;
  onExport?: (objContent: string) => void;
  onError?: (error: string) => void;
  className?: string;
  showControls?: boolean;
  autoGenerate?: boolean;
}

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner = ({ message = 'Loading 3D engine...' }: LoadingSpinnerProps) => (
  <div className="loading-spinner" data-testid="loading-3d">
    <div className="spinner-animation">
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
    </div>
    <p className="loading-message">{message}</p>
    <style>{`
      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 200px;
      }
      
      .spinner-animation {
        position: relative;
        width: 64px;
        height: 64px;
      }
      
      .spinner-ring {
        position: absolute;
        border: 4px solid transparent;
        border-top-color: #3b82f6;
        border-radius: 50%;
        width: 100%;
        height: 100%;
        animation: spin 1.2s linear infinite;
      }
      
      .spinner-ring:nth-child(2) {
        border-top-color: #10b981;
        animation-delay: -0.4s;
        animation-duration: 1.8s;
      }
      
      .spinner-ring:nth-child(3) {
        border-top-color: #f59e0b;
        animation-delay: -0.8s;
        animation-duration: 2.4s;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .loading-message {
        margin-top: 1rem;
        color: #6b7280;
        font-size: 0.875rem;
        text-align: center;
      }
    `}</style>
  </div>
);

const ErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <div className="error-fallback" data-testid="3d-error">
    <div className="error-icon">⚠️</div>
    <h3>3D Engine Failed to Load</h3>
    <p className="error-message">
      {error.message.includes('Loading chunk') 
        ? 'Failed to load 3D rendering components. This might be due to a network issue.'
        : error.message
      }
    </p>
    <div className="error-actions">
      <button onClick={retry} className="retry-button">
        Try Again
      </button>
      <p className="fallback-hint">
        If the problem persists, try refreshing the page or check your internet connection.
      </p>
    </div>
    <style>{`
      .error-fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 200px;
        text-align: center;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
      }
      
      .error-icon {
        font-size: 2rem;
        margin-bottom: 1rem;
      }
      
      .error-fallback h3 {
        color: #dc2626;
        margin: 0 0 0.5rem 0;
        font-size: 1.125rem;
        font-weight: 600;
      }
      
      .error-message {
        color: #991b1b;
        margin: 0 0 1.5rem 0;
        font-size: 0.875rem;
        max-width: 400px;
      }
      
      .error-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      
      .retry-button {
        background: #dc2626;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .retry-button:hover {
        background: #b91c1c;
      }
      
      .fallback-hint {
        color: #6b7280;
        font-size: 0.75rem;
        margin: 0;
        max-width: 300px;
      }
    `}</style>
  </div>
);

class LazyModel3DErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: () => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; onError?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyModel3D Error:', error, errorInfo);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error || new Error('Unknown error')}
          retry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}

export const LazyModel3D = (props: LazyModel3DProps) => {
  const { onError, ...componentProps } = props;

  return (
    <LazyModel3DErrorBoundary onError={onError}>
      <Suspense fallback={<LoadingSpinner />}>
        <Model3DComponent {...componentProps} />
      </Suspense>
    </LazyModel3DErrorBoundary>
  );
};

export const LazyModelViewer = (props: Omit<LazyModel3DProps, 'autoGenerate'>) => {
  const { onError, ...componentProps } = props;

  return (
    <LazyModel3DErrorBoundary onError={onError}>
      <Suspense fallback={<LoadingSpinner message="Loading 3D viewer..." />}>
        <ModelViewerComponent {...componentProps} />
      </Suspense>
    </LazyModel3DErrorBoundary>
  );
};

export default LazyModel3D;