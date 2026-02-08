'use client';

import { useState } from 'react';
import { X, Minus, Plus, Trash2, RotateCcw, Lock, Edit3, Users, StickyNote } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrencyStore } from '@/hooks/use-currency';
import { useTableStore } from '@/stores/table-store';
import { useInventoryStore } from '@/stores/inventory-store';
import { useAuthStore } from '@/stores/auth-store';
import { getTableDuration, formatTime, cn } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/constants';
import type { TableWithOrders, Order } from '@/types';

interface TableDetailModalProps {
  table: TableWithOrders | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TableDetailModal({ table, isOpen, onClose }: TableDetailModalProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editOrderQty, setEditOrderQty] = useState(0);

  const formatMoney = useCurrencyStore((s) => s.format);
  const updateTable = useTableStore((s) => s.updateTable);
  const closeTable = useTableStore((s) => s.closeTable);
  const reopenTable = useTableStore((s) => s.reopenTable);
  const removeOrder = useTableStore((s) => s.removeOrder);
  const updateOrderQuantity = useTableStore((s) => s.updateOrderQuantity);
  const undoSale = useInventoryStore((s) => s.undoSale);
  const currentStaff = useAuthStore((s) => s.currentStaff);
  const verifyAdmin = useAuthStore((s) => s.verifyAdminPassword);

  if (!table) return null;

  const duration = getTableDuration(table.created_at, table.closed_at);

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveField = async () => {
    if (!editingField) return;
    if (editingField === 'name') await updateTable(table.id, { name: editValue });
    if (editingField === 'guests') await updateTable(table.id, { guest_count: parseInt(editValue) || 0 });
    if (editingField === 'notes') await updateTable(table.id, { notes: editValue });
    setEditingField(null);
    setEditValue('');
  };

  const handleClose = async () => {
    await closeTable(table.id, currentStaff?.id);
    onClose();
  };

  const handleReopen = () => {
    setPendingAction({ type: 'reopen' });
  };

  const confirmAdminAction = async () => {
    const valid = await verifyAdmin(adminPassword);
    if (!valid) return;

    if (pendingAction?.type === 'reopen') {
      await reopenTable(table.id);
    } else if (pendingAction?.type === 'removeOrder') {
      const order = pendingAction.data as Order;
      await removeOrder(order.id, table.id);
      await undoSale(order.product_id, order.quantity);
    }
    setPendingAction(null);
    setAdminPassword('');
  };

  const handleRemoveOrder = (order: Order) => {
    setPendingAction({ type: 'removeOrder', data: order });
  };

  const handleEditOrderQty = (order: Order) => {
    setEditingOrderId(order.id);
    setEditOrderQty(order.quantity);
  };

  const saveOrderQty = async (order: Order) => {
    if (editOrderQty <= 0) {
      handleRemoveOrder(order);
    } else if (editOrderQty !== order.quantity) {
      const diff = order.quantity - editOrderQty;
      await updateOrderQuantity(order.id, editOrderQty);
      if (diff > 0) await undoSale(order.product_id, diff);
    }
    setEditingOrderId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Table ${table.table_number}`} size="lg">
      {/* Admin confirmation overlay */}
      {pendingAction && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-800 mb-3">
            {pendingAction.type === 'reopen' ? 'Admin password required to reopen table' : 'Admin password required to remove item'}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin PIN"
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
              autoFocus
            />
            <Button size="sm" onClick={confirmAdminAction}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPendingAction(null); setAdminPassword(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl',
            table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          )}>
            {table.table_number}
          </div>
          <div>
            {/* Editable name */}
            {editingField === 'name' ? (
              <div className="flex gap-1">
                <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="border rounded px-2 py-1 text-sm w-32" autoFocus />
                <Button size="sm" onClick={saveField}>Save</Button>
              </div>
            ) : (
              <button onClick={() => handleEditField('name', table.name)} className="flex items-center gap-1 hover:bg-gray-50 rounded px-1 -ml-1">
                <span className="font-semibold text-gray-900">{table.name || 'No name'}</span>
                <Edit3 className="w-3 h-3 text-gray-400" />
              </button>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>{duration}</span>
              <Badge variant={table.is_active ? 'success' : 'default'}>
                {table.is_active ? 'Active' : 'Closed'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{formatMoney(table.total)}</p>
          <p className="text-xs text-gray-400">{table.orders.length} items</p>
        </div>
      </div>

      {/* Guest count + notes (editable) */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => handleEditField('guests', String(table.guest_count))}
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition"
        >
          <Users className="w-4 h-4 text-gray-400" />
          {table.guest_count || 0} guests
        </button>
        <button
          onClick={() => handleEditField('notes', table.notes)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition flex-1 text-left"
        >
          <StickyNote className="w-4 h-4 text-gray-400" />
          <span className="truncate">{table.notes || 'Add note...'}</span>
        </button>
      </div>

      {/* Edit guests/notes modal inline */}
      {editingField && editingField !== 'name' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs text-blue-600 font-medium mb-2">
            Edit {editingField === 'guests' ? 'Guest Count' : 'Notes'}
          </p>
          {editingField === 'guests' ? (
            <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="border rounded px-3 py-2 w-full" />
          ) : (
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} className="border rounded px-3 py-2 w-full resize-none" />
          )}
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={saveField}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto">
        {table.orders.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">No orders yet</p>
        ) : (
          table.orders.map((order) => {
            const cat = getCategoryInfo(order.category_id);
            const isEditing = editingOrderId === order.id;

            return (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cat.bgColor)}>
                    <span className={cn('text-xs font-bold', cat.textColor)}>
                      {isEditing ? editOrderQty : order.quantity}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{order.product_name}</p>
                    <p className="text-xs text-gray-400">
                      {formatMoney(order.price_per_unit)} × {order.quantity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditOrderQty(Math.max(0, editOrderQty - 1))} className="p-1 hover:bg-gray-200 rounded">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold w-6 text-center">{editOrderQty}</span>
                      <button onClick={() => setEditOrderQty(editOrderQty + 1)} className="p-1 hover:bg-gray-200 rounded">
                        <Plus className="w-4 h-4" />
                      </button>
                      <Button size="sm" onClick={() => saveOrderQty(order)}>Save</Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-gray-900">{formatMoney(order.total)}</span>
                      {table.is_active && (
                        <div className="flex gap-1">
                          <button onClick={() => handleEditOrderQty(order)} className="p-1.5 hover:bg-gray-200 rounded-lg transition">
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => handleRemoveOrder(order)} className="p-1.5 hover:bg-red-100 rounded-lg transition">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {table.is_active ? (
          <Button variant="danger" className="flex-1" onClick={handleClose}>
            <Lock className="w-4 h-4" />
            Close Table
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={handleReopen}>
            <RotateCcw className="w-4 h-4" />
            Reopen Table
          </Button>
        )}
      </div>
    </Modal>
  );
}
