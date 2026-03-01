'use client';

import { useInventoryStore } from '@/stores/inventory-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { WASTE_REASONS } from '@/types';

export function WasteTab() {
  const getTodayWaste = useInventoryStore((s) => s.getTodayWaste);
  const getTotalWasteValue = useInventoryStore((s) => s.getTotalWasteValue);
  const formatMoney = useCurrencyStore((s) => s.format);

  const todayWaste = getTodayWaste();
  const totalWasteValue = getTotalWasteValue();

  return (
    <>
      {/* Waste summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-red-600">{todayWaste.reduce((s, w) => s + w.quantity, 0)}</p>
          <p className="text-xs text-gray-500">Items Wasted</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-lg font-bold text-red-600">{formatMoney(totalWasteValue)}</p>
          <p className="text-xs text-gray-500">Value Lost</p>
        </div>
      </div>

      {todayWaste.length === 0 ? (
        <EmptyState emoji="✅" title="No waste today" description="That's great! Use the waste button on products to log waste." />
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Waste Log</h3>
          {todayWaste.map((w) => {
            const reasonInfo = WASTE_REASONS.find((r) => r.value === w.reason);
            return (
              <div key={w.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{reasonInfo?.emoji || '?'}</span>
                    <span className="font-semibold text-gray-900">{w.product_name}</span>
                  </div>
                  <Badge variant="danger">{w.quantity} unit{w.quantity !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{reasonInfo?.label || w.reason}</Badge>
                    {w.notes && <span className="text-gray-400">{w.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-medium">{formatMoney(w.value_lost)}</span>
                    <span>· {w.staff_name || 'Unknown'}</span>
                    <span>{w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
