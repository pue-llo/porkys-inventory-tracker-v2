'use client';

import { useState } from 'react';
import { MessageSquare, Send, SkipForward } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/lib/utils';

interface StaffMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  staffId: string;
  staffName: string;
}

export function StaffMessageModal({ isOpen, onClose, onLogout, staffId, staffName }: StaffMessageModalProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendAndLogout = async () => {
    if (!message.trim()) {
      onLogout();
      return;
    }
    setIsSending(true);
    try {
      await supabase.from('staff_messages').insert({
        staff_id: staffId,
        staff_name: staffName,
        message: message.trim(),
        date: getTodayKey(),
      });
    } catch {
      // Non-critical, proceed with logout
    }
    setIsSending(false);
    setMessage('');
    onLogout();
  };

  const handleSkip = () => {
    setMessage('');
    onLogout();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="End of Shift" size="sm">
      <div className="text-center mb-5">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="w-7 h-7 text-blue-600" />
        </div>
        <p className="text-sm text-gray-600">Any notes for the owner before you log out?</p>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Notes about the shift, issues, requests..."
        rows={4}
        className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 mb-4"
        autoFocus
      />

      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSendAndLogout}
          isLoading={isSending}
          disabled={!message.trim()}
        >
          <Send className="w-4 h-4" />
          Send & Log Out
        </Button>
        <Button
          className="w-full"
          variant="ghost"
          size="lg"
          onClick={handleSkip}
        >
          <SkipForward className="w-4 h-4" />
          Skip & Log Out
        </Button>
      </div>
    </Modal>
  );
}
