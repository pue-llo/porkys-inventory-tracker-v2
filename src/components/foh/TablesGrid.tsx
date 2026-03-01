'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useTableStore } from '@/stores/table-store';
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

  const handleTableTap = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  const handleAddNewTable = async () => {
    haptic(10);
    await openTable({ staffId: currentStaff?.id });
  };

  const selectedTable = selectedTableId ? getTable(selectedTableId) : null;

  return (
    <>
      {/* Table count bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{activeTables.length} active, {closedTables.length} closed</span>
        <button onClick={() => setShowClosedTables(!showClosedTables)} className="text-sm text-blue-600 font-medium">
          {showClosedTables ? 'Hide Closed' : 'Show Closed'}
        </button>
      </div>

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

      {/* Table detail modal */}
      <TableDetailModal
        table={selectedTable as TableWithOrders || null}
        isOpen={!!selectedTableId}
        onClose={() => setSelectedTableId(null)}
      />
    </>
  );
}
