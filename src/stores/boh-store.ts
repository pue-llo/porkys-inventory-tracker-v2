import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/lib/utils';
import type { BohCartItem, BohDisbursement, StaffProfile } from '@/types';

interface BohState {
  // State
  cart: BohCartItem[];
  disbursements: BohDisbursement[];
  isSelectingFoh: boolean;
  showSuccess: boolean;
  lastConfirmedFoh: StaffProfile | null;
  isLoading: boolean;
  error: string | null;

  // Computed
  getCartTotal: () => number;
  getCartQuantity: (productId: string) => number;
  getTodayHistory: () => BohDisbursement[];
  getTodayCount: (productId: string) => number;
  getTodayTotal: () => number;

  // Granular realtime update methods
  upsertDisbursement: (d: BohDisbursement) => void;
  removeDisbursementById: (id: string) => void;

  // Actions
  loadDisbursements: () => Promise<void>;
  addToCart: (item: { productId: string; productName: string; categoryId: string; imageUrl: string | null }) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  startFohSelection: () => void;
  cancelFohSelection: () => void;
  submitToFoh: (fohStaff: StaffProfile, bohStaff: StaffProfile | null) => Promise<void>;
  removeDisbursement: (id: string) => Promise<void>;
}

export const useBohStore = create<BohState>((set, get) => ({
  cart: [],
  disbursements: [],
  isSelectingFoh: false,
  showSuccess: false,
  lastConfirmedFoh: null,
  isLoading: false,
  error: null,

  // ---- Computed ----
  getCartTotal: () => get().cart.reduce((sum, item) => sum + item.quantity, 0),

  getCartQuantity: (productId) => {
    const item = get().cart.find((c) => c.productId === productId);
    return item ? item.quantity : 0;
  },

  getTodayHistory: () => {
    const today = getTodayKey();
    return get()
      .disbursements.filter((d) => d.date === today)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getTodayCount: (productId) => {
    const today = getTodayKey();
    return get()
      .disbursements.filter((d) => d.product_id === productId && d.date === today)
      .reduce((sum, d) => sum + d.quantity, 0);
  },

  getTodayTotal: () => {
    const today = getTodayKey();
    return get()
      .disbursements.filter((d) => d.date === today)
      .reduce((sum, d) => sum + d.quantity, 0);
  },

  // ---- Granular realtime update methods ----
  upsertDisbursement: (d: BohDisbursement) => {
    set((state) => {
      const idx = state.disbursements.findIndex((existing) => existing.id === d.id);
      if (idx >= 0) {
        const updated = [...state.disbursements];
        updated[idx] = d;
        return { disbursements: updated };
      }
      return { disbursements: [d, ...state.disbursements] };
    });
  },

  removeDisbursementById: (id: string) => {
    set((state) => ({
      disbursements: state.disbursements.filter((d) => d.id !== id),
    }));
  },

  // ---- Actions ----
  loadDisbursements: async () => {
    const today = getTodayKey();
    try {
      const { data, error } = await supabase
        .from('boh_disbursements')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ disbursements: data || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addToCart: ({ productId, productName, categoryId, imageUrl }) => {
    set((state) => {
      const existing = state.cart.find((c) => c.productId === productId);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return {
        cart: [...state.cart, { productId, productName, categoryId, imageUrl, quantity: 1 }],
      };
    });
  },

  removeFromCart: (productId) => {
    set((state) => {
      const existing = state.cart.find((c) => c.productId === productId);
      if (!existing) return state;
      if (existing.quantity > 1) {
        return {
          cart: state.cart.map((c) =>
            c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c
          ),
        };
      }
      return { cart: state.cart.filter((c) => c.productId !== productId) };
    });
  },

  clearCart: () => set({ cart: [] }),

  startFohSelection: () => set({ isSelectingFoh: true }),

  cancelFohSelection: () => set({ isSelectingFoh: false }),

  submitToFoh: async (fohStaff, bohStaff) => {
    const { cart } = get();
    const today = getTodayKey();

    try {
      const rows = cart.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        category_id: item.categoryId,
        quantity: item.quantity,
        boh_staff_id: bohStaff?.id || null,
        boh_staff_name: bohStaff?.name || null,
        foh_staff_id: fohStaff.id,
        foh_staff_name: fohStaff.name,
        date: today,
      }));

      const { error } = await supabase.from('boh_disbursements').insert(rows);
      if (error) throw error;

      set({
        cart: [],
        isSelectingFoh: false,
        showSuccess: true,
        lastConfirmedFoh: fohStaff,
      });

      // Hide success after 2 seconds
      setTimeout(() => {
        set({ showSuccess: false, lastConfirmedFoh: null });
      }, 2000);

      await get().loadDisbursements();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeDisbursement: async (id) => {
    try {
      const { error } = await supabase.from('boh_disbursements').delete().eq('id', id);
      if (error) throw error;
      set((state) => ({
        disbursements: state.disbursements.filter((d) => d.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
