'use client';

import { useState } from 'react';
import { Wine, Beer, CupSoda } from 'lucide-react';
import { cn, getStockLevel } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/constants';
import { useCurrencyStore } from '@/hooks/use-currency';
import type { ProductWithCalc } from '@/types';

interface ProductCardProps {
  product: ProductWithCalc;
  onTap: (product: ProductWithCalc) => void;
  showAnimation?: boolean;
  mode?: 'foh' | 'boh';
  cartQuantity?: number;
}

const categoryIcons: Record<string, typeof Wine> = {
  liquor: Wine,
  beer: Beer,
  fountain: CupSoda,
};

export function ProductCard({ product, onTap, showAnimation, mode = 'foh', cartQuantity = 0 }: ProductCardProps) {
  const formatMoney = useCurrencyStore((s) => s.format);
  const cat = getCategoryInfo(product.category_id);
  const stockLevel = getStockLevel(product.remaining, product.totalUnits);
  const Icon = categoryIcons[product.category_id] || Wine;

  return (
    <button
      onClick={() => onTap(product)}
      className={cn(
        'product-card relative bg-white rounded-2xl p-3 border text-left transition-all duration-150 w-full',
        'hover:shadow-md active:scale-[0.97]',
        showAnimation && 'animate-pop',
        stockLevel === 'critical' && 'border-red-200 bg-red-50/30',
        stockLevel === 'low' && 'border-amber-200 bg-amber-50/30',
        stockLevel === 'ok' && 'border-gray-100'
      )}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Category icon + name */}
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cat.bgColor)}>
          <Icon className={cn('w-4 h-4', cat.textColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
          {product.bottle_size && (
            <p className="text-xs text-gray-400">{product.bottle_size}</p>
          )}
        </div>
      </div>

      {/* Stock info */}
      <div className="flex items-end justify-between">
        <div>
          <p className={cn(
            'text-lg font-bold',
            stockLevel === 'critical' ? 'text-red-600' :
            stockLevel === 'low' ? 'text-amber-600' :
            'text-gray-900'
          )}>
            {product.remaining}
          </p>
          <p className="text-xs text-gray-400">of {product.totalUnits}</p>
        </div>
        <p className="text-xs font-medium text-gray-500">{formatMoney(product.price_per_unit)}</p>
      </div>

      {/* Low stock warning */}
      {stockLevel !== 'ok' && (
        <div className={cn(
          'absolute top-2 right-2 w-2 h-2 rounded-full',
          stockLevel === 'critical' ? 'bg-red-500 animate-pulse-dot' : 'bg-amber-400'
        )} />
      )}

      {/* BOH cart badge */}
      {cartQuantity > 0 && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
          {cartQuantity}
        </div>
      )}

      {/* Sold today badge */}
      {product.sold > 0 && mode === 'foh' && (
        <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-green-500 text-white rounded-full text-[10px] font-bold">
          {product.sold} sold
        </div>
      )}
    </button>
  );
}
