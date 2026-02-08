import { create } from 'zustand';
import { EXCHANGE_RATE_API, EXCHANGE_RATE_CACHE_MS, FALLBACK_EXCHANGE_RATE } from '@/lib/constants';

interface CurrencyState {
  showUSD: boolean;
  exchangeRate: number | null;
  lastFetch: number | null;
  isLoading: boolean;

  fetchRate: () => Promise<number>;
  toggle: () => Promise<void>;
  format: (value: number) => string;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  showUSD: false,
  exchangeRate: null,
  lastFetch: null,
  isLoading: false,

  fetchRate: async () => {
    const { lastFetch, exchangeRate } = get();

    // Use cached rate if fresh enough
    if (lastFetch && Date.now() - lastFetch < EXCHANGE_RATE_CACHE_MS && exchangeRate) {
      return exchangeRate;
    }

    set({ isLoading: true });
    try {
      const response = await fetch(EXCHANGE_RATE_API);
      const data = await response.json();
      const rate = data.rates.COP;
      set({ exchangeRate: rate, lastFetch: Date.now(), isLoading: false });
      return rate;
    } catch {
      const fallback = exchangeRate || FALLBACK_EXCHANGE_RATE;
      set({ exchangeRate: fallback, isLoading: false });
      return fallback;
    }
  },

  toggle: async () => {
    const { showUSD } = get();
    if (!showUSD) {
      // Switching to USD — fetch rate first
      await get().fetchRate();
    }
    set({ showUSD: !showUSD });
  },

  format: (value: number) => {
    const { showUSD, exchangeRate } = get();
    const num = Number(value || 0);

    if (showUSD && exchangeRate) {
      const usdValue = num / exchangeRate;
      return (
        'US$ ' +
        usdValue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }

    const formatted = num.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return '$' + formatted + ' COP';
  },
}));
