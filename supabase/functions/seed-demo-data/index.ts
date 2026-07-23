import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create demo users
    const demoUsers = [
      { email: "admin@attendx.edu", password: "admin123", fullName: "Dr. Admin Smith", role: "admin" },
      { email: "faculty@attendx.edu", password: "faculty123", fullName: "Prof. Sarah Chen", role: "faculty" },
      { email: "student@attendx.edu", password: "student123", fullName: "Alex Johnson", role: "student" },
      { email: "faculty2@attendx.edu", password: "faculty123", fullName: "Dr. James Wilson", role: "faculty" },
      { email: "student2@attendx.edu", password: "student123", fullName: "Emily Davis", role: "student" },
      { email: "student3@attendx.edu", password: "student123", fullName: "Michael Brown", role: "student" },
      { email: "student4@attendx.edu", password: "student123", fullName: "Jessica Garcia", role: "student" },
      { email: "student5@attendx.edu", password: "student123", fullName: "David Martinez", role: "student" },
      { email: "student6@attendx.edu", password: "student123", fullName: "Lisa Anderson", role: "student" },
      { email: "student7@attendx.edu", password: "student123", fullName: "Robert Taylor", role: "student" },
      { email: "student8@attendx.edu", password: "student123", fullName: "Jennifer Thomas", role: "student" },
      { email: "student9@attendx.edu", password: "student123", fullName: "Christopher Lee", role: "student" },
      { email: "student10@attendx.edu", password: "student123", fullName: "Amanda White", role: "student" },
    ];

    const createdUsers: { id: string; email: string; fullName: string; role: string }[] = [];

    for (const user of demoUsers) {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === user.email);
      let userId: string;

      if (existing) {
        userId = existing.id;
      } else {
        const { data: newUser, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });
        if (error) {
          createdUsers.push({ id: "", email: user.email, fullName: user.fullName, role: user.role });
          continue;
        }
        userId = newUser.user.id;
      }

      // Upsert profile
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        is_active: true,
      }, { onConflict: "id" });

      createdUsers.push({ id: userId, email: user.email, fullName: user.fullName, role: user.role });
    }

    // Seed departments if empty
    const { data: existingDepts } = await supabase.from("departments").select("id").limit(1);
    let deptCsId: string | null = null;
    let deptEngId: string | null = null;

    if (!existingDepts || existingDepts.length === 0) {
      const { data: depts } = await supabase.from("departments").insert([
        { name: "Computer Science & Engineering", code: "CSE", description: "Computer science, software engineering, and AI programs" },
        { name: "Electronics & Communication", code: "ECE", description: "Electronics, communication, and embedded systems" },
        { name: "Mechanical Engineering", code: "ME", description: "Mechanical engineering and robotics" },
        { name: "Information Technology", code: "IT", description: "Information technology and data science" },
      ]).select();
      deptCsId = depts?.[0]?.id ?? null;
      deptEngId = depts?.[1]?.id ?? null;
    } else {
      deptCsId = existingDepts[0].id;
      const { data: depts2 } = await supabase.from("departments").select("id").limit(2);
      deptEngId = depts2?.[1]?.id ?? deptCsId;
    }

    // Seed academic year + semester
    const { data: existingYears } = await supabase.from("academic_years").select("id").limit(1);
    let semId: string | null = null;

    if (!existingYears || existingYears.length === 0) {
      const { data: years } = await supabase.from("academic_years").insert({
        year_label: "2025-2026",
        start_date: "2025-07-01",
        end_date: "2026-06-30",
        is_active: true,
      }).select();

      const ayId = years?.[0]?.id;
      if (ayId) {
        const { data: sems } = await supabase.from("semesters").insert([
          { academic_year_id: ayId, semester_number: 1, name: "Semester 1 — Fall 2025", start_date: "2025-07-01", end_date: "2025-12-15", is_active: true },
          { academic_year_id: ayId, semester_number: 2, name: "Semester 2 — Spring 2026", start_date: "2026-01-15", end_date: "2026-06-30", is_active: false },
        ]).select();
        semId = sems?.[0]?.id ?? null;
      }
    } else {
      const { data: activeSem } = await supabase.from("semesters").select("id").eq("is_active", true).limit(1);
      semId = activeSem?.[0]?.id ?? null;
    }

    // Seed courses
    const { data: existingCourses } = await supabase.from("courses").select("id").limit(1);
    let courseId: string | null = null;
    if (!existingCourses || existingCourses.length === 0) {
      const { data: courses } = await supabase.from("courses").insert([
        { department_id: deptCsId, name: "B.Tech Computer Science", code: "BTCS", duration_years: 4 },
        { department_id: deptCsId, name: "M.Tech Computer Science", code: "MTCS", duration_years: 2 },
        { department_id: deptEngId, name: "B.Tech Electronics", code: "BTEC", duration_years: 4 },
      ]).select();
      courseId = courses?.[0]?.id ?? null;
    } else {
      courseId = existingCourses[0].id;
    }

    // Seed subjects
    const { data: existingSubjects } = await supabase.from("subjects").select("id").limit(1);
    let subDataSciId: string | null = null;
    let subAlgoId: string | null = null;
    let subDbId: string | null = null;
    let subAimlId: string | null = null;

    if (!existingSubjects || existingSubjects.length === 0) {
      const { data: subs } = await supabase.from("subjects").insert([
        { name: "Data Structures & Algorithms", code: "CS201", department_id: deptCsId, course_id: courseId, semester_id: semId, credits: 4, description: "Fundamental data structures and algorithm design" },
        { name: "Database Management Systems", code: "CS202", department_id: deptCsId, course_id: courseId, semester_id: semId, credits: 3, description: "Relational databases, SQL, normalization" },
        { name: "Artificial Intelligence & ML", code: "CS301", department_id: deptCsId, course_id: courseId, semester_id: semId, credits: 4, description: "Machine learning, neural networks, AI" },
        { name: "Data Science Foundations", code: "CS302", department_id: deptCsId, course_id: courseId, semester_id: semId, credits: 3, description: "Statistics, data analysis, visualization" },
      ]).select();
      subAlgoId = subs?.[0]?.id ?? null;
      subDbId = subs?.[1]?.id ?? null;
      subAimlId = subs?.[2]?.id ?? null;
      subDataSciId = subs?.[3]?.id ?? null;
    } else {
      const { data: subs } = await supabase.from("subjects").select("id").limit(4);
      subAlgoId = subs?.[0]?.id ?? null;
      subDbId = subs?.[1]?.id ?? null;
      subAimlId = subs?.[2]?.id ?? null;
      subDataSciId = subs?.[3]?.id ?? null;
    }

    // Seed classrooms
    const { data: existingRooms } = await supabase.from("classrooms").select("id").limit(1);
    let roomId: string | null = null;
    if (!existingRooms || existingRooms.length === 0) {
      const { data: rooms } = await supabase.from("classrooms").insert([
        { name: "A-101", building: "Academic Block A", capacity: 60, room_type: "lecture_hall" },
        { name: "B-201", building: "Academic Block B", capacity: 40, room_type: "classroom" },
        { name: "C-Lab-1", building: "CS Lab Wing", capacity: 30, room_type: "lab" },
      ]).select();
      roomId = rooms?.[0]?.id ?? null;
    } else {
      roomId = existingRooms[0].id;
    }

    // Get user IDs by role
    const faculty1 = createdUsers.find((u) => u.email === "faculty@attendx.edu");
    const faculty2 = createdUsers.find((u) => u.email === "faculty2@attendx.edu");
    const students = createdUsers.filter((u) => u.role === "student");

    // Seed faculty assignments
    const { data: existingAssignments } = await supabase.from("faculty_assignments").select("id").limit(1);
    if (!existingAssignments || existingAssignments.length === 0) {
      if (faculty1 && subAlgoId && semId) {
        await supabase.from("faculty_assignments").insert([
          { faculty_id: faculty1.id, subject_id: subAlgoId, semester_id: semId, section: "A" },
          { faculty_id: faculty1.id, subject_id: subAimlId, semester_id: semId, section: "A" },
        ]);
      }
      if (faculty2 && subDbId && semId) {
        await supabase.from("faculty_assignments").insert([
          { faculty_id: faculty2.id, subject_id: subDbId, semester_id: semId, section: "A" },
          { faculty_id: faculty2.id, subject_id: subDataSciId, semester_id: semId, section: "A" },
        ]);
      }
    }

    // Seed enrollments
    const { data: existingEnrollments } = await supabase.from("enrollments").select("id").limit(1);
    if (!existingEnrollments || existingEnrollments.length === 0) {
      if (courseId && semId) {
        const enrollmentRows = students.filter((s) => s.id).map((s, i) => ({
          student_id: s.id,
          course_id: courseId,
          semester_id: semId,
          roll_number: `CS2025-${String(i + 1).padStart(3, "0")}`,
          section: "A",
        }));
        if (enrollmentRows.length > 0) {
          await supabase.from("enrollments").insert(enrollmentRows);
        }
      }
    }

    // Seed schedules
    const { data: existingSchedules } = await supabase.from("schedules").select("id").limit(1);
    if (!existingSchedules || existingSchedules.length === 0) {
      if (faculty1 && subAlgoId && semId) {
        await supabase.from("schedules").insert([
          { subject_id: subAlgoId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId, day_of_week: 1, start_time: "09:00", end_time: "10:30", section: "A" },
          { subject_id: subAlgoId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId, day_of_week: 3, start_time: "09:00", end_time: "10:30", section: "A" },
          { subject_id: subAimlId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId, day_of_week: 2, start_time: "11:00", end_time: "12:30", section: "A" },
          { subject_id: subAimlId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId, day_of_week: 4, start_time: "11:00", end_time: "12:30", section: "A" },
        ]);
      }
      if (faculty2 && subDbId && semId) {
        await supabase.from("schedules").insert([
          { subject_id: subDbId, faculty_id: faculty2.id, classroom_id: roomId, semester_id: semId, day_of_week: 1, start_time: "14:00", end_time: "15:30", section: "A" },
          { subject_id: subDataSciId, faculty_id: faculty2.id, classroom_id: roomId, semester_id: semId, day_of_week: 5, start_time: "10:00", end_time: "11:30", section: "A" },
        ]);
      }
    }

    // Seed some attendance sessions + records
    const { data: existingSessions } = await supabase.from("attendance_sessions").select("id").limit(1);
    if (!existingSessions || existingSessions.length === 0) {
      if (faculty1 && subAlgoId && semId) {
        const token1 = btoa(JSON.stringify({ sid: "seed1", sub: subAlgoId, fac: faculty1.id, ts: Date.now(), nonce: "seed1" }));
        const token2 = btoa(JSON.stringify({ sid: "seed2", sub: subAimlId, fac: faculty1.id, ts: Date.now(), nonce: "seed2" }));

        const { data: sessions } = await supabase.from("attendance_sessions").insert([
          {
            subject_id: subAlgoId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId,
            session_date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
            qr_token: token1, qr_expires_at: new Date(Date.now() - 86400000 * 2 + 300000).toISOString(),
            status: "ended", duration_seconds: 300, section: "A",
            started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            ended_at: new Date(Date.now() - 86400000 * 2 + 300000).toISOString(),
          },
          {
            subject_id: subAimlId, faculty_id: faculty1.id, classroom_id: roomId, semester_id: semId,
            session_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
            qr_token: token2, qr_expires_at: new Date(Date.now() - 86400000 + 300000).toISOString(),
            status: "ended", duration_seconds: 300, section: "A",
            started_at: new Date(Date.now() - 86400000).toISOString(),
            ended_at: new Date(Date.now() - 86400000 + 300000).toISOString(),
          },
        ]).select();

        if (sessions && students.length > 0) {
          const records: Record<string, unknown>[] = [];
          sessions.forEach((session, sIdx) => {
            students.forEach((student, stIdx) => {
              if (!student.id) return;
              const isPresent = (stIdx + sIdx) % 5 !== 0;
              const isLate = (stIdx + sIdx) % 7 === 0;
              records.push({
                session_id: session.id,
                student_id: student.id,
                status: isLate ? "late" : isPresent ? "present" : "absent",
                marked_at: new Date(Date.now() - 86400000 * (2 - sIdx) + 60000 * stIdx).toISOString(),
                marked_method: "qr",
                is_flagged: false,
                faculty_approved: true,
              });
            });
          });
          if (records.length > 0) {
            await supabase.from("attendance_records").insert(records);
          }
        }
      }
    }

    // Seed announcements
    const { data: existingAnnouncements } = await supabase.from("announcements").select("id").limit(1);
    if (!existingAnnouncements || existingAnnouncements.length === 0) {
      if (faculty1) {
        await supabase.from("announcements").insert([
          { title: "Welcome to AttendX", message: "All classes will use QR-based attendance starting this semester. Make sure your profile is complete.", target_audience: "all", created_by: faculty1.id, is_active: true },
          { title: "Mid-term Exam Schedule", message: "Mid-term exams begin next week. Check your timetable for updated class times.", target_audience: "students", created_by: faculty1.id, is_active: true },
        ]);
      }
    }

    // Seed leave requests
    const { data: existingLeaves } = await supabase.from("leave_requests").select("id").limit(1);
    if (!existingLeaves || existingLeaves.length === 0) {
      const student1 = createdUsers.find((u) => u.email === "student@attendx.edu");
      const student2 = createdUsers.find((u) => u.email === "student2@attendx.edu");
      if (student1 && subAlgoId && faculty1) {
        await supabase.from("leave_requests").insert([
          { student_id: student1.id, subject_id: subAlgoId, faculty_id: faculty1.id, start_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0], end_date: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0], reason: "Family function — out of town", status: "pending" },
          { student_id: student2?.id ?? "", subject_id: subDbId, faculty_id: faculty2?.id ?? "", start_date: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0], end_date: new Date(Date.now() - 86400000 * 4).toISOString().split("T")[0], reason: "Medical leave — doctor's appointment", status: "approved", reviewed_by: faculty2?.id ?? null, reviewed_at: new Date(Date.now() - 86400000 * 3).toISOString() },
        ]);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Demo data seeded successfully",
      usersCreated: createdUsers.length,
      users: createdUsers.map((u) => ({ email: u.email, role: u.role })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
