import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getTodayKey, calculateFields } from '@/lib/utils';
import type { Product, InventoryDaily, Category, ProductWithCalc, WasteLog, WasteReason } from '@/types';

interface InventoryState {
  // State
  products: Product[];
  categories: Category[];
  categoryMap: Record<string, Category>; // O(1) lookup by category id
  dailyInventory: Record<string, InventoryDaily>; // keyed by product_id
  wasteLog: WasteLog[];
  isLoading: boolean;
  error: string | null;

  // Computed
  getProductsWithCalc: (categoryFilter?: string, searchTerm?: string) => ProductWithCalc[];
  getProduct: (id: string) => Product | undefined;
  getDailyInventory: (productId: string) => InventoryDaily | undefined;
  getTodayWaste: () => WasteLog[];
  getTotalWasteValue: () => number;

  // Granular realtime update methods
  upsertDailyInventory: (row: InventoryDaily) => void;
  upsertWasteLog: (entry: WasteLog) => void;
  removeWasteLogEntry: (id: string) => void;

  // Actions
  loadProducts: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadDailyInventory: () => Promise<void>;
  loadWasteLog: () => Promise<void>;
  initializeDailyInventory: () => Promise<void>;
  createProduct: (product: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  recordSale: (productId: string, quantity: number) => Promise<void>;
  undoSale: (productId: string, quantity: number) => Promise<void>;
  restockProduct: (productId: string, quantity: number) => Promise<void>;
  recordWaste: (productId: string, productName: string, categoryId: string, quantity: number, reason: WasteReason, notes: string, pricePerUnit: number, staffId: string | null, staffName: string | null) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  categories: [],
  categoryMap: {},
  dailyInventory: {},
  wasteLog: [],
  isLoading: false,
  error: null,

  // ---- Computed ----
  getProductsWithCalc: (categoryFilter?: string, searchTerm?: string) => {
    const { products, dailyInventory, categoryMap } = get();
    let filtered = products.filter((p) => p.is_active);

    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category_id === categoryFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(term));
    }

