/*
# AttendX Schedules, Sessions, Attendance, Leaves, Announcements

## Overview
Creates the operational tables: class schedules, attendance sessions with QR codes,
attendance records, leave requests, announcements, and activity logs.

## New Tables
1. `schedules` — Weekly timetable entries
   - id, subject_id, faculty_id, classroom_id, semester_id, day_of_week (0-6),
     start_time, end_time, section
2. `attendance_sessions` — A single lecture session with a QR code
   - id, subject_id, faculty_id, classroom_id, semester_id, schedule_id (nullable),
     session_date, qr_token (unique encrypted token), qr_expires_at, status (active/ended/expired),
     duration_seconds, started_at, ended_at, section
3. `attendance_records` — Individual student attendance for a session
   - id, session_id, student_id, status (present/absent/late/leave), marked_at,
     marked_method (qr/manual), ip_address, device_fingerprint, is_flagged, faculty_approved
4. `leave_requests` — Student leave applications
   - id, student_id, subject_id (nullable), faculty_id (nullable for approval),
     start_date, end_date, reason, status (pending/approved/rejected), reviewed_by, reviewed_at
5. `announcements` — Broadcast messages to users
   - id, title, message, target_audience (all/students/faculty/section),
     target_department_id, created_by, is_active
6. `activity_logs` — Audit trail of user actions
   - id, user_id, action, entity_type, entity_id, details (jsonb), ip_address, created_at

## Security
- RLS enabled on all tables.
- All authenticated users can read operational data.
- All authenticated users can insert/update/delete (role enforcement in app logic).
- Students can insert their own attendance/leave and update their own leave requests.
*/

CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  section text DEFAULT 'A',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  semester_id uuid REFERENCES semesters(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  qr_token text NOT NULL UNIQUE,
  qr_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  duration_seconds integer NOT NULL DEFAULT 120,
  section text DEFAULT 'A',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'leave')),
  marked_at timestamptz DEFAULT now(),
  marked_method text NOT NULL DEFAULT 'qr' CHECK (marked_method IN ('qr', 'manual')),
  ip_address text,
  device_fingerprint text,
  is_flagged boolean DEFAULT false,
  faculty_approved boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'faculty', 'section', 'department')),
  target_department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- schedules policies
DROP POLICY IF EXISTS "read_schedules" ON schedules;
CREATE POLICY "read_schedules" ON schedules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_schedules" ON schedules;
CREATE POLICY "insert_schedules" ON schedules FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_schedules" ON schedules;
CREATE POLICY "update_schedules" ON schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_schedules" ON schedules;
CREATE POLICY "delete_schedules" ON schedules FOR DELETE TO authenticated USING (true);

-- attendance_sessions policies
DROP POLICY IF EXISTS "read_sessions" ON attendance_sessions;
CREATE POLICY "read_sessions" ON attendance_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_sessions" ON attendance_sessions;
CREATE POLICY "insert_sessions" ON attendance_sessions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_sessions" ON attendance_sessions;
CREATE POLICY "update_sessions" ON attendance_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_sessions" ON attendance_sessions;
CREATE POLICY "delete_sessions" ON attendance_sessions FOR DELETE TO authenticated USING (true);

-- attendance_records policies
DROP POLICY IF EXISTS "read_records" ON attendance_records;
CREATE POLICY "read_records" ON attendance_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_records" ON attendance_records;
CREATE POLICY "insert_records" ON attendance_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_records" ON attendance_records;
CREATE POLICY "update_records" ON attendance_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_records" ON attendance_records;
CREATE POLICY "delete_records" ON attendance_records FOR DELETE TO authenticated USING (true);

-- leave_requests policies
DROP POLICY IF EXISTS "read_leaves" ON leave_requests;
CREATE POLICY "read_leaves" ON leave_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_leaves" ON leave_requests;
CREATE POLICY "insert_leaves" ON leave_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_leaves" ON leave_requests;
CREATE POLICY "update_leaves" ON leave_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_leaves" ON leave_requests;
CREATE POLICY "delete_leaves" ON leave_requests FOR DELETE TO authenticated USING (true);

-- announcements policies
DROP POLICY IF EXISTS "read_announcements" ON announcements;
CREATE POLICY "read_announcements" ON announcements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_announcements" ON announcements;
CREATE POLICY "insert_announcements" ON announcements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_announcements" ON announcements;
CREATE POLICY "update_announcements" ON announcements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_announcements" ON announcements;
CREATE POLICY "delete_announcements" ON announcements FOR DELETE TO authenticated USING (true);

-- activity_logs policies
DROP POLICY IF EXISTS "read_logs" ON activity_logs;
CREATE POLICY "read_logs" ON activity_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_logs" ON activity_logs;
CREATE POLICY "insert_logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty ON attendance_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_leaves_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_schedules_faculty ON schedules(faculty_id);
CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
