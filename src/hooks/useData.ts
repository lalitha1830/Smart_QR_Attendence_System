import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Department, AcademicYear, Semester, Course, Classroom, Subject,
  Profile, Enrollment, FacultyAssignment, Schedule, AttendanceSession,
  AttendanceRecord, LeaveRequest, Announcement, ActivityLog, UserRole,
} from '../types';

function useSupabaseQuery<T>(
  table: string,
  select: string = '*',
  filter?: { column: string; value: string | boolean | null },
  order?: { column: string; ascending?: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select(select);
    if (filter) query = query.eq(filter.column, filter.value);
    if (order) query = query.order(order.column, { ascending: order.ascending ?? true });
    const { data: result, error: err } = await query;
    if (err) setError(err.message);
    else setData((result as T[]) ?? []);
    setLoading(false);
  }, [table, select, filter?.column, filter?.value, order?.column, order?.ascending]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useDepartments() {
  return useSupabaseQuery<Department>('departments', '*', undefined, { column: 'name' });
}

export function useAcademicYears() {
  return useSupabaseQuery<AcademicYear>('academic_years', '*', undefined, { column: 'start_date', ascending: false });
}

export function useSemesters(yearId?: string) {
  const filter = yearId ? { column: 'academic_year_id', value: yearId } : undefined;
  return useSupabaseQuery<Semester>('semesters', '*', filter, { column: 'semester_number' });
}

export function useCourses() {
  return useSupabaseQuery<Course>('courses', '*, departments!inner(name)', undefined, { column: 'name' });
}

export function useClassrooms() {
  return useSupabaseQuery<Classroom>('classrooms', '*', undefined, { column: 'name' });
}

export function useSubjects(departmentId?: string) {
  const filter = departmentId ? { column: 'department_id', value: departmentId } : undefined;
  return useSupabaseQuery<Subject>('subjects', '*, departments(name)', filter, { column: 'name' });
}

export function useProfiles(role?: UserRole) {
  const filter = role ? { column: 'role', value: role } : undefined;
  return useSupabaseQuery<Profile & { department?: { name: string } | null }>(
    'profiles', '*, department:departments(name)', filter, { column: 'full_name' }
  );
}

export function useEnrollments() {
  return useSupabaseQuery<Enrollment & { student: Profile; course: Course; semester: Semester }>(
    'enrollments', '*, student:profiles(*), course:courses(*), semester:semesters(*)', undefined, { column: 'enrolled_at', ascending: false }
  );
}

export function useFacultyAssignments() {
  return useSupabaseQuery<FacultyAssignment & { faculty: Profile; subject: Subject; semester: Semester | null }>(
    'faculty_assignments', '*, faculty:profiles(*), subject:subjects(*), semester:semesters(*)', undefined, { column: 'assigned_at', ascending: false }
  );
}

export function useSchedules(facultyId?: string) {
  const filter = facultyId ? { column: 'faculty_id', value: facultyId } : undefined;
  return useSupabaseQuery<Schedule & { subject: Subject; faculty: Profile; classroom: Classroom | null; semester: Semester }>(
    'schedules', '*, subject:subjects(*), faculty:profiles(*), classroom:classrooms(*), semester:semesters(*)', filter, { column: 'day_of_week' }
  );
}

export function useSessions(facultyId?: string) {
  const filter = facultyId ? { column: 'faculty_id', value: facultyId } : undefined;
  return useSupabaseQuery<AttendanceSession & { subject: Subject; faculty: Profile }>(
    'attendance_sessions', '*, subject:subjects(*), faculty:profiles(*)', filter, { column: 'started_at', ascending: false }
  );
}

export function useAnnouncements() {
  return useSupabaseQuery<Announcement & { creator: Profile; department: Department | null }>(
    'announcements', '*, creator:profiles!created_by(*), department:departments(*)', undefined, { column: 'created_at', ascending: false }
  );
}

export function useLeaveRequests(studentId?: string, facultyId?: string) {
  const [data, setData] = useState<(LeaveRequest & { student: Profile; subject: Subject | null; reviewer: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('leave_requests')
      .select('*, student:profiles!student_id(*), subject:subjects(*), reviewer:profiles!reviewed_by(*)');
    if (studentId) query = query.eq('student_id', studentId);
    if (facultyId) query = query.eq('faculty_id', facultyId);
    query = query.order('created_at', { ascending: false });
    const { data: result, error: err } = await query;
    if (err) setError(err.message);
    else setData((result as (LeaveRequest & { student: Profile; subject: Subject | null; reviewer: Profile | null })[]) ?? []);
    setLoading(false);
  }, [studentId, facultyId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useAttendanceRecords(studentId?: string, sessionId?: string) {
  const [data, setData] = useState<(AttendanceRecord & { student: Profile; session: AttendanceSession & { subject: Subject } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('attendance_records')
      .select('*, student:profiles(*), session:attendance_sessions(*, subject:subjects(*))');
    if (studentId) query = query.eq('student_id', studentId);
    if (sessionId) query = query.eq('session_id', sessionId);
    query = query.order('marked_at', { ascending: false });
    const { data: result, error: err } = await query;
    if (err) setError(err.message);
    else setData((result as (AttendanceRecord & { student: Profile; session: AttendanceSession & { subject: Subject } })[]) ?? []);
    setLoading(false);
  }, [studentId, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useActivityLogs() {
  return useSupabaseQuery<ActivityLog & { user: Profile | null }>(
    'activity_logs', '*, user:profiles(*)', undefined, { column: 'created_at', ascending: false }
  );
}
