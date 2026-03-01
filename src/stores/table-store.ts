import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/lib/utils';
import type { Table, Order, TableWithOrders, ActivityLog } from '@/types';

interface TableState {
  // State
  tables: Table[];
  orders: Record<string, Order[]>; // keyed by table_id
  activityLog: ActivityLog[];
  isLoading: boolean;
  error: string | null;

  // Computed
  getActiveTables: () => TableWithOrders[];
  getClosedTables: () => TableWithOrders[];
  getTable: (id: string) => TableWithOrders | undefined;
  getNextTableNumber: () => number;

  // Granular realtime update methods
  upsertTable: (table: Table) => void;
  removeTable: (tableId: string) => void;
  upsertOrder: (order: Order) => void;
  removeOrderById: (orderId: string) => void;

  // Actions
  loadTables: () => Promise<void>;
  loadOrders: () => Promise<void>;
  loadActivityLog: () => Promise<void>;
  openTable: (data: { name?: string; guestCount?: number; staffId?: string }) => Promise<Table | null>;
  closeTable: (tableId: string, staffId?: string) => Promise<void>;
  reopenTable: (tableId: string) => Promise<void>;
  updateTable: (tableId: string, updates: Partial<Table>) => Promise<void>;
  addOrder: (order: Omit<Order, 'id' | 'created_at'>) => Promise<Order | null>;
  removeOrder: (orderId: string, tableId: string) => Promise<void>;
  updateOrderQuantity: (orderId: string, newQuantity: number) => Promise<void>;
  logActivity: (data: { entityType: string; entityId?: string; action: string; details: string; staffId?: string; staffName?: string }) => Promise<void>;
}

