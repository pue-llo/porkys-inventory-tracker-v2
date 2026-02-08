'use client';

import { useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useInventoryStore } from '@/stores/inventory-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { WASTE_REASONS } from '@/types';
import type { ProductWithCalc, WasteReason } from '@/types';

interface WasteModalProps {
  product: ProductWithCalc | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WasteModal({ product, isOpen, onClose }: WasteModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<WasteReason>('broken');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatMoney = useCurrencyStore((s) => s.format);
  const recordWaste = useInventoryStore((s) => s.recordWaste);
  const currentStaff = useAuthStore((s) => s.currentStaff);

  if (!product) return null;

  const valueLost = product.price_per_unit * quantity;
  const maxQty = product.remaining;

  const handleSubmit = async () => {
    if (quantity <= 0 || !reason) return;
    setIsSubmitting(true);
    try {
      await recordWaste(
        product.id,
        product.name,
        product.category_id,
        quantity,
        reason,
        notes.trim(),
        product.price_per_unit,
        currentStaff?.id || null,
        currentStaff?.name || null
      );
      // Reset and close
      setQuantity(1);
      setReason('broken');
      setNotes('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Waste" size="sm">
      {/* Product info */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-red-50 rounded-xl border border-red-100">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{product.name}</p>
          <p className="text-xs text-gray-500">{product.remaining} in stock</p>
        </div>
      </div>

      {/* Quantity picker */}
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Quantity Lost</label>
        <div className="flex items-center justify-center gap-6">
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
        <p className="text-center text-sm text-red-500 mt-2 font-medium">
          Value lost: {formatMoney(valueLost)}
        </p>
      </div>

      {/* Reason picker */}
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Reason</label>
        <div className="grid grid-cols-2 gap-2">
          {WASTE_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition border-2',
                reason === r.value
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <span>{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened?"
          rows={2}
          className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400"
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full bg-red-600 hover:bg-red-700"
        size="lg"
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={quantity <= 0}
      >
        <AlertTriangle className="w-5 h-5" />
        Report {quantity} Wasted
      </Button>
    </Modal>
  );
}
