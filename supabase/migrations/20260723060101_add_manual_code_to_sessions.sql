-- Add optional manual_code column so faculty can set a short custom passcode
-- students can type when the camera scanner fails.
ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS manual_code text;

-- Allow students to look up a session by manual_code (no unique constraint needed;
-- the lookup query will filter by status=active and match the code).
CREATE INDEX IF NOT EXISTS idx_sessions_manual_code ON attendance_sessions(manual_code) WHERE manual_code IS NOT NULL;