export const useTableStore = create<TableState>((set, get) => ({
  tables: [],
  orders: {},
  activityLog: [],
  isLoading: false,
  error: null,

  // ---- Computed ----
  getActiveTables: () => {
    const { tables, orders } = get();
    return tables
      .filter((t) => t.is_active)
      .map((t) => ({
        ...t,
        orders: orders[t.id] || [],
        total: (orders[t.id] || []).reduce((sum, o) => sum + o.total, 0),
      }))
      .sort((a, b) => a.table_number - b.table_number);
  },

  getClosedTables: () => {
    const { tables, orders } = get();
    return tables
      .filter((t) => !t.is_active)
      .map((t) => ({
        ...t,
        orders: orders[t.id] || [],
        total: (orders[t.id] || []).reduce((sum, o) => sum + o.total, 0),
      }))
      .sort((a, b) => new Date(b.closed_at || '').getTime() - new Date(a.closed_at || '').getTime());
  },

  getTable: (id: string) => {
    const { tables, orders } = get();
    const t = tables.find((t) => t.id === id);
    if (!t) return undefined;
    return {
      ...t,
      orders: orders[t.id] || [],
      total: (orders[t.id] || []).reduce((sum, o) => sum + o.total, 0),
    };
  },

  getNextTableNumber: () => {
    const { tables } = get();
    const todayTables = tables.filter((t) => t.date === getTodayKey());
    if (todayTables.length === 0) return 1;
    return Math.max(...todayTables.map((t) => t.table_number)) + 1;
  },

  // ---- Granular realtime update methods ----
  upsertTable: (table: Table) => {
    set((state) => {
      const idx = state.tables.findIndex((t) => t.id === table.id);
      if (idx >= 0) {
        const updated = [...state.tables];
        updated[idx] = table;
        return { tables: updated };
      }
      // Only add if it's for today
      const today = getTodayKey();
      if (table.date !== today) return state;
      return { tables: [...state.tables, table] };
    });
  },

  removeTable: (tableId: string) => {
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== tableId),
      orders: (() => {
        const { [tableId]: _, ...rest } = state.orders;
        return rest;
      })(),
    }));
  },

  upsertOrder: (order: Order) => {
    set((state) => {
      const tableOrders = state.orders[order.table_id] || [];
      const idx = tableOrders.findIndex((o) => o.id === order.id);
      if (idx >= 0) {
        const updated = [...tableOrders];
        updated[idx] = order;
        return {
          orders: { ...state.orders, [order.table_id]: updated },
        };
      }
      return {
        orders: { ...state.orders, [order.table_id]: [order, ...tableOrders] },
      };
    });
  },

  removeOrderById: (orderId: string) => {
    set((state) => {
      const newOrders: Record<string, Order[]> = {};
      for (const [tableId, tableOrders] of Object.entries(state.orders)) {
        newOrders[tableId] = tableOrders.filter((o) => o.id !== orderId);
      }
      return { orders: newOrders };
    });
  },

  // ---- Actions ----
  loadTables: async () => {
    const today = getTodayKey();
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('date', today)
        .order('table_number');

      if (error) throw error;
      set({ tables: data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadOrders: async () => {
    const today = getTodayKey();
    try {
      // Get all orders for today's tables
      const { tables } = get();
      const tableIds = tables.map((t) => t.id);
      if (tableIds.length === 0) {
        set({ orders: {} });
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('table_id', tableIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orderMap: Record<string, Order[]> = {};
      (data || []).forEach((o) => {
        if (!orderMap[o.table_id]) orderMap[o.table_id] = [];
        orderMap[o.table_id].push(o);
      });
      set({ orders: orderMap });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadActivityLog: async () => {
    const today = getTodayKey();
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      set({ activityLog: data || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  openTable: async ({ name, guestCount, staffId }) => {
    const today = getTodayKey();
    const tableNumber = get().getNextTableNumber();

    try {
      const { data, error } = await supabase
        .from('tables')
        .insert({
          table_number: tableNumber,
          name: name || '',
          guest_count: guestCount || 0,
          date: today,
          opened_by: staffId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await get().logActivity({
        entityType: 'table',
        entityId: data.id,
        action: 'Opened',
        details: `Table ${tableNumber} created${guestCount ? ` for ${guestCount} guests` : ''}`,
        staffId,
      });

      await get().loadTables();
      return data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  closeTable: async (tableId, staffId) => {
    try {
      const table = get().tables.find((t) => t.id === tableId);
      const { error } = await supabase
        .from('tables')
        .update({
          is_active: false,
          closed_at: new Date().toISOString(),
          closed_by: staffId || null,
        })
        .eq('id', tableId);

      if (error) throw error;

      if (table) {
        await get().logActivity({
          entityType: 'table',
          entityId: tableId,
          action: 'Closed',
          details: `Table ${table.table_number} closed`,
          staffId,
        });
      }

      await get().loadTables();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  reopenTable: async (tableId) => {
    try {
      const table = get().tables.find((t) => t.id === tableId);
      const { error } = await supabase
        .from('tables')
        .update({ is_active: true, closed_at: null })
        .eq('id', tableId);

      if (error) throw error;

      if (table) {
        await get().logActivity({
          entityType: 'table',
          entityId: tableId,
          action: 'Reopened',
          details: `Table ${table.table_number} reopened`,
        });
      }

      await get().loadTables();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateTable: async (tableId, updates) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update(updates)
        .eq('id', tableId);

      if (error) throw error;
      await get().loadTables();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addOrder: async (order) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();

      if (error) throw error;

      // Optimistic update to orders map
      set((state) => {
        const tableOrders = state.orders[order.table_id] || [];
        return {
          orders: {
            ...state.orders,
            [order.table_id]: [data, ...tableOrders],
          },
        };
      });

      return data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  removeOrder: async (orderId, tableId) => {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;

      set((state) => ({
        orders: {
          ...state.orders,
          [tableId]: (state.orders[tableId] || []).filter((o) => o.id !== orderId),
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateOrderQuantity: async (orderId, newQuantity) => {
    try {
      // Find the order to calculate new total
      const allOrders = Object.values(get().orders).flat();
      const order = allOrders.find((o) => o.id === orderId);
      if (!order) return;

      const newTotal = order.price_per_unit * newQuantity;

      const { error } = await supabase
        .from('orders')
        .update({ quantity: newQuantity, total: newTotal })
        .eq('id', orderId);

      if (error) throw error;

      set((state) => ({
        orders: {
          ...state.orders,
          [order.table_id]: (state.orders[order.table_id] || []).map((o) =>
            o.id === orderId ? { ...o, quantity: newQuantity, total: newTotal } : o
          ),
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  logActivity: async ({ entityType, entityId, action, details, staffId, staffName }) => {
    try {
      await supabase.from('activity_log').insert({
        entity_type: entityType,
        entity_id: entityId || null,
        action,
        details,
        staff_id: staffId || null,
        staff_name: staffName || null,
      });
    } catch (err) {
      // Non-critical, don't block UI
      console.error('Failed to log activity:', err);
    }
  },
}));
