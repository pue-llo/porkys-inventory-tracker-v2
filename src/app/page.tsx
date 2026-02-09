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
import { StaffMessageModal } from '@/components/auth/staff-message-modal';
import { FohView } from './foh-view';
import { BohView } from './boh-view';
import { AdminView } from './admin-view';

export default function HomePage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const [endShiftStaff, setEndShiftStaff] = useState<{ id: string; name: string } | null>(null);

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
    // End shift: staff picker
    if (showEndShift && !endShiftStaff) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900">Who's ending their shift?</h1>
            <p className="text-sm text-gray-500 mt-1">Select your name to leave a note</p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            {allStaff.filter((s) => s.role !== 'admin').map((staff) => (
              <button
                key={staff.id}
                onClick={() => setEndShiftStaff({ id: staff.id, name: staff.name })}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-left"
              >
                {staff.photo_url ? (
                  <img src={staff.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                    {staff.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{staff.name}</p>
                  <p className="text-xs text-gray-400">{staff.role.toUpperCase()}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowEndShift(false)}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Back to Login
          </button>
        </div>
      );
    }

    // End shift: message modal for selected staff
    if (showEndShift && endShiftStaff) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 px-6">
          <div className="w-full max-w-sm">
            <StaffMessageModal
              isOpen={true}
              onClose={() => { setEndShiftStaff(null); setShowEndShift(false); }}
              onLogout={() => { setEndShiftStaff(null); setShowEndShift(false); }}
              staffId={endShiftStaff.id}
              staffName={endShiftStaff.name}
            />
          </div>
        </div>
      );
    }

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
        onEndShift={() => setShowEndShift(true)}
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
