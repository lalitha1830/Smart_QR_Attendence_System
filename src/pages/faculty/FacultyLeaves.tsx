import { useState, useMemo } from 'react';
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Calendar, Eye, Filter, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLeaveRequests } from '../../hooks/useData';
import {
  Button, LoadingSpinner, EmptyState, StatusBadge, Avatar, StatCard, Modal,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type { LeaveRequest, Profile, Subject, LeaveStatus } from '../../types';

type Leave = LeaveRequest & {
  student: Profile;
  subject: Subject | null;
  reviewer: Profile | null;
};

export default function FacultyLeaves() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const facultyId = profile?.id ?? '';

  const { data, loading, refetch } = useLeaveRequests(undefined, facultyId);
  const leaves = data as Leave[];

  const [filter, setFilter] = useState<'all' | LeaveStatus>('all');
  const [viewing, setViewing] = useState<Leave | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return leaves;
    return leaves.filter((l) => l.status === filter);
  }, [leaves, filter]);

  const counts = useMemo(() => ({
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  }), [leaves]);

  const review = async (leave: Leave, status: 'approved' | 'rejected') => {
    setProcessing(leave.id);
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        reviewed_by: facultyId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', leave.id);
    if (error) {
      toast('Failed to update leave request', 'error');
    } else {
      toast(`Leave ${status}`, status === 'approved' ? 'success' : 'info');
      await refetch();
      setViewing(null);
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Requests</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Review and approve student leave requests assigned to you.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending" value={counts.pending} icon={Clock} color="amber" />
        <StatCard label="Approved" value={counts.approved} icon={CheckCircle2} color="accent" />
        <StatCard label="Rejected" value={counts.rejected} icon={XCircle} color="red" />
      </div>

      {leaves.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          description="Students haven't submitted any leave requests assigned to you yet."
        />
      ) : (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="input-field pl-10 appearance-none pr-8"
              >
                <option value="all">All requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <span className="text-sm text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Dates</th>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12">
                        <EmptyState icon={Filter} title="No matches" description="No leave requests match this filter." />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((l) => (
                      <tr key={l.id} className="text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={l.student.full_name} src={l.student.avatar_url} size={34} />
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{l.student.full_name}</p>
                              <p className="text-xs text-slate-400">{l.student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(l.start_date, 'MMM d')} – {formatDate(l.end_date, 'MMM d, yyyy')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{l.subject?.name ?? 'General'}</td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="ghost" className="px-2.5" onClick={() => setViewing(l)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {l.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  className="px-2.5 text-accent-600 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-600/15"
                                  loading={processing === l.id}
                                  onClick={() => review(l, 'approved')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="px-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-600/15"
                                  loading={processing === l.id}
                                  onClick={() => review(l, 'rejected')}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Leave Request Details" size="md">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/30">
              <Avatar name={viewing.student.full_name} src={viewing.student.avatar_url} size={44} />
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{viewing.student.full_name}</p>
                <p className="text-xs text-slate-500">{viewing.student.email}</p>
              </div>
              <StatusBadge status={viewing.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-400">Start Date</p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatDate(viewing.start_date, 'MMM d, yyyy')}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-400">End Date</p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatDate(viewing.end_date, 'MMM d, yyyy')}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Subject</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{viewing.subject?.name ?? 'General / All subjects'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Reason</p>
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700/30 dark:text-slate-200">
                {viewing.reason}
              </p>
            </div>

            {viewing.reviewed_at && (
              <div className="text-xs text-slate-500">
                Reviewed by {viewing.reviewer?.full_name ?? '—'} on {formatDateTime(viewing.reviewed_at)}
              </div>
            )}

            {viewing.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={processing === viewing.id}
                  onClick={() => review(viewing, 'rejected')}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button
                  className="flex-1"
                  loading={processing === viewing.id}
                  onClick={() => review(viewing, 'approved')}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
