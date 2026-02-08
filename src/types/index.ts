// ============================================
// DATABASE TYPES (mirrors Supabase schema)
// ============================================

export type StaffRole = 'foh' | 'boh' | 'admin';

export interface StaffProfile {
  id: string;
  name: string;
  pin_hash: string;
  photo_url: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  image_url: string | null;
  bottle_size: string | null;
  num_boxes: number;
  per_box: number;
  price_per_unit: number;
  cost_per_unit: number;
  par_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryDaily {
  id: string;
  product_id: string;
  date: string;
  opening_stock: number;
  sold: number;
  wasted: number;
  restocked: number;
  closing_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  table_number: number;
  name: string;
  guest_count: number;
  notes: string;
  is_active: boolean;
  date: string;
  opened_by: string | null;
  closed_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface Order {
  id: string;
  table_id: string;
  product_id: string;
  product_name: string;
  category_id: string;
  price_per_unit: number;
  quantity: number;
  total: number;
  staff_id: string | null;
  staff_name: string | null;
  created_at: string;
}

export interface BohDisbursement {
  id: string;
  product_id: string;
  product_name: string;
  category_id: string;
  quantity: number;
  boh_staff_id: string | null;
  boh_staff_name: string | null;
  foh_staff_id: string | null;
  foh_staff_name: string | null;
  date: string;
  created_at: string;
}

export interface WasteLog {
  id: string;
  product_id: string;
  product_name: string;
  category_id: string;
  quantity: number;
  reason: WasteReason;
  notes: string;
  staff_id: string | null;
  staff_name: string | null;
  value_lost: number;
  date: string;
  created_at: string;
}

export type WasteReason = 'broken' | 'spill' | 'comp' | 'spoiled' | 'other';

export interface EodReport {
  id: string;
  date: string;
  total_sales: number;
  total_orders: number;
  total_tables: number;
  total_waste_value: number;
  cash_in_drawer: number;
  expected_cash: number;
  variance: number;
  notes: string;
  closed_by: string | null;
  created_at: string;
}

export interface StaffMessage {
  id: string;
  staff_id: string;
  staff_name: string;
  message: string;
  is_read: boolean;
  date: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: string;
  staff_id: string | null;
  staff_name: string | null;
  created_at: string;
}

// ============================================
// APP TYPES (UI state, computed values)
// ============================================

export interface ProductWithCalc extends Product {
  category?: Category;
  inventory?: InventoryDaily;
  totalUnits: number;
  remaining: number;
  sold: number;
  expectedValue: number;
}

export interface TableWithOrders extends Table {
  orders: Order[];
  total: number;
  openedByStaff?: StaffProfile;
}

export interface BohCartItem {
  productId: string;
  productName: string;
  categoryId: string;
  imageUrl: string | null;
  quantity: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  darkBg: string;
  icon: string;
}

// ============================================
// CONSTANTS
// ============================================

export const CATEGORY_STYLES: Record<string, Omit<CategoryInfo, 'id' | 'name' | 'color'>> = {
  liquor: {
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    darkBg: 'bg-purple-600',
    icon: 'wine',
  },
  beer: {
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    darkBg: 'bg-amber-500',
    icon: 'beer',
  },
  fountain: {
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
    darkBg: 'bg-cyan-500',
    icon: 'cup-soda',
  },
};

export const WASTE_REASONS: { value: WasteReason; label: string; emoji: string }[] = [
  { value: 'broken', label: 'Broken', emoji: '💥' },
  { value: 'spill', label: 'Spill', emoji: '💧' },
  { value: 'comp', label: 'Comp / Free', emoji: '🎁' },
  { value: 'spoiled', label: 'Spoiled / Expired', emoji: '🗑️' },
  { value: 'other', label: 'Other', emoji: '❓' },
];
