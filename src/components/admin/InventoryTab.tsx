'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Plus, Search, Download, Edit3, Trash2, Wine, RefreshCw,
  AlertTriangle, Bell,
} from 'lucide-react';
import { useInventoryStore } from '@/stores/inventory-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useRestockAlerts } from '@/hooks/use-restock-alerts';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { WasteModal } from '@/components/inventory/waste-modal';
import { cn, getStockLevel, getTodayKey } from '@/lib/utils';
import { CATEGORIES, CATEGORY_ICONS, getCategoryInfo } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Product, ProductWithCalc } from '@/types';

interface InventoryTabProps {
  showCost: boolean;
}

export function InventoryTab({ showCost }: InventoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout>();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [wasteProduct, setWasteProduct] = useState<ProductWithCalc | null>(null);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showAlertsBanner, setShowAlertsBanner] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [form, setForm] = useState({
    name: '', category_id: 'liquor', bottle_size: '', num_boxes: 1, per_box: 1,
    price_per_unit: 0, cost_per_unit: 0, par_level: 0,
  });

  const getProductsWithCalc = useInventoryStore((s) => s.getProductsWithCalc);
  const createProduct = useInventoryStore((s) => s.createProduct);
  const updateProduct = useInventoryStore((s) => s.updateProduct);
  const deleteProduct = useInventoryStore((s) => s.deleteProduct);
  const restockProduct = useInventoryStore((s) => s.restockProduct);
  const getTodayWaste = useInventoryStore((s) => s.getTodayWaste);
  const formatMoney = useCurrencyStore((s) => s.format);

  const restockAlerts = useRestockAlerts();
  const filteredProducts = getProductsWithCalc(categoryFilter, searchTerm);
  const todayWaste = getTodayWaste();

  const totalRevenue = useMemo(
    () => filteredProducts.reduce((s, p) => s + p.expectedValue, 0),
    [filteredProducts]
  );
  const totalSold = useMemo(
    () => filteredProducts.reduce((s, p) => s + p.sold, 0),
    [filteredProducts]
  );

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
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
    if (isExporting) return;
    setIsExporting(true);
    try {
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();
    const today = getTodayKey();

    const invData = filteredProducts.map((p) => ({
      Category: p.category?.name || '', Name: p.name, 'Bottle Size': p.bottle_size || '',
      Boxes: p.num_boxes, 'Per Box': p.per_box, 'Total Units': p.totalUnits,
      Sold: p.sold, Remaining: p.remaining, 'Price/Unit': formatMoney(p.price_per_unit),
      Revenue: formatMoney(p.expectedValue),
      ...(showCost ? { 'Cost/Unit': formatMoney(p.cost_per_unit) } : {}),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Inventory');

    if (todayWaste.length > 0) {
      const wasteData = todayWaste.map((w) => ({
        Time: w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Product: w.product_name, Category: w.category_id, Quantity: w.quantity,
        Reason: w.reason, Notes: w.notes || '',
        'Value Lost': formatMoney(w.value_lost), Staff: w.staff_name || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wasteData), 'Waste Log');
    }

    const { data: disbursements } = await supabase
      .from('boh_disbursements').select('*').eq('date', today).order('created_at', { ascending: false });

    if (disbursements && disbursements.length > 0) {
      const bohData = disbursements.map((d: any) => ({
        Time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Product: d.product_name, Quantity: d.quantity,
        'BOH Staff': d.boh_staff_name || '', 'FOH Staff': d.foh_staff_name || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bohData), 'BOH Disbursements');
    }

    const { data: tables } = await supabase
      .from('tables').select('*').eq('date', today).order('table_number');

    if (tables && tables.length > 0) {
      const tableIds = tables.map((t: any) => t.id);
      const { data: orders } = await supabase.from('orders').select('*').in('table_id', tableIds);
      const ordersByTable: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach((o: any) => {
        if (!ordersByTable[o.table_id]) ordersByTable[o.table_id] = { count: 0, total: 0 };
        ordersByTable[o.table_id].count++;
        ordersByTable[o.table_id].total += o.total;
      });
      const tableData = tables.map((t: any) => ({
        'Table #': t.table_number, Name: t.name || '', Guests: t.guest_count || 0,
        Status: t.is_active ? 'Active' : 'Closed',
        Orders: ordersByTable[t.id]?.count || 0, Total: formatMoney(ordersByTable[t.id]?.total || 0),
        Opened: t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Closed: t.closed_at ? new Date(t.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tableData), 'Tables');
    }

    const { data: eodReport } = await supabase
      .from('eod_reports').select('*').eq('date', today).single();

    if (eodReport) {
      const eodData = [{
        Date: eodReport.date, 'Total Sales': formatMoney(eodReport.total_sales),
        'Total Orders': eodReport.total_orders, 'Tables Served': eodReport.total_tables,
        'Waste Value': formatMoney(eodReport.total_waste_value),
        'Cash in Drawer': formatMoney(eodReport.cash_in_drawer),
        'Expected Cash': formatMoney(eodReport.expected_cash),
        Variance: formatMoney(eodReport.variance), Notes: eodReport.notes || '',
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eodData), 'EOD Report');
    }

    XLSX.writeFile(wb, `porkys_inventory_${today}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
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
            type="text" value={inputValue} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search products..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <Button onClick={openNewProduct}><Plus className="w-4 h-4" /> Add</Button>
        <Button variant="secondary" onClick={handleExport} isLoading={isExporting} disabled={isExporting}><Download className="w-4 h-4" /></Button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        <button onClick={() => setCategoryFilter('all')} className={cn('flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition', categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>All</button>
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Wine;
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
                      {(() => { const I = CATEGORY_ICONS[p.category_id] || Wine; return <I className={cn('w-5 h-5', cat.textColor)} />; })()}
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
    </>
  );
}
