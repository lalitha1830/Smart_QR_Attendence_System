import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { initials, avatarColor } from '../lib/utils';

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} style={{ width: size, height: size }} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 animate-pulse" />
        <LoadingSpinner size={28} />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-8 w-2/3" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }[variant];

  return (
    <button className={`${base} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 shadow-2xl animate-scale-in scrollbar-thin`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'brand',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: 'brand' | 'accent' | 'amber' | 'red' | 'sky';
}) {
  const colors = {
    brand: 'from-brand-500 to-brand-600 text-brand-600 bg-brand-50 dark:bg-brand-600/10',
    accent: 'from-accent-500 to-accent-600 text-accent-600 bg-accent-50 dark:bg-accent-600/10',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50 dark:bg-amber-600/10',
    red: 'from-red-500 to-red-600 text-red-600 bg-red-50 dark:bg-red-600/10',
    sky: 'from-sky-500 to-sky-600 text-sky-600 bg-sky-50 dark:bg-sky-600/10',
  };
  const c = colors[color];
  return (
    <div className="card p-5 hover:shadow-md transition-shadow animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-400">{trend}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.split(' ').slice(2).join(' ')}`}>
          <Icon className={`h-6 w-6 ${c.split(' ')[2]}`} />
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, color = 'brand', className = '' }: { value: number; color?: string; className?: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-500',
    accent: 'bg-accent-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className={`h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${colors[color] ?? colors.brand}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    present: { cls: 'badge-success', label: 'Present' },
    absent: { cls: 'badge-danger', label: 'Absent' },
    late: { cls: 'badge-warning', label: 'Late' },
    leave: { cls: 'badge-info', label: 'On Leave' },
    pending: { cls: 'badge-warning', label: 'Pending' },
    approved: { cls: 'badge-success', label: 'Approved' },
    rejected: { cls: 'badge-danger', label: 'Rejected' },
    active: { cls: 'badge-info', label: 'Active' },
    ended: { cls: 'badge-neutral', label: 'Ended' },
    expired: { cls: 'badge-neutral', label: 'Expired' },
  };
  const s = map[status] ?? { cls: 'badge-neutral', label: status };
  return <span className={s.cls}>{s.label}</span>;
}
