import { useEffect, useState, useMemo } from 'react';
import {
  FileBarChart, Download, FileSpreadsheet, Filter, ChevronDown, BookOpen, Users, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFacultyAssignments } from '../../hooks/useData';
import {
  Button, LoadingSpinner, EmptyState, StatCard, Avatar, ProgressBar,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { exportToPDF, exportToExcel } from '../../lib/export';
import { getAttendanceColor } from '../../lib/utils';
import type {
  FacultyAssignment, Subject, Semester, Profile,
} from '../../types';

type Assignment = FacultyAssignment & { faculty: Profile; subject: Subject; semester: Semester | null };

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sessions: number;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

interface StudentRow {
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  present: number;
  absent: number;
  late: number;
  total: number;
  pct: number;
}

const ATTEND_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function FacultyReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const facultyId = profile?.id ?? '';

  const { data: allAssignments, loading } = useFacultyAssignments();
  const assignments = (allAssignments.filter((a) => a.faculty_id === facultyId) as Assignment[]);

  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [reportLoading, setReportLoading] = useState(false);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);

  const runReport = async () => {
    setReportLoading(true);
    // Faculty sessions within date range
    let sessionQuery = supabase
      .from('attendance_sessions')
      .select('id, subject_id, session_date, subject:subjects(name, code)')
      .eq('faculty_id', facultyId);
    if (subjectFilter !== 'all') sessionQuery = sessionQuery.eq('subject_id', subjectFilter);
    if (fromDate) sessionQuery = sessionQuery.gte('session_date', fromDate);
    if (toDate) sessionQuery = sessionQuery.lte('session_date', toDate);
    const { data: sessions, error } = await sessionQuery.order('session_date', { ascending: false });
    if (error) {
      toast('Failed to build report', 'error');
      setReportLoading(false);
      return;
    }

    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length === 0) {
      setSubjectSummaries([]);
      setStudentRows([]);
      setReportLoading(false);
      return;
    }

    const { data: records } = await supabase
      .from('attendance_records')
      .select('student_id, status, session_id, session:attendance_sessions(subject_id, subject:subjects(name, code))')
      .in('session_id', sessionIds);

    // Subject summaries
    const bySubject: Record<string, SubjectSummary> = {};
    (sessions ?? []).forEach((s) => {
      const subj = s.subject as unknown as { name: string; code: string };
      if (!bySubject[s.subject_id]) {
        bySubject[s.subject_id] = {
          subjectId: s.subject_id,
          subjectName: subj?.name ?? 'Unknown',
          subjectCode: subj?.code ?? '',
          sessions: 0, totalRecords: 0, present: 0, absent: 0, late: 0, rate: 0,
        };
      }
      bySubject[s.subject_id].sessions += 1;
    });
    (records ?? []).forEach((r) => {
      const sess = r.session as unknown as { subject_id: string; subject: { name: string; code: string } };
      const sid = sess?.subject_id;
      if (!sid || !bySubject[sid]) return;
      const m = bySubject[sid];
      m.totalRecords += 1;
      if (r.status === 'present') m.present += 1;
      else if (r.status === 'absent') m.absent += 1;
      else if (r.status === 'late') m.late += 1;
    });
    Object.values(bySubject).forEach((m) => {
      m.rate = m.totalRecords ? Math.round(((m.present + m.late) / m.totalRecords) * 100) : 0;
    });
    setSubjectSummaries(Object.values(bySubject));

    // Student-wise breakdown
    const byStudent: Record<string, StudentRow> = {};
    const { data: students } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in(
        'id',
        Array.from(new Set((records ?? []).map((r) => r.student_id))),
      );
    (students ?? []).forEach((s) => {
      byStudent[s.id] = {
        studentId: s.id,
        studentName: s.full_name,
        rollNumber: null,
        present: 0, absent: 0, late: 0, total: 0, pct: 0,
      };
    });
    (records ?? []).forEach((r) => {
      const m = byStudent[r.student_id];
      if (!m) return;
      m.total += 1;
      if (r.status === 'present') m.present += 1;
      else if (r.status === 'absent') m.absent += 1;
      else if (r.status === 'late') m.late += 1;
    });
    Object.values(byStudent).forEach((m) => {
      m.pct = m.total ? Math.round(((m.present + m.late) / m.total) * 100) : 0;
    });
    setStudentRows(Object.values(byStudent).sort((a, b) => b.pct - a.pct));

    setReportLoading(false);
  };

  // Auto-run on first load once assignments are ready
  useEffect(() => {
    if (!loading && assignments.length > 0 && subjectSummaries.length === 0 && !reportLoading) {
      runReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, assignments.length]);

  const overall = useMemo(() => {
    const totalRecords = subjectSummaries.reduce((a, s) => a + s.totalRecords, 0);
    const present = subjectSummaries.reduce((a, s) => a + s.present + s.late, 0);
    return {
      sessions: subjectSummaries.reduce((a, s) => a + s.sessions, 0),
      totalRecords,
      avgRate: totalRecords ? Math.round((present / totalRecords) * 100) : 0,
      students: studentRows.length,
    };
  }, [subjectSummaries, studentRows]);

  const handleExportPDF = () => {
    if (subjectSummaries.length === 0) { toast('Nothing to export', 'warning'); return; }
    const subtitle = `Faculty: ${profile?.full_name}${fromDate || toDate ? ` · ${fromDate || '…'} → ${toDate || '…'}` : ''}`;
    exportToPDF(
      'Attendance Report',
      [
        { header: 'Student', key: 'student' },
        { header: 'Present', key: 'present' },
        { header: 'Absent', key: 'absent' },
        { header: 'Late', key: 'late' },
        { header: 'Total', key: 'total' },
        { header: 'Rate %', key: 'rate' },
      ],
      studentRows.map((r) => ({
        student: r.studentName,
        present: r.present,
        absent: r.absent,
        late: r.late,
        total: r.total,
        rate: `${r.pct}%`,
      })),
      subtitle,
    );
    toast('PDF exported', 'success');
  };

  const handleExportExcel = () => {
    if (subjectSummaries.length === 0) { toast('Nothing to export', 'warning'); return; }
    exportToExcel(
      'Student Attendance',
      [
        { header: 'Student', key: 'student' },
        { header: 'Roll No', key: 'roll' },
        { header: 'Present', key: 'present' },
        { header: 'Absent', key: 'absent' },
        { header: 'Late', key: 'late' },
        { header: 'Total', key: 'total' },
        { header: 'Attendance %', key: 'rate' },
      ],
      studentRows.map((r) => ({
        student: r.studentName,
        roll: r.rollNumber ?? '',
        present: r.present,
        absent: r.absent,
        late: r.late,
        total: r.total,
        rate: r.pct,
      })),
    );
    toast('Excel exported', 'success');
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance Reports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Analyze attendance across your subjects and export for records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportExcel} disabled={studentRows.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={handleExportPDF} disabled={studentRows.length === 0}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No assignments"
          description="You need subject assignments to generate reports."
        />
      ) : (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Subject</label>
              <div className="relative">
                <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="input-field pl-10 appearance-none pr-8"
                >
                  <option value="all">All subjects</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.subject_id}>{a.subject.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field" />
            </div>
            <Button onClick={runReport} loading={reportLoading}>
              <Filter className="h-4 w-4" /> Run Report
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Sessions" value={overall.sessions} icon={BookOpen} color="brand" />
            <StatCard label="Records" value={overall.totalRecords} icon={FileBarChart} color="sky" />
            <StatCard label="Avg Attendance" value={`${overall.avgRate}%`} icon={TrendingUp} color={overall.avgRate >= 75 ? 'accent' : 'amber'} />
            <StatCard label="Students" value={overall.students} icon={Users} color="accent" />
          </div>

          {/* Subject summary chart */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Attendance by Subject</h2>
            {subjectSummaries.length === 0 ? (
              <EmptyState icon={FileBarChart} title="No data" description="Run a report to see the summary." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={subjectSummaries} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                    <XAxis dataKey="subjectCode" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v: any, name: any) => [`${v}${name === 'rate' ? '%' : ''}`, name]}
                      labelFormatter={(label: any) => {
                        const s = subjectSummaries.find((x) => x.subjectCode === label);
                        return s?.subjectName ?? label;
                      }}
                    />
                    <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {subjectSummaries.map((s, i) => (
                        <Cell key={i} fill={s.rate >= 75 ? ATTEND_COLORS[0] : s.rate >= 50 ? ATTEND_COLORS[1] : ATTEND_COLORS[2]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700">
                        <th className="pb-2 font-semibold">Subject</th>
                        <th className="pb-2 font-semibold">Sessions</th>
                        <th className="pb-2 font-semibold">Present</th>
                        <th className="pb-2 font-semibold">Absent</th>
                        <th className="pb-2 font-semibold">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {subjectSummaries.map((s) => (
                        <tr key={s.subjectId} className="text-slate-700 dark:text-slate-200">
                          <td className="py-2.5 font-medium">{s.subjectName} <span className="text-xs text-slate-400">({s.subjectCode})</span></td>
                          <td className="py-2.5">{s.sessions}</td>
                          <td className="py-2.5 text-accent-600 dark:text-accent-400">{s.present + s.late}</td>
                          <td className="py-2.5 text-red-600 dark:text-red-400">{s.absent}</td>
                          <td className="py-2.5"><span className={`font-semibold ${getAttendanceColor(s.rate)}`}>{s.rate}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Student-wise breakdown */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Student-wise Breakdown</h2>
            {studentRows.length === 0 ? (
              <EmptyState icon={Users} title="No students" description="No attendance records found for the selected filters." />
            ) : (
              <div className="space-y-2">
                {studentRows.map((r) => (
                  <div
                    key={r.studentId}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
                  >
                    <Avatar name={r.studentName} size={38} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{r.studentName}</p>
                      <p className="text-xs text-slate-500">{r.present} present · {r.absent} absent · {r.late} late</p>
                    </div>
                    <div className="hidden sm:block w-28">
                      <ProgressBar value={r.pct} color={r.pct >= 75 ? 'accent' : r.pct >= 50 ? 'amber' : 'red'} />
                    </div>
                    <span className={`font-bold ${getAttendanceColor(r.pct)} w-12 text-right`}>{r.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
