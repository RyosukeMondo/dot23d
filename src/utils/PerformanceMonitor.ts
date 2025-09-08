/**
 * Performance monitoring utility for tracking bundle loading and runtime performance
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface BundleLoadMetric {
  chunkName: string;
  loadTime: number;
  size?: number;
  cached: boolean;
}

interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  decodedBodySize: number;
  encodedBodySize: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private bundleLoads: BundleLoadMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = typeof window !== 'undefined' && 'performance' in window;
    
    if (this.enabled) {
      this.initializeObservers();
      this.trackInitialLoad();
    }
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers() {
    if (!this.enabled) return;

    try {
      // Track resource loading
      if ('PerformanceObserver' in window) {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleResourceEntry(entry as PerformanceResourceTiming);
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);

        // Track navigation
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleNavigationEntry(entry as PerformanceNavigationTiming);
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navigationObserver);
      }
    } catch (error) {
      console.warn('Performance observers not supported:', error);
    }
  }

  /**
   * Track initial page load metrics
   */
  private trackInitialLoad() {
    if (!this.enabled) return;

    // Track Core Web Vitals
    this.trackWebVitals();

    // Track when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.recordMetric('dom-content-loaded', performance.now());
      });
    } else {
      this.recordMetric('dom-content-loaded', performance.now());
    }

    // Track when everything is loaded
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this.recordMetric('window-load', performance.now());
      });
    }
  }

  /**
   * Track Core Web Vitals
   */
  private trackWebVitals() {
    // First Contentful Paint
    this.observeEntryType('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.recordMetric('first-contentful-paint', entry.startTime);
      }
    });

    // Largest Contentful Paint
    this.observeEntryType('largest-contentful-paint', (entry) => {
      this.recordMetric('largest-contentful-paint', entry.startTime);
    });

    // Cumulative Layout Shift
    this.observeEntryType('layout-shift', (entry) => {
      if (!(entry as any).hadRecentInput) {
        const existingCLS = this.metrics.get('cumulative-layout-shift');
        const currentValue = existingCLS?.duration || 0;
        this.recordMetric('cumulative-layout-shift', currentValue + (entry as any).value);
      }
    });

    // First Input Delay
    this.observeEntryType('first-input', (entry) => {
      this.recordMetric('first-input-delay', (entry as any).processingStart - entry.startTime);
    });
  }

  /**
   * Observe specific entry types
   */
  private observeEntryType(type: string, callback: (entry: PerformanceEntry) => void) {
    if (!this.enabled || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          callback(entry);
        }
      });
      observer.observe({ entryTypes: [type] });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Cannot observe ${type}:`, error);
    }
  }

  /**
   * Handle resource loading entries
   */
  private handleResourceEntry(entry: PerformanceResourceTiming) {
    if (entry.name.includes('chunk') || entry.name.includes('.js')) {
      const chunkName = this.extractChunkName(entry.name);
      this.bundleLoads.push({
        chunkName,
        loadTime: entry.duration,
        size: entry.transferSize,
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0
      });
    }
  }

  /**
   * Handle navigation entries
   */
  private handleNavigationEntry(entry: PerformanceNavigationTiming) {
    this.recordMetric('navigation-start', entry.fetchStart);
    this.recordMetric('dns-lookup', entry.domainLookupEnd - entry.domainLookupStart);
    this.recordMetric('tcp-connect', entry.connectEnd - entry.connectStart);
    this.recordMetric('request-response', entry.responseEnd - entry.requestStart);
    this.recordMetric('dom-processing', entry.domComplete - entry.responseEnd);
  }

  /**
   * Extract chunk name from resource URL
   */
  private extractChunkName(url: string): string {
    const match = url.match(/([^/]+)-[a-f0-9]+\.js$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Start tracking a custom metric
   */
  startMetric(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
  }

  /**
   * End tracking a custom metric
   */
  endMetric(name: string): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(name);
    if (!metric || metric.endTime) return null;

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    return duration;
  }

  /**
   * Record a point-in-time metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    this.metrics.set(name, {
      name,
      startTime: value,
      endTime: value,
      duration: 0,
      metadata
    });
  }

  /**
   * Track bundle loading performance
   */
  trackBundleLoad(chunkName: string): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      // Wait for next frame to ensure chunk is loaded
      requestAnimationFrame(() => {
        const loadTime = performance.now() - startTime;
        this.bundleLoads.push({
          chunkName,
          loadTime,
          cached: false // We don't know cache status for dynamic imports
        });
        resolve();
      });
    });
  }

  /**
   * Track component render time
   */
  trackComponentRender<T>(
    componentName: string, 
    renderFn: () => T, 
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) return renderFn();

    this.startMetric(`${componentName}-render`, metadata);
    const result = renderFn();
    this.endMetric(`${componentName}-render`);
    
    return result;
  }

  /**
   * Track async operation performance
   */
  async trackAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) return operation();

    this.startMetric(operationName, metadata);
    try {
      const result = await operation();
      this.endMetric(operationName);
      return result;
    } catch (error) {
      this.endMetric(operationName);
      throw error;
    }
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): {
    coreWebVitals: Record<string, number>;
    bundleLoads: BundleLoadMetric[];
    customMetrics: Record<string, number>;
    resourceTimings: ResourceTiming[];
    memoryUsage?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  } {
    const coreWebVitals: Record<string, number> = {};
    const customMetrics: Record<string, number> = {};

    // Categorize metrics
    this.metrics.forEach((metric, name) => {
      const value = metric.duration ?? metric.startTime;
      
      if (['first-contentful-paint', 'largest-contentful-paint', 'first-input-delay', 'cumulative-layout-shift'].includes(name)) {
        coreWebVitals[name] = value;
      } else {
        customMetrics[name] = value;
      }
    });

    // Get resource timings
    const resourceTimings: ResourceTiming[] = [];
    if (this.enabled) {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      entries.forEach(entry => {
        resourceTimings.push({
          name: entry.name.split('/').pop() || entry.name,
          duration: entry.duration,
          transferSize: entry.transferSize,
          decodedBodySize: entry.decodedBodySize,
          encodedBodySize: entry.encodedBodySize
        });
      });
    }

    // Get memory usage if available
    let memoryUsage;
    if (this.enabled && 'memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }

    return {
      coreWebVitals,
      bundleLoads: this.bundleLoads,
      customMetrics,
      resourceTimings: resourceTimings.slice(-20), // Last 20 resources
      memoryUsage
    };
  }

  /**
   * Get performance grade based on Core Web Vitals
   */
  getPerformanceGrade(): {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    scores: Record<string, { value: number; grade: string; threshold: string }>;
    overall: number;
  } {
    const fcp = this.metrics.get('first-contentful-paint')?.startTime || 0;
    const lcp = this.metrics.get('largest-contentful-paint')?.startTime || 0;
    const fid = this.metrics.get('first-input-delay')?.duration || 0;
    const cls = this.metrics.get('cumulative-layout-shift')?.duration || 0;

    const scores = {
      'First Contentful Paint': {
        value: fcp,
        grade: fcp <= 1800 ? 'A' : fcp <= 3000 ? 'B' : fcp <= 4500 ? 'C' : 'F',
        threshold: '≤1.8s (good), ≤3.0s (needs improvement), >3.0s (poor)'
      },
      'Largest Contentful Paint': {
        value: lcp,
        grade: lcp <= 2500 ? 'A' : lcp <= 4000 ? 'B' : lcp <= 6000 ? 'C' : 'F',
        threshold: '≤2.5s (good), ≤4.0s (needs improvement), >4.0s (poor)'
      },
      'First Input Delay': {
        value: fid,
        grade: fid <= 100 ? 'A' : fid <= 300 ? 'B' : fid <= 500 ? 'C' : 'F',
        threshold: '≤100ms (good), ≤300ms (needs improvement), >300ms (poor)'
      },
      'Cumulative Layout Shift': {
        value: cls,
        grade: cls <= 0.1 ? 'A' : cls <= 0.25 ? 'B' : cls <= 0.4 ? 'C' : 'F',
        threshold: '≤0.1 (good), ≤0.25 (needs improvement), >0.25 (poor)'
      }
    };

    // Calculate overall score
    const gradeValues = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
    const totalScore = Object.values(scores).reduce((sum, score) => sum + gradeValues[score.grade as keyof typeof gradeValues], 0);
    const averageScore = totalScore / Object.keys(scores).length;
    
    const overallGrade = averageScore >= 3.5 ? 'A' : averageScore >= 2.5 ? 'B' : averageScore >= 1.5 ? 'C' : averageScore >= 0.5 ? 'D' : 'F';

    return {
      grade: overallGrade,
      scores,
      overall: averageScore
    };
  }

  /**
   * Export performance data for debugging
   */
  exportPerformanceData(): string {
    const summary = this.getPerformanceSummary();
    const grade = this.getPerformanceGrade();
    
    const data = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...summary,
      performanceGrade: grade
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Clean up observers
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
    this.bundleLoads.length = 0;
  }

  /**
   * Check if performance monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper hooks for React components
export const usePerformanceTracker = (componentName: string) => {
  const trackRender = <T>(renderFn: () => T) => 
    performanceMonitor.trackComponentRender(componentName, renderFn);
    
  const trackAsync = <T>(operationName: string, operation: () => Promise<T>) =>
    performanceMonitor.trackAsyncOperation(`${componentName}-${operationName}`, operation);

  return { trackRender, trackAsync };
};

export default PerformanceMonitor;