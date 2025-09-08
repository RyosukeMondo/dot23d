/**
 * Lazy loading utilities for images, components, and other resources
 */

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  unobserveAfterLoad?: boolean;
}

interface LazyImageOptions extends LazyLoadOptions {
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: Event) => void;
}

interface ImagePreloadOptions {
  priority?: 'high' | 'low';
  sizes?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
}

class LazyLoader {
  private intersectionObserver: IntersectionObserver | null = null;
  private loadedImages = new Set<string>();
  private preloadedResources = new Set<string>();

  constructor() {
    this.initializeIntersectionObserver();
  }

  /**
   * Initialize intersection observer for lazy loading
   */
  private initializeIntersectionObserver(options: LazyLoadOptions = {}) {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const { rootMargin = '50px', threshold = 0.1 } = options;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            this.loadElement(element);
            
            if (options.unobserveAfterLoad !== false) {
              this.intersectionObserver?.unobserve(element);
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );
  }

  /**
   * Load element based on its data attributes
   */
  private loadElement(element: HTMLElement) {
    const src = element.dataset.src;
    const srcset = element.dataset.srcset;
    const backgroundImage = element.dataset.backgroundImage;

    if (element instanceof HTMLImageElement) {
      this.loadImage(element, src, srcset);
    } else if (element instanceof HTMLIFrameElement && src) {
      element.src = src;
    } else if (backgroundImage) {
      element.style.backgroundImage = `url(${backgroundImage})`;
    }

    // Add loaded class
    element.classList.add('lazy-loaded');
    element.classList.remove('lazy-loading');
  }

  /**
   * Load image with fallback support
   */
  private loadImage(img: HTMLImageElement, src?: string, srcset?: string) {
    if (!src && !srcset) return;

    img.classList.add('lazy-loading');

    const loadHandler = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      if (src) this.loadedImages.add(src);
    };

