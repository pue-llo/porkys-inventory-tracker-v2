import type { CategoryInfo } from '@/types';

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'liquor',
    name: 'Liquor',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    darkBg: 'bg-purple-700',
    icon: 'wine',
  },
  {
    id: 'beer',
    name: 'Beer',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    darkBg: 'bg-amber-700',
    icon: 'beer',
  },
  {
    id: 'fountain',
    name: 'Fountain Drinks',
    color: 'cyan',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
    darkBg: 'bg-cyan-700',
    icon: 'cup-soda',
  },
];

export function getCategoryInfo(categoryId: string): CategoryInfo {
  return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
}

// Exchange rate API
export const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
export const EXCHANGE_RATE_CACHE_MS = 3600000; // 1 hour
export const FALLBACK_EXCHANGE_RATE = 4100; // COP per USD
