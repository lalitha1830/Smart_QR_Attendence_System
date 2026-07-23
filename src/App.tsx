import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './components/DashboardLayout';
import { PageLoader } from './components/ui';
import type { UserRole } from './types';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminCourses from './pages/admin/AdminCourses';
import AdminSubjects from './pages/admin/AdminSubjects';
import AdminAcademic from './pages/admin/AdminAcademic';
import AdminClassrooms from './pages/admin/AdminClassrooms';
import AdminStudents from './pages/admin/AdminStudents';
import AdminFaculty from './pages/admin/AdminFaculty';
import AdminEnrollments from './pages/admin/AdminEnrollments';
import AdminSchedules from './pages/admin/AdminSchedules';
import AdminReports from './pages/admin/AdminReports';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminActivity from './pages/admin/AdminActivity';

// Faculty pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyQRSession from './pages/faculty/FacultyQRSession';
import FacultyClasses from './pages/faculty/FacultyClasses';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyLeaves from './pages/faculty/FacultyLeaves';
import FacultyReports from './pages/faculty/FacultyReports';
import FacultyAnnouncements from './pages/faculty/FacultyAnnouncements';
import ProfilePage from './pages/shared/ProfilePage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentScan from './pages/student/StudentScan';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentLeaves from './pages/student/StudentLeaves';
import StudentAnnouncements from './pages/student/StudentAnnouncements';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: UserRole }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <PageLoader />;
  if (allowedRole && profile.role !== allowedRole) {
    return <Navigate to={`/${profile.role}`} replace />;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (session && profile) return <Navigate to={`/${profile.role}`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/departments" element={<ProtectedRoute allowedRole="admin"><AdminDepartments /></ProtectedRoute>} />
      <Route path="/admin/courses" element={<ProtectedRoute allowedRole="admin"><AdminCourses /></ProtectedRoute>} />
      <Route path="/admin/subjects" element={<ProtectedRoute allowedRole="admin"><AdminSubjects /></ProtectedRoute>} />
      <Route path="/admin/academic" element={<ProtectedRoute allowedRole="admin"><AdminAcademic /></ProtectedRoute>} />
      <Route path="/admin/classrooms" element={<ProtectedRoute allowedRole="admin"><AdminClassrooms /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute allowedRole="admin"><AdminStudents /></ProtectedRoute>} />
      <Route path="/admin/faculty" element={<ProtectedRoute allowedRole="admin"><AdminFaculty /></ProtectedRoute>} />
      <Route path="/admin/enrollments" element={<ProtectedRoute allowedRole="admin"><AdminEnrollments /></ProtectedRoute>} />
      <Route path="/admin/schedules" element={<ProtectedRoute allowedRole="admin"><AdminSchedules /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute allowedRole="admin"><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute allowedRole="admin"><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute allowedRole="admin"><AdminActivity /></ProtectedRoute>} />

      {/* Faculty */}
      <Route path="/faculty" element={<ProtectedRoute allowedRole="faculty"><FacultyDashboard /></ProtectedRoute>} />
      <Route path="/faculty/qr-session" element={<ProtectedRoute allowedRole="faculty"><FacultyQRSession /></ProtectedRoute>} />
      <Route path="/faculty/classes" element={<ProtectedRoute allowedRole="faculty"><FacultyClasses /></ProtectedRoute>} />
      <Route path="/faculty/attendance" element={<ProtectedRoute allowedRole="faculty"><FacultyAttendance /></ProtectedRoute>} />
      <Route path="/faculty/leaves" element={<ProtectedRoute allowedRole="faculty"><FacultyLeaves /></ProtectedRoute>} />
      <Route path="/faculty/reports" element={<ProtectedRoute allowedRole="faculty"><FacultyReports /></ProtectedRoute>} />
      <Route path="/faculty/announcements" element={<ProtectedRoute allowedRole="faculty"><FacultyAnnouncements /></ProtectedRoute>} />
      <Route path="/faculty/profile" element={<ProtectedRoute allowedRole="faculty"><ProfilePage /></ProtectedRoute>} />

      {/* Student */}
      <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/scan" element={<ProtectedRoute allowedRole="student"><StudentScan /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute allowedRole="student"><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute allowedRole="student"><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/leaves" element={<ProtectedRoute allowedRole="student"><StudentLeaves /></ProtectedRoute>} />
      <Route path="/student/announcements" element={<ProtectedRoute allowedRole="student"><StudentAnnouncements /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute allowedRole="student"><ProfilePage /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
