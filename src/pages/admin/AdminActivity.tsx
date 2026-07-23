import { useState, useMemo } from 'react';
import { Search, ShieldCheck, Activity as ActivityIcon, Globe } from 'lucide-react';
import { useActivityLogs } from '../../hooks/useData';
import { Avatar, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDateTime } from '../../lib/utils';
import type { ActivityLog } from '../../types';

type LogRow = ActivityLog & { user?: { full_name: string; avatar_url: string | null } | null };

export default function AdminActivity() {
  const { data: logs, loading } = useActivityLogs();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs as LogRow[];
    return (logs as LogRow[]).filter(
      (l) =>
        (l.user?.full_name ?? '').toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.entity_type ?? '').toLowerCase().includes(q),
    );
  }, [logs, search]);

  // Group by date for readability
  const grouped = useMemo(() => {
    const groups: Record<string, LogRow[]> = {};
    for (const l of filtered) {
      const date = l.created_at.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(l);
    }
    return groups;
  }, [filtered]);

  const sortedDates = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Logs</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Audit trail of all system actions</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by user, action or entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShieldCheck} title="No activity logs" description={search ? 'Try a different search.' : 'System actions will be logged here.'} />
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                  {formatDateTime(date + 'T00:00:00').split(' at ')[0]}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
                {grouped[date].map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    {log.user?.full_name ? (
                      <Avatar name={log.user.full_name} src={log.user.avatar_url} size={36} />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex-shrink-0">
                        <ActivityIcon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        <span className="font-medium">{log.user?.full_name ?? 'System'}</span>
                        <span className="text-slate-500 dark:text-slate-400"> · {log.action}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{formatDateTime(log.created_at)}</span>
                        {log.entity_type && <span className="badge-neutral text-[10px]">{log.entity_type}</span>}
                        {log.ip_address && (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {log.ip_address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
