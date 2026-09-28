import { useState, useEffect, useCallback } from 'react';
import { offlineStore } from '../utils/offlineStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWA() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [syncingOfflineData, setSyncingOfflineData] = useState<boolean>(false);

  // Register Service Worker (Production Only - In Dev Mode, purge to prevent stale Vite chunk conflicts)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const isDev = Boolean((import.meta as any).env?.DEV || process.env.NODE_ENV !== 'production');
      if (isDev) {
        // Unregister any active Service Workers during development
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => {});
          }
        });
        // Clear old PWA caches that might contain stale dev chunks
        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              if (key.startsWith('ipds-cache')) {
                caches.delete(key).catch(() => {});
              }
            }
          });
        }
        return;
      }

      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[iPDS PWA] Service Worker berjaya didaftarkan:', registration.scope);
            setSwRegistered(true);
            registration.update().catch(() => {});
          })
          .catch((error) => {
            console.warn('[iPDS PWA] Service Worker registration failed:', error);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // Check if running as standalone PWA
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    }
  }, []);

  // Online / Offline Detection & Auto Sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      setIsOnline(true);
      console.log('[iPDS PWA] Sambungan internet kembali aktif. Memproses data tertunda...');
      
      // Auto flush offline sync queue
      try {
        setSyncingOfflineData(true);
        const queue = await offlineStore.getSyncQueue();
        if (queue.length > 0) {
          for (const item of queue) {
            try {
              const res = await fetch(item.url, {
                method: item.method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload),
              });
              if (res.ok) {
                await offlineStore.removeSyncQueueItem(item.id);
                console.log('[iPDS PWA] Berjaya menyegerakkan rekod tertunda:', item.id);
              }
            } catch (err) {
              console.warn('[iPDS PWA] Gagal sync item:', item.id, err);
            }
          }
        }
      } catch (e) {
        console.warn('[iPDS PWA] Sync queue flush error:', e);
      } finally {
        setSyncingOfflineData(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.warn('[iPDS PWA] Sambungan internet terputus. Beralih ke mod luar talian (Offline Cache).');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Capture beforeinstallprompt for custom install banner / button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      console.log('[iPDS PWA] Aplikasi telah dipasang pada peranti.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) {
      return false;
    }

    try {
      await installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[iPDS PWA] Pengguna bersetuju memasang aplikasi.');
        setInstallPrompt(null);
        setIsInstalled(true);
        return true;
      } else {
        console.log('[iPDS PWA] Pemasangan dibatalkan oleh pengguna.');
        return false;
      }
    } catch (err) {
      console.error('[iPDS PWA] Ralat semasa proses pemasangan:', err);
      return false;
    }
  }, [installPrompt]);

  return {
    isOnline,
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    swRegistered,
    syncingOfflineData,
    installPWA,
  };
}
