'use client';

import { useInventoryStore } from '@/stores/inventory-store';

export interface RestockAlert {
  productId: string;
  productName: string;
  categoryId: string;
  currentStock: number;
  parLevel: number;
}

export function useRestockAlerts(): RestockAlert[] {
  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);
  const products = getProductsWithCalc();

  return products
    .filter((p) => p.par_level > 0 && p.remaining <= p.par_level)
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      categoryId: p.category_id,
      currentStock: p.remaining,
      parLevel: p.par_level,
    }));
}
