'use client';

import { useState } from 'react';
import {
  Package, Users, Download, LogOut, Plus, Search, Edit3, Trash2,
  Eye, EyeOff, Wine, Beer, CupSoda, UserPlus, ShoppingCart, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StaffSetup } from '@/components/auth/staff-setup';
import { FohView } from './foh-view';
import { cn, getStockLevel } from '@/lib/utils';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import type { Product } from '@/types';

type AdminTab = 'inventory' | 'orders' | 'staff';

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
  const formatMoney = useCurrencyStore((s) => s.format);
  const toggleCurrency = useCurrencyStore((s) => s.toggle);
  const showUSD = useCurrencyStore((s) => s.showUSD);

  const filteredProducts = getProductsWithCalc(categoryFilter, searchTerm);

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
    const invData = filteredProducts.map((p) => ({
      Category: p.category?.name || '', Name: p.name, 'Bottle Size': p.bottle_size || '',
      Boxes: p.num_boxes, 'Per Box': p.per_box, 'Total Units': p.totalUnits,
      Sold: p.sold, Remaining: p.remaining, 'Price/Unit': formatMoney(p.price_per_unit),
      'Revenue': formatMoney(p.expectedValue),
      ...(showCost ? { 'Cost/Unit': formatMoney(p.cost_per_unit) } : {}),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Inventory');
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (tab === 'orders') {
    return (
      <div>
        <div className="fixed bottom-4 left-4 z-50">
          <button onClick={() => setTab('inventory')} className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">← Admin</button>
        </div>
        <FohView />
      </div>
    );
  }

  if (showAddStaff) {
    return (
      <div>
        <div className="fixed top-4 left-4 z-50">
          <button onClick={() => setShowAddStaff(false)} className="bg-white text-gray-700 px-4 py-2 rounded-full text-sm font-medium shadow-lg border">← Cancel</button>
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

      {/* Tab nav */}
      <div className="sticky top-[64px] z-30 bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex gap-2">
          {([
            { id: 'inventory' as const, label: 'Inventory', icon: Package },
            { id: 'orders' as const, label: 'Orders', icon: ShoppingCart },
            { id: 'staff' as const, label: 'Staff', icon: Users },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2', tab === id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200')}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-3 pb-24">
        {/* ===== INVENTORY TAB ===== */}
        {tab === 'inventory' && (
          <>
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
              <button onClick={() => setCategoryFilter('all')} className={cn('flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition', categoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200')}>All</button>
              {CATEGORIES.map((cat) => {
                const Icon = categoryIcons[cat.id] || Wine;
                return (
                  <button key={cat.id} onClick={() => setCategoryFilter(cat.id)} className={cn('flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition', categoryFilter === cat.id ? `${cat.darkBg} text-white` : 'bg-white text-gray-600 border border-gray-200')}>
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
                  return (
                    <div key={p.id} className={cn('bg-white rounded-xl p-3 border shadow-sm', stockLevel === 'critical' ? 'border-red-200' : stockLevel === 'low' ? 'border-amber-200' : 'border-gray-100')}>
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
                      {/* Details row */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Price: {formatMoney(p.price_per_unit)}</span>
                          {showCost && <span>Cost: {formatMoney(p.cost_per_unit)}</span>}
                          <span>Sold: {p.sold}</span>
                          {p.par_level > 0 && p.remaining <= p.par_level && (
                            <Badge variant="warning">Below par ({p.par_level})</Badge>
                          )}
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
    </div>
  );
}
