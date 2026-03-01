'use client';

import { useTableStore } from '@/stores/table-store';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export function ActivityLog() {
  const activityLog = useTableStore((s) => s.activityLog);

  if (activityLog.length === 0) {
    return <EmptyState emoji="📋" title="No activity yet" description="Table actions will be logged here" />;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Activity Log</h3>
      {activityLog.map((log) => (
        <div key={log.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  log.action === 'Opened' ? 'info' :
                  log.action === 'Closed' ? 'default' :
                  log.action === 'Reopened' ? 'purple' :
                  log.action === 'Sale' ? 'success' :
                  log.action === 'Removed' ? 'danger' :
                  'warning'
                }
              >
                {log.action}
              </Badge>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-gray-600">{log.details}</p>
          {log.staff_name && <p className="text-xs text-gray-400 mt-1">by {log.staff_name}</p>}
        </div>
      ))}
    </div>
  );
}
