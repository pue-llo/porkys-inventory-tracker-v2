'use client';

import { useState, useEffect } from 'react';
import { Download, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from './button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(0);

  useEffect(() => {
    // Check if already dismissed too many times
    const count = parseInt(localStorage.getItem('pwa-dismiss-count') || '0');
    setDismissed(count);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (count < 3) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      localStorage.setItem('pwa-dismiss-count', '0');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    const newCount = dismissed + 1;
    setDismissed(newCount);
    localStorage.setItem('pwa-dismiss-count', String(newCount));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white rounded-2xl p-4 shadow-xl z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install Porky&apos;s Inventory</p>
          <p className="text-xs text-blue-200 mt-0.5">Quick access from your home screen</p>
        </div>
        <button onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <Button
        onClick={handleInstall}
        className="w-full mt-3 bg-white text-blue-600 hover:bg-blue-50"
        size="sm"
      >
        Install App
      </Button>
    </div>
  );
}

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm font-medium z-[100] flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      You&apos;re offline — some features may not work
    </div>
  );
}
