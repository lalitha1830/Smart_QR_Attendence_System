import { useState } from 'react';
import { QrCode, Mail, Lock, User, GraduationCap, Users, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui';
import type { UserRole } from '../types';

type RoleOption = {
  value: UserRole;
  label: string;
  icon: React.ElementType;
  desc: string;
};

const roleOptions: RoleOption[] = [
  { value: 'student', label: 'Student', icon: GraduationCap, desc: 'Scan QR & track attendance' },
  { value: 'faculty', label: 'Faculty', icon: Users, desc: 'Generate QR & manage classes' },
  { value: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full system management' },
];

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast(error, 'error');
        setLoading(false);
      } else {
        toast('Welcome back!', 'success');
      }
    } else {
      if (password.length < 6) {
        toast('Password must be at least 6 characters', 'error');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) {
        toast(error, 'error');
        setLoading(false);
      } else {
        toast('Account created successfully! Please sign in.', 'success');
        setMode('login');
        setLoading(false);
      }
    }
  };

  const fillDemo = (demoRole: UserRole) => {
    setMode('login');
    const creds: Record<UserRole, { email: string; pass: string }> = {
      admin: { email: 'admin@attendx.edu', pass: 'admin123' },
      faculty: { email: 'faculty@attendx.edu', pass: 'faculty123' },
      student: { email: 'student@attendx.edu', pass: 'student123' },
    };
    setEmail(creds[demoRole].email);
    setPassword(creds[demoRole].pass);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-accent-700 p-8 text-white lg:w-1/2 lg:p-12">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-white/30 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-20 right-10 h-60 w-60 rounded-full bg-accent-300/30 blur-3xl animate-pulse-slow" />
          <div className="absolute top-1/2 left-1/3 h-32 w-32 rounded-full bg-brand-300/30 blur-2xl animate-float" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AttendX</h1>
            <p className="text-sm text-white/70">Smart QR Attendance System</p>
          </div>
        </div>

        <div className="relative z-10 my-12 lg:my-0">
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
            Attendance made<br />
            <span className="text-accent-300">simple, secure & smart.</span>
          </h2>
          <p className="mt-4 text-white/80 max-w-md">
            Generate encrypted QR codes for every lecture. Students scan to mark attendance.
            Real-time dashboards, analytics, and reports — all in one place.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
            {[
              { label: 'Encrypted QR', value: 'Secure' },
              { label: 'Anti-cheating', value: 'Built-in' },
              { label: 'Real-time', value: 'Live' },
              { label: 'Analytics', value: 'Smart' },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
                <p className="text-xs text-white/60">{f.label}</p>
                <p className="text-sm font-semibold">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/50">© 2026 AttendX. Built for colleges & universities.</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Sign in to your AttendX account' : 'Join AttendX in seconds'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">I am a</label>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                        role === r.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:border-brand-500 dark:text-brand-300'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <r.icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Demo credentials */}
          <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">Quick demo login:</p>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((r) => (
                <button
                  key={r.value}
                  onClick={() => fillDemo(r.value)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-600/20 dark:hover:text-brand-300 transition-colors"
                >
                  <r.icon className="h-3.5 w-3.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
