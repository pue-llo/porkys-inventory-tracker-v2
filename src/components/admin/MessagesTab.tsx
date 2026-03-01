'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { StaffMessage } from '@/types';

interface MessagesTabProps {
  onUnreadCountChange: (count: number) => void;
}

export function MessagesTab({ onUnreadCountChange }: MessagesTabProps) {
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const today = getTodayKey();
    const { data } = await supabase
      .from('staff_messages')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });
    setMessages(data || []);
    const count = (data || []).filter((m: StaffMessage) => !m.is_read).length;
    setUnreadCount(count);
    onUnreadCountChange(count);
  };

  const markMessageRead = async (id: string) => {
    await supabase.from('staff_messages').update({ is_read: true }).eq('id', id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    const newCount = Math.max(0, unreadCount - 1);
    setUnreadCount(newCount);
    onUnreadCountChange(newCount);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Staff Messages</h2>
        {unreadCount > 0 && <Badge variant="info">{unreadCount} unread</Badge>}
      </div>
      {messages.length === 0 ? (
        <EmptyState emoji="💬" title="No messages today" description="Staff messages will appear here when they log out" />
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'bg-white rounded-xl p-4 border shadow-sm transition cursor-pointer',
                msg.is_read ? 'border-gray-100' : 'border-blue-200 bg-blue-50/30'
              )}
              onClick={() => !msg.is_read && markMessageRead(msg.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400">
                    {msg.staff_name.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-900">{msg.staff_name}</span>
                  {!msg.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                </div>
                <span className="text-xs text-gray-400">
                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-sm text-gray-600">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
