'use client';

import { useState } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useTableStore } from '@/stores/table-store';
import type { ProductWithCalc } from '@/types';

interface SaleConfirmModalProps {
  product: ProductWithCalc | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productId: string, quantity: number, tableId: string) => void;
  staffId?: string;
}

export function SaleConfirmModal({
  product,
  isOpen,
  onClose,
  onConfirm,
  staffId,
}: SaleConfirmModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  const formatMoney = useCurrencyStore((s) => s.format);
  const activeTables = useTableStore((s) => s.getActiveTables());
  const openTable = useTableStore((s) => s.openTable);

  if (!product) return null;

  const total = product.price_per_unit * quantity;
  const maxQty = product.remaining;

  // Auto-select first table if none selected
  const effectiveTableId = selectedTableId || (activeTables.length > 0 ? activeTables[0].id : null);

  const handleConfirm = async () => {
    let tableId = effectiveTableId;

    // Create a new table if none exists or user wants a new one
    if (!tableId || isCreatingTable) {
      const newTable = await openTable({ staffId });
      if (newTable) tableId = newTable.id;
      else return;
    }

    onConfirm(product.id, quantity, tableId!);
    setQuantity(1);
    setSelectedTableId(null);
    setIsCreatingTable(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Sale" size="sm">
      {/* Product info */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
        <p className="text-sm text-gray-500">{formatMoney(product.price_per_unit)} each</p>
      </div>

      {/* Quantity picker */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <Minus className="w-5 h-5" />
        </button>
        <span className="text-4xl font-bold text-gray-900 min-w-[60px] text-center">
          {quantity}
        </span>
        <button
          onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
          className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Total */}
      <div className="text-center mb-6">
        <p className="text-2xl font-bold text-blue-600">{formatMoney(total)}</p>
        <p className="text-xs text-gray-400">{product.remaining - quantity} remaining after sale</p>
      </div>

      {/* Table selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Assign to Table</p>
        <div className="flex flex-wrap gap-2">
          {activeTables.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTableId(t.id); setIsCreatingTable(false); }}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                effectiveTableId === t.id && !isCreatingTable
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              #{t.table_number}
              {t.name && <span className="text-xs opacity-70 ml-1">{t.name}</span>}
            </button>
          ))}
          <button
            onClick={() => { setIsCreatingTable(true); setSelectedTableId(null); }}
            className={`px-3 py-2 rounded-xl text-sm font-medium border-2 border-dashed transition ${
              isCreatingTable
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-gray-300 text-gray-400 hover:border-gray-400'
            }`}
          >
            + New
          </button>
        </div>
      </div>

      {/* Confirm button */}
      <Button className="w-full" size="lg" onClick={handleConfirm}>
        <Check className="w-5 h-5" />
        Confirm {quantity}x {product.name}
      </Button>
    </Modal>
  );
}
