/**
 * Resource cleanup utilities for memory management and performance optimization
 */

export interface CleanupTask {
  id: string;
  cleanup: () => void | Promise<void>;
  priority: 'low' | 'medium' | 'high';
}

export interface ResourceManagerConfig {
  maxMemoryUsage: number; // MB
  cleanupInterval: number; // milliseconds
  autoCleanup: boolean;
}

class ResourceManager {
  private static instance: ResourceManager;
  private cleanupTasks: Map<string, CleanupTask> = new Map();
  private cleanupInterval: number | null = null;
  private config: ResourceManagerConfig = {
    maxMemoryUsage: 200, // 200MB default
    cleanupInterval: 30000, // 30 seconds
    autoCleanup: true
  };

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Configure the resource manager
   */
  configure(config: Partial<ResourceManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.autoCleanup && !this.cleanupInterval) {
      this.startAutoCleanup();
    } else if (!this.config.autoCleanup && this.cleanupInterval) {
      this.stopAutoCleanup();
    }
  }

  /**
   * Register a cleanup task
   */
  registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.set(task.id, task);
  }

  /**
   * Unregister a cleanup task
   */
  unregisterCleanupTask(taskId: string): void {
    this.cleanupTasks.delete(taskId);
  }

  /**
   * Execute a specific cleanup task
   */
  async executeCleanupTask(taskId: string): Promise<void> {
    const task = this.cleanupTasks.get(taskId);
    if (task) {
      try {
        await task.cleanup();
        console.log(`Cleanup task '${taskId}' executed successfully`);
      } catch (error) {
        console.error(`Error executing cleanup task '${taskId}':`, error);
      }
    }
  }

  /**
   * Execute cleanup tasks by priority
   */
  async executeCleanupTasks(priority?: 'low' | 'medium' | 'high'): Promise<void> {
    const tasks = Array.from(this.cleanupTasks.values());
    const filteredTasks = priority 
      ? tasks.filter(task => task.priority === priority)
      : tasks;

    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    for (const task of filteredTasks) {
      await this.executeCleanupTask(task.id);
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Check if memory cleanup is needed
   */
  needsMemoryCleanup(): boolean {
    const currentUsage = this.getCurrentMemoryUsage();
    return currentUsage > this.config.maxMemoryUsage;
  }

  /**
   * Perform memory cleanup if needed
   */
  async performMemoryCleanup(): Promise<void> {
    if (this.needsMemoryCleanup()) {
      console.log('Memory usage high, performing cleanup...');
      await this.executeCleanupTasks('high');
      
      // Force garbage collection if available (Chrome DevTools)
      if ('gc' in window) {
        (window as any).gc();
      }
      
      // Give browser time to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterCleanup = this.getCurrentMemoryUsage();
      console.log(`Memory cleanup completed. Usage: ${afterCleanup}MB`);
    }
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = window.setInterval(async () => {
      await this.performMemoryCleanup();
      await this.executeCleanupTasks('low'); // Regular low-priority cleanup
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up all resources and stop monitoring
   */
  async shutdown(): Promise<void> {
    this.stopAutoCleanup();
    await this.executeCleanupTasks(); // Execute all cleanup tasks
    this.cleanupTasks.clear();
  }
}

/**
 * React hook for automatic resource cleanup
 */
export function useResourceCleanup(
  cleanupFn: () => void | Promise<void>,
  dependencies: React.DependencyList = [],
  priority: 'low' | 'medium' | 'high' = 'medium'
) {
  const cleanupIdRef = React.useRef<string>();
  const resourceManager = ResourceManager.getInstance();

  React.useEffect(() => {
    // Generate unique ID for this cleanup task
    const cleanupId = `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    cleanupIdRef.current = cleanupId;

    // Register cleanup task
    resourceManager.registerCleanupTask({
      id: cleanupId,
      cleanup: cleanupFn,
      priority
    });

    return () => {
      if (cleanupIdRef.current) {
        resourceManager.unregisterCleanupTask(cleanupIdRef.current);
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (cleanupIdRef.current) {
        resourceManager.executeCleanupTask(cleanupIdRef.current);
      }
    };
  }, [resourceManager]);
}

/**
 * Higher-order component for automatic resource cleanup
 */
export function withResourceCleanup<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  cleanupFn: () => void | Promise<void>,
  priority: 'low' | 'medium' | 'high' = 'medium'
): React.ComponentType<P> {
  const WithResourceCleanup = (props: P) => {
    useResourceCleanup(cleanupFn, [], priority);
    return React.createElement(WrappedComponent, props);
  };

  WithResourceCleanup.displayName = `withResourceCleanup(${WrappedComponent.displayName || WrappedComponent.name})`;
  return WithResourceCleanup;
}

/**
 * Cleanup utility functions
 */
export const CleanupUtils = {
  /**
   * Clear all timeouts and intervals
   */
  clearTimers: () => {
    // Clear all timeouts (up to reasonable limit)
    for (let i = 1; i < 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
  },

  /**
   * Remove all event listeners from an element
   */
  clearEventListeners: (element: Element) => {
    const newElement = element.cloneNode(true);
    element.parentNode?.replaceChild(newElement, element);
    return newElement;
  },

  /**
   * Clear browser caches (if available)
   */
  clearCaches: async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  },

  /**
   * Clear local storage with prefix
   */
  clearLocalStorage: (prefix?: string) => {
    if (!prefix) {
      localStorage.clear();
      return;
    }

    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith(prefix)
    );
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  /**
   * Clear session storage with prefix
   */
  clearSessionStorage: (prefix?: string) => {
    if (!prefix) {
      sessionStorage.clear();
      return;
    }

    const keysToRemove = Object.keys(sessionStorage).filter(key => 
      key.startsWith(prefix)
    );
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }
};

// Export singleton instance
export const resourceManager = ResourceManager.getInstance();

// Auto-start resource management
resourceManager.configure({
  autoCleanup: true,
  maxMemoryUsage: 150, // 150MB threshold
  cleanupInterval: 30000 // 30 seconds
});