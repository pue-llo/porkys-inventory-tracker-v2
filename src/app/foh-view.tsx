'use client';

import { useState, useCallback } from 'react';
import {
  ShoppingCart, LayoutGrid, Receipt, LogOut, Wine, Beer, CupSoda,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useTableStore } from '@/stores/table-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { ProductCard } from '@/components/orders/product-card';
import { SaleConfirmModal } from '@/components/orders/sale-confirm-modal';
import { TableCard } from '@/components/tables/table-card';
import { TableDetailModal } from '@/components/tables/table-detail-modal';
import { WasteModal } from '@/components/inventory/waste-modal';

import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import type { ProductWithCalc, TableWithOrders } from '@/types';

type StaffView = 'products' | 'tables' | 'history';

export function FohView() {
  const [view, setView] = useState<StaffView>('products');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCalc | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showClosedTables, setShowClosedTables] = useState(false);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [wasteProduct, setWasteProduct] = useState<ProductWithCalc | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);

  const currentStaff = useAuthStore((s) => s.currentStaff);
  const logout = useAuthStore((s) => s.logout);
  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);
  const recordSale = useInventoryStore((s) => s.recordSale);
  const activeTables = useTableStore((s) => s.getActiveTables());
  const closedTables = useTableStore((s) => s.getClosedTables());
  const getTable = useTableStore((s) => s.getTable);
  const openTable = useTableStore((s) => s.openTable);
  const addOrder = useTableStore((s) => s.addOrder);
  const logActivity = useTableStore((s) => s.logActivity);
  const activityLog = useTableStore((s) => s.activityLog);
  const loadActivityLog = useTableStore((s) => s.loadActivityLog);
  const formatMoney = useCurrencyStore((s) => s.format);
  const toggleCurrency = useCurrencyStore((s) => s.toggle);
  const showUSD = useCurrencyStore((s) => s.showUSD);

  // Get filtered products (only those with remaining stock)
  const products = getProductsWithCalc(categoryFilter).filter((p) => p.remaining > 0);

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

      // Record sale in inventory
      await recordSale(productId, quantity);

      // Add order to table
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

      // Log activity
      const table = getTable(tableId);
      await logActivity({
        entityType: 'table',
        entityId: tableId,
        action: 'Sale',
        details: `${quantity}x ${product.name} - ${formatMoney(product.price_per_unit * quantity)}${table ? ` on Table ${table.table_number}` : ''}`,
        staffId: currentStaff?.id,
        staffName: currentStaff?.name,
      });

      // Flash animation
      setTappedId(productId);
      setTimeout(() => setTappedId(null), 300);
    },
    [getProductsWithCalc, recordSale, addOrder, logActivity, currentStaff, getTable, formatMoney]
  );

  const handleTableTap = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  const handleAddNewTable = async () => {
    await openTable({ staffId: currentStaff?.id });
  };

  // Load activity log when switching to history view
  const handleViewSwitch = (newView: StaffView) => {
    setView(newView);
    if (newView === 'history') loadActivityLog();
  };

  const selectedTable = selectedTableId ? getTable(selectedTableId) : null;

  const categoryIcons: Record<string, typeof Wine> = { liquor: Wine, beer: Beer, fountain: CupSoda };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStaff?.photo_url ? (
                <img src={currentStaff.photo_url} alt="" className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />
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

      {/* View toggle + filters */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        {/* View tabs */}
        <div className="flex gap-2 mb-2">
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

        {/* Category filters (products view only) */}
        {view === 'products' && (
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
              const Icon = categoryIcons[cat.id] || Wine;
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
        )}

        {/* Table count bar (tables view only) */}
        {view === 'tables' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{activeTables.length} active, {closedTables.length} closed</span>
            <button onClick={() => setShowClosedTables(!showClosedTables)} className="text-sm text-blue-600 font-medium">
              {showClosedTables ? 'Hide Closed' : 'Show Closed'}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="p-3 pb-24">
        {/* Products Grid */}
        {view === 'products' && (
          products.length === 0 ? (
            <EmptyState emoji="🍹" title="No products available" description="All items are out of stock or none match your filter" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onTap={handleProductTap}
                  onLongPress={handleProductLongPress}
                  showAnimation={tappedId === product.id}
                />
              ))}
            </div>
          )
        )}

        {/* Tables Grid */}
        {view === 'tables' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {/* Add new table button */}
            <button
              onClick={handleAddNewTable}
              className="table-card bg-white rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50/50 transition"
              style={{ minHeight: 140 }}
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                <span className="text-2xl">+</span>
              </div>
              <span className="text-sm font-medium">New Table</span>
            </button>

            {/* Active tables */}
            {activeTables.map((table) => (
              <TableCard key={table.id} table={table} onTap={handleTableTap} />
            ))}

            {/* Closed tables */}
            {showClosedTables && closedTables.map((table) => (
              <TableCard key={table.id} table={table} onTap={handleTableTap} />
            ))}
          </div>
        )}

        {/* Activity History */}
        {view === 'history' && (
          activityLog.length === 0 ? (
            <EmptyState emoji="📋" title="No activity yet" description="Table actions will be logged here" />
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Activity Log</h3>
              {activityLog.map((log) => (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.action === 'Opened' ? 'info' :
                          log.action === 'Closed' ? 'default' :
                          log.action === 'Reopened' ? 'purple' :
                          log.action === 'Sale' ? 'success' :
                          log.action === 'Removed' ? 'danger' :
                          'warning'
                        }
                      >
                        {log.action}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{log.details}</p>
                  {log.staff_name && <p className="text-xs text-gray-400 mt-1">by {log.staff_name}</p>}
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* Sale confirmation modal */}
      <SaleConfirmModal
        product={selectedProduct}
        isOpen={showSaleModal}
        onClose={() => { setShowSaleModal(false); setSelectedProduct(null); }}
        onConfirm={handleConfirmSale}
        staffId={currentStaff?.id}
      />

      {/* Table detail modal */}
      <TableDetailModal
        table={selectedTable as TableWithOrders || null}
        isOpen={!!selectedTableId}
        onClose={() => setSelectedTableId(null)}
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
