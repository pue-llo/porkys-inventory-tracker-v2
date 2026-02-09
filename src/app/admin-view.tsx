'use client';

import { useState, useEffect } from 'react';
import {
  Package, Users, Download, LogOut, Plus, Search, Edit3, Trash2,
  Eye, EyeOff, Wine, Beer, CupSoda, UserPlus, RefreshCw,
  AlertTriangle, MessageSquare, FileText, BarChart3, Bell,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useRestockAlerts } from '@/hooks/use-restock-alerts';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StaffSetup } from '@/components/auth/staff-setup';
import { WasteModal } from '@/components/inventory/waste-modal';

import { EodView } from './eod-view';
import { AnalyticsView } from './analytics-view';
import { cn, getStockLevel, formatTime, getTodayKey } from '@/lib/utils';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Product, ProductWithCalc, StaffMessage, WasteLog } from '@/types';
import { WASTE_REASONS } from '@/types';

type AdminTab = 'inventory' | 'staff' | 'waste' | 'messages' | 'eod' | 'analytics';

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCost, setShowCost] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [wasteProduct, setWasteProduct] = useState<ProductWithCalc | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showAlertsBanner, setShowAlertsBanner] = useState(true);

  // Messages state
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [form, setForm] = useState({
    name: '', category_id: 'liquor', bottle_size: '', num_boxes: 1, per_box: 1,
    price_per_unit: 0, cost_per_unit: 0, par_level: 0,
  });

  const currentStaff = useAuthStore((s) => s.currentStaff);
  const allStaff = useAuthStore((s) => s.allStaff);
  const logout = useAuthStore((s) => s.logout);
  const loadStaff = useAuthStore((s) => s.loadStaff);
  const deactivateStaff = useAuthStore((s) => s.deactivateStaff);
  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);
  const createProduct = useInventoryStore((s) => s.createProduct);
  const updateProduct = useInventoryStore((s) => s.updateProduct);
  const deleteProduct = useInventoryStore((s) => s.deleteProduct);
  const restockProduct = useInventoryStore((s) => s.restockProduct);
  const loadWasteLog = useInventoryStore((s) => s.loadWasteLog);
  const getTodayWaste = useInventoryStore((s) => s.getTodayWaste);
  const getTotalWasteValue = useInventoryStore((s) => s.getTotalWasteValue);
  const formatMoney = useCurrencyStore((s) => s.format);
  const toggleCurrency = useCurrencyStore((s) => s.toggle);
  const showUSD = useCurrencyStore((s) => s.showUSD);

  const restockAlerts = useRestockAlerts();
  const filteredProducts = getProductsWithCalc(categoryFilter, searchTerm);
  const todayWaste = getTodayWaste();
  const totalWasteValue = getTotalWasteValue();

  // Load waste log and messages on mount
  useEffect(() => {
    loadWasteLog();
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const today = getTodayKey();
    const { data } = await supabase
      .from('staff_messages')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });
    setMessages(data || []);
    setUnreadCount((data || []).filter((m: StaffMessage) => !m.is_read).length);
  };

  const markMessageRead = async (id: string) => {
    await supabase.from('staff_messages').update({ is_read: true }).eq('id', id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setForm({ name: '', category_id: 'liquor', bottle_size: '', num_boxes: 1, per_box: 1, price_per_unit: 0, cost_per_unit: 0, par_level: 0 });
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setForm({ name: p.name, category_id: p.category_id, bottle_size: p.bottle_size || '', num_boxes: p.num_boxes, per_box: p.per_box, price_per_unit: p.price_per_unit, cost_per_unit: p.cost_per_unit, par_level: p.par_level });
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!form.name.trim()) return;
    if (editingProduct) await updateProduct(editingProduct.id, form);
    else await createProduct(form);
    setShowProductModal(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Remove this product from inventory?')) {
      await deleteProduct(id);
    }
  };

  const handleRestock = async (productId: string) => {
    if (restockQty > 0) {
      await restockProduct(productId, restockQty);
      setRestockId(null);
      setRestockQty(0);
    }
  };

  const handleExport = async () => {
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();
    const today = getTodayKey();

    // Inventory sheet
    const invData = filteredProducts.map((p) => ({
      Category: p.category?.name || '', Name: p.name, 'Bottle Size': p.bottle_size || '',
      Boxes: p.num_boxes, 'Per Box': p.per_box, 'Total Units': p.totalUnits,
      Sold: p.sold, Remaining: p.remaining, 'Price/Unit': formatMoney(p.price_per_unit),
      Revenue: formatMoney(p.expectedValue),
      ...(showCost ? { 'Cost/Unit': formatMoney(p.cost_per_unit) } : {}),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Inventory');

    // Waste Log sheet
    if (todayWaste.length > 0) {
      const wasteData = todayWaste.map((w) => ({
        Time: w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Product: w.product_name,
        Category: w.category_id,
        Quantity: w.quantity,
        Reason: w.reason,
        Notes: w.notes || '',
        'Value Lost': formatMoney(w.value_lost),
        Staff: w.staff_name || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wasteData), 'Waste Log');
    }

    // BOH Disbursements sheet
    const { data: disbursements } = await supabase
      .from('boh_disbursements')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });

    if (disbursements && disbursements.length > 0) {
      const bohData = disbursements.map((d: any) => ({
        Time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Product: d.product_name,
        Quantity: d.quantity,
        'BOH Staff': d.boh_staff_name || '',
        'FOH Staff': d.foh_staff_name || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bohData), 'BOH Disbursements');
    }

    // Tables sheet
    const { data: tables } = await supabase
      .from('tables')
      .select('*')
      .eq('date', today)
      .order('table_number');

    if (tables && tables.length > 0) {
      const tableIds = tables.map((t: any) => t.id);
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .in('table_id', tableIds);

      const ordersByTable: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach((o: any) => {
        if (!ordersByTable[o.table_id]) ordersByTable[o.table_id] = { count: 0, total: 0 };
        ordersByTable[o.table_id].count++;
        ordersByTable[o.table_id].total += o.total;
      });

      const tableData = tables.map((t: any) => ({
        'Table #': t.table_number,
        Name: t.name || '',
        Guests: t.guest_count || 0,
        Status: t.is_active ? 'Active' : 'Closed',
        Orders: ordersByTable[t.id]?.count || 0,
        Total: formatMoney(ordersByTable[t.id]?.total || 0),
        Opened: t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Closed: t.closed_at ? new Date(t.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tableData), 'Tables');
    }

    // EOD Report sheet
    const { data: eodReport } = await supabase
      .from('eod_reports')
      .select('*')
      .eq('date', today)
      .single();

    if (eodReport) {
      const eodData = [{
        Date: eodReport.date,
        'Total Sales': formatMoney(eodReport.total_sales),
        'Total Orders': eodReport.total_orders,
        'Tables Served': eodReport.total_tables,
        'Waste Value': formatMoney(eodReport.total_waste_value),
        'Cash in Drawer': formatMoney(eodReport.cash_in_drawer),
        'Expected Cash': formatMoney(eodReport.expected_cash),
        Variance: formatMoney(eodReport.variance),
        Notes: eodReport.notes || '',
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eodData), 'EOD Report');
    }

    XLSX.writeFile(wb, `porkys_inventory_${today}.xlsx`);
  };

  // ---- Special views ----
  if (tab === 'eod') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">EOD Report</h1>
            </div>
          </div>
        </header>
        <main className="p-3 pb-24">
          <EodView onBack={() => setTab('inventory')} />
        </main>
      </div>
    );
  }

  if (tab === 'analytics') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">Analytics</h1>
            </div>
          </div>
        </header>
        <main className="p-3 pb-24">
          <AnalyticsView onBack={() => setTab('inventory')} />
        </main>
      </div>
    );
  }

  if (showAddStaff) {
    return (
      <div>
        <div className="fixed top-4 left-4 z-50">
          <button onClick={() => setShowAddStaff(false)} className="bg-white text-gray-700 px-4 py-2 rounded-full text-sm font-medium shadow-lg border">
            ← Cancel
          </button>
        </div>
        <StaffSetup onComplete={() => { setShowAddStaff(false); loadStaff(); }} />
      </div>
    );
  }

  const categoryIcons: Record<string, typeof Wine> = { liquor: Wine, beer: Beer, fountain: CupSoda };
  const totalRevenue = filteredProducts.reduce((s, p) => s + p.expectedValue, 0);
  const totalSold = filteredProducts.reduce((s, p) => s + p.sold, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">👑</div>
            <div>
              <h1 className="text-lg font-bold">{currentStaff?.name || 'Admin'}</h1>
              <p className="text-xs text-gray-400">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification badges */}
            {restockAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold">
                {restockAlerts.length}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs font-bold">
                {unreadCount}
              </span>
            )}
            <button onClick={toggleCurrency} className={cn('px-2 py-1 rounded-lg text-xs font-bold transition', showUSD ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white')}>
              {showUSD ? 'USD' : 'COP'}
            </button>
            <button onClick={() => setShowCost(!showCost)} className="p-2 rounded-lg hover:bg-white/10 transition">
              {showCost ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav - scrollable */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { id: 'inventory' as const, label: 'Inventory', icon: Package },
            { id: 'waste' as const, label: 'Waste', icon: AlertTriangle, count: todayWaste.length },
            { id: 'messages' as const, label: 'Messages', icon: MessageSquare, count: unreadCount },
            { id: 'staff' as const, label: 'Staff', icon: Users },
            { id: 'eod' as const, label: 'EOD', icon: FileText },
            { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
          ]).map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setTab(id)} className={cn(
              'flex-shrink-0 py-2.5 px-3 rounded-lg text-sm font-medium transition flex items-center gap-2',
              tab === id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
            )}>
              <Icon className="w-4 h-4" /> {label}
              {count !== undefined && count > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded-full text-xs', tab === id ? 'bg-white/20' : 'bg-red-100 text-red-600')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="p-3 pb-24">
        {/* ===== INVENTORY TAB ===== */}
        {tab === 'inventory' && (
          <>
            {/* Restock alerts banner */}
            {restockAlerts.length > 0 && showAlertsBanner && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <button
                  onClick={() => setShowAlertsBanner(!showAlertsBanner)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">
                      {restockAlerts.length} product{restockAlerts.length !== 1 ? 's' : ''} below par level
                    </span>
                  </div>
                </button>
                <div className="space-y-1.5">
                  {restockAlerts.map((alert) => (
                    <div key={alert.productId} className="flex items-center justify-between text-sm">
                      <span className="text-amber-800">{alert.productName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600">{alert.currentStock}/{alert.parLevel}</span>
                        <button
                          onClick={() => { setRestockId(alert.productId); setRestockQty(0); }}
                          className="px-2 py-1 bg-amber-200 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-300 transition"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-2xl font-bold text-gray-900">{filteredProducts.length}</p>
                <p className="text-xs text-gray-500">Products</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-2xl font-bold text-green-600">{totalSold}</p>
                <p className="text-xs text-gray-500">Sold Today</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-sm font-bold text-blue-600">{formatMoney(totalRevenue)}</p>
                <p className="text-xs text-gray-500">Revenue</p>
              </div>
            </div>

            {/* Search + Add */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <Button onClick={openNewProduct}><Plus className="w-4 h-4" /> Add</Button>
              <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /></Button>
            </div>

            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
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

            {/* Product list */}
            {filteredProducts.length === 0 ? (
              <EmptyState emoji="📦" title="No products found" description="Add your first product or adjust filters" action={<Button onClick={openNewProduct}><Plus className="w-4 h-4" /> Add Product</Button>} />
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((p) => {
                  const cat = getCategoryInfo(p.category_id);
                  const stockLevel = getStockLevel(p.remaining, p.totalUnits);
                  const belowPar = p.par_level > 0 && p.remaining <= p.par_level;
                  return (
                    <div key={p.id} className={cn('bg-white rounded-xl p-3 border shadow-sm', stockLevel === 'critical' ? 'border-red-200' : stockLevel === 'low' ? 'border-amber-200' : belowPar ? 'border-amber-100' : 'border-gray-100')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cat.bgColor)}>
                            {(() => { const I = categoryIcons[p.category_id] || Wine; return <I className={cn('w-5 h-5', cat.textColor)} />; })()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.bottle_size || ''} · {p.num_boxes}×{p.per_box}</p>
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className={cn('text-lg font-bold', stockLevel === 'critical' ? 'text-red-600' : stockLevel === 'low' ? 'text-amber-600' : 'text-gray-900')}>{p.remaining}</p>
                          <p className="text-xs text-gray-400">of {p.totalUnits}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <span>Price: {formatMoney(p.price_per_unit)}</span>
                          {showCost && <span>Cost: {formatMoney(p.cost_per_unit)}</span>}
                          <span>Sold: {p.sold}</span>
                          {belowPar && <Badge variant="warning">Below par ({p.par_level})</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          {restockId === p.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={restockQty} onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-sm text-center" autoFocus />
                              <Button size="sm" onClick={() => handleRestock(p.id)}>Add</Button>
                              <Button size="sm" variant="ghost" onClick={() => setRestockId(null)}>×</Button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => { setWasteProduct(p); setShowWasteModal(true); }} className="p-1.5 hover:bg-red-50 rounded-lg transition" title="Report waste">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              </button>
                              <button onClick={() => { setRestockId(p.id); setRestockQty(0); }} className="p-1.5 hover:bg-green-50 rounded-lg transition" title="Restock">
                                <RefreshCw className="w-3.5 h-3.5 text-green-500" />
                              </button>
                              <button onClick={() => openEditProduct(p)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                                <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== WASTE TAB ===== */}
        {tab === 'waste' && (
          <>
            {/* Waste summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-2xl font-bold text-red-600">{todayWaste.reduce((s, w) => s + w.quantity, 0)}</p>
                <p className="text-xs text-gray-500">Items Wasted</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-lg font-bold text-red-600">{formatMoney(totalWasteValue)}</p>
                <p className="text-xs text-gray-500">Value Lost</p>
              </div>
            </div>

            {todayWaste.length === 0 ? (
              <EmptyState emoji="✅" title="No waste today" description="That's great! Use the waste button on products to log waste." />
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Waste Log</h3>
                {todayWaste.map((w) => {
                  const reasonInfo = WASTE_REASONS.find((r) => r.value === w.reason);
                  return (
                    <div key={w.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{reasonInfo?.emoji || '❓'}</span>
                          <span className="font-semibold text-gray-900">{w.product_name}</span>
                        </div>
                        <Badge variant="danger">{w.quantity} unit{w.quantity !== 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{reasonInfo?.label || w.reason}</Badge>
                          {w.notes && <span className="text-gray-400">{w.notes}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 font-medium">{formatMoney(w.value_lost)}</span>
                          <span>· {w.staff_name || 'Unknown'}</span>
                          <span>{w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== MESSAGES TAB ===== */}
        {tab === 'messages' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Staff Messages</h2>
              {unreadCount > 0 && <Badge variant="info">{unreadCount} unread</Badge>}
            </div>
            {messages.length === 0 ? (
              <EmptyState emoji="💬" title="No messages today" description="Staff messages will appear here when they log out" />
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'bg-white rounded-xl p-4 border shadow-sm transition cursor-pointer',
                      msg.is_read ? 'border-gray-100' : 'border-blue-200 bg-blue-50/30'
                    )}
                    onClick={() => !msg.is_read && markMessageRead(msg.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400">
                          {msg.staff_name.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-900">{msg.staff_name}</span>
                        {!msg.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                      <span className="text-xs text-gray-400">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== STAFF TAB ===== */}
        {tab === 'staff' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{allStaff.length} Staff Members</h2>
              <Button onClick={() => setShowAddStaff(true)}><UserPlus className="w-4 h-4" /> Add</Button>
            </div>
            <div className="space-y-2">
              {allStaff.map((staff) => (
                <div key={staff.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {staff.photo_url ? (
                      <img src={staff.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-lg">
                        {staff.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{staff.name}</p>
                      <Badge variant={staff.role === 'admin' ? 'purple' : staff.role === 'boh' ? 'warning' : 'info'}>
                        {staff.role.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {staff.id !== currentStaff?.id && (
                    <button onClick={() => { if (confirm(`Remove ${staff.name}?`)) deactivateStaff(staff.id); }} className="p-2 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Product add/edit modal */}
      <Modal isOpen={showProductModal} onClose={() => setShowProductModal(false)} title={editingProduct ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" placeholder="Product name" autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setForm({ ...form, category_id: cat.id })} className={cn('flex-1 py-2 rounded-xl text-sm font-medium border-2 transition', form.category_id === cat.id ? `${cat.darkBg} text-white border-transparent` : 'border-gray-200 text-gray-600')}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Bottle Size</label>
            <input value={form.bottle_size} onChange={(e) => setForm({ ...form, bottle_size: e.target.value })} className="w-full border rounded-xl px-3 py-2.5" placeholder="750ml, Lata, etc." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1"># Boxes</label>
              <input type="number" value={form.num_boxes} onChange={(e) => setForm({ ...form, num_boxes: parseInt(e.target.value) || 0 })} className="w-full border rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Per Box</label>
              <input type="number" value={form.per_box} onChange={(e) => setForm({ ...form, per_box: parseInt(e.target.value) || 0 })} className="w-full border rounded-xl px-3 py-2.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Price/Unit (COP)</label>
              <input type="number" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: parseInt(e.target.value) || 0 })} className="w-full border rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Cost/Unit (COP)</label>
              <input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: parseInt(e.target.value) || 0 })} className="w-full border rounded-xl px-3 py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Par Level (restock alert threshold)</label>
            <input type="number" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: parseInt(e.target.value) || 0 })} className="w-full border rounded-xl px-3 py-2.5" placeholder="0 = no alert" />
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            Total units: <strong>{form.num_boxes * form.per_box}</strong>
          </div>
          <Button className="w-full" size="lg" onClick={handleSaveProduct}>{editingProduct ? 'Update Product' : 'Add Product'}</Button>
        </div>
      </Modal>

      {/* Waste modal */}
      <WasteModal
        product={wasteProduct}
        isOpen={showWasteModal}
        onClose={() => { setShowWasteModal(false); setWasteProduct(null); }}
      />
    </div>
  );
}
