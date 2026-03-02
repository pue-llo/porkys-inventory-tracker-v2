'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useTableStore } from '@/stores/table-store';
import { useCurrencyStore } from '@/hooks/use-currency';
import { TableCard } from '@/components/tables/table-card';
import { TableDetailModal } from '@/components/tables/table-detail-modal';
import { haptic } from '@/lib/utils';
import type { TableWithOrders } from '@/types';

export function TablesGrid() {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showClosedTables, setShowClosedTables] = useState(false);

  const currentStaff = useAuthStore((s) => s.currentStaff);
  const activeTables = useTableStore((s) => s.getActiveTables());
  const closedTables = useTableStore((s) => s.getClosedTables());
  const getTable = useTableStore((s) => s.getTable);
  const openTable = useTableStore((s) => s.openTable);
  const formatMoney = useCurrencyStore((s) => s.format);

  const handleTableTap = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  const handleAddNewTable = async () => {
    haptic(10);
    await openTable({ staffId: currentStaff?.id });
  };

  const selectedTable = selectedTableId ? getTable(selectedTableId) : null;

  const totalRevenue = useMemo(() => {
    const visibleClosed = showClosedTables ? closedTables : [];
    return [...activeTables, ...visibleClosed].reduce((sum, t) => sum + (t.total || 0), 0);
  }, [activeTables, closedTables, showClosedTables]);

  return (
    <>
      <div className="pb-20">
        {/* Table count bar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">{activeTables.length} active, {closedTables.length} closed</span>
          <button onClick={() => setShowClosedTables(!showClosedTables)} className="text-sm text-blue-600 font-medium">
            {showClosedTables ? 'Hide Closed' : 'Show Closed'}
          </button>
        </div>

        {/* New Table row */}
        <button
          onClick={handleAddNewTable}
          className="w-full flex items-center gap-3 py-3 px-1 text-gray-400 hover:text-blue-500 transition border-b border-gray-100"
        >
          <div
            className="bg-gray-100 flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 10 }}
          >
            <span className="text-lg">+</span>
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

      {/* Sticky summary bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400">Active</p>
              <p className="text-sm font-bold text-green-600">{activeTables.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Closed</p>
              <p className="text-sm font-bold text-gray-500">{closedTables.length}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Revenue</p>
            <p className="text-base font-bold text-gray-900">{formatMoney(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Table detail modal */}
      <TableDetailModal
        table={selectedTable as TableWithOrders || null}
        isOpen={!!selectedTableId}
        onClose={() => setSelectedTableId(null)}
      />
    </>
  );
}
