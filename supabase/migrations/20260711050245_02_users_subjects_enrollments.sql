/*
# AttendX Users, Subjects, Enrollments, and Assignments Schema

## Overview
Creates user profiles (admin/faculty/student), subjects, student enrollments in class sections,
and faculty-to-subject teaching assignments.

## New Tables
1. `profiles` — User profile data linked to Supabase auth.users
   - id (uuid PK, matches auth.users.id), full_name, email, role (admin/faculty/student),
     phone, avatar_url, department_id (FK, nullable), is_active, created_at
2. `subjects` — Subjects/courses taught in the institution
   - id (uuid PK), name, code (unique), department_id (FK), course_id (FK, nullable),
     semester_id (FK, nullable), credits, description
3. `enrollments` — Students enrolled in a course/semester section
   - id (uuid PK), student_id (FK profiles), course_id (FK), semester_id (FK),
     roll_number, section, enrolled_at
4. `faculty_assignments` — Links faculty to subjects they teach
   - id (uuid PK), faculty_id (FK profiles), subject_id (FK subjects),
     semester_id (FK), section, assigned_at

## Security
- RLS enabled on all tables.
- All authenticated users can read profiles/subjects/enrollments/assignments.
- Users can update their own profile.
- All authenticated users can insert/update (admin manages via UI; row-level ownership
  checks are enforced in app logic by role).
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
  phone text,
  avatar_url text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  semester_id uuid REFERENCES semesters(id) ON DELETE SET NULL,
  credits integer DEFAULT 3,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  roll_number text,
  section text DEFAULT 'A',
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(student_id, semester_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS faculty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester_id uuid REFERENCES semesters(id) ON DELETE CASCADE,
  section text DEFAULT 'A',
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(faculty_id, subject_id, semester_id, section)
);

ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_profiles" ON profiles;
CREATE POLICY "insert_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_any_profile" ON profiles;
CREATE POLICY "update_any_profile" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- subjects policies
DROP POLICY IF EXISTS "read_subjects" ON subjects;
CREATE POLICY "read_subjects" ON subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_subjects" ON subjects;
CREATE POLICY "insert_subjects" ON subjects FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_subjects" ON subjects;
CREATE POLICY "update_subjects" ON subjects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_subjects" ON subjects;
CREATE POLICY "delete_subjects" ON subjects FOR DELETE TO authenticated USING (true);

-- enrollments policies
DROP POLICY IF EXISTS "read_enrollments" ON enrollments;
CREATE POLICY "read_enrollments" ON enrollments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_enrollments" ON enrollments;
CREATE POLICY "insert_enrollments" ON enrollments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_enrollments" ON enrollments;
CREATE POLICY "update_enrollments" ON enrollments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_enrollments" ON enrollments;
CREATE POLICY "delete_enrollments" ON enrollments FOR DELETE TO authenticated USING (true);

-- faculty_assignments policies
DROP POLICY IF EXISTS "read_faculty_assignments" ON faculty_assignments;
CREATE POLICY "read_faculty_assignments" ON faculty_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_faculty_assignments" ON faculty_assignments;
CREATE POLICY "insert_faculty_assignments" ON faculty_assignments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_faculty_assignments" ON faculty_assignments;
CREATE POLICY "update_faculty_assignments" ON faculty_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_faculty_assignments" ON faculty_assignments;
CREATE POLICY "delete_faculty_assignments" ON faculty_assignments FOR DELETE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_faculty_assign_faculty ON faculty_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department_id);
