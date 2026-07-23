import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, QrCode, CalendarClock, TrendingUp, Clock,
  BookOpen, ChevronRight, Megaphone, CheckCircle2, X, Play,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  useSchedules, useSessions, useLeaveRequests,
} from '../../hooks/useData';
import { fetchFacultyStats, type FacultyDashboardStats } from '../../hooks/useStats';
import {
  StatCard, LoadingSpinner, EmptyState, StatusBadge, Avatar, Button,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate, formatTime, dayName } from '../../lib/utils';
import type { Schedule, AttendanceSession, LeaveRequest, Profile, Subject } from '../../types';

export default function FacultyDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<FacultyDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [trend, setTrend] = useState<{ day: string; rate: number }[]>([]);

  const facultyId = profile?.id ?? '';
  const { data: schedules, loading: schedLoading } = useSchedules(facultyId);
  const { data: sessions, loading: sessLoading } = useSessions(facultyId);
  const { data: leaves, loading: leavesLoading } = useLeaveRequests(undefined, facultyId);

  useEffect(() => {
    if (!facultyId) return;
    let active = true;
    (async () => {
      setStatsLoading(true);
      try {
        const s = await fetchFacultyStats(facultyId);
        if (active) setStats(s);
      } catch {
        if (active) toast('Failed to load dashboard stats', 'error');
      } finally {
        if (active) setStatsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [facultyId, toast]);

  // Build a 7-day attendance trend from recent sessions.
  useEffect(() => {
    if (!sessions.length) {
      setTrend([]);
      return;
    }
    const byDay: Record<string, { present: number; total: number }> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      byDay[key] = { present: 0, total: 0 };
    }
    sessions.forEach((s: AttendanceSession) => {
      const key = s.session_date;
      if (byDay[key]) byDay[key].total += 1;
    });
    (async () => {
      const days = Object.keys(byDay);
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status, session:attendance_sessions(session_date)')
        .in(
          'session.session_date',
          days.filter((d) => byDay[d].total > 0),
        );
      (records ?? []).forEach((r) => {
        const key = (r.session as unknown as { session_date: string })?.session_date;
        if (key && byDay[key]) {
          byDay[key].present += r.status === 'present' || r.status === 'late' ? 1 : 0;
          byDay[key].total += 1;
        }
      });
      setTrend(
        days.map((d) => ({
          day: dayName(new Date(d).getDay()).slice(0, 3),
          rate: byDay[d].total ? Math.round((byDay[d].present / byDay[d].total) * 100) : 0,
        })),
      );
    })();
  }, [sessions]);

  const todayDow = new Date().getDay();
  const todaysClasses = (schedules as (Schedule & { subject: Subject })[]).filter(
    (s) => s.day_of_week === todayDow,
  );
  const activeSessions = (sessions as (AttendanceSession & { subject: Subject })[]).filter(
    (s) => s.status === 'active',
  );
  const pendingLeaves = (leaves as (LeaveRequest & { student: Profile })[]).filter(
    (l) => l.status === 'pending',
  );

  const loading = statsLoading || schedLoading;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {formatDate(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button onClick={() => navigate('/faculty/qr-session')}>
          <QrCode className="h-4 w-4" />
          Start QR Session
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Today's Lectures"
          value={stats?.todayLectures ?? 0}
          icon={CalendarDays}
          color="brand"
          trend={dayName(todayDow)}
        />
        <StatCard
          label="Active Sessions"
          value={stats?.activeSessions ?? 0}
          icon={QrCode}
          color="sky"
          trend="Live now"
        />
        <StatCard
          label="My Subjects"
          value={stats?.totalStudents ?? 0}
          icon={BookOpen}
          color="accent"
          trend="Assignments"
        />
        <StatCard
          label="Pending Leaves"
          value={stats?.pendingLeaves ?? 0}
          icon={CalendarClock}
          color="amber"
          trend="Awaiting review"
        />
        <StatCard
          label="Avg Attendance"
          value={`${stats?.avgAttendance ?? 0}%`}
          icon={TrendingUp}
          color={stats && stats.avgAttendance >= 75 ? 'accent' : 'red'}
          trend={`${stats?.totalSessions ?? 0} sessions`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's schedule */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Today's Schedule
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {todaysClasses.length} class{todaysClasses.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {schedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : todaysClasses.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No classes today"
              description="Enjoy your free day or start an ad-hoc QR session."
              action={
                <Button variant="secondary" onClick={() => navigate('/faculty/qr-session')}>
                  <QrCode className="h-4 w-4" /> Start Session
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {todaysClasses.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 p-3.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/30"
                >
                  <div className="flex flex-col items-center justify-center rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-600/10">
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                      {formatTime(s.start_time)}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatTime(s.end_time)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {s.subject.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.subject.code} · Section {s.section}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="px-2.5"
                    onClick={() => navigate('/faculty/qr-session')}
                  >
                    <Play className="h-4 w-4 text-brand-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active sessions */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Active Sessions
            </h2>
          </div>
          {sessLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <EmptyState
              icon={QrCode}
              title="No active sessions"
              description="Start a QR session to take attendance."
            />
          ) : (
            <div className="space-y-2.5">
              {activeSessions.map((s) => {
                const expired = new Date(s.qr_expires_at) < new Date();
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 dark:border-sky-500/30 dark:bg-sky-500/5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {s.subject.name}
                      </p>
                      <span className={`badge ${expired ? 'badge-neutral' : 'badge-info'}`}>
                        {expired ? 'Expired' : 'Live'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Section {s.section} · expires {formatDate(s.qr_expires_at, 'h:mm a')}
                    </p>
                    <Button
                      variant="secondary"
                      className="w-full mt-3"
                      onClick={() => navigate('/faculty/qr-session')}
                    >
                      Manage <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance trend chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Attendance Trend
              </h2>
            </div>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          {trend.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No data yet" description="Trend appears once sessions are recorded." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v}%`, 'Attendance']}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#trendGrad)"
                  dot={{ r: 3, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pending leave requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pending Leaves
              </h2>
            </div>
            <Button variant="ghost" className="px-2 text-xs" onClick={() => navigate('/faculty/leaves')}>
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {leavesLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up" description="No pending leave requests." />
          ) : (
            <div className="space-y-2.5">
              {pendingLeaves.slice(0, 4).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <Avatar name={l.student.full_name} src={l.student.avatar_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {l.student.full_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(l.start_date, 'MMM d')} – {formatDate(l.end_date, 'MMM d')}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Recent Sessions
            </h2>
          </div>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => navigate('/faculty/attendance')}>
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {sessLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={X} title="No sessions yet" description="Your attendance sessions will appear here." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Section</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {(sessions as (AttendanceSession & { subject: Subject })[]).slice(0, 6).map((s) => (
                  <tr key={s.id} className="text-slate-700 dark:text-slate-200">
                    <td className="py-2.5 font-medium">{s.subject.name}</td>
                    <td className="py-2.5 text-slate-500">{formatDate(s.session_date)}</td>
                    <td className="py-2.5">{s.section}</td>
                    <td className="py-2.5"><StatusBadge status={s.status} /></td>
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
