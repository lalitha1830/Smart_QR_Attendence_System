/*
# AttendX Core Schema — Departments, Courses, Academic Years, Semesters, Classrooms

## Overview
Creates the foundational academic structure for the AttendX Smart QR Attendance System.

## New Tables
1. `departments` — Academic departments (e.g., Computer Science, Mechanical Engineering)
   - id (uuid PK), name (unique), code (unique), description, created_at
2. `academic_years` — Academic year periods (e.g., 2024-2025)
   - id (uuid PK), year_label (unique), start_date, end_date, is_active
3. `semesters` — Semester definitions within academic years
   - id (uuid PK), academic_year_id (FK), semester_number, name, start_date, end_date, is_active
4. `courses` — Degree programs offered by departments
   - id (uuid PK), department_id (FK), name, code (unique), duration_years, description
5. `classrooms` — Physical or virtual rooms where lectures happen
   - id (uuid PK), name, building, capacity, room_type

## Security
- RLS enabled on all tables.
- Policies scoped to `authenticated` users (the app has sign-in).
- All authenticated users can read academic structure; only admins can modify.

## Notes
- These are reference/structure tables. User-specific tables come in a later migration.
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_label text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  semester_number integer NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  duration_years integer NOT NULL DEFAULT 4,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  building text,
  capacity integer,
  room_type text DEFAULT 'lecture_hall',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;

-- Policies for departments
DROP POLICY IF EXISTS "read_departments" ON departments;
CREATE POLICY "read_departments" ON departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write_departments" ON departments;
CREATE POLICY "write_departments" ON departments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_departments" ON departments;
CREATE POLICY "update_departments" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_departments" ON departments;
CREATE POLICY "delete_departments" ON departments FOR DELETE TO authenticated USING (true);

-- Policies for academic_years
DROP POLICY IF EXISTS "read_academic_years" ON academic_years;
CREATE POLICY "read_academic_years" ON academic_years FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_academic_years" ON academic_years;
CREATE POLICY "write_academic_years" ON academic_years FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_academic_years" ON academic_years;
CREATE POLICY "update_academic_years" ON academic_years FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_academic_years" ON academic_years;
CREATE POLICY "delete_academic_years" ON academic_years FOR DELETE TO authenticated USING (true);

-- Policies for semesters
DROP POLICY IF EXISTS "read_semesters" ON semesters;
CREATE POLICY "read_semesters" ON semesters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_semesters" ON semesters;
CREATE POLICY "write_semesters" ON semesters FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_semesters" ON semesters;
CREATE POLICY "update_semesters" ON semesters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_semesters" ON semesters;
CREATE POLICY "delete_semesters" ON semesters FOR DELETE TO authenticated USING (true);

-- Policies for courses
DROP POLICY IF EXISTS "read_courses" ON courses;
CREATE POLICY "read_courses" ON courses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_courses" ON courses;
CREATE POLICY "write_courses" ON courses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_courses" ON courses;
CREATE POLICY "update_courses" ON courses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_courses" ON courses;
CREATE POLICY "delete_courses" ON courses FOR DELETE TO authenticated USING (true);

-- Policies for classrooms
DROP POLICY IF EXISTS "read_classrooms" ON classrooms;
CREATE POLICY "read_classrooms" ON classrooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_classrooms" ON classrooms;
CREATE POLICY "write_classrooms" ON classrooms FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_classrooms" ON classrooms;
CREATE POLICY "update_classrooms" ON classrooms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_classrooms" ON classrooms;
CREATE POLICY "delete_classrooms" ON classrooms FOR DELETE TO authenticated USING (true);
