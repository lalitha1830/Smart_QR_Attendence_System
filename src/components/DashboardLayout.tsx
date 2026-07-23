import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen, CalendarDays,
  QrCode, FileBarChart, LogOut, Menu, X, Moon, Sun, Bell,
  CalendarRange, ShieldCheck, Megaphone, ClipboardList, UserCircle, ScanLine,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './ui';
import type { UserRole } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/courses', label: 'Courses', icon: BookOpen },
    { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
    { to: '/admin/academic', label: 'Academic Years', icon: CalendarRange },
    { to: '/admin/classrooms', label: 'Classrooms', icon: Building2 },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/faculty', label: 'Faculty', icon: Users },
    { to: '/admin/enrollments', label: 'Enrollments', icon: ClipboardList },
    { to: '/admin/schedules', label: 'Schedules', icon: CalendarDays },
    { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/admin/activity', label: 'Activity Logs', icon: ShieldCheck },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/faculty/qr-session', label: 'QR Attendance', icon: QrCode },
    { to: '/faculty/classes', label: 'My Classes', icon: BookOpen },
    { to: '/faculty/attendance', label: 'Attendance Records', icon: ClipboardList },
    { to: '/faculty/leaves', label: 'Leave Requests', icon: CalendarDays },
    { to: '/faculty/reports', label: 'Reports', icon: FileBarChart },
    { to: '/faculty/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/faculty/profile', label: 'Profile', icon: UserCircle },
  ],
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/scan', label: 'Scan QR Code', icon: ScanLine },
    { to: '/student/attendance', label: 'Attendance History', icon: ClipboardList },
    { to: '/student/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/student/leaves', label: 'My Leaves', icon: CalendarRange },
    { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/student/profile', label: 'Profile', icon: UserCircle },
  ],
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  faculty: 'Faculty Member',
  student: 'Student',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;

  const navItems = navByRole[profile.role] ?? [];
  const basePath = `/${profile.role}`;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">AttendX</h1>
          <p className="text-[11px] text-slate-400 font-medium">Smart QR Attendance</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin space-y-1">
        {navItems.map((item) => {
          const isDashboard = item.to === basePath;
          const isActive = isDashboard
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={isDashboard}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-700 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{profile.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{roleLabels[profile.role]}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 shadow-2xl animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-slate-600 dark:text-slate-300"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {navItems.find((n) => n.to === location.pathname)?.label ??
                (location.pathname.startsWith(basePath) ? navItems[0]?.label : 'AttendX')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </button>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-slate-700">
              <Avatar name={profile.full_name} src={profile.avatar_url} size={32} />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
