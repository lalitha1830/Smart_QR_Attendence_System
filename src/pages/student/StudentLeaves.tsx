import { useEffect, useState, useCallback } from 'react';
import {
  CalendarRange, Plus, CalendarDays, BookOpen, Clock, CheckCircle2, XCircle,
  AlertCircle, MessageSquare, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Button, Modal, StatusBadge, EmptyState, SkeletonCard, StatCard,
} from '../../components/ui';
import { formatDate } from '../../lib/utils';
import type { LeaveRequest, Subject } from '../../types';

interface LeaveWithRelations extends LeaveRequest {
  subject: Subject | null;
  reviewer: { full_name: string } | null;
}

export default function StudentLeaves() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [leaves, setLeaves] = useState<LeaveWithRelations[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch this student's leave requests
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*, subject:subjects(*), reviewer:profiles!reviewed_by(full_name)')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });
      setLeaves((leaveData as LeaveWithRelations[]) ?? []);

      // Fetch subjects for the student's enrollment (semester)
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('semester_id')
        .eq('student_id', profile.id)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollment) {
        const { data: subjData } = await supabase
          .from('subjects')
          .select('*')
          .eq('semester_id', enrollment.semester_id)
          .order('name');
        setSubjects((subjData as Subject[]) ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setSubjectId('');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!startDate || !endDate) {
      toast('Please select both start and end dates.', 'warning');
      return;
    }
    if (endDate < startDate) {
      toast('End date cannot be before the start date.', 'warning');
      return;
    }
    if (!reason.trim()) {
      toast('Please provide a reason for your leave.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('leave_requests').insert({
        student_id: profile.id,
        subject_id: subjectId || null,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'pending',
      });

      if (error) throw error;

      toast('Leave request submitted successfully!', 'success');
      resetForm();
      setModalOpen(false);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit leave request.';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id).eq('status', 'pending');
      if (error) throw error;
      toast('Leave request cancelled.', 'info');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel request.';
      toast(message, 'error');
    }
  };

  // Summary counts
  const pending = leaves.filter((l) => l.status === 'pending').length;
  const approved = leaves.filter((l) => l.status === 'approved').length;
  const rejected = leaves.filter((l) => l.status === 'rejected').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Leaves</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Apply for and track your leave requests</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="card p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Leaves</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Apply for and track your leave requests</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Apply for Leave
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending" value={pending} icon={Clock} color="amber" trend="Awaiting review" />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} color="accent" trend="Accepted requests" />
        <StatCard label="Rejected" value={rejected} icon={XCircle} color="red" trend="Declined requests" />
      </div>

      {/* Leave requests list */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">All Leave Requests</h3>
        {leaves.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No leave requests yet"
            description="When you apply for a leave, it will appear here with its current status."
            action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Apply for Leave</Button>}
          />
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <div
                key={leave.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              >
                {/* Date block */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-center justify-center w-16 py-2 rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
                    <span className="text-[10px] uppercase font-medium">From</span>
                    <span className="text-xs font-bold">{formatDate(leave.start_date, 'MMM d')}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center w-16 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-300">
                    <span className="text-[10px] uppercase font-medium">To</span>
                    <span className="text-xs font-bold">{formatDate(leave.end_date, 'MMM d')}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {leave.subject ? (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        <BookOpen className="h-4 w-4 text-brand-500" /> {leave.subject.name}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">General Leave</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 flex items-start gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                    {leave.reason}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Applied {formatDate(leave.created_at)}
                    </span>
                    {leave.reviewer && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> Reviewed by {leave.reviewer.full_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status + action */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <StatusBadge status={leave.status} />
                  {leave.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(leave.id)}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply for leave modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title="Apply for Leave" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Subject <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
              <option value="">General leave (all classes)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {subjects.length === 0 && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> No subjects found for your enrollment.
              </p>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Reason</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain the reason for your leave request…"
              className="input-field resize-none"
            />
          </div>

          {/* Info note */}
          <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-100 dark:border-brand-700/30 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-brand-700 dark:text-brand-300">
              Your request will be reviewed by the faculty. You'll be notified when the status changes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              <Plus className="h-4 w-4" /> Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
