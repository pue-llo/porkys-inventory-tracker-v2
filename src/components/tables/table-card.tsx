'use client';

import { Users, Clock } from 'lucide-react';
import { cn, getTableDuration, formatTime } from '@/lib/utils';
import { useCurrencyStore } from '@/hooks/use-currency';
import type { TableWithOrders } from '@/types';

interface TableCardProps {
  table: TableWithOrders;
  onTap: (tableId: string) => void;
}

export function TableCard({ table, onTap }: TableCardProps) {
  const formatMoney = useCurrencyStore((s) => s.format);
  const duration = getTableDuration(table.created_at, table.closed_at);

  return (
    <button
      onClick={() => onTap(table.id)}
      className={cn(
        'table-card bg-white rounded-2xl p-3 text-left transition-all duration-200 w-full',
        'hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]',
        'border',
        table.is_active ? 'border-green-200' : 'border-gray-100 opacity-75'
      )}
      style={{ minHeight: 140 }}
    >
      {/* Table number badge */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'table-number-badge',
            table.is_active
              ? 'bg-green-100 text-green-700 animate-pulse-dot'
              : 'bg-gray-100 text-gray-500'
          )}
          style={{ width: 48, height: 48, borderRadius: 12 }}
        >
          {table.table_number}
        </div>
        <div className="min-w-0 flex-1">
          {table.name && (
            <p className="text-sm font-semibold text-gray-900 truncate">{table.name}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {table.guest_count > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {table.guest_count}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {duration}
            </span>
          </div>
        </div>
      </div>

      {/* Orders count + total */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {table.orders.length} item{table.orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <p className={cn('text-sm font-bold', table.total > 0 ? 'text-gray-900' : 'text-gray-300')}>
          {formatMoney(table.total)}
        </p>
      </div>

      {/* Status badge */}
      {!table.is_active && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400">
            Closed {table.closed_at ? formatTime(table.closed_at) : ''}
          </span>
        </div>
      )}
    </button>
  );
}
