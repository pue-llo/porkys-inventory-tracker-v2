'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useTableStore } from '@/stores/table-store';
import { useBohStore } from '@/stores/boh-store';
import { useRealtime } from '@/hooks/use-realtime';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PwaInstallPrompt, OfflineBanner } from '@/components/ui/pwa-install';
import { PinPad } from '@/components/auth/pin-pad';
import { StaffSetup } from '@/components/auth/staff-setup';
import { FohView } from './foh-view';
import { BohView } from './boh-view';
import { AdminView } from './admin-view';

export default function HomePage() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Auth state
  const currentStaff = useAuthStore((s) => s.currentStaff);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const allStaff = useAuthStore((s) => s.allStaff);
  const loadStaff = useAuthStore((s) => s.loadStaff);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const clearError = useAuthStore((s) => s.clearError);

  // Data loaders
  const loadProducts = useInventoryStore((s) => s.loadProducts);
  const loadCategories = useInventoryStore((s) => s.loadCategories);
  const loadDailyInventory = useInventoryStore((s) => s.loadDailyInventory);
  const loadWasteLog = useInventoryStore((s) => s.loadWasteLog);
  const initializeDailyInventory = useInventoryStore((s) => s.initializeDailyInventory);
  const loadTables = useTableStore((s) => s.loadTables);
  const loadOrders = useTableStore((s) => s.loadOrders);
  const loadDisbursements = useBohStore((s) => s.loadDisbursements);

  // Realtime subscriptions
  useRealtime();

  // Initial data load
  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadStaff(),
        loadProducts(),
        loadCategories(),
      ]);
      await initializeDailyInventory();
      await Promise.all([
        loadDailyInventory(),
        loadTables(),
        loadWasteLog(),
      ]);
      setIsInitialized(true);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load orders once tables are loaded
  const tables = useTableStore((s) => s.tables);
  useEffect(() => {
    if (tables.length > 0) {
      loadOrders();
    }
  }, [tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load BOH disbursements when authenticated as BOH
  useEffect(() => {
    if (isAuthenticated && currentStaff?.role === 'boh') {
      loadDisbursements();
    }
  }, [isAuthenticated, currentStaff?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading state
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">📦</span>
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // No staff exist yet — show setup wizard
  if (allStaff.length === 0) {
    return (
      <StaffSetup
        onComplete={() => {
          loadStaff();
        }}
      />
    );
  }

  // Not logged in — show PIN pad
  if (!isAuthenticated) {
    return (
      <PinPad
        onSubmit={(pin) => {
          clearError();
          loginWithPin(pin);
        }}
        title="Staff Login"
        subtitle={`${allStaff.length} staff member${allStaff.length !== 1 ? 's' : ''} registered`}
        error={error}
        isLoading={isLoading}
      />
    );
  }

  // Route based on role
  const role = currentStaff?.role || 'foh';

  if (role === 'admin') {
    return (
      <ErrorBoundary>
        <OfflineBanner />
        <AdminView />
        <PwaInstallPrompt />
      </ErrorBoundary>
    );
  }

  if (role === 'boh') {
    return (
      <ErrorBoundary>
        <OfflineBanner />
        <BohView />
        <PwaInstallPrompt />
      </ErrorBoundary>
    );
  }

  // Default: FOH
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <FohView />
      <PwaInstallPrompt />
    </ErrorBoundary>
  );
}
