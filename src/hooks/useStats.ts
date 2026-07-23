import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalDepartments: number;
  totalCourses: number;
  totalSubjects: number;
  attendanceToday: number;
  attendanceThisMonth: number;
  activeSessions: number;
  pendingLeaves: number;
}

export async function fetchAdminStats(): Promise<DashboardStats> {
  const [students, faculty, depts, courses, subjects, todayRecords, monthRecords, activeSessions, pendingLeaves] =
    await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'faculty'),
      supabase.from('departments').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).gte('marked_at', new Date().toISOString().split('T')[0]),
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).gte('marked_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

  return {
    totalStudents: students.count ?? 0,
    totalFaculty: faculty.count ?? 0,
    totalDepartments: depts.count ?? 0,
    totalCourses: courses.count ?? 0,
    totalSubjects: subjects.count ?? 0,
    attendanceToday: todayRecords.count ?? 0,
    attendanceThisMonth: monthRecords.count ?? 0,
    activeSessions: activeSessions.count ?? 0,
    pendingLeaves: pendingLeaves.count ?? 0,
  };
}

export interface StudentDashboardStats {
  attendancePct: number;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  todayClasses: number;
  upcomingClasses: number;
  pendingLeaves: number;
}

export async function fetchStudentStats(studentId: string): Promise<StudentDashboardStats> {
  const { data: records } = await supabase
    .from('attendance_records')
    .select('status, session:attendance_sessions(session_date)')
    .eq('student_id', studentId);

  const total = records?.length ?? 0;
  const present = records?.filter((r) => r.status === 'present').length ?? 0;
  const absent = records?.filter((r) => r.status === 'absent').length ?? 0;
  const late = records?.filter((r) => r.status === 'late').length ?? 0;
  const leave = records?.filter((r) => r.status === 'leave').length ?? 0;

  const { count: pendingLeaves } = await supabase
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'pending');

  return {
    attendancePct: total > 0 ? Math.round((present / total) * 100) : 0,
    totalClasses: total,
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    leaveCount: leave,
    todayClasses: 0,
    upcomingClasses: 0,
    pendingLeaves: pendingLeaves ?? 0,
  };
}

export interface FacultyDashboardStats {
  todayLectures: number;
  activeSessions: number;
  totalStudents: number;
  pendingLeaves: number;
  totalSessions: number;
  avgAttendance: number;
}

export async function fetchFacultyStats(facultyId: string): Promise<FacultyDashboardStats> {
  const dayOfWeek = new Date().getDay();

  const [todaySchedules, activeSessions, totalSessions, pendingLeaves, assignments] = await Promise.all([
    supabase.from('schedules').select('id').eq('faculty_id', facultyId).eq('day_of_week', dayOfWeek),
    supabase.from('attendance_sessions').select('id').eq('faculty_id', facultyId).eq('status', 'active'),
    supabase.from('attendance_sessions').select('id').eq('faculty_id', facultyId),
    supabase.from('leave_requests').select('id').eq('faculty_id', facultyId).eq('status', 'pending'),
    supabase.from('faculty_assignments').select('subject_id').eq('faculty_id', facultyId),
  ]);

  let avgAttendance = 0;
  if ((totalSessions.data?.length ?? 0) > 0) {
    const { data: records } = await supabase
      .from('attendance_records')
      .select('status, session:attendance_sessions(faculty_id)')
      .eq('session.faculty_id', facultyId);
    const totalRecords = records?.length ?? 0;
    const presentRecords = records?.filter((r) => r.status === 'present' || r.status === 'late').length ?? 0;
    avgAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
  }

  return {
    todayLectures: todaySchedules.data?.length ?? 0,
    activeSessions: activeSessions.data?.length ?? 0,
    totalStudents: assignments.data?.length ?? 0,
    pendingLeaves: pendingLeaves.data?.length ?? 0,
    totalSessions: totalSessions.data?.length ?? 0,
    avgAttendance,
  };
}
