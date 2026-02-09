'use client';

import { useState } from 'react';
import {
  ShoppingCart, History, LogOut, Minus, Plus, Send, Check, X, Wine, Beer, CupSoda, Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useBohStore } from '@/stores/boh-store';
import { ProductCard } from '@/components/orders/product-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatTime } from '@/lib/utils';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import type { ProductWithCalc, StaffProfile } from '@/types';

export function BohView() {
  const [viewMode, setViewMode] = useState<'products' | 'history'>('products');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const currentStaff = useAuthStore((s) => s.currentStaff);
  const allStaff = useAuthStore((s) => s.allStaff);
  const logout = useAuthStore((s) => s.logout);
  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);

  const cart = useBohStore((s) => s.cart);
  const addToCart = useBohStore((s) => s.addToCart);
  const removeFromCart = useBohStore((s) => s.removeFromCart);
  const clearCart = useBohStore((s) => s.clearCart);
  const getCartTotal = useBohStore((s) => s.getCartTotal);
  const getCartQuantity = useBohStore((s) => s.getCartQuantity);
  const isSelectingFoh = useBohStore((s) => s.isSelectingFoh);
  const startFohSelection = useBohStore((s) => s.startFohSelection);
  const cancelFohSelection = useBohStore((s) => s.cancelFohSelection);
  const submitToFoh = useBohStore((s) => s.submitToFoh);
  const showSuccess = useBohStore((s) => s.showSuccess);
  const lastConfirmedFoh = useBohStore((s) => s.lastConfirmedFoh);
  const getTodayHistory = useBohStore((s) => s.getTodayHistory);
  const getTodayTotal = useBohStore((s) => s.getTodayTotal);
  const removeDisbursement = useBohStore((s) => s.removeDisbursement);

  const products = getProductsWithCalc(categoryFilter);
  const cartTotal = getCartTotal();
  const fohStaff = allStaff.filter((s) => s.role === 'foh');
  const todayHistory = getTodayHistory();

  const handleProductTap = (product: ProductWithCalc) => {
    addToCart({
      productId: product.id,
      productName: product.name,
      categoryId: product.category_id,
      imageUrl: product.image_url,
    });
  };

  const handleSubmitToFoh = async (foh: StaffProfile) => {
    await submitToFoh(foh, currentStaff);
  };

  const categoryIcons: Record<string, typeof Wine> = { liquor: Wine, beer: Beer, fountain: CupSoda };

  // ===== Success overlay =====
  if (showSuccess && lastConfirmedFoh) {
    return (
      <div className="fixed inset-0 bg-green-500 flex flex-col items-center justify-center text-white z-50 animate-fade-in">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Sent to FOH!</h2>
        <p className="text-lg text-green-100">Handed off to {lastConfirmedFoh.name}</p>
      </div>
    );
  }

  // ===== FOH Selection overlay =====
  if (isSelectingFoh) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Send to which FOH staff?</h2>
          <button onClick={cancelFohSelection} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {fohStaff.length === 0 ? (
            <EmptyState emoji="👤" title="No FOH staff registered" description="FOH staff need to create a profile first" />
          ) : (
            fohStaff.map((staff) => (
              <button
                key={staff.id}
                onClick={() => handleSubmitToFoh(staff)}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition text-left"
              >
                {staff.photo_url ? (
                  <img src={staff.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-lg font-bold">
                    {staff.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{staff.name}</p>
                  <p className="text-xs text-gray-500">FOH Staff</p>
                </div>
                <Send className="w-5 h-5 text-gray-400 ml-auto" />
              </button>
            ))
          )}
        </div>

        {/* Cart summary */}
        <div className="p-4 bg-gray-50 border-t">
          <p className="text-sm text-gray-500 mb-2">Sending {cartTotal} items:</p>
          <div className="flex flex-wrap gap-2">
            {cart.map((item) => (
              <span key={item.productId} className="px-2 py-1 bg-white rounded-lg text-xs font-medium border">
                {item.quantity}x {item.productName}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStaff?.photo_url ? (
                <img src={currentStaff.photo_url} alt="" className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                  👨‍🍳
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold">{currentStaff?.name || 'BOH'}</h1>
                <p className="text-xs text-orange-200">Kitchen / Bar</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <span className="font-bold">{getTodayTotal()}</span>
                <span className="text-orange-200 ml-1">sent today</span>
              </div>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* View toggle */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setViewMode('products')}
            className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2',
              viewMode === 'products' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            )}
          >
            <ShoppingCart className="w-4 h-4" /> Products
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2',
              viewMode === 'history' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            )}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>

        {viewMode === 'products' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCategoryFilter('all')} className={cn('flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition', categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>All</button>
            {CATEGORIES.map((cat) => {
              const Icon = categoryIcons[cat.id] || Wine;
              return (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.id)} className={cn('flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition', categoryFilter === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>
                  <Icon className="w-4 h-4" /> {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="p-3 pb-32">
        {viewMode === 'products' && (
          products.length === 0 ? (
            <EmptyState emoji="📦" title="No products available" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onTap={handleProductTap}
                  mode="boh"
                  cartQuantity={getCartQuantity(product.id)}
                />
              ))}
            </div>
          )
        )}

        {viewMode === 'history' && (
          todayHistory.length === 0 ? (
            <EmptyState emoji="📋" title="No disbursements today" description="Items you send to FOH will show here" />
          ) : (
            <div className="space-y-2">
              {todayHistory.map((d) => {
                const cat = getCategoryInfo(d.category_id);
                return (
                  <div key={d.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', cat.bgColor, cat.textColor)}>
                        {d.quantity}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.product_name}</p>
                        <p className="text-xs text-gray-400">→ {d.foh_staff_name} · {formatTime(d.created_at)}</p>
                      </div>
                    </div>
                    <button onClick={() => removeDisbursement(d.id)} className="p-2 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

      </main>

      {/* Floating cart bar */}
      {cartTotal > 0 && viewMode === 'products' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 z-40 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-gray-900">{cartTotal} items</span>
            </div>
            <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500 transition">
              Clear all
            </button>
          </div>

          {/* Cart items mini-list */}
          <div className="flex flex-wrap gap-2 mb-3">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                <button onClick={() => removeFromCart(item.productId)} className="text-gray-400 hover:text-red-500">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-medium">{item.quantity}x {item.productName}</span>
                <button onClick={() => addToCart(item)} className="text-gray-400 hover:text-green-500">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <Button className="w-full bg-orange-500 hover:bg-orange-600" size="lg" onClick={startFohSelection}>
            <Send className="w-5 h-5" />
            Send to FOH
          </Button>
        </div>
      )}

    </div>
  );
}
