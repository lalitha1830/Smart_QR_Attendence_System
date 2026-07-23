import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, GraduationCap, Building2, CalendarCheck, Radio, CalendarOff,
  TrendingUp, BookOpen, Activity, ArrowRight, ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchAdminStats, type DashboardStats } from '../../hooks/useStats';
import { useAuth } from '../../context/AuthContext';
import { StatCard, SkeletonCard, Avatar, StatusBadge, EmptyState } from '../../components/ui';
import { formatDateTime, formatDate, dayShort } from '../../lib/utils';
import type { AttendanceSession, ActivityLog } from '../../types';

interface TrendPoint {
  day: string;
  present: number;
  absent: number;
  total: number;
}

interface DeptAttendance {
  name: string;
  attendance: number;
}

interface RecentSession extends AttendanceSession {
  subject?: { name: string };
  faculty?: { full_name: string };
}

interface RecentLog extends ActivityLog {
  user?: { full_name: string } | null;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [deptData, setDeptData] = useState<DeptAttendance[]>([]);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adminStats, trendRes, deptRes, sessionRes, logRes] = await Promise.all([
        fetchAdminStats(),
        buildTrend(),
        buildDeptAttendance(),
        supabase
          .from('attendance_sessions')
          .select('*, subject:subjects(name), faculty:profiles(full_name)')
          .order('started_at', { ascending: false })
          .limit(5),
        supabase
          .from('activity_logs')
          .select('*, user:profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(6),
      ]);
      setStats(adminStats);
      setTrend(trendRes);
      setDeptData(deptRes);
      setSessions((sessionRes.data as RecentSession[]) ?? []);
      setLogs((logRes.data as RecentLog[]) ?? []);
    } catch {
      // non-fatal — partial render
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">System overview at a glance</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 h-72"><div className="skeleton h-full w-full rounded-xl" /></div>
          <div className="card p-6 h-72"><div className="skeleton h-full w-full rounded-xl" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Admin'} — here's your system overview.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/reports')}
          className="btn-secondary text-sm self-start sm:self-auto"
        >
          <TrendingUp className="h-4 w-4" /> View Reports
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={GraduationCap} color="brand" trend="Enrolled learners" />
        <StatCard label="Total Faculty" value={stats.totalFaculty} icon={Users} color="accent" trend="Teaching staff" />
        <StatCard label="Departments" value={stats.totalDepartments} icon={Building2} color="sky" trend="Academic units" />
        <StatCard label="Courses" value={stats.totalCourses} icon={BookOpen} color="amber" trend="Degree programs" />
        <StatCard label="Attendance Today" value={stats.attendanceToday} icon={CalendarCheck} color="accent" trend="Records marked today" />
        <StatCard label="This Month" value={stats.attendanceThisMonth} icon={CalendarCheck} color="brand" trend="Records this month" />
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={Radio} color="red" trend="Live QR sessions" />
        <StatCard label="Pending Leaves" value={stats.pendingLeaves} icon={CalendarOff} color="amber" trend="Awaiting review" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance trend — last 7 days */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          {trend.length === 0 ? (
            <EmptyState icon={Activity} title="No data yet" description="Attendance records will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: 13,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} fill="url(#colorPresent)" />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} fill="url(#colorAbsent)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department-wise attendance */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Department Attendance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Records this month</p>
            </div>
            <Building2 className="h-4 w-4 text-brand-500" />
          </div>
          {deptData.length === 0 ? (
            <EmptyState icon={Building2} title="No data yet" description="Department-wise attendance will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(37,99,235,0.05)' }}
                  contentStyle={{
                    borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="attendance" name="Records" radius={[6, 6, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent sessions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Sessions</h3>
            <button onClick={() => navigate('/admin/reports')} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {sessions.length === 0 ? (
            <EmptyState icon={Radio} title="No sessions yet" description="Attendance sessions will appear here." />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400 flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {s.subject?.name ?? 'Unknown subject'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {s.faculty?.full_name ?? '—'} · {formatDate(s.session_date)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
            <button onClick={() => navigate('/admin/activity')} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {logs.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No activity yet" description="System actions will be logged here." />
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  {log.user?.full_name ? (
                    <Avatar name={log.user.full_name} size={36} />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex-shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {log.user?.full_name ?? 'System'} · <span className="text-slate-500 dark:text-slate-400 font-normal">{log.action}</span>
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(log.created_at)}</p>
                  </div>
                  {log.entity_type && (
                    <span className="badge-neutral text-[10px]">{log.entity_type}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

async function buildTrend(): Promise<TrendPoint[]> {
  const points: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const { count } = await supabase
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .gte('marked_at', dayStr)
      .lt('marked_at', new Date(d.getTime() + 86400000).toISOString().split('T')[0]);
    const presentCount = await supabase
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'present')
      .gte('marked_at', dayStr)
      .lt('marked_at', new Date(d.getTime() + 86400000).toISOString().split('T')[0]);
    points.push({
      day: dayShort(d.getDay()),
      present: presentCount.count ?? 0,
      absent: (count ?? 0) - (presentCount.count ?? 0),
      total: count ?? 0,
    });
  }
  return points;
}

async function buildDeptAttendance(): Promise<DeptAttendance[]> {
  const { data: depts } = await supabase.from('departments').select('id, name').order('name').limit(8);
  if (!depts || depts.length === 0) return [];

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Fetch this month's attendance records and group by the subject's department.
  const { data: records } = await supabase
    .from('attendance_records')
    .select('session:attendance_sessions(subject:subjects(department_id))')
    .gte('marked_at', monthStart);

  const counts: Record<string, number> = {};
  for (const r of (records ?? []) as Array<{ session?: { subject?: { department_id?: string } } }>) {
    const deptId = r.session?.subject?.department_id;
    if (deptId) counts[deptId] = (counts[deptId] ?? 0) + 1;
  }

  return depts.map((d) => ({
    name: d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name,
    attendance: counts[d.id] ?? 0,
  }));
}
