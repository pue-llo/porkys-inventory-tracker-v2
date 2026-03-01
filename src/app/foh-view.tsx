'use client';

import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Image from 'next/image';
import {
  ShoppingCart, LayoutGrid, Receipt, LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useTableStore } from '@/stores/table-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { SaleConfirmModal } from '@/components/orders/sale-confirm-modal';
import { WasteModal } from '@/components/inventory/waste-modal';
import { ProductsGrid } from '@/components/foh/ProductsGrid';
import { TablesGrid } from '@/components/foh/TablesGrid';
import { ActivityLog } from '@/components/foh/ActivityLog';

import { cn } from '@/lib/utils';
import type { ProductWithCalc } from '@/types';

type StaffView = 'products' | 'tables' | 'history';

export function FohView() {
  const [view, setView] = useState<StaffView>('products');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCalc | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [wasteProduct, setWasteProduct] = useState<ProductWithCalc | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);

  const { currentStaff, logout } = useAuthStore(
    useShallow((s) => ({ currentStaff: s.currentStaff, logout: s.logout }))
  );
  const { getProductsWithCalc, recordSale } = useInventoryStore(
    useShallow((s) => ({ getProductsWithCalc: s.getProductsWithCalc, recordSale: s.recordSale }))
  );
  const activeTables = useTableStore((s) => s.getActiveTables());
  const { getTable, addOrder, logActivity, loadActivityLog } = useTableStore(
    useShallow((s) => ({
      getTable: s.getTable,
      addOrder: s.addOrder,
      logActivity: s.logActivity,
      loadActivityLog: s.loadActivityLog,
    }))
  );
  const { format: formatMoney, toggle: toggleCurrency, showUSD } = useCurrencyStore(
    useShallow((s) => ({ format: s.format, toggle: s.toggle, showUSD: s.showUSD }))
  );

  const handleProductTap = (product: ProductWithCalc) => {
    setSelectedProduct(product);
    setShowSaleModal(true);
  };

  const handleProductLongPress = (product: ProductWithCalc) => {
    setWasteProduct(product);
    setShowWasteModal(true);
  };

  const handleConfirmSale = useCallback(
    async (productId: string, quantity: number, tableId: string) => {
      const product = getProductsWithCalc().find((p) => p.id === productId);
      if (!product) return;

      await recordSale(productId, quantity);

      await addOrder({
        table_id: tableId,
        product_id: productId,
        product_name: product.name,
        category_id: product.category_id,
        price_per_unit: product.price_per_unit,
        quantity,
        total: product.price_per_unit * quantity,
        staff_id: currentStaff?.id || null,
        staff_name: currentStaff?.name || null,
      });

      const table = getTable(tableId);
      await logActivity({
        entityType: 'table',
        entityId: tableId,
        action: 'Sale',
        details: `${quantity}x ${product.name} - ${formatMoney(product.price_per_unit * quantity)}${table ? ` on Table ${table.table_number}` : ''}`,
        staffId: currentStaff?.id,
        staffName: currentStaff?.name,
      });

      setTappedId(productId);
      setTimeout(() => setTappedId(null), 300);
    },
    [getProductsWithCalc, recordSale, addOrder, logActivity, currentStaff, getTable, formatMoney]
  );

  const handleViewSwitch = (newView: StaffView) => {
    setView(newView);
    if (newView === 'history') loadActivityLog();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStaff?.photo_url ? (
                <Image src={currentStaff.photo_url} alt="" width={40} height={40} className="rounded-full border-2 border-white/30 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold">{currentStaff?.name || 'Staff'}</h1>
                <p className="text-xs text-blue-200">{activeTables.length} active table{activeTables.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleCurrency}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-bold transition',
                  showUSD ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white'
                )}
              >
                {showUSD ? 'USD' : 'COP'}
              </button>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* View toggle */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex gap-2">
          {[
            { id: 'products' as const, label: 'Products', icon: ShoppingCart },
            { id: 'tables' as const, label: 'Tables', icon: LayoutGrid, count: activeTables.length },
            { id: 'history' as const, label: 'History', icon: Receipt },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => handleViewSwitch(id)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2',
                view === id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded-full text-xs', view === id ? 'bg-white/20' : 'bg-blue-100 text-blue-600')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-3 pb-24">
        {view === 'products' && (
          <ProductsGrid
            onProductTap={handleProductTap}
            onProductLongPress={handleProductLongPress}
            tappedId={tappedId}
          />
        )}
        {view === 'tables' && <TablesGrid />}
        {view === 'history' && <ActivityLog />}
      </main>

      {/* Sale confirmation modal */}
      <SaleConfirmModal
        product={selectedProduct}
        isOpen={showSaleModal}
        onClose={() => { setShowSaleModal(false); setSelectedProduct(null); }}
        onConfirm={handleConfirmSale}
        staffId={currentStaff?.id}
      />

      {/* Waste modal */}
      <WasteModal
        product={wasteProduct}
        isOpen={showWasteModal}
        onClose={() => { setShowWasteModal(false); setWasteProduct(null); }}
      />
    </div>
  );
}