    const errorHandler = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      console.warn(`Failed to load image: ${src}`);
    };

    img.addEventListener('load', loadHandler, { once: true });
    img.addEventListener('error', errorHandler, { once: true });

    if (srcset) {
      img.srcset = srcset;
    }
    if (src) {
      img.src = src;
    }
  }

  /**
   * Observe element for lazy loading
   */
  observe(element: HTMLElement, options?: LazyLoadOptions): void {
    if (!this.intersectionObserver) {
      // Fallback: load immediately if IntersectionObserver not supported
      this.loadElement(element);
      return;
    }

    if (options && JSON.stringify(options) !== JSON.stringify(this.getObserverOptions())) {
      // Reinitialize observer with new options
      this.intersectionObserver.disconnect();
      this.initializeIntersectionObserver(options);
    }

    this.intersectionObserver?.observe(element);
  }

  /**
   * Unobserve element
   */
  unobserve(element: HTMLElement): void {
    this.intersectionObserver?.unobserve(element);
  }

  /**
   * Get current observer options
   */
  private getObserverOptions(): LazyLoadOptions {
    if (!this.intersectionObserver) return {};
    
    return {
      rootMargin: this.intersectionObserver.rootMargin,
      threshold: this.intersectionObserver.thresholds[0] || 0.1,
    };
  }

  /**
   * Preload image
   */
  preloadImage(src: string, options: ImagePreloadOptions = {}): Promise<HTMLImageElement> {
    if (this.loadedImages.has(src) || this.preloadedResources.has(src)) {
      return Promise.resolve(document.createElement('img'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      if (options.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }
      
      if (options.sizes) {
        img.sizes = options.sizes;
      }

      img.onload = () => {
        this.loadedImages.add(src);
        this.preloadedResources.add(src);
        resolve(img);
      };

      img.onerror = (error) => {
        console.warn(`Failed to preload image: ${src}`);
        reject(error);
      };

      img.src = src;
    });
  }

  /**
   * Preload multiple images
   */
  async preloadImages(
    sources: string[], 
    options: ImagePreloadOptions = {}
  ): Promise<HTMLImageElement[]> {
    const promises = sources.map(src => 
      this.preloadImage(src, options).catch(error => {
        console.warn(`Failed to preload ${src}:`, error);
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter(img => img !== null) as HTMLImageElement[];
  }

  /**
   * Preload critical resources
   */
  preloadResource(url: string, type: 'script' | 'style' | 'font' | 'image' = 'script'): Promise<void> {
    if (this.preloadedResources.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = type;

      if (type === 'font') {
        link.crossOrigin = 'anonymous';
      }

      link.onload = () => {
        this.preloadedResources.add(url);
        resolve();
      };

      link.onerror = () => {
        console.warn(`Failed to preload resource: ${url}`);
        reject(new Error(`Failed to preload ${url}`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Lazy load React component with dynamic import
   */
  static lazyLoadComponent<T = React.ComponentType<any>>(
    importFn: () => Promise<{ default: T } | T>,
    fallback?: React.ComponentType
  ): React.LazyExoticComponent<T> {
    return React.lazy(() =>
      importFn().then((module) => ({
        default: 'default' in module ? module.default : (module as T),
      }))
    );
  }

  /**
   * Lazy load with retry mechanism
   */
  static lazyLoadWithRetry<T = React.ComponentType<any>>(
    importFn: () => Promise<{ default: T } | T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): React.LazyExoticComponent<T> {
    return React.lazy(() => {
      let retryCount = 0;
      
      const attemptLoad = async (): Promise<{ default: T }> => {
        try {
          const module = await importFn();
          return 'default' in module ? module : { default: module as T };
        } catch (error) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`Lazy load failed, retrying (${retryCount}/${maxRetries}):`, error);
            await new Promise(resolve => setTimeout(resolve, delay * retryCount));
            return attemptLoad();
          }
          throw error;
        }
      };

      return attemptLoad();
    });
  }

  /**
   * Create lazy image component
   */
  createLazyImage(options: LazyImageOptions = {}): React.ComponentType<React.ImgHTMLAttributes<HTMLImageElement>> {
    const loader = this;

    return React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
      function LazyImage({ src, srcSet, className = '', alt = '', ...props }, ref) {
        const imgRef = React.useRef<HTMLImageElement>(null);
        const [loaded, setLoaded] = React.useState(false);
        const [error, setError] = React.useState(false);

        React.useImperativeHandle(ref, () => imgRef.current!, []);

        React.useEffect(() => {
          const element = imgRef.current;
          if (!element || !src) return;

          // Set up lazy loading
          element.dataset.src = src;
          if (srcSet) {
            element.dataset.srcset = srcSet;
          }

          const handleLoad = () => {
            setLoaded(true);
            options.onLoad?.();
          };

          const handleError = (event: Event) => {
            setError(true);
            options.onError?.(event);
          };

          element.addEventListener('load', handleLoad);
          element.addEventListener('error', handleError);

          loader.observe(element, options);

          return () => {
            element.removeEventListener('load', handleLoad);
            element.removeEventListener('error', handleError);
            loader.unobserve(element);
          };
        }, [src, srcSet]);

        const combinedClassName = [
          className,
          'lazy-image',
          loaded ? 'lazy-loaded' : 'lazy-loading',
          error ? 'lazy-error' : ''
        ].filter(Boolean).join(' ');

        return (
          <img
            ref={imgRef}
            className={combinedClassName}
            alt={alt}
            src={options.placeholder}
            {...props}
          />
        );
      }
    );
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loadedImages: number;
    preloadedResources: number;
    isObserverSupported: boolean;
  } {
    return {
      loadedImages: this.loadedImages.size,
      preloadedResources: this.preloadedResources.size,
      isObserverSupported: !!this.intersectionObserver,
    };
  }

  /**
   * Clear cache and reset state
   */
  reset(): void {
    this.loadedImages.clear();
    this.preloadedResources.clear();
    this.intersectionObserver?.disconnect();
    this.initializeIntersectionObserver();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.intersectionObserver?.disconnect();
    this.loadedImages.clear();
    this.preloadedResources.clear();
  }
}

// CSS for lazy loading states
export const lazyLoadingStyles = `
  .lazy-image {
    transition: opacity 0.3s ease;
  }

  .lazy-loading {
    opacity: 0.6;
    filter: blur(2px);
  }

  .lazy-loaded {
    opacity: 1;
    filter: none;
  }

  .lazy-error {
    opacity: 0.5;
    background-color: #f3f4f6;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 48px;
  }
`;

// Create singleton instance
export const lazyLoader = new LazyLoader();

// React hooks
export const useLazyImage = (src: string, options: LazyImageOptions = {}) => {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (lazyLoader.loadedImages.has(src)) {
      setLoaded(true);
      return;
    }

    lazyLoader.preloadImage(src)
      .then(() => setLoaded(true))
      .catch(() => setError(true));
  }, [src]);

  return { loaded, error };
};

export const usePreloadImages = (sources: string[]) => {
  const [loadedCount, setLoadedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    setLoadedCount(0);

    lazyLoader.preloadImages(sources)
      .then((results) => {
        setLoadedCount(results.length);
        setLoading(false);
      });
  }, [sources]);

  return {
    loadedCount,
    totalCount: sources.length,
    loading,
    progress: sources.length > 0 ? loadedCount / sources.length : 0,
  };
};

export default LazyLoader;