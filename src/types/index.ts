export type UserRole = 'admin' | 'faculty' | 'student';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';
export type MarkedMethod = 'qr' | 'manual';
export type SessionStatus = 'active' | 'ended' | 'expired';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type TargetAudience = 'all' | 'students' | 'faculty' | 'section' | 'department';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
}

export interface AcademicYear {
  id: string;
  year_label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  semester_number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Course {
  id: string;
  department_id: string;
  name: string;
  code: string;
  duration_years: number;
  description: string | null;
}

export interface Classroom {
  id: string;
  name: string;
  building: string | null;
  capacity: number | null;
  room_type: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department_id: string;
  course_id: string | null;
  semester_id: string | null;
  credits: number;
  description: string | null;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  semester_id: string;
  roll_number: string | null;
  section: string;
  enrolled_at: string;
}

export interface FacultyAssignment {
  id: string;
  faculty_id: string;
  subject_id: string;
  semester_id: string | null;
  section: string;
  assigned_at: string;
}

export interface Schedule {
  id: string;
  subject_id: string;
  faculty_id: string;
  classroom_id: string | null;
  semester_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string;
}

export interface AttendanceSession {
  id: string;
  subject_id: string;
  faculty_id: string;
  classroom_id: string | null;
  semester_id: string | null;
  schedule_id: string | null;
  session_date: string;
  qr_token: string;
  manual_code: string | null;
  qr_expires_at: string;
  status: SessionStatus;
  duration_seconds: number;
  section: string;
  started_at: string;
  ended_at: string | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_method: MarkedMethod;
  ip_address: string | null;
  device_fingerprint: string | null;
  is_flagged: boolean;
  faculty_approved: boolean;
  notes: string | null;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  subject_id: string | null;
  faculty_id: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  target_audience: TargetAudience;
  target_department_id: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ProfileWithRelations extends Profile {
  department?: Department | null;
}

export interface AttendanceRecordWithRelations extends AttendanceRecord {
  student?: Profile;
  session?: AttendanceSessionWithRelations;
}

export interface AttendanceSessionWithRelations extends AttendanceSession {
  subject?: Subject;
  faculty?: Profile;
  classroom?: Classroom;
  attendance_records?: AttendanceRecordWithRelations[];
}
