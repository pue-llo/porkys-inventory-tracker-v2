import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes, differenceInHours } from 'date-fns';
import type { Product, InventoryDaily, CATEGORY_STYLES } from '@/types';

// ============================================
// DATE / TIME FORMATTING
// ============================================

export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy');
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy h:mm a');
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

/**
 * Relative time like V1: "Just now", "5m ago", "2h 15m ago", "Yesterday"
 */
export function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const now = new Date();
  const then = new Date(iso);
  const diffMins = differenceInMinutes(now, then);
  const diffHrs = differenceInHours(now, then);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) {
    const mins = diffMins % 60;
    return mins > 0 ? `${diffHrs}h ${mins}m ago` : `${diffHrs}h ago`;
  }
  if (isYesterday(then)) return 'Yesterday';
  return formatDate(iso);
}

export function getFullTimestamp(iso: string): string {
  if (!iso) return '';
  return format(new Date(iso), 'EEE, MMM d · h:mm a');
}

/**
 * Get today's date key in YYYY-MM-DD format (for daily scoping)
 */
export function getTodayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format COP value, optionally converting to USD
 */
export function formatCurrency(
  value: number,
  showUSD: boolean = false,
  exchangeRate: number | null = null
): string {
  const num = Number(value || 0);
  if (showUSD && exchangeRate) {
    const usdValue = num / exchangeRate;
    return 'US$ ' + usdValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // Colombian Peso: $4.000.000 COP (periods as thousand separators)
  const formatted = num.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return '$' + formatted + ' COP';
}

// ============================================
// INVENTORY CALCULATIONS (ported from V1)
// ============================================

export interface CalcResult {
  totalUnits: number;
  remaining: number;
  sold: number;
  expectedValue: number;
  profit: number;
}

/**
 * Calculate derived product fields from boxes/per-box/sold
 * Works with either flat product data or product + daily inventory
 */
export function calculateFields(
  product: Product,
  inventory?: InventoryDaily
): CalcResult {
  const totalUnits = (product.num_boxes || 0) * (product.per_box || 0);
  const sold = inventory?.sold ?? 0;
  const wasted = inventory?.wasted ?? 0;
  const restocked = inventory?.restocked ?? 0;
  const remaining = totalUnits - sold - wasted + restocked;
  const expectedValue = sold * (product.price_per_unit || 0);
  const profit = (product.price_per_unit - (product.cost_per_unit || 0)) * sold;

  return { totalUnits, remaining: Math.max(0, remaining), sold, expectedValue, profit };
}

/**
 * Get the remaining stock percentage for color coding
 */
export function getStockLevel(remaining: number, totalUnits: number): 'critical' | 'low' | 'ok' {
  if (totalUnits === 0) return 'ok';
  const pct = remaining / totalUnits;
  if (pct <= 0.1) return 'critical';
  if (pct <= 0.2) return 'low';
  return 'ok';
}

// ============================================
// TABLE HELPERS
// ============================================

export function getTableDuration(createdAt: string, closedAt: string | null): string {
  const start = new Date(createdAt);
  const end = closedAt ? new Date(closedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ============================================
// MISC
// ============================================

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}
