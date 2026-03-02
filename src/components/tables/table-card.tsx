'use client';

import React from 'react';
import { cn, getTableDuration, formatTime } from '@/lib/utils';
import { useCurrencyStore } from '@/hooks/use-currency';
import type { TableWithOrders } from '@/types';

interface TableCardProps {
  table: TableWithOrders;
  onTap: (tableId: string) => void;
}

export const TableCard = React.memo(function TableCard({ table, onTap }: TableCardProps) {
  const formatMoney = useCurrencyStore((s) => s.format);
  const duration = getTableDuration(table.created_at, table.closed_at);

  return (
    <button
      onClick={() => onTap(table.id)}
      className={cn(
        'w-full flex items-center gap-3 py-3 px-1 text-left transition-all active:bg-gray-50 border-b border-gray-100',
        !table.is_active && 'opacity-75'
      )}
    >
      {/* Table number badge */}
      <div
        className={cn(
          'flex items-center justify-center font-bold text-sm shrink-0',
          table.is_active
            ? 'bg-green-100 text-green-700 animate-pulse-dot'
            : 'bg-gray-100 text-gray-500'
        )}
        style={{ width: 36, height: 36, borderRadius: 10 }}
      >
        {table.table_number}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {table.name && (
          <p className="text-sm font-semibold text-gray-900 truncate">{table.name}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {table.is_active ? (
            <>
              {table.guest_count > 0 && (
                <>
                  <span>{table.guest_count} guests</span>
                  <span>·</span>
                </>
              )}
              <span>{duration}</span>
              <span>·</span>
              <span>{table.orders.length} item{table.orders.length !== 1 ? 's' : ''}</span>
            </>
          ) : (
            <>
              <span>Closed {table.closed_at ? formatTime(table.closed_at) : ''}</span>
              <span>·</span>
              <span>{table.orders.length} item{table.orders.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* Total */}
      <p className="text-sm font-bold text-gray-900 shrink-0">
        {formatMoney(table.total)}
      </p>
    </button>
  );
});
