'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign, ShoppingCart, Users, AlertTriangle, Save, Download, FileText, ChevronDown, ChevronUp, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTodayKey, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import type { EodReport, BohDisbursement } from '@/types';

interface EodStats {
  totalSales: number;
  totalOrders: number;
  totalTables: number;
  totalWasteValue: number;
  topSellers: { product_name: string; quantity: number; revenue: number }[];
  staffBreakdown: { staff_name: string; orders: number; revenue: number }[];
}

export function EodView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<EodStats | null>(null);
  const [cashInDrawer, setCashInDrawer] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedReport, setSavedReport] = useState<EodReport | null>(null);
  const [pastReports, setPastReports] = useState<EodReport[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [disbursements, setDisbursements] = useState<BohDisbursement[]>([]);
  const [showDisbursements, setShowDisbursements] = useState(true);

  const formatMoney = useCurrencyStore((s) => s.format);
  const currentStaff = useAuthStore((s) => s.currentStaff);
  const today = getTodayKey();

  useEffect(() => {
    loadEodData();
    loadPastReports();
    loadDisbursements();
  }, []);

  const loadEodData = async () => {
    setIsLoading(true);
    try {
      // Check if report already saved for today
      const { data: existing } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('date', today)
        .single();

      if (existing) {
        setSavedReport(existing);
        setCashInDrawer(String(existing.cash_in_drawer || ''));
        setNotes(existing.notes || '');
      }

      // Get today's tables
      const { data: tables } = await supabase
        .from('tables')
        .select('id')
        .eq('date', today);

      const tableIds = (tables || []).map((t) => t.id);
      const totalTables = tableIds.length;

      // Get today's orders
      let totalSales = 0;
      let totalOrders = 0;
      const productSales: Record<string, { product_name: string; quantity: number; revenue: number }> = {};
      const staffSales: Record<string, { staff_name: string; orders: number; revenue: number }> = {};

      if (tableIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .in('table_id', tableIds);

        (orders || []).forEach((o) => {
          totalSales += o.total;
          totalOrders++;

          // Product aggregation
          if (!productSales[o.product_id]) {
            productSales[o.product_id] = { product_name: o.product_name, quantity: 0, revenue: 0 };
          }
          productSales[o.product_id].quantity += o.quantity;
          productSales[o.product_id].revenue += o.total;

          // Staff aggregation
          const sName = o.staff_name || 'Unknown';
          if (!staffSales[sName]) {
            staffSales[sName] = { staff_name: sName, orders: 0, revenue: 0 };
          }
          staffSales[sName].orders++;
          staffSales[sName].revenue += o.total;
        });
      }

      // Get today's waste
      const { data: wasteData } = await supabase
        .from('waste_log')
        .select('value_lost')
        .eq('date', today);

      const totalWasteValue = (wasteData || []).reduce((s, w) => s + w.value_lost, 0);

      const topSellers = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const staffBreakdown = Object.values(staffSales)
        .sort((a, b) => b.revenue - a.revenue);

      setStats({ totalSales, totalOrders, totalTables, totalWasteValue, topSellers, staffBreakdown });
    } catch (err) {
      console.error('Failed to load EOD data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPastReports = async () => {
    const { data } = await supabase
      .from('eod_reports')
      .select('*')
      .neq('date', today)
      .order('date', { ascending: false })
      .limit(30);
    setPastReports(data || []);
  };

  const loadDisbursements = async () => {
    const { data } = await supabase
      .from('boh_disbursements')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });
    setDisbursements(data || []);
  };

  const handleSave = async () => {
    if (!stats) return;
    setIsSaving(true);
    const cash = parseInt(cashInDrawer) || 0;
    const expectedCash = stats.totalSales;
    const variance = cash - expectedCash;

    const reportData = {
      date: today,
      total_sales: stats.totalSales,
      total_orders: stats.totalOrders,
      total_tables: stats.totalTables,
      total_waste_value: stats.totalWasteValue,
      cash_in_drawer: cash,
      expected_cash: expectedCash,
      variance,
      notes: notes.trim(),
      closed_by: currentStaff?.id || null,
    };

    try {
      if (savedReport) {
        await supabase.from('eod_reports').update(reportData).eq('id', savedReport.id);
      } else {
        await supabase.from('eod_reports').insert(reportData);
      }
      const { data } = await supabase.from('eod_reports').select('*').eq('date', today).single();
      setSavedReport(data);
    } catch (err: any) {
      console.error('Failed to save EOD report:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportEod = async () => {
    const XLSX = (await import('xlsx')).default;
    const wb = XLSX.utils.book_new();

    if (stats) {
      const cash = parseInt(cashInDrawer) || 0;
      const summaryData = [{
        Date: today,
        'Total Sales': stats.totalSales,
        'Total Orders': stats.totalOrders,
        'Tables Served': stats.totalTables,
        'Total Waste Value': stats.totalWasteValue,
        'Cash in Drawer': cash,
        'Expected Cash': stats.totalSales,
        'Variance': cash - stats.totalSales,
        'Notes': notes,
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'EOD Summary');

      if (stats.topSellers.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats.topSellers.map((s) => ({
          Product: s.product_name, 'Qty Sold': s.quantity, Revenue: s.revenue,
        }))), 'Top Sellers');
      }

      if (stats.staffBreakdown.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stats.staffBreakdown.map((s) => ({
          Staff: s.staff_name, Orders: s.orders, Revenue: s.revenue,
        }))), 'Staff Performance');
      }
    }

    // BOH Disbursements sheets
    if (disbursements.length > 0) {
      // Raw disbursement log
      const bohData = disbursements.map((d) => ({
        Time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        Product: d.product_name,
        Quantity: d.quantity,
        'BOH Staff': d.boh_staff_name || '',
        'FOH Staff': d.foh_staff_name || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bohData), 'BOH Disbursements');

      // By-product summary
      const byProduct: Record<string, { name: string; qty: number }> = {};
      disbursements.forEach((d) => {
        if (!byProduct[d.product_id]) byProduct[d.product_id] = { name: d.product_name, qty: 0 };
        byProduct[d.product_id].qty += d.quantity;
      });
      const productSummary = Object.values(byProduct)
        .sort((a, b) => b.qty - a.qty)
        .map((p) => ({ Product: p.name, 'Total Disbursed': p.qty }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productSummary), 'BOH By Product');

      // By-FOH-staff summary
      const byStaff: Record<string, Record<string, number>> = {};
      disbursements.forEach((d) => {
        const name = d.foh_staff_name || 'Unknown';
        if (!byStaff[name]) byStaff[name] = {};
        byStaff[name][d.product_name] = (byStaff[name][d.product_name] || 0) + d.quantity;
      });
      const staffSummary: { 'FOH Staff': string; Product: string; Quantity: number }[] = [];
      Object.entries(byStaff).forEach(([staffName, products]) => {
        Object.entries(products).forEach(([productName, qty]) => {
          staffSummary.push({ 'FOH Staff': staffName, Product: productName, Quantity: qty });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffSummary), 'BOH By FOH Staff');
    }

    XLSX.writeFile(wb, `eod_report_${today}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">Calculating totals...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <EmptyState emoji="📊" title="No data available" description="No activity recorded for today" />;
  }

  const cash = parseInt(cashInDrawer) || 0;
  const expectedCash = stats.totalSales;
  const variance = cash - expectedCash;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">End-of-Day Report</h2>
          <p className="text-sm text-gray-500">{formatDate(today + 'T00:00:00')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportEod}>
            <Download className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={onBack} variant="ghost">Back</Button>
        </div>
      </div>

      {savedReport && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
          <Save className="w-4 h-4" /> Report saved. You can update it below.
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{formatMoney(stats.totalSales)}</p>
          <p className="text-xs text-gray-500">Total Sales</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <ShoppingCart className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
          <p className="text-xs text-gray-500">Orders Placed</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <Users className="w-6 h-6 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.totalTables}</p>
          <p className="text-xs text-gray-500">Tables Served</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-600">{formatMoney(stats.totalWasteValue)}</p>
          <p className="text-xs text-gray-500">Waste Value</p>
        </div>
      </div>

      {/* Cash reconciliation */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Cash Reconciliation</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Expected Cash (Sales)</span>
            <span className="font-bold text-gray-900">{formatMoney(expectedCash)}</span>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Cash in Drawer</label>
            <input
              type="number"
              value={cashInDrawer}
              onChange={(e) => setCashInDrawer(e.target.value)}
              placeholder="Enter cash count"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {cashInDrawer && (
            <div className={cn(
              'flex items-center justify-between p-3 rounded-xl',
              variance >= 0 ? 'bg-green-50' : 'bg-red-50'
            )}>
              <span className="text-sm font-medium">Variance</span>
              <span className={cn('font-bold', variance >= 0 ? 'text-green-700' : 'text-red-700')}>
                {variance >= 0 ? '+' : ''}{formatMoney(Math.abs(variance))}
                {variance < 0 && ' short'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top sellers */}
      {stats.topSellers.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Sellers</h3>
          <div className="space-y-2">
            {stats.topSellers.map((item, i) => (
              <div key={item.product_name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-900">{item.product_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatMoney(item.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff breakdown */}
      {stats.staffBreakdown.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Staff Performance</h3>
          <div className="space-y-2">
            {stats.staffBreakdown.map((staff) => (
              <div key={staff.staff_name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{staff.staff_name}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{staff.orders} orders</span>
                  <span className="font-bold text-gray-900">{formatMoney(staff.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOH Disbursements */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowDisbursements(!showDisbursements)}
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            <span>BOH Disbursements ({disbursements.reduce((s, d) => s + d.quantity, 0)} items)</span>
          </div>
          {showDisbursements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDisbursements && (
          disbursements.length === 0 ? (
            <div className="px-4 pb-4">
              <div className="text-center py-6 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No disbursements today</p>
                <p className="text-xs mt-1">BOH handoffs to FOH will appear here</p>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{disbursements.reduce((s, d) => s + d.quantity, 0)}</p>
                  <p className="text-xs text-gray-500">Items Sent</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{new Set(disbursements.map((d) => d.product_id)).size}</p>
                  <p className="text-xs text-gray-500">Products</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{new Set(disbursements.map((d) => d.foh_staff_name).filter(Boolean)).size}</p>
                  <p className="text-xs text-gray-500">FOH Staff</p>
                </div>
              </div>

              {/* By Product */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">By Product</h4>
                <div className="space-y-1.5">
                  {(() => {
                    const byProduct: Record<string, { name: string; quantity: number }> = {};
                    disbursements.forEach((d) => {
                      if (!byProduct[d.product_id]) byProduct[d.product_id] = { name: d.product_name, quantity: 0 };
                      byProduct[d.product_id].quantity += d.quantity;
                    });
                    return Object.values(byProduct).sort((a, b) => b.quantity - a.quantity).map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                            i === 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-900">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* By FOH Staff */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">By FOH Staff</h4>
                <div className="space-y-2">
                  {(() => {
                    const byStaff: Record<string, { name: string; items: Record<string, { name: string; quantity: number }> }> = {};
                    disbursements.forEach((d) => {
                      const staffName = d.foh_staff_name || 'Unknown';
                      const staffId = d.foh_staff_id || staffName;
                      if (!byStaff[staffId]) byStaff[staffId] = { name: staffName, items: {} };
                      if (!byStaff[staffId].items[d.product_id]) byStaff[staffId].items[d.product_id] = { name: d.product_name, quantity: 0 };
                      byStaff[staffId].items[d.product_id].quantity += d.quantity;
                    });
                    return Object.values(byStaff).sort((a, b) => a.name.localeCompare(b.name)).map((staff) => {
                      const staffItems = Object.values(staff.items).sort((a, b) => b.quantity - a.quantity);
                      const staffTotal = staffItems.reduce((sum, item) => sum + item.quantity, 0);
                      return (
                        <div key={staff.name} className="p-2.5 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-gray-900">{staff.name}</span>
                            <span className="text-xs font-bold text-gray-500">{staffTotal} items</span>
                          </div>
                          <div className="space-y-0.5">
                            {staffItems.map((item) => (
                              <div key={item.name} className="flex items-center justify-between text-xs text-gray-600">
                                <span>{item.name}</span>
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <label className="text-sm font-semibold text-gray-900 block mb-2">Admin Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything to note about today..."
          rows={3}
          className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Save button */}
      <Button className="w-full" size="lg" onClick={handleSave} isLoading={isSaving}>
        <Save className="w-5 h-5" />
        {savedReport ? 'Update Report' : 'Save Report'}
      </Button>

      {/* Past reports */}
      {pastReports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
          >
            <span>Past Reports ({pastReports.length})</span>
            {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPast && (
            <div className="px-4 pb-4 space-y-2">
              {pastReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <span className="font-medium text-gray-900">{formatDate(r.date + 'T00:00:00')}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{formatMoney(r.total_sales)}</span>
                    <Badge variant={r.variance >= 0 ? 'success' : 'danger'}>
                      {r.variance >= 0 ? '+' : ''}{formatMoney(Math.abs(r.variance))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
