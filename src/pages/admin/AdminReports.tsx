import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FileBarChart, FileDown, FileSpreadsheet, Filter, Building2, TrendingUp, PieChart as PieIcon } from 'lucide-react';
import { useDepartments, useCourses, useSubjects } from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, EmptyState, LoadingSpinner } from '../../components/ui';
import { exportToPDF, exportToExcel } from '../../lib/export';
import { formatDate } from '../../lib/utils';

interface ReportRow {
  department: string;
  subject: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  rate: number;
}

interface TrendRow {
  date: string;
  present: number;
  total: number;
}

interface StatusRow {
  name: string;
  value: number;
}

const STATUS_COLORS: Record<string, string> = {
  Present: '#10b981',
  Absent: '#ef4444',
  Late: '#f59e0b',
  Leave: '#3b82f6',
};

export default function AdminReports() {
  const { toast } = useToast();
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses();
  const { data: subjects } = useSubjects();

  // Filters
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [deptId, setDeptId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [statusDist, setStatusDist] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredSubjects = useMemo(
    () => (deptId ? subjects.filter((s) => s.department_id === deptId) : subjects),
    [subjects, deptId],
  );
  const filteredCourses = useMemo(
    () => (deptId ? courses.filter((c) => c.department_id === deptId) : courses),
    [courses, deptId],
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch attendance records in the date range with session -> subject -> department
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('status, marked_at, session:attendance_sessions(session_date, subject:subjects(id, name, department_id, department:departments(name)))')
        .gte('marked_at', startDate)
        .lte('marked_at', endDate + 'T23:59:59');
      if (error) { toast(error.message, 'error'); return; }

      type Rec = {
        status: string;
        marked_at: string;
        session?: {
          session_date: string;
          subject?: { id: string; name: string; department_id: string; department?: { name: string } } | null;
        } | null;
      };

      const recs = (records ?? []) as unknown as Rec[];

      // Apply subject filter
      const filtered = recs.filter((r) => {
        const subj = r.session?.subject;
        if (!subj) return false;
        if (subjectId && subj.id !== subjectId) return false;
        if (deptId && subj.department_id !== deptId) return false;
        // course filter: subjects linked to a course — we check via subject lookup
        if (courseId) {
          const sObj = subjects.find((s) => s.id === subj.id);
          if (sObj?.course_id !== courseId) return false;
        }
        return true;
      });

      // Build summary rows grouped by subject
      const grouped: Record<string, ReportRow> = {};
      for (const r of filtered) {
        const subj = r.session!.subject!;
        const key = subj.id;
        if (!grouped[key]) {
          grouped[key] = {
            department: subj.department?.name ?? '—',
            subject: subj.name,
            total: 0, present: 0, absent: 0, late: 0, leave: 0, rate: 0,
          };
        }
        const g = grouped[key];
        g.total++;
        if (r.status === 'present') g.present++;
        else if (r.status === 'absent') g.absent++;
        else if (r.status === 'late') g.late++;
        else if (r.status === 'leave') g.leave++;
      }
      const reportRows = Object.values(grouped).map((g) => ({
        ...g,
        rate: g.total > 0 ? Math.round(((g.present + g.late) / g.total) * 100) : 0,
      }));
      setRows(reportRows);

      // Trend by date
      const trendMap: Record<string, { present: number; total: number }> = {};
      for (const r of filtered) {
        const date = r.session?.session_date ?? r.marked_at.split('T')[0];
        if (!trendMap[date]) trendMap[date] = { present: 0, total: 0 };
        trendMap[date].total++;
        if (r.status === 'present' || r.status === 'late') trendMap[date].present++;
      }
      const trendRows = Object.entries(trendMap)
        .map(([date, v]) => ({ date, present: v.present, total: v.total }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);
      setTrend(trendRows);

      // Status distribution
      const statusCounts: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
      for (const r of filtered) {
        const key = r.status.charAt(0).toUpperCase() + r.status.slice(1);
        if (statusCounts[key] !== undefined) statusCounts[key]++;
      }
      setStatusDist(Object.entries(statusCounts).map(([name, value]) => ({ name, value })).filter((s) => s.value > 0));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, deptId, courseId, subjectId, subjects, toast]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const handleExportPDF = () => {
    if (rows.length === 0) { toast('No data to export', 'warning'); return; }
    exportToPDF(
      'Attendance Report',
      [
        { header: 'Department', key: 'department' },
        { header: 'Subject', key: 'subject' },
        { header: 'Total', key: 'total' },
        { header: 'Present', key: 'present' },
        { header: 'Absent', key: 'absent' },
        { header: 'Late', key: 'late' },
        { header: 'Leave', key: 'leave' },
        { header: 'Rate %', key: 'rate' },
      ],
      rows as unknown as Record<string, unknown>[],
      `Period: ${formatDate(startDate)} — ${formatDate(endDate)}`,
    );
    toast('PDF exported', 'success');
  };

  const handleExportExcel = () => {
    if (rows.length === 0) { toast('No data to export', 'warning'); return; }
    exportToExcel(
      'Attendance Report',
      [
        { header: 'Department', key: 'department' },
        { header: 'Subject', key: 'subject' },
        { header: 'Total', key: 'total' },
        { header: 'Present', key: 'present' },
        { header: 'Absent', key: 'absent' },
        { header: 'Late', key: 'late' },
        { header: 'Leave', key: 'leave' },
        { header: 'Rate %', key: 'rate' },
      ],
      rows as unknown as Record<string, unknown>[],
    );
    toast('Excel exported', 'success');
  };

  // Bar chart data: department-wise attendance rate
  const deptChartData = useMemo(() => {
    const map: Record<string, { total: number; present: number }> = {};
    for (const r of rows) {
      if (!map[r.department]) map[r.department] = { total: 0, present: 0 };
      map[r.department].total += r.total;
      map[r.department].present += r.present + r.late;
    }
    return Object.entries(map).map(([name, v]) => ({
      name: name.length > 10 ? name.slice(0, 9) + '…' : name,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analyze attendance across the institution</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportPDF}><FileDown className="h-4 w-4" /> PDF</Button>
          <Button variant="accent" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filters</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Department</label>
            <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setCourseId(''); setSubjectId(''); }} className="input-field">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Course</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input-field" disabled={filteredCourses.length === 0}>
              <option value="">All courses</option>
              {filteredCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field" disabled={filteredSubjects.length === 0}>
              <option value="">All subjects</option>
              {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileBarChart} title="No data for selected filters" description="Try adjusting the date range or filters." />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department bar chart */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-brand-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Rate by Department</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: 'rgba(37,99,235,0.05)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }} formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                  <Bar dataKey="rate" name="Attendance %" radius={[6, 6, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status distribution pie */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon className="h-4 w-4 text-accent-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Status Distribution</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                    {statusDist.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend line chart */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-accent-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Trend</h3>
              <span className="text-xs text-slate-400 ml-1">Last {trend.length} days with data</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(d: string) => formatDate(d, 'MMM d')} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }} labelFormatter={(d) => formatDate(String(d))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Present/Late" />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Total Records" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Summary</h3>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3">Present</th>
                    <th className="px-6 py-3">Absent</th>
                    <th className="px-6 py-3">Late</th>
                    <th className="px-6 py-3">Leave</th>
                    <th className="px-6 py-3">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.department}</td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{row.subject}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.total}</td>
                      <td className="px-6 py-4"><span className="text-accent-600 dark:text-accent-400 font-medium">{row.present}</span></td>
                      <td className="px-6 py-4"><span className="text-red-600 dark:text-red-400 font-medium">{row.absent}</span></td>
                      <td className="px-6 py-4"><span className="text-amber-600 dark:text-amber-400 font-medium">{row.late}</span></td>
                      <td className="px-6 py-4"><span className="text-brand-600 dark:text-brand-400 font-medium">{row.leave}</span></td>
                      <td className="px-6 py-4">
                        <span className={`badge ${row.rate >= 75 ? 'badge-success' : row.rate >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                          {row.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
