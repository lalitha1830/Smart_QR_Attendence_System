import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  CalendarCheck, BookOpen, CheckCircle2, CalendarOff, TrendingUp, ScanLine,
  MapPin, Megaphone, ArrowRight, CalendarDays, Award, Target, ClipboardList,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchStudentStats, type StudentDashboardStats } from '../../hooks/useStats';
import { useAuth } from '../../context/AuthContext';
import {
  StatCard, SkeletonCard, StatusBadge, EmptyState, ProgressBar,
} from '../../components/ui';
import { formatDate, formatTime, getAttendanceColor } from '../../lib/utils';
import type { Schedule, Subject, Profile, Classroom, AttendanceRecord, LeaveRequest, Announcement } from '../../types';

interface TodaySchedule extends Schedule {
  subject: Subject;
  faculty: Profile;
  classroom: Classroom | null;
}

interface RecentRecord extends AttendanceRecord {
  session: { session_date: string; subject: Subject; faculty?: { full_name: string } };
}

interface RecentAnnouncement extends Announcement {
  creator: Profile;
}

interface PendingLeave extends LeaveRequest {
  subject: Subject | null;
}

interface MonthPoint {
  month: string;
  present: number;
  absent: number;
  total: number;
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<StudentDashboardStats | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<TodaySchedule[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Find the student's current enrollment to get semester + section
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('semester_id, section')
        .eq('student_id', profile.id)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const todayDow = new Date().getDay();

      const [studentStats, schedRes, recordsRes, annRes, leavesRes, allRecordsRes] = await Promise.all([
        fetchStudentStats(profile.id),
        enrollment
          ? supabase
              .from('schedules')
              .select('*, subject:subjects(*), faculty:profiles(*), classroom:classrooms(*)')
              .eq('semester_id', enrollment.semester_id)
              .eq('section', enrollment.section)
              .eq('day_of_week', todayDow)
              .order('start_time')
          : Promise.resolve({ data: [] as TodaySchedule[] | null, error: null }),
        supabase
          .from('attendance_records')
          .select('*, session:attendance_sessions(*, subject:subjects(*), faculty:profiles(*))')
          .eq('student_id', profile.id)
          .order('marked_at', { ascending: false })
          .limit(5),
        supabase
          .from('announcements')
          .select('*, creator:profiles!created_by(*)')
          .in('target_audience', ['all', 'students'])
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('leave_requests')
          .select('*, subject:subjects(*)')
          .eq('student_id', profile.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('attendance_records')
          .select('status, marked_at')
          .eq('student_id', profile.id),
      ]);

      setStats(studentStats);
      setTodaySchedules((schedRes.data as TodaySchedule[]) ?? []);
      setRecentRecords((recordsRes.data as RecentRecord[]) ?? []);
      setAnnouncements((annRes.data as RecentAnnouncement[]) ?? []);
      setPendingLeaves((leavesRes.data as PendingLeave[]) ?? []);
      setMonthlyData(buildMonthlyData((allRecordsRes.data as { status: string; marked_at: string }[]) ?? []));
    } catch {
      // non-fatal — partial render
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your attendance overview</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 h-72 lg:col-span-2"><div className="skeleton h-full w-full rounded-xl" /></div>
          <div className="card p-6 h-72"><div className="skeleton h-full w-full rounded-xl" /></div>
        </div>
      </div>
    );
  }

  const pct = stats.attendancePct;
  const pctColor = pct >= 75 ? 'accent' : pct >= 60 ? 'amber' : 'red';
  const pctText = pct >= 75 ? 'Excellent! Keep it up.' : pct >= 60 ? 'Good, but aim higher.' : 'Needs improvement — attend more classes!';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Student';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here's your attendance snapshot for today.
          </p>
        </div>
        <Link to="/student/scan" className="btn-primary text-sm self-start sm:self-auto">
          <ScanLine className="h-4 w-4" /> Scan to Mark Attendance
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Attendance Rate"
          value={`${pct}%`}
          icon={Target}
          color={pctColor}
          trend={pctText}
        />
        <StatCard
          label="Total Classes"
          value={stats.totalClasses}
          icon={BookOpen}
          color="brand"
          trend="Marked sessions"
        />
        <StatCard
          label="Classes Present"
          value={stats.presentCount}
          icon={CheckCircle2}
          color="accent"
          trend={`${stats.lateCount} late · ${stats.absentCount} absent`}
        />
        <StatCard
          label="Pending Leaves"
          value={stats.pendingLeaves}
          icon={CalendarOff}
          color="amber"
          trend="Awaiting approval"
        />
      </div>

