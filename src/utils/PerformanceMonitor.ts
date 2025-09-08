import React from 'react';

/**
 * Performance monitoring utilities for the 3D testing interface
 */

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentLoadTime: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  maxRenderTime: number;
  maxMemoryUsage: number;
  maxComponentLoadTime: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds = {
    maxRenderTime: 5000,      // 5 seconds
    maxMemoryUsage: 100,      // 100MB
    maxComponentLoadTime: 2000 // 2 seconds
  };

  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    // Monitor resource timing
    if (typeof PerformanceObserver !== 'undefined') {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'resource' && entry.name.includes('.js')) {
            this.recordMetric({
              renderTime: 0,
              memoryUsage: this.getMemoryUsage(),
              componentLoadTime: entry.duration,
              timestamp: Date.now()
            });
          }
        });
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }

    // Monitor navigation timing
    if (typeof PerformanceObserver !== 'undefined') {
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.recordMetric({
              renderTime: entry.duration,
              memoryUsage: this.getMemoryUsage(),
              componentLoadTime: entry.loadEventEnd - entry.loadEventStart,
              timestamp: Date.now()
            });
          }
        });
      });

      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    }
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the last 1000 metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check thresholds and warn if exceeded
    this.checkThresholds(metric);
  }

  /**
   * Get current memory usage (approximate)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(metric: PerformanceMetrics): void {
    const warnings: string[] = [];

    if (metric.renderTime > this.thresholds.maxRenderTime) {
      warnings.push(`Render time (${metric.renderTime}ms) exceeds threshold (${this.thresholds.maxRenderTime}ms)`);
    }

    if (metric.memoryUsage > this.thresholds.maxMemoryUsage) {
      warnings.push(`Memory usage (${metric.memoryUsage}MB) exceeds threshold (${this.thresholds.maxMemoryUsage}MB)`);
    }

    if (metric.componentLoadTime > this.thresholds.maxComponentLoadTime) {
      warnings.push(`Component load time (${metric.componentLoadTime}ms) exceeds threshold (${this.thresholds.maxComponentLoadTime}ms)`);
    }

    if (warnings.length > 0) {
      console.warn('Performance threshold exceeded:', warnings);
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get average metrics over a time period
   */
  getAverageMetrics(timeWindowMs: number = 60000): PerformanceMetrics | null {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const totals = recentMetrics.reduce((acc, metric) => ({
      renderTime: acc.renderTime + metric.renderTime,
      memoryUsage: acc.memoryUsage + metric.memoryUsage,
      componentLoadTime: acc.componentLoadTime + metric.componentLoadTime,
      timestamp: 0
    }), { renderTime: 0, memoryUsage: 0, componentLoadTime: 0, timestamp: 0 });

    return {
      renderTime: Math.round(totals.renderTime / recentMetrics.length),
      memoryUsage: Math.round(totals.memoryUsage / recentMetrics.length),
      componentLoadTime: Math.round(totals.componentLoadTime / recentMetrics.length),
      timestamp: Date.now()
    };
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Generate a performance report
   */
  generateReport(): {
    current: PerformanceMetrics | null;
    average: PerformanceMetrics | null;
    thresholds: PerformanceThresholds;
    totalMetrics: number;
  } {
    return {
      current: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null,
      average: this.getAverageMetrics(),
      thresholds: this.thresholds,
      totalMetrics: this.metrics.length
    };
  }
}

/**
 * Higher-order component for performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  const WithPerformanceMonitoring = (props: P) => {
    const monitor = PerformanceMonitor.getInstance();
    const startTime = performance.now();

    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      monitor.recordMetric({
        renderTime,
        memoryUsage: monitor['getMemoryUsage'](),
        componentLoadTime: renderTime,
        timestamp: Date.now()
      });
    }, [monitor, startTime]);

    return React.createElement(WrappedComponent, props);
  };

  WithPerformanceMonitoring.displayName = `withPerformanceMonitoring(${componentName})`;
  return WithPerformanceMonitoring;
}

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();
  const startTime = React.useRef(performance.now());

  React.useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;

    monitor.recordMetric({
      renderTime,
      memoryUsage: monitor['getMemoryUsage'](),
      componentLoadTime: renderTime,
      timestamp: Date.now()
    });
  }, [componentName, monitor]);

  return {
    recordMetric: (metric: Partial<PerformanceMetrics>) => {
      monitor.recordMetric({
        renderTime: metric.renderTime || 0,
        memoryUsage: metric.memoryUsage || monitor['getMemoryUsage'](),
        componentLoadTime: metric.componentLoadTime || 0,
        timestamp: Date.now()
      });
    },
    getReport: () => monitor.generateReport()
  };
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();