import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Clock, Users, CheckCircle2, XCircle, Timer, RefreshCw,
  StopCircle, Play, BookOpen, Sparkles, ShieldCheck, Wifi,
  ArrowLeft, Activity, Copy, Eye, EyeOff, KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFacultyAssignments } from '../../hooks/useData';
import {
  Button, LoadingSpinner, EmptyState, Avatar, StatusBadge, StatCard,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { generateQrToken } from '../../lib/qr';
import { formatDate } from '../../lib/utils';
import type {
  FacultyAssignment, Subject, Semester, AttendanceSession, AttendanceRecord,
  Profile, Enrollment, MarkedMethod,
} from '../../types';

type Assignment = FacultyAssignment & { faculty: Profile; subject: Subject; semester: Semester | null };
type ScannedRecord = AttendanceRecord & { student: Profile };
type EnrolledStudent = Enrollment & { student: Profile };

const DURATION_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
];

function fmtDuration(total: number): string {
  if (total <= 0) return '0:00';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FacultyQRSession() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const facultyId = profile?.id ?? '';

  const { data: allAssignments, loading: assignLoading } = useFacultyAssignments();
  const assignments = allAssignments.filter((a) => a.faculty_id === facultyId) as Assignment[];

  // Setup state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [duration, setDuration] = useState<number>(120);

  // Active session state
  const [session, setSession] = useState<(AttendanceSession & { subject: Subject }) | null>(null);
  const [scanned, setScanned] = useState<ScannedRecord[]>([]);
  const [roster, setRoster] = useState<EnrolledStudent[]>([]);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Live timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireHandled = useRef(false);

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  // Load any active session for this faculty on mount
  useEffect(() => {
    if (!facultyId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('attendance_sessions')
        .select('*, subject:subjects(*)')
        .eq('faculty_id', facultyId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) {
        const s = data as AttendanceSession & { subject: Subject };
        setSession(s);
        setDuration(s.duration_seconds);
        const left = Math.max(0, Math.round((new Date(s.qr_expires_at).getTime() - Date.now()) / 1000));
        setSecondsLeft(left);
      }
    })();
    return () => { active = false; };
  }, [facultyId]);

  // Fetch the enrolled roster for a session's semester + section
  const loadRoster = useCallback(async (s: AttendanceSession) => {
    if (!s.semester_id) { setRoster([]); return; }
    const { data } = await supabase
      .from('enrollments')
      .select('*, student:profiles(*)')
      .eq('semester_id', s.semester_id)
      .eq('section', s.section);
    setRoster((data as EnrolledStudent[]) ?? []);
  }, []);

  // Fetch scanned records for the active session
  const loadScanned = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('attendance_records')
      .select('*, student:profiles(*)')
      .eq('session_id', sessionId)
      .order('marked_at', { ascending: false });
    setScanned((data as ScannedRecord[]) ?? []);
  }, []);

  // Poll records + manage expiry while a session is active
  useEffect(() => {
    if (!session) {
      setScanned([]);
      setRoster([]);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    loadScanned(session.id);
    loadRoster(session);

    pollRef.current = setInterval(async () => {
      if (!session) return;
      const left = Math.max(0, Math.round((new Date(session.qr_expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      await loadScanned(session.id);
      if (left <= 0 && !expireHandled.current) {
        expireHandled.current = true;
        await supabase.from('attendance_sessions').update({ status: 'expired' }).eq('id', session.id);
        setSession((prev) => prev ? { ...prev, status: 'expired' } : prev);
        toast('QR code expired. Regenerate to continue.', 'warning');
      }
    }, 3000);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [session, loadScanned, loadRoster, toast]);

  const startSession = async () => {
    if (!selectedAssignment) {
      toast('Please select a subject first', 'warning');
      return;
    }
    setCreating(true);
    const sessionId = crypto.randomUUID();
    const token = generateQrToken(sessionId, selectedAssignment.subject_id, facultyId);
    const expiresAt = new Date(Date.now() + duration * 1000).toISOString();

    const payload = {
      id: sessionId,
      subject_id: selectedAssignment.subject_id,
      faculty_id: facultyId,
      semester_id: selectedAssignment.semester_id ?? null,
      schedule_id: null,
      session_date: new Date().toISOString().split('T')[0],
      qr_token: token,
      qr_expires_at: expiresAt,
      status: 'active' as const,
      duration_seconds: duration,
      section: selectedAssignment.section,
      started_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert(payload)
      .select('*, subject:subjects(*)')
      .maybeSingle();

    if (error || !data) {
      toast(error?.message ?? 'Failed to start session', 'error');
      setCreating(false);
      return;
    }

    expireHandled.current = false;
    const s = data as AttendanceSession & { subject: Subject };
    setSession(s);
    setSecondsLeft(duration);
    await loadRoster(s);
    toast('QR session started — students can scan now!', 'success');
    setCreating(false);
  };

  const regenerateQr = async () => {
    if (!session) return;
    setActionLoading(true);
    const newToken = generateQrToken(session.id, session.subject_id, facultyId);
    const newExpiry = new Date(Date.now() + duration * 1000).toISOString();
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({ qr_token: newToken, qr_expires_at: newExpiry, status: 'active' })
      .eq('id', session.id)
      .select('*, subject:subjects(*)')
      .maybeSingle();
    if (error || !data) {
      toast('Failed to regenerate QR', 'error');
      setActionLoading(false);
      return;
    }
    expireHandled.current = false;
    setSession(data as AttendanceSession & { subject: Subject });
    setSecondsLeft(duration);
    toast('QR code regenerated', 'success');
    setActionLoading(false);
  };

  const endSession = async () => {
    if (!session) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('attendance_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id);
    if (error) toast('Failed to end session', 'error');
    else {
      toast('Session ended. You can mark absent students manually.', 'success');
      setSession((prev) => prev ? { ...prev, status: 'ended' } : prev);
    }
    setActionLoading(false);
  };

  const markAbsentees = async (method: MarkedMethod = 'manual', status: 'absent' | 'present' = 'absent') => {
    if (!session || roster.length === 0) return;
    const scannedIds = new Set(scanned.map((r) => r.student_id));
    const missing = roster.filter((r) => !scannedIds.has(r.student_id));
    if (missing.length === 0) {
      toast('Everyone has marked attendance!', 'info');
      return;
    }
    const rows = missing.map((m) => ({
      session_id: session.id,
      student_id: m.student_id,
      status,
      marked_method: method,
      marked_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('attendance_records').insert(rows);
    if (error) toast('Failed to mark remaining students', 'error');
    else {
      toast(`Marked ${missing.length} students as ${status}`, 'success');
      await loadScanned(session.id);
    }
  };

  // ---- Derived values ----
  const total = session ? roster.length : 0;
  const presentCount = scanned.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount = scanned.filter((r) => r.status === 'absent').length;
  const scannedIds = new Set(scanned.map((r) => r.student_id));
  const notScanned = roster.filter((r) => !scannedIds.has(r.student_id));

  const pctTotal = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const timePct = session ? Math.max(0, Math.min(100, (secondsLeft / session.duration_seconds) * 100)) : 0;
  const isExpired = session?.status === 'expired' || (session !== null && secondsLeft <= 0);
  const isEnded = session?.status === 'ended';

  // -------- Setup screen --------
  if (assignLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!session && assignments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <EmptyState
          icon={BookOpen}
          title="No subjects assigned"
          description="You need a faculty assignment before you can start a QR session. Contact your administrator."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader onBack={() => navigate('/faculty')} />

      {!session ? (
        /* ---------------- SETUP ---------------- */
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="card p-6 lg:col-span-3 space-y-6 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Select Subject
              </label>
              <div className="space-y-2">
                {assignments.map((a) => {
                  const active = selectedAssignmentId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssignmentId(a.id)}
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                        active
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/10 dark:border-brand-500 ring-2 ring-brand-500/20'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{a.subject.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {a.subject.code} · Section {a.section}{a.semester ? ` · ${a.semester.name}` : ''}
                        </p>
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 text-brand-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  QR Validity Duration
                </label>
                <span className="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                  {fmtDuration(duration)}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={600}
                step={30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-brand-600 dark:bg-slate-700"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDuration(p.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      duration === p.value
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={startSession} loading={creating} disabled={!selectedAssignmentId} className="w-full">
              <Play className="h-5 w-5" />
              Start QR Session
            </Button>
          </div>

          {/* Info panel */}
          <div className="card p-6 lg:col-span-2 space-y-4 animate-slide-up">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold">How it works</h3>
            </div>
            {[
              { icon: QrCode, title: 'Pick a subject', desc: 'Choose from your assigned classes.' },
              { icon: Timer, title: 'Set validity', desc: 'QR auto-expires to prevent cheating.' },
              { icon: Play, title: 'Start session', desc: 'Display the QR for students to scan.' },
              { icon: Activity, title: 'Track live', desc: 'See scans appear in real-time.' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                  <s.icon className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-accent-50 p-3 dark:bg-accent-600/10">
              <div className="flex items-center gap-2 text-accent-700 dark:text-accent-300">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-xs font-semibold">Anti-cheating built-in</p>
              </div>
              <p className="mt-1 text-xs text-accent-600/80 dark:text-accent-400/80">
                Tokens expire automatically and are unique per session.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ---------------- ACTIVE SESSION ---------------- */
        <div className="space-y-6">
          {/* Top stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Enrolled" value={total} icon={Users} color="brand" />
            <StatCard label="Present" value={presentCount} icon={CheckCircle2} color="accent" trend={`${pctTotal}% of class`} />
            <StatCard label="Absent" value={absentCount} icon={XCircle} color="red" />
            <StatCard
              label="Time Left"
              value={isEnded ? 'Ended' : isExpired ? 'Expired' : fmtDuration(secondsLeft)}
              icon={Timer}
              color={isExpired || isEnded ? 'red' : secondsLeft < 30 ? 'amber' : 'sky'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* QR display */}
            <div className="card p-6 lg:col-span-2 flex flex-col items-center text-center">
              <div className="mb-2 flex items-center gap-2">
                <span className={`badge ${isEnded ? 'badge-neutral' : isExpired ? 'badge-danger' : 'badge-success'} animate-pulse`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isEnded || isExpired ? 'bg-red-500' : 'bg-accent-500 animate-ping'}`} />
                  {isEnded ? 'Session Ended' : isExpired ? 'Expired' : 'Live'}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{session.subject.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {session.subject.code} · Section {session.section} · {formatDate(session.session_date)}
              </p>

              {/* QR card */}
              <div className={`relative mt-5 rounded-2xl p-5 transition-all ${isExpired ? 'opacity-40 grayscale' : 'bg-white shadow-xl ring-1 ring-slate-200'}`}>
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG
                    value={session.qr_token}
                    size={224}
                    level="H"
                    includeMargin={false}
                    fgColor="#0f172a"
                    bgColor="#ffffff"
                  />
                </div>
                {isExpired && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                      Expired
                    </span>
                  </div>
                )}
              </div>

              {/* Countdown ring */}
              {!isEnded && (
                <div className="mt-5 w-full">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Validity</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtDuration(secondsLeft)}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                        isExpired ? 'bg-red-500' : secondsLeft < 30 ? 'bg-amber-500' : 'bg-gradient-to-r from-brand-500 to-accent-500'
                      }`}
                      style={{ width: `${isExpired ? 0 : timePct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Manual token for students whose scanner fails */}
              {!isEnded && (
                <div className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <KeyRound className="h-3.5 w-3.5" /> Manual Token (for scanner issues)
                    </div>
                    <button
                      onClick={() => setShowToken((v) => !v)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                    >
                      {showToken ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={showToken ? session.qr_token : '••••••••••••••••••••••••'}
                      onClick={(e) => e.currentTarget.select()}
                      className="input-field font-mono text-xs py-2 cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(session.qr_token);
                        toast('Token copied to clipboard', 'success');
                      }}
                      className="btn-secondary px-3 py-2 flex-shrink-0"
                      title="Copy token"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Share this token with students whose camera scanner isn't working. They can paste it on the Scan page.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex w-full flex-col gap-2.5">
                {!isEnded && (
                  <Button onClick={regenerateQr} loading={actionLoading} variant="secondary" className="w-full">
                    <RefreshCw className="h-4 w-4" /> Regenerate QR
                  </Button>
                )}
                {isEnded ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => { setSession(null); setScanned([]); setRoster([]); }}
                  >
                    <ArrowLeft className="h-4 w-4" /> Start New Session
                  </Button>
                ) : (
                  <Button onClick={endSession} loading={actionLoading} variant="danger" className="w-full">
                    <StopCircle className="h-4 w-4" /> End Session
                  </Button>
                )}
                {!isEnded && notScanned.length > 0 && (
                  <button
                    onClick={() => markAbsentees('manual', 'absent')}
                    className="btn-ghost w-full text-xs"
                  >
                    Mark {notScanned.length} remaining as absent
                  </button>
                )}
              </div>
            </div>

            {/* Live attendance + roster */}
            <div className="lg:col-span-3 space-y-6">
              {/* Live scans */}
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-accent-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live Attendance</h2>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-accent-600 dark:text-accent-400">
                    <Wifi className="h-3.5 w-3.5 animate-pulse" /> Polling every 3s
                  </span>
                </div>

                {/* Progress bar of class */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>{presentCount} of {total} scanned</span>
                    <span className="font-semibold">{pctTotal}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-700"
                      style={{ width: `${pctTotal}%` }}
                    />
                  </div>
                </div>

                {scanned.length === 0 ? (
                  <EmptyState
                    icon={QrCode}
                    title="Waiting for scans…"
                    description="Students who scan the QR code will appear here instantly."
                  />
                ) : (
                  <div className="max-h-[280px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                    {scanned.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 animate-slide-in dark:border-slate-700"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <Avatar name={r.student.full_name} src={r.student.avatar_url} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {r.student.full_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Scanned at {formatDate(r.marked_at, 'h:mm:ss a')} · {r.marked_method.toUpperCase()}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Roster — who hasn't scanned */}
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-brand-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Class Roster</h2>
                  </div>
                  <span className="text-xs text-slate-400">{notScanned.length} pending</span>
                </div>
                {roster.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No enrolled students"
                    description="No students are enrolled in this section's semester."
                  />
                ) : (
                  <div className="max-h-[300px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                    {roster.map((e) => {
                      const done = scannedIds.has(e.student_id);
                      const rec = scanned.find((r) => r.student_id === e.student_id);
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                            done
                              ? 'border-accent-200 bg-accent-50/40 dark:border-accent-500/30 dark:bg-accent-500/5'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Avatar name={e.student.full_name} src={e.student.avatar_url} size={34} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {e.student.full_name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {e.roll_number ? `Roll ${e.roll_number} · ` : ''}Section {e.section}
                            </p>
                          </div>
                          {done ? (
                            <span className="badge badge-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {rec?.status ?? 'present'}
                            </span>
                          ) : (
                            <span className="badge badge-neutral">Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageHeader({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="btn-ghost px-2.5">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30">
          <QrCode className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">QR Attendance Session</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Generate a live QR code and track attendance in real-time</p>
        </div>
      </div>
    </div>
  );
}
