import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getTodayKey, calculateFields } from '@/lib/utils';
import type { Product, InventoryDaily, Category, ProductWithCalc } from '@/types';

interface InventoryState {
  // State
  products: Product[];
  categories: Category[];
  dailyInventory: Record<string, InventoryDaily>; // keyed by product_id
  isLoading: boolean;
  error: string | null;

  // Computed
  getProductsWithCalc: (categoryFilter?: string, searchTerm?: string) => ProductWithCalc[];
  getProduct: (id: string) => Product | undefined;
  getDailyInventory: (productId: string) => InventoryDaily | undefined;

  // Actions
  loadProducts: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadDailyInventory: () => Promise<void>;
  initializeDailyInventory: () => Promise<void>;
  createProduct: (product: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  recordSale: (productId: string, quantity: number) => Promise<void>;
  undoSale: (productId: string, quantity: number) => Promise<void>;
  restockProduct: (productId: string, quantity: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  categories: [],
  dailyInventory: {},
  isLoading: false,
  error: null,

  // ---- Computed ----
  getProductsWithCalc: (categoryFilter?: string, searchTerm?: string) => {
    const { products, dailyInventory, categories } = get();
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
      const category = categories.find((c) => c.id === p.category_id);
      return { ...p, ...calc, category, inventory: inv };
    });
  },

  getProduct: (id: string) => get().products.find((p) => p.id === id),

  getDailyInventory: (productId: string) => get().dailyInventory[productId],

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
      set({ categories: data || [] });
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

    try {
      const { error } = await supabase
        .from('inventory_daily')
        .update({
          sold: inv.sold + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('date', today);

      if (error) throw error;

      // Optimistic update
      set((state) => ({
        dailyInventory: {
          ...state.dailyInventory,
          [productId]: { ...inv, sold: inv.sold + quantity },
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
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

    try {
      const { error } = await supabase
        .from('inventory_daily')
        .update({
          restocked: inv.restocked + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('date', today);

      if (error) throw error;

      set((state) => ({
        dailyInventory: {
          ...state.dailyInventory,
          [productId]: { ...inv, restocked: inv.restocked + quantity },
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
