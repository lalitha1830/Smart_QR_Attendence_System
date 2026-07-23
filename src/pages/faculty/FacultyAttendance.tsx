import { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList, Filter, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, Edit3, Save, X, Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSessions } from '../../hooks/useData';
import {
  Button, LoadingSpinner, EmptyState, StatusBadge, Avatar, StatCard, Modal,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type {
  AttendanceSession, Subject, AttendanceRecord, Profile, AttendanceStatus,
} from '../../types';

type Session = AttendanceSession & { subject: Subject };
type Record = AttendanceRecord & { student: Profile };

export default function FacultyAttendance() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const facultyId = profile?.id ?? '';

  const { data: rawSessions, loading: sessLoading } = useSessions(facultyId);
  const sessions = rawSessions as Session[];

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [records, setRecords] = useState<Record[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  const [editing, setEditing] = useState<Record | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [saving, setSaving] = useState(false);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const loadRecords = async (sessionId: string) => {
    if (!sessionId) { setRecords([]); return; }
    setRecordsLoading(true);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, student:profiles(*)')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: true });
    if (error) toast('Failed to load records', 'error');
    setRecords((data as Record[]) ?? []);
    setRecordsLoading(false);
  };

  useEffect(() => {
    if (selectedSessionId) loadRecords(selectedSessionId);
    else setRecords([]);
  }, [selectedSessionId]);

  const summary = useMemo(() => {
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const flagged = records.filter((r) => r.is_flagged).length;
    return { present, absent, late, flagged, total: records.length };
  }, [records]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  const openEdit = (r: Record) => {
    setEditing(r);
    setEditStatus(r.status);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: editStatus })
      .eq('id', editing.id);
    if (error) toast('Failed to update record', 'error');
    else {
      toast('Attendance updated', 'success');
      setRecords((prev) => prev.map((r) => (r.id === editing.id ? { ...r, status: editStatus } : r)));
      setEditing(null);
    }
    setSaving(false);
  };

  if (sessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance Records</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          View, filter and edit attendance for your sessions.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No sessions yet"
          description="Start a QR session to begin collecting attendance records."
        />
      ) : (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Session
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="input-field pl-10 appearance-none pr-8"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject.name} · {formatDate(s.session_date)} · Sec {s.section}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="sm:w-44">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Status
              </label>
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="input-field pl-10 appearance-none pr-8"
                >
                  <option value="all">All statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="leave">On Leave</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Records" value={summary.total} icon={ClipboardList} color="brand" />
            <StatCard label="Present" value={summary.present} icon={CheckCircle2} color="accent" />
            <StatCard label="Absent" value={summary.absent} icon={XCircle} color="red" />
            <StatCard label="Flagged" value={summary.flagged} icon={AlertTriangle} color="amber" />
          </div>

          {/* Records table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Marked At</th>
                    <th className="px-4 py-3 font-semibold">Flagged</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {recordsLoading ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">Loading records…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12">
                        <EmptyState
                          icon={ClipboardList}
                          title="No records found"
                          description="No attendance records match the current filters for this session."
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.student.full_name} src={r.student.avatar_url} size={34} />
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{r.student.full_name}</p>
                              <p className="text-xs text-slate-400">{r.student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3">
                          <span className={`badge ${r.marked_method === 'qr' ? 'badge-info' : 'badge-neutral'}`}>
                            {r.marked_method.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(r.marked_at)}</td>
                        <td className="px-4 py-3">
                          {r.is_flagged ? (
                            <span className="badge badge-warning"><AlertTriangle className="h-3.5 w-3.5" /> Flagged</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" className="px-2.5" onClick={() => openEdit(r)}>
                            <Edit3 className="h-4 w-4" /> Edit
                          </Button>
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

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Attendance" size="sm">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/30">
              <Avatar name={editing.student.full_name} src={editing.student.avatar_url} size={40} />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{editing.student.full_name}</p>
                <p className="text-xs text-slate-500">{editing.student.email}</p>
              </div>
            </div>
            {selectedSession && (
              <p className="text-xs text-slate-500">
                {selectedSession.subject.name} · {formatDate(selectedSession.session_date)}
              </p>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Attendance Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['present', 'late', 'absent', 'leave'] as AttendanceStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setEditStatus(st)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-semibold capitalize transition-all ${
                      editStatus === st
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300 ring-2 ring-brand-500/20'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button className="flex-1" loading={saving} onClick={saveEdit}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
