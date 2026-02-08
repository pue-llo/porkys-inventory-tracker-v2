'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Users, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/lib/utils';
import { useCurrencyStore } from '@/hooks/use-currency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

type DateRange = '1' | '7' | '14' | '30';

interface AnalyticsData {
  dailySales: { date: string; revenue: number; orders: number }[];
  topSellers: { name: string; quantity: number; revenue: number }[];
  peakHours: { hour: number; orders: number; revenue: number }[];
  categoryBreakdown: { name: string; revenue: number; color: string }[];
  staffLeaderboard: { name: string; tables: number; items: number; revenue: number }[];
  wasteByReason: { reason: string; quantity: number; value: number }[];
  worstWasted: { name: string; quantity: number; value: number }[];
}

const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#06b6d4', '#10b981', '#ef4444', '#6366f1'];
const CATEGORY_COLORS: Record<string, string> = { liquor: '#8b5cf6', beer: '#f59e0b', fountain: '#06b6d4' };

export function AnalyticsView({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<DateRange>('7');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatMoney = useCurrencyStore((s) => s.format);

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(range) + 1);
    return d.toISOString().split('T')[0];
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    const startDate = getStartDate();
    const today = getTodayKey();

    try {
      // Get tables in date range
      const { data: tables } = await supabase
        .from('tables')
        .select('id, date')
        .gte('date', startDate)
        .lte('date', today);

      const tableIds = (tables || []).map((t) => t.id);
      const tableDateMap: Record<string, string> = {};
      (tables || []).forEach((t) => { tableDateMap[t.id] = t.date; });

      // Get orders for those tables
      let orders: any[] = [];
      if (tableIds.length > 0) {
        // Batch queries for large arrays
        const batchSize = 100;
        for (let i = 0; i < tableIds.length; i += batchSize) {
          const batch = tableIds.slice(i, i + batchSize);
          const { data: batchOrders } = await supabase
            .from('orders')
            .select('*')
            .in('table_id', batch);
          orders = orders.concat(batchOrders || []);
        }
      }

      // Daily sales
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      orders.forEach((o) => {
        const date = tableDateMap[o.table_id] || o.created_at?.split('T')[0];
        if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
        dailyMap[date].revenue += o.total;
        dailyMap[date].orders++;
      });
      const dailySales = Object.entries(dailyMap)
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top sellers
      const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
      orders.forEach((o) => {
        if (!productMap[o.product_id]) productMap[o.product_id] = { name: o.product_name, quantity: 0, revenue: 0 };
        productMap[o.product_id].quantity += o.quantity;
        productMap[o.product_id].revenue += o.total;
      });
      const topSellers = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

      // Peak hours
      const hourMap: Record<number, { orders: number; revenue: number }> = {};
      orders.forEach((o) => {
        const hour = new Date(o.created_at).getHours();
        if (!hourMap[hour]) hourMap[hour] = { orders: 0, revenue: 0 };
        hourMap[hour].orders++;
        hourMap[hour].revenue += o.total;
      });
      const peakHours = Object.entries(hourMap)
        .map(([h, v]) => ({ hour: parseInt(h), ...v }))
        .sort((a, b) => a.hour - b.hour);

      // Category breakdown
      const catMap: Record<string, number> = {};
      orders.forEach((o) => {
        const catName = o.category_id || 'other';
        catMap[catName] = (catMap[catName] || 0) + o.total;
      });
      const catNames: Record<string, string> = { liquor: 'Liquor', beer: 'Beer', fountain: 'Fountain', other: 'Other' };
      const categoryBreakdown = Object.entries(catMap)
        .map(([id, revenue]) => ({
          name: catNames[id] || id,
          revenue,
          color: CATEGORY_COLORS[id] || '#9ca3af',
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Staff leaderboard
      const staffMap: Record<string, { name: string; tableSet: Set<string>; items: number; revenue: number }> = {};
      orders.forEach((o) => {
        const name = o.staff_name || 'Unknown';
        if (!staffMap[name]) staffMap[name] = { name, tableSet: new Set(), items: 0, revenue: 0 };
        staffMap[name].tableSet.add(o.table_id);
        staffMap[name].items += o.quantity;
        staffMap[name].revenue += o.total;
      });
      const staffLeaderboard = Object.values(staffMap)
        .map((s) => ({ name: s.name, tables: s.tableSet.size, items: s.items, revenue: s.revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      // Waste data
      const { data: wasteData } = await supabase
        .from('waste_log')
        .select('*')
        .gte('date', startDate)
        .lte('date', today);

      const reasonMap: Record<string, { quantity: number; value: number }> = {};
      const wasteProductMap: Record<string, { name: string; quantity: number; value: number }> = {};
      (wasteData || []).forEach((w: any) => {
        const r = w.reason || 'other';
        if (!reasonMap[r]) reasonMap[r] = { quantity: 0, value: 0 };
        reasonMap[r].quantity += w.quantity;
        reasonMap[r].value += w.value_lost;

        if (!wasteProductMap[w.product_id]) wasteProductMap[w.product_id] = { name: w.product_name, quantity: 0, value: 0 };
        wasteProductMap[w.product_id].quantity += w.quantity;
        wasteProductMap[w.product_id].value += w.value_lost;
      });

      const reasonLabels: Record<string, string> = { broken: 'Broken', spill: 'Spill', comp: 'Comp', spoiled: 'Spoiled', other: 'Other' };
      const wasteByReason = Object.entries(reasonMap)
        .map(([reason, v]) => ({ reason: reasonLabels[reason] || reason, ...v }))
        .sort((a, b) => b.value - a.value);

      const worstWasted = Object.values(wasteProductMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setData({ dailySales, topSellers, peakHours, categoryBreakdown, staffLeaderboard, wasteByReason, worstWasted });
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatShortDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatHour = (h: number) => {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <BarChart3 className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <EmptyState emoji="📊" title="No data available" />;
  }

  const totalRevenue = data.dailySales.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = data.dailySales.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
        <Button size="sm" onClick={onBack} variant="ghost">Back</Button>
      </div>

      {/* Date range selector */}
      <div className="flex gap-2">
        {([
          { value: '1' as const, label: 'Today' },
          { value: '7' as const, label: '7 Days' },
          { value: '14' as const, label: '14 Days' },
          { value: '30' as const, label: '30 Days' },
        ]).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setRange(value)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition',
              range === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-xl font-bold text-gray-900">{formatMoney(totalRevenue)}</p>
          <p className="text-xs text-gray-500">Total Revenue</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-xl font-bold text-gray-900">{totalOrders}</p>
          <p className="text-xs text-gray-500">Total Orders</p>
        </div>
      </div>

      {/* Sales Trend */}
      {data.dailySales.length > 1 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Sales Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatMoney(value), 'Revenue']}
                labelFormatter={(label: string) => formatShortDate(label)}
              />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Sellers */}
      {data.topSellers.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-500" /> Top Sellers
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(150, data.topSellers.length * 32)}>
            <BarChart data={data.topSellers} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={75} />
              <Tooltip formatter={(value: number) => [value, 'Sold']} />
              <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Peak Hours */}
      {data.peakHours.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" /> Peak Hours
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label: number) => formatHour(label)}
                formatter={(value: number) => [value, 'Orders']}
              />
              <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Category Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={150}>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                >
                  {data.categoryBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {data.categoryBreakdown.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-gray-700">{cat.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{formatMoney(cat.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Staff Leaderboard */}
      {data.staffLeaderboard.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /> Staff Leaderboard
          </h3>
          <div className="space-y-2">
            {data.staffLeaderboard.map((staff, i) => (
              <div key={staff.name} className={cn(
                'flex items-center justify-between p-3 rounded-xl',
                i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-500'
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{staff.name}</p>
                    <p className="text-xs text-gray-400">{staff.tables} tables, {staff.items} items</p>
                  </div>
                </div>
                <span className="font-bold text-gray-900 text-sm">{formatMoney(staff.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waste Summary */}
      {data.wasteByReason.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Waste Summary
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data.wasteByReason}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="reason" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, 'Qty']} />
              <Bar dataKey="quantity" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {data.worstWasted.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Most Wasted Items</p>
              {data.worstWasted.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{item.quantity} units</Badge>
                    <span className="text-xs text-red-500">{formatMoney(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.dailySales.length === 0 && data.topSellers.length === 0 && (
        <EmptyState emoji="📊" title="No data for this period" description="Select a different date range or wait for more activity" />
      )}
    </div>
  );
}