      {/* Attendance progress banner */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 flex-shrink-0">
            <Award className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">Overall Attendance Progress</h3>
              <span className={`text-2xl font-bold ${getAttendanceColor(pct)}`}>{pct}%</span>
            </div>
            <ProgressBar value={pct} color={pct >= 75 ? 'accent' : pct >= 60 ? 'amber' : 'red'} className="h-3" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {pct >= 75
                ? "🎉 You're meeting the 75% attendance requirement. Great work!"
                : pct >= 60
                ? "⚠️ You're below the 75% requirement. Try to attend more classes."
                : "🚨 Critical: You're well below the 75% requirement. Attend classes regularly."}
            </p>
          </div>
        </div>
      </div>

      {/* Charts + Today's classes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly attendance chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Monthly Attendance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last 6 months</p>
            </div>
            <TrendingUp className="h-4 w-4 text-brand-500" />
          </div>
          {monthlyData.every((m) => m.total === 0) ? (
            <EmptyState icon={TrendingUp} title="No attendance data yet" description="Your monthly attendance will appear here once records are marked." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(37,99,235,0.05)' }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name="Present" stackId="a" radius={[0, 0, 0, 0]} fill="#10b981" />
                <Bar dataKey="absent" name="Absent" stackId="a" radius={[6, 6, 0, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Today's classes */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Today's Classes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
            </div>
            <CalendarCheck className="h-4 w-4 text-accent-500" />
          </div>
          {todaySchedules.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No classes today" description="Enjoy your free day! Check your timetable for the full week." />
          ) : (
            <div className="space-y-3">
              {todaySchedules.map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex flex-col items-center justify-center flex-shrink-0 w-14 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
                    <span className="text-xs font-medium">{formatTime(s.start_time).split(' ')[0]}</span>
                    <span className="text-[10px] uppercase">{formatTime(s.start_time).split(' ')[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.subject.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.faculty.full_name}</p>
                    {s.classroom && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.classroom.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent attendance + Announcements + Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent attendance */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Attendance</h3>
            <Link to="/student/attendance" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentRecords.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No attendance yet" description="Your attendance records will appear here after you scan a QR code." />
          ) : (
            <div className="space-y-3">
              {recentRecords.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400 flex-shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {r.session?.subject?.name ?? 'Unknown subject'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {formatDate(r.session?.session_date ?? r.marked_at)} · {r.session?.faculty?.full_name ?? 'Faculty'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    <span className="text-[10px] text-slate-400 uppercase">{r.marked_method}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Announcements</h3>
            <Link to="/student/announcements" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements" description="Important updates will appear here." />
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-brand-200 dark:hover:border-brand-700 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <Megaphone className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{a.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(a.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending leaves */}
      {pendingLeaves.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Pending Leave Requests</h3>
            </div>
            <Link to="/student/leaves" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingLeaves.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                <CalendarDays className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {l.subject?.name ?? 'General Leave'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(l.start_date)} — {formatDate(l.end_date)}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function buildMonthlyData(records: { status: string; marked_at: string }[]): MonthPoint[] {
  const points: MonthPoint[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
    const monthRecords = records.filter((r) => {
      const date = new Date(r.marked_at);
      return date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear();
    });
    const present = monthRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const absent = monthRecords.filter((r) => r.status === 'absent').length;
    points.push({ month: monthLabel, present, absent, total: monthRecords.length });
  }
  return points;
}