    return filtered.map((p) => {
      const inv = dailyInventory[p.id];
      const calc = calculateFields(p, inv);
      const category = categoryMap[p.category_id];
      return { ...p, ...calc, category, inventory: inv };
    });
  },

  getProduct: (id: string) => get().products.find((p) => p.id === id),

  getDailyInventory: (productId: string) => get().dailyInventory[productId],

  getTodayWaste: () => {
    const today = getTodayKey();
    return get().wasteLog
      .filter((w) => w.date === today)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getTotalWasteValue: () => {
    const today = getTodayKey();
    return get().wasteLog
      .filter((w) => w.date === today)
      .reduce((sum, w) => sum + w.value_lost, 0);
  },

  // ---- Granular realtime update methods ----
  upsertDailyInventory: (row: InventoryDaily) => {
    const today = getTodayKey();
    if (row.date !== today) return;
    set((state) => ({
      dailyInventory: {
        ...state.dailyInventory,
        [row.product_id]: row,
      },
    }));
  },

  upsertWasteLog: (entry: WasteLog) => {
    set((state) => {
      const idx = state.wasteLog.findIndex((w) => w.id === entry.id);
      if (idx >= 0) {
        const updated = [...state.wasteLog];
        updated[idx] = entry;
        return { wasteLog: updated };
      }
      return { wasteLog: [entry, ...state.wasteLog] };
    });
  },

  removeWasteLogEntry: (id: string) => {
    set((state) => ({
      wasteLog: state.wasteLog.filter((w) => w.id !== id),
    }));
  },

  // ---- Actions ----
  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      set({ products: data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      const categories = data || [];
      const categoryMap: Record<string, Category> = {};
      categories.forEach((c) => {
        categoryMap[c.id] = c;
      });
      set({ categories, categoryMap });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadDailyInventory: async () => {
    const today = getTodayKey();
    try {
      const { data, error } = await supabase
        .from('inventory_daily')
        .select('*')
        .eq('date', today);

      if (error) throw error;

      const map: Record<string, InventoryDaily> = {};
      (data || []).forEach((row) => {
        map[row.product_id] = row;
      });
      set({ dailyInventory: map });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  /**
   * Create inventory_daily rows for all products that don't have one today.
   * Opening stock = yesterday's closing stock (or product's total units if first day).
   */
  initializeDailyInventory: async () => {
    const today = getTodayKey();
    const { products } = get();

    // Get existing rows for today
    const { data: existing } = await supabase
      .from('inventory_daily')
      .select('product_id')
      .eq('date', today);

    const existingIds = new Set((existing || []).map((r) => r.product_id));
    const missing = products.filter((p) => p.is_active && !existingIds.has(p.id));

    if (missing.length === 0) return;

    // For each missing product, try to get yesterday's closing stock
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    const { data: yesterdayData } = await supabase
      .from('inventory_daily')
      .select('product_id, closing_stock')
      .eq('date', yesterdayKey);

    const yesterdayMap: Record<string, number> = {};
    (yesterdayData || []).forEach((r) => {
      yesterdayMap[r.product_id] = r.closing_stock;
    });

    const rows = missing.map((p) => ({
      product_id: p.id,
      date: today,
      opening_stock: yesterdayMap[p.id] ?? p.num_boxes * p.per_box,
      sold: 0,
      wasted: 0,
      restocked: 0,
    }));

    const { error } = await supabase.from('inventory_daily').insert(rows);
    if (!error) {
      await get().loadDailyInventory();
    }
  },

  createProduct: async (product) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;

      // Also create today's inventory row
      const today = getTodayKey();
      const totalUnits = (product.num_boxes || 0) * (product.per_box || 0);
      await supabase.from('inventory_daily').insert({
        product_id: data.id,
        date: today,
        opening_stock: totalUnits,
      });

      await get().loadProducts();
      await get().loadDailyInventory();
      set({ isLoading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  updateProduct: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().loadProducts();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteProduct: async (id) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().loadProducts();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  recordSale: async (productId, quantity) => {
    const today = getTodayKey();
    const inv = get().dailyInventory[productId];
    if (!inv) return;

    // Optimistic update for UI responsiveness
    set((state) => ({
      dailyInventory: {
        ...state.dailyInventory,
        [productId]: { ...inv, sold: inv.sold + quantity },
      },
    }));

    try {
      // Fetch fresh value to narrow race window
      const { data: fresh } = await supabase
        .from('inventory_daily')
        .select('sold')
        .eq('product_id', productId)
        .eq('date', today)
        .single();

      if (!fresh) return;

      const { error } = await supabase
        .from('inventory_daily')
        .update({
          sold: fresh.sold + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('date', today);

      if (error) throw error;
    } catch (err: any) {
      // Revert optimistic update on failure
      set((state) => ({
        dailyInventory: {
          ...state.dailyInventory,
          [productId]: { ...inv, sold: inv.sold },
        },
        error: err.message,
      }));
    }
  },

  undoSale: async (productId, quantity) => {
    const today = getTodayKey();
    const inv = get().dailyInventory[productId];
    if (!inv) return;

    try {
      const newSold = Math.max(0, inv.sold - quantity);
      const { error } = await supabase
        .from('inventory_daily')
        .update({
          sold: newSold,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('date', today);

      if (error) throw error;

      set((state) => ({
        dailyInventory: {
          ...state.dailyInventory,
          [productId]: { ...inv, sold: newSold },
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  restockProduct: async (productId, quantity) => {
    const today = getTodayKey();
    const inv = get().dailyInventory[productId];
    if (!inv) return;

    // Optimistic update for UI responsiveness
    set((state) => ({
      dailyInventory: {
        ...state.dailyInventory,
        [productId]: { ...inv, restocked: inv.restocked + quantity },
      },
    }));

    try {
      // Fetch fresh value to narrow race window
      const { data: fresh } = await supabase
        .from('inventory_daily')
        .select('restocked')
        .eq('product_id', productId)
        .eq('date', today)
        .single();

      if (!fresh) return;

      const { error } = await supabase
        .from('inventory_daily')
        .update({
          restocked: fresh.restocked + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('date', today);

      if (error) throw error;
    } catch (err: any) {
      // Revert optimistic update on failure
      set((state) => ({
        dailyInventory: {
          ...state.dailyInventory,
          [productId]: { ...inv, restocked: inv.restocked },
        },
        error: err.message,
      }));
    }
  },

  loadWasteLog: async () => {
    const today = getTodayKey();
    try {
      const { data, error } = await supabase
        .from('waste_log')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ wasteLog: data || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  recordWaste: async (productId, productName, categoryId, quantity, reason, notes, pricePerUnit, staffId, staffName) => {
    const today = getTodayKey();
    const valueLost = pricePerUnit * quantity;

    try {
      // Insert waste log entry
      const { error: wasteError } = await supabase.from('waste_log').insert({
        product_id: productId,
        product_name: productName,
        category_id: categoryId,
        quantity,
        reason,
        notes: notes || '',
        staff_id: staffId,
        staff_name: staffName,
        value_lost: valueLost,
        date: today,
      });
      if (wasteError) throw wasteError;

      // Update inventory_daily.wasted — fetch fresh value to narrow race window
      const inv = get().dailyInventory[productId];
      if (inv) {
        // Optimistic update for UI responsiveness
        set((state) => ({
          dailyInventory: {
            ...state.dailyInventory,
            [productId]: { ...inv, wasted: inv.wasted + quantity },
          },
        }));

        const { data: fresh } = await supabase
          .from('inventory_daily')
          .select('wasted')
          .eq('product_id', productId)
          .eq('date', today)
          .single();

        if (fresh) {
          const { error: invError } = await supabase
            .from('inventory_daily')
            .update({
              wasted: fresh.wasted + quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('product_id', productId)
            .eq('date', today);

          if (invError) throw invError;
        }
      }

      // Refresh waste log
      await get().loadWasteLog();
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
