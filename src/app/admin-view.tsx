'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import {
  Package, Users, LogOut,
  Eye, EyeOff, AlertTriangle, MessageSquare, FileText, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useRestockAlerts } from '@/hooks/use-restock-alerts';
import { StaffSetup } from '@/components/auth/staff-setup';

import { InventoryTab } from '@/components/admin/InventoryTab';
import { WasteTab } from '@/components/admin/WasteTab';
import { MessagesTab } from '@/components/admin/MessagesTab';
import { StaffTab } from '@/components/admin/StaffTab';
import { cn } from '@/lib/utils';

function TabLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const EodView = dynamic(() => import('./eod-view').then(m => ({ default: m.EodView })), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />
});
const AnalyticsView = dynamic(() => import('./analytics-view').then(m => ({ default: m.AnalyticsView })), {
  ssr: false,
  loading: () => <TabLoadingSkeleton />
});

type AdminTab = 'inventory' | 'staff' | 'waste' | 'messages' | 'eod' | 'analytics';

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('inventory');
  const [showCost, setShowCost] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { currentStaff, logout, loadStaff } = useAuthStore(
    useShallow((s) => ({ currentStaff: s.currentStaff, logout: s.logout, loadStaff: s.loadStaff }))
  );
  const { loadWasteLog, getTodayWaste } = useInventoryStore(
    useShallow((s) => ({ loadWasteLog: s.loadWasteLog, getTodayWaste: s.getTodayWaste }))
  );
  const { toggle: toggleCurrency, showUSD } = useCurrencyStore(
    useShallow((s) => ({ toggle: s.toggle, showUSD: s.showUSD }))
  );

  const restockAlerts = useRestockAlerts();
  const todayWaste = getTodayWaste();

  useEffect(() => {
    loadWasteLog();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  // ---- Special views ----
  if (tab === 'eod') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">EOD Report</h1>
            </div>
          </div>
        </header>
        <main className="p-3 pb-24">
          <EodView onBack={() => setTab('inventory')} />
        </main>
      </div>
    );
  }

  if (tab === 'analytics') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">Analytics</h1>
            </div>
          </div>
        </header>
        <main className="p-3 pb-24">
          <AnalyticsView onBack={() => setTab('inventory')} />
        </main>
      </div>
    );
  }

  if (showAddStaff) {
    return (
      <div>
        <div className="fixed top-4 left-4 z-50">
          <button onClick={() => setShowAddStaff(false)} className="bg-white text-gray-700 px-4 py-2 rounded-full text-sm font-medium shadow-lg border">
            ← Cancel
          </button>
        </div>
        <StaffSetup onComplete={() => { setShowAddStaff(false); loadStaff(); }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">👑</div>
            <div>
              <h1 className="text-lg font-bold">{currentStaff?.name || 'Admin'}</h1>
              <p className="text-xs text-gray-400">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {restockAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold">
                {restockAlerts.length}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs font-bold">
                {unreadCount}
              </span>
            )}
            <button onClick={toggleCurrency} className={cn('px-2 py-1 rounded-lg text-xs font-bold transition', showUSD ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white')}>
              {showUSD ? 'USD' : 'COP'}
            </button>
            <button onClick={() => setShowCost(!showCost)} className="p-2 rounded-lg hover:bg-white/10 transition">
              {showCost ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav - scrollable */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { id: 'inventory' as const, label: 'Inventory', icon: Package },
            { id: 'waste' as const, label: 'Waste', icon: AlertTriangle, count: todayWaste.length },
            { id: 'messages' as const, label: 'Messages', icon: MessageSquare, count: unreadCount },
            { id: 'staff' as const, label: 'Staff', icon: Users },
            { id: 'eod' as const, label: 'EOD', icon: FileText },
            { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
          ]).map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setTab(id)} className={cn(
              'flex-shrink-0 py-2.5 px-3 rounded-lg text-sm font-medium transition flex items-center gap-2',
              tab === id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
            )}>
              <Icon className="w-4 h-4" /> {label}
              {count !== undefined && count > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded-full text-xs', tab === id ? 'bg-white/20' : 'bg-red-100 text-red-600')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="p-3 pb-24">
        {tab === 'inventory' && <InventoryTab showCost={showCost} />}
        {tab === 'waste' && <WasteTab />}
        {tab === 'messages' && <MessagesTab onUnreadCountChange={handleUnreadCountChange} />}
        {tab === 'staff' && <StaffTab onShowAddStaff={() => setShowAddStaff(true)} />}
      </main>
    </div>
  );
}
