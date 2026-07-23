import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Megaphone, Search, X, CalendarDays, Info, Users, GraduationCap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SkeletonCard, EmptyState, Avatar } from '../../components/ui';
import { formatDateTime } from '../../lib/utils';
import type { Announcement, Profile, Department } from '../../types';

interface AnnouncementWithRelations extends Announcement {
  creator: Profile;
  department: Department | null;
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Announcements', icon: Megaphone },
  { value: 'all-target', label: 'General (All)', icon: Users },
  { value: 'students', label: 'For Students', icon: GraduationCap },
];

export default function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*, creator:profiles!created_by(*), department:departments(*)')
        .in('target_audience', ['all', 'students'])
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setAnnouncements((data as AnnouncementWithRelations[]) ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      // Filter
      if (filter === 'all-target' && a.target_audience !== 'all') return false;
      if (filter === 'students' && a.target_audience !== 'students') return false;
      // Search
      if (search) {
        const q = search.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [announcements, filter, search]);

  const hasActiveFilters = search || filter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Stay updated with the latest notices</p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Stay updated with the latest notices</p>
      </div>

      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements…"
              className="input-field pl-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {FILTER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">{filtered.length} of {announcements.length} announcements</p>
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Announcements list */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={hasActiveFilters ? Search : Megaphone}
            title={hasActiveFilters ? 'No matching announcements' : 'No announcements yet'}
            description={hasActiveFilters ? 'Try adjusting your search or filters.' : 'Important notices from your faculty and administrators will appear here.'}
            action={hasActiveFilters ? <button onClick={clearFilters} className="btn-secondary text-sm"><X className="h-4 w-4" /> Clear Filters</button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a, idx) => {
            const isStudentTargeted = a.target_audience === 'students';
            return (
              <div
                key={a.id}
                className="card p-6 hover:shadow-md transition-shadow animate-slide-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0 ${
                    isStudentTargeted
                      ? 'bg-accent-50 dark:bg-accent-600/10 text-accent-600 dark:text-accent-400'
                      : 'bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400'
                  }`}>
                    <Megaphone className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{a.title}</h3>
                      <span className={isStudentTargeted ? 'badge-info' : 'badge-neutral'}>
                        {isStudentTargeted ? 'For Students' : 'General'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {a.message}
                    </p>

                    {/* Meta */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={a.creator?.full_name ?? 'Unknown'} size={20} />
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {a.creator?.full_name ?? 'System'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(a.created_at)}
                      </span>
                      {a.department && (
                        <span className="flex items-center gap-1">
                          <Info className="h-3.5 w-3.5" /> {a.department.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
