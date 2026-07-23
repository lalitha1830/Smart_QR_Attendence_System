import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, ChevronRight, ArrowLeft, GraduationCap, QrCode, Hash, Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFacultyAssignments } from '../../hooks/useData';
import {
  Button, LoadingSpinner, EmptyState, Avatar, StatCard, ProgressBar,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { getAttendanceColor } from '../../lib/utils';
import type {
  FacultyAssignment, Subject, Semester, Profile, Enrollment,
} from '../../types';

type Assignment = FacultyAssignment & { faculty: Profile; subject: Subject; semester: Semester | null };
type EnrolledStudent = Enrollment & { student: Profile };

interface StudentStats {
  studentId: string;
  present: number;
  total: number;
  pct: number;
}

export default function FacultyClasses() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const facultyId = profile?.id ?? '';

  const { data: allAssignments, loading } = useFacultyAssignments();
  const assignments = (allAssignments.filter((a) => a.faculty_id === facultyId) as Assignment[]);

  const [selected, setSelected] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [stats, setStats] = useState<Record<string, StudentStats>>({});
  const [studentsLoading, setStudentsLoading] = useState(false);

  const openClass = async (a: Assignment) => {
    setSelected(a);
    setStudents([]);
    setStats({});
    if (!a.semester_id) return;
    setStudentsLoading(true);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, student:profiles(*)')
      .eq('semester_id', a.semester_id)
      .eq('section', a.section)
      .order('roll_number', { ascending: true, nullsFirst: false });
    if (error) {
      toast('Failed to load students', 'error');
      setStudentsLoading(false);
      return;
    }
    const list = (data as EnrolledStudent[]) ?? [];
    setStudents(list);

    // Compute per-student attendance for this subject
    if (list.length > 0) {
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('subject_id', a.subject_id)
        .eq('faculty_id', facultyId);
      const sessionIds = (sessions ?? []).map((s) => s.id);
      if (sessionIds.length > 0) {
        const { data: records } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .in('session_id', sessionIds);
        const map: Record<string, StudentStats> = {};
        list.forEach((e) => { map[e.student_id] = { studentId: e.student_id, present: 0, total: 0, pct: 0 }; });
        (records ?? []).forEach((r) => {
          const s = map[r.student_id];
          if (s) {
            s.total += 1;
            if (r.status === 'present' || r.status === 'late') s.present += 1;
          }
        });
        Object.values(map).forEach((s) => { s.pct = s.total ? Math.round((s.present / s.total) * 100) : 0; });
        setStats(map);
      }
    }
    setStudentsLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // Detail view
  if (selected) {
    const presentCount = Object.values(stats).filter((s) => s.pct >= 75).length;
    const atRisk = Object.values(stats).filter((s) => s.pct > 0 && s.pct < 75).length;
    const avg = students.length
      ? Math.round(Object.values(stats).reduce((acc, s) => acc + s.pct, 0) / students.length)
      : 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="btn-ghost px-2.5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selected.subject.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {selected.subject.code} · Section {selected.section}
              {selected.semester ? ` · ${selected.semester.name}` : ''}
            </p>
          </div>
          <Button onClick={() => navigate('/faculty/qr-session')}>
            <QrCode className="h-4 w-4" /> Start Session
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Enrolled" value={students.length} icon={Users} color="brand" />
          <StatCard label="Avg Attendance" value={`${avg}%`} icon={GraduationCap} color={avg >= 75 ? 'accent' : 'amber'} />
          <StatCard label="Good Standing" value={presentCount} icon={BookOpen} color="accent" trend="≥ 75%" />
          <StatCard label="At Risk" value={atRisk} icon={Layers} color="red" trend="< 75%" />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Enrolled Students</h2>
            <span className="text-xs text-slate-400">{students.length} total</span>
          </div>
          {studentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students enrolled"
              description="No students are enrolled in this section's semester yet."
            />
          ) : (
            <div className="space-y-2">
              {students.map((e) => {
                const st = stats[e.student_id];
                const pct = st?.pct ?? 0;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
                  >
                    <Avatar name={e.student.full_name} src={e.student.avatar_url} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {e.student.full_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {e.roll_number ? `Roll ${e.roll_number}` : e.student.email}
                      </p>
                    </div>
                    <div className="hidden sm:block w-32">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">{st?.present ?? 0}/{st?.total ?? 0}</span>
                        <span className={`font-semibold ${getAttendanceColor(pct)}`}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} color={pct >= 75 ? 'accent' : pct >= 50 ? 'amber' : 'red'} />
                    </div>
                    <span className={`badge ${pct >= 75 ? 'badge-success' : pct > 0 ? 'badge-warning' : 'badge-neutral'}`}>
                      {pct >= 75 ? 'Good' : pct > 0 ? 'At Risk' : 'New'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Classes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Subjects assigned to you — click a class to view enrolled students and their attendance.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No classes assigned"
          description="You don't have any subject assignments yet. Contact your administrator."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <button
              key={a.id}
              onClick={() => openClass(a)}
              className="card p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 animate-slide-up"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="badge badge-info">{a.subject.code}</span>
              </div>
              <h3 className="mt-4 font-bold text-slate-900 dark:text-white">{a.subject.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {a.subject.description ?? 'No description available'}
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Section {a.section}</span>
                <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {a.semester?.name ?? '—'}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700/50">
                <span className="text-xs font-medium text-slate-400">{a.subject.credits} credits</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                  View students <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
