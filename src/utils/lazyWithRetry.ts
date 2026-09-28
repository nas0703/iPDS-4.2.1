import React, { ComponentType, LazyExoticComponent } from 'react';

/**
 * Robust lazy import wrapper with automatic retry and page reload fallback
 * for handling stale chunk hashes when a new build is deployed to Vercel/Cloud Run.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>,
  componentName?: string
): LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasBeenForceRefreshed = window.sessionStorage.getItem(`retry-lazy-${componentName || 'module'}`);

    try {
      const module = await componentImport();
      // Clear flag on successful load
      if (pageHasBeenForceRefreshed) {
        window.sessionStorage.removeItem(`retry-lazy-${componentName || 'module'}`);
      }
      return module?.default ? module : { default: module };
    } catch (error: any) {
      console.warn(`Dynamic import error for ${componentName || 'module'}:`, error);

      const isChunkError = 
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && !pageHasBeenForceRefreshed) {
        // Set flag to prevent infinite reload loop
        window.sessionStorage.setItem(`retry-lazy-${componentName || 'module'}`, 'true');
        console.info('New app version detected. Refreshing page to load latest assets...');
        window.location.reload();
        // Return a pending promise while page reloads
        return new Promise(() => {});
      }

      // If already reloaded once and still failed, throw error to ErrorBoundary
      throw error;
    }
  });
}
