'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTableStore } from '@/stores/table-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useBohStore } from '@/stores/boh-store';

/**
 * Subscribe to Supabase Realtime changes for multi-device sync.
 * Call this once in your root layout or main page component.
 */
export function useRealtime() {
  const loadTables = useTableStore((s) => s.loadTables);
  const loadOrders = useTableStore((s) => s.loadOrders);
  const loadDailyInventory = useInventoryStore((s) => s.loadDailyInventory);
  const loadDisbursements = useBohStore((s) => s.loadDisbursements);

  useEffect(() => {
    const channel = supabase
      .channel('app-realtime')
      // Tables changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          loadTables();
        }
      )
      // Orders changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders();
        }
      )
      // Inventory changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_daily' },
        () => {
          loadDailyInventory();
        }
      )
      // BOH disbursements
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boh_disbursements' },
        () => {
          loadDisbursements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTables, loadOrders, loadDailyInventory, loadDisbursements]);
}
