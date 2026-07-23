import { useMemo, useState } from 'react';
import {
  FileDown, FileSpreadsheet, Filter, ClipboardList, BookOpen, CalendarRange,
  CheckCircle2, XCircle, Clock, Search, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAttendanceRecords } from '../../hooks/useData';
import { exportToPDF, exportToExcel } from '../../lib/export';
import {
  StatCard, SkeletonCard, StatusBadge, EmptyState, ProgressBar,
} from '../../components/ui';
import { formatDate, formatTime, getAttendanceColor } from '../../lib/utils';
import type { AttendanceRecord, Subject } from '../../types';

interface RecordWithRelations extends AttendanceRecord {
  session: { session_date: string; subject: Subject; faculty?: { full_name: string } | null };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'leave', label: 'On Leave' },
];

export default function StudentAttendance() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: records, loading } = useAttendanceRecords(profile?.id);

  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const typedRecords = records as unknown as RecordWithRelations[];

  // Build subject list for the filter dropdown
  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    typedRecords.forEach((r) => {
      if (r.session?.subject && !map.has(r.session.subject.id)) {
        map.set(r.session.subject.id, { id: r.session.subject.id, name: r.session.subject.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [typedRecords]);

  // Apply filters
  const filtered = useMemo(() => {
    return typedRecords.filter((r) => {
      if (subjectFilter && r.session?.subject?.id !== subjectFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (fromDate) {
        const recDate = (r.session?.session_date ?? r.marked_at).slice(0, 10);
        if (recDate < fromDate) return false;
      }
      if (toDate) {
        const recDate = (r.session?.session_date ?? r.marked_at).slice(0, 10);
        if (recDate > toDate) return false;
      }
      return true;
    });
  }, [typedRecords, subjectFilter, statusFilter, fromDate, toDate]);

  // Summary stats
  const summary = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter((r) => r.status === 'present').length;
    const late = filtered.filter((r) => r.status === 'late').length;
    const absent = filtered.filter((r) => r.status === 'absent').length;
    const leave = filtered.filter((r) => r.status === 'leave').length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, leave, pct };
  }, [filtered]);

  const hasActiveFilters = subjectFilter || statusFilter || fromDate || toDate;

  const clearFilters = () => {
    setSubjectFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      toast('No records to export.', 'warning');
      return;
    }
    const rows = filtered.map((r) => ({
      date: formatDate(r.session?.session_date ?? r.marked_at),
      subject: r.session?.subject?.name ?? '—',
      faculty: r.session?.faculty?.full_name ?? '—',
      status: r.status,
      method: r.marked_method,
      time: formatTime(r.marked_at.slice(11, 16)),
    }));
    exportToPDF(
      'Attendance History',
      [
        { header: 'Date', key: 'date' },
        { header: 'Subject', key: 'subject' },
        { header: 'Faculty', key: 'faculty' },
        { header: 'Status', key: 'status' },
        { header: 'Method', key: 'method' },
        { header: 'Time', key: 'time' },
      ],
      rows,
      `${profile?.full_name ?? 'Student'} · ${filtered.length} records`,
    );
    toast('PDF exported successfully.', 'success');
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast('No records to export.', 'warning');
      return;
    }
    const rows = filtered.map((r) => ({
      date: formatDate(r.session?.session_date ?? r.marked_at),
      subject: r.session?.subject?.name ?? '—',
      faculty: r.session?.faculty?.full_name ?? '—',
      status: r.status,
      method: r.marked_method,
      time: formatTime(r.marked_at.slice(11, 16)),
    }));
    exportToExcel(
      'Attendance History',
      [
        { header: 'Date', key: 'date' },
        { header: 'Subject', key: 'subject' },
        { header: 'Faculty', key: 'faculty' },
        { header: 'Status', key: 'status' },
        { header: 'Method', key: 'method' },
        { header: 'Time', key: 'time' },
      ],
      rows,
    );
    toast('Excel exported successfully.', 'success');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Complete record of all your classes</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="card p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Complete record of all your classes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="btn-secondary text-sm">
            <FileDown className="h-4 w-4" /> PDF
          </button>
          <button onClick={handleExportExcel} className="btn-secondary text-sm">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Records" value={summary.total} icon={ClipboardList} color="brand" trend="All filtered records" />
        <StatCard label="Present" value={summary.present} icon={CheckCircle2} color="accent" trend={`${summary.late} late marks`} />
        <StatCard label="Absent" value={summary.absent} icon={XCircle} color="red" trend={`${summary.leave} on leave`} />
        <StatCard label="Attendance Rate" value={`${summary.pct}%`} icon={CalendarRange} color={summary.pct >= 75 ? 'accent' : summary.pct >= 60 ? 'amber' : 'red'} trend={summary.pct >= 75 ? 'Above requirement' : 'Below 75% target'} />
      </div>

      {/* Progress bar summary */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Percentage</h3>
          <span className={`text-2xl font-bold ${getAttendanceColor(summary.pct)}`}>{summary.pct}%</span>
        </div>
        <ProgressBar
          value={summary.pct}
          color={summary.pct >= 75 ? 'accent' : summary.pct >= 60 ? 'amber' : 'red'}
          className="h-3"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>0%</span>
          <span className={summary.pct >= 75 ? 'text-accent-600 dark:text-accent-400 font-medium' : ''}>75% requirement</span>
          <span>100%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            <Filter className="h-4 w-4 text-brand-500" /> Filters
            {hasActiveFilters && <span className="badge-info text-[10px] px-2 py-0.5">Active</span>}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Subject</label>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="input-field text-sm">
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field text-sm">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Records table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Search : ClipboardList}
            title={hasActiveFilters ? 'No matching records' : 'No attendance yet'}
            description={hasActiveFilters ? 'Try adjusting your filters to see more results.' : 'Your attendance records will appear here after you scan a QR code.'}
            action={hasActiveFilters ? <button onClick={clearFilters} className="btn-secondary text-sm"><X className="h-4 w-4" /> Clear Filters</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 hidden md:table-cell">Faculty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">Method</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(r.session?.session_date ?? r.marked_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400 flex-shrink-0">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {r.session?.subject?.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell truncate max-w-[140px]">
                      {r.session?.faculty?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs uppercase font-medium text-slate-400">{r.marked_method}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatTime(r.marked_at.slice(11, 16))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
