'use client';

import { useState } from 'react';
import { Wine } from 'lucide-react';
import { useInventoryStore } from '@/stores/inventory-store';
import { ProductCard } from '@/components/orders/product-card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { CATEGORIES, CATEGORY_ICONS } from '@/lib/constants';
import type { ProductWithCalc } from '@/types';

interface ProductsGridProps {
  onProductTap: (product: ProductWithCalc) => void;
  onProductLongPress: (product: ProductWithCalc) => void;
  tappedId: string | null;
}

export function ProductsGrid({ onProductTap, onProductLongPress, tappedId }: ProductsGridProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);

  const products = getProductsWithCalc(categoryFilter).filter((p) => p.remaining > 0);

  return (
    <>
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition',
            categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Wine;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition',
                categoryFilter === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Products grid content */}
      <div className="mt-3">
        {products.length === 0 ? (
          <EmptyState emoji="🍹" title="No products available" description="All items are out of stock or none match your filter" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onTap={onProductTap}
                onLongPress={onProductLongPress}
                showAnimation={tappedId === product.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
