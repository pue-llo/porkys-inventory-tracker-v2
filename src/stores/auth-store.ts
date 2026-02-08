import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { StaffProfile, StaffRole } from '@/types';
import bcrypt from 'bcryptjs';

interface AuthState {
  // State
  currentStaff: StaffProfile | null;
  allStaff: StaffProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadStaff: () => Promise<void>;
  loginWithPin: (pin: string) => Promise<StaffProfile | null>;
  loginAsAdmin: (password: string) => Promise<boolean>;
  logout: () => void;
  createStaff: (data: {
    name: string;
    pin: string;
    role: StaffRole;
    photoFile?: File;
  }) => Promise<StaffProfile | null>;
  updateStaff: (id: string, updates: Partial<StaffProfile>) => Promise<void>;
  deactivateStaff: (id: string) => Promise<void>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentStaff: null,
  allStaff: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  loadStaff: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      set({ allStaff: data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loginWithPin: async (pin: string) => {
    set({ isLoading: true, error: null });
    try {
      const { allStaff } = get();

      // Check PIN against all active staff
      for (const staff of allStaff) {
        const match = await bcrypt.compare(pin, staff.pin_hash);
        if (match) {
          set({ currentStaff: staff, isAuthenticated: true, isLoading: false });
          return staff;
        }
      }

      set({ error: 'Invalid PIN', isLoading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  loginAsAdmin: async (password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { allStaff } = get();
      const admins = allStaff.filter((s) => s.role === 'admin');

      for (const admin of admins) {
        const match = await bcrypt.compare(password, admin.pin_hash);
        if (match) {
          set({ currentStaff: admin, isAuthenticated: true, isLoading: false });
          return true;
        }
      }

      set({ error: 'Invalid admin password', isLoading: false });
      return false;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({ currentStaff: null, isAuthenticated: false, error: null });
  },

  createStaff: async ({ name, pin, role, photoFile }) => {
    set({ isLoading: true, error: null });
    try {
      // Hash the PIN
      const pin_hash = await bcrypt.hash(pin, 10);

      // Upload photo if provided
      let photo_url: string | null = null;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('staff-photos')
          .upload(fileName, photoFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('staff-photos')
            .getPublicUrl(fileName);
          photo_url = urlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('staff_profiles')
        .insert({ name, pin_hash, role, photo_url })
        .select()
        .single();

      if (error) throw error;

      // Refresh staff list
      await get().loadStaff();
      set({ isLoading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  updateStaff: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('staff_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().loadStaff();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deactivateStaff: async (id) => {
    try {
      const { error } = await supabase
        .from('staff_profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().loadStaff();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  verifyAdminPassword: async (password: string) => {
    const { allStaff } = get();
    const admins = allStaff.filter((s) => s.role === 'admin');
    for (const admin of admins) {
      const match = await bcrypt.compare(password, admin.pin_hash);
      if (match) return true;
    }
    return false;
  },

  clearError: () => set({ error: null }),
}));
