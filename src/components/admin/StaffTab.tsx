'use client';

import Image from 'next/image';
import { Trash2, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StaffTabProps {
  onShowAddStaff: () => void;
}

export function StaffTab({ onShowAddStaff }: StaffTabProps) {
  const currentStaff = useAuthStore((s) => s.currentStaff);
  const allStaff = useAuthStore((s) => s.allStaff);
  const deactivateStaff = useAuthStore((s) => s.deactivateStaff);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">{allStaff.length} Staff Members</h2>
        <Button onClick={onShowAddStaff}><UserPlus className="w-4 h-4" /> Add</Button>
      </div>
      <div className="space-y-2">
        {allStaff.map((staff) => (
          <div key={staff.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              {staff.photo_url ? (
                <Image src={staff.photo_url} alt="" width={48} height={48} className="rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-lg">
                  {staff.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{staff.name}</p>
                <Badge variant={staff.role === 'admin' ? 'purple' : staff.role === 'boh' ? 'warning' : 'info'}>
                  {staff.role.toUpperCase()}
                </Badge>
              </div>
            </div>
            {staff.id !== currentStaff?.id && (
              <button onClick={() => { if (confirm(`Remove ${staff.name}?`)) deactivateStaff(staff.id); }} className="p-2 hover:bg-red-50 rounded-lg transition">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
