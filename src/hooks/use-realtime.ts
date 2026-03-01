'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useTableStore } from '@/stores/table-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useBohStore } from '@/stores/boh-store';
import type { Table, Order, InventoryDaily, WasteLog, BohDisbursement } from '@/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const DEBOUNCE_MS = 500;

/**
 * Create a debounced version of a callback that batches rapid-fire calls.
 * Returns a stable ref-based function.
 */
function useDebouncedCallback(callback: () => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callbackRef.current();
      timeoutRef.current = null;
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debounced;
}

/**
 * Subscribe to Supabase Realtime changes for multi-device sync.
 * Uses granular payload merging instead of full table refetches.
 * Debounces rapid-fire events (e.g., bulk sales) with a 500ms window.
 * Call this once in your root layout or main page component.
 */
export function useRealtime() {
  // Table store methods
  const upsertTable = useTableStore((s) => s.upsertTable);
  const removeTable = useTableStore((s) => s.removeTable);
  const upsertOrder = useTableStore((s) => s.upsertOrder);
  const removeOrderById = useTableStore((s) => s.removeOrderById);

  // Inventory store methods
  const upsertDailyInventory = useInventoryStore((s) => s.upsertDailyInventory);
  const upsertWasteLog = useInventoryStore((s) => s.upsertWasteLog);
  const removeWasteLogEntry = useInventoryStore((s) => s.removeWasteLogEntry);

  // BOH store methods
  const upsertDisbursement = useBohStore((s) => s.upsertDisbursement);
  const removeDisbursementById = useBohStore((s) => s.removeDisbursementById);

  // Queue for batching rapid events per table
  const pendingRef = useRef<Map<string, () => void>>(new Map());
  const flushPending = useDebouncedCallback(() => {
    const pending = pendingRef.current;
    pending.forEach((fn) => fn());
    pending.clear();
  }, DEBOUNCE_MS);

  // Stable refs so the effect doesn't re-subscribe on every render
  const storeRefs = useRef({
    upsertTable,
    removeTable,
    upsertOrder,
    removeOrderById,
    upsertDailyInventory,
    upsertWasteLog,
    removeWasteLogEntry,
    upsertDisbursement,
    removeDisbursementById,
  });
  storeRefs.current = {
    upsertTable,
    removeTable,
    upsertOrder,
    removeOrderById,
    upsertDailyInventory,
    upsertWasteLog,
    removeWasteLogEntry,
    upsertDisbursement,
    removeDisbursementById,
  };

  useEffect(() => {
    const channel = supabase
      .channel('app-realtime')
      // Tables: only INSERT and UPDATE (soft deletes, no DELETE events needed)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tables' },
        (payload: RealtimePostgresChangesPayload<Table>) => {
          const row = payload.new as Table;
          if (row && row.id) {
            pendingRef.current.set(`table-ins-${row.id}`, () =>
              storeRefs.current.upsertTable(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables' },
        (payload: RealtimePostgresChangesPayload<Table>) => {
          const row = payload.new as Table;
          if (row && row.id) {
            pendingRef.current.set(`table-upd-${row.id}`, () =>
              storeRefs.current.upsertTable(row)
            );
            flushPending();
          }
        }
      )
      // Orders: all events (orders can be deleted)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Order>) => {
          const row = payload.new as Order;
          if (row && row.id) {
            pendingRef.current.set(`order-ins-${row.id}`, () =>
              storeRefs.current.upsertOrder(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Order>) => {
          const row = payload.new as Order;
          if (row && row.id) {
            pendingRef.current.set(`order-upd-${row.id}`, () =>
              storeRefs.current.upsertOrder(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<Order>) => {
          const old = payload.old as Partial<Order>;
          if (old && old.id) {
            const id = old.id;
            pendingRef.current.set(`order-del-${id}`, () =>
              storeRefs.current.removeOrderById(id)
            );
            flushPending();
          }
        }
      )
      // Inventory daily: only INSERT and UPDATE (soft deletes via closing_stock)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_daily' },
        (payload: RealtimePostgresChangesPayload<InventoryDaily>) => {
          const row = payload.new as InventoryDaily;
          if (row && row.id) {
            pendingRef.current.set(`inv-${row.product_id}`, () =>
              storeRefs.current.upsertDailyInventory(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory_daily' },
        (payload: RealtimePostgresChangesPayload<InventoryDaily>) => {
          const row = payload.new as InventoryDaily;
          if (row && row.id) {
            pendingRef.current.set(`inv-${row.product_id}`, () =>
              storeRefs.current.upsertDailyInventory(row)
            );
            flushPending();
          }
        }
      )
      // BOH disbursements: all events
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'boh_disbursements' },
        (payload: RealtimePostgresChangesPayload<BohDisbursement>) => {
          const row = payload.new as BohDisbursement;
          if (row && row.id) {
            pendingRef.current.set(`boh-ins-${row.id}`, () =>
              storeRefs.current.upsertDisbursement(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'boh_disbursements' },
        (payload: RealtimePostgresChangesPayload<BohDisbursement>) => {
          const row = payload.new as BohDisbursement;
          if (row && row.id) {
            pendingRef.current.set(`boh-upd-${row.id}`, () =>
              storeRefs.current.upsertDisbursement(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'boh_disbursements' },
        (payload: RealtimePostgresChangesPayload<BohDisbursement>) => {
          const old = payload.old as Partial<BohDisbursement>;
          if (old && old.id) {
            const id = old.id;
            pendingRef.current.set(`boh-del-${id}`, () =>
              storeRefs.current.removeDisbursementById(id)
            );
            flushPending();
          }
        }
      )
      // Waste log: all events
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waste_log' },
        (payload: RealtimePostgresChangesPayload<WasteLog>) => {
          const row = payload.new as WasteLog;
          if (row && row.id) {
            pendingRef.current.set(`waste-ins-${row.id}`, () =>
              storeRefs.current.upsertWasteLog(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waste_log' },
        (payload: RealtimePostgresChangesPayload<WasteLog>) => {
          const row = payload.new as WasteLog;
          if (row && row.id) {
            pendingRef.current.set(`waste-upd-${row.id}`, () =>
              storeRefs.current.upsertWasteLog(row)
            );
            flushPending();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'waste_log' },
        (payload: RealtimePostgresChangesPayload<WasteLog>) => {
          const old = payload.old as Partial<WasteLog>;
          if (old && old.id) {
            const id = old.id;
            pendingRef.current.set(`waste-del-${id}`, () =>
              storeRefs.current.removeWasteLogEntry(id)
            );
            flushPending();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flushPending]);
}
