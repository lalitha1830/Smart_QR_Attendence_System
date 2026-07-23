import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, CalendarDays, Clock, DoorOpen } from 'lucide-react';
import {
  useSchedules, useSubjects, useProfiles, useClassrooms, useSemesters,
} from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, Avatar, EmptyState, LoadingSpinner } from '../../components/ui';
import { dayName, formatTime } from '../../lib/utils';
import type { Schedule } from '../../types';

interface FormState {
  subject_id: string;
  faculty_id: string;
  classroom_id: string;
  semester_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string;
}

const emptyForm: FormState = {
  subject_id: '', faculty_id: '', classroom_id: '', semester_id: '',
  day_of_week: 1, start_time: '09:00', end_time: '10:00', section: 'A',
};

type ScheduleWithRels = Schedule & {
  subject?: { name: string; code: string };
  faculty?: { full_name: string; avatar_url: string | null };
  classroom?: { name: string } | null;
  semester?: { name: string };
};

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function AdminSchedules() {
  const { data: schedules, loading, refetch } = useSchedules();
  const { data: subjects } = useSubjects();
  const { data: faculty } = useProfiles('faculty');
  const { data: classrooms } = useClassrooms();
  const { data: semesters } = useSemesters();
  const { toast } = useToast();

  const [dayFilter, setDayFilter] = useState<number | ''>('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const facultyMap = useMemo(() => new Map(faculty.map((f) => [f.id, f])), [faculty]);

  const filtered = useMemo(() => {
    return (schedules as ScheduleWithRels[]).filter((s) => {
      const matchesDay = dayFilter === '' || s.day_of_week === dayFilter;
      const matchesFaculty = !facultyFilter || s.faculty_id === facultyFilter;
      return matchesDay && matchesFaculty;
    });
  }, [schedules, dayFilter, facultyFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: Record<number, ScheduleWithRels[]> = {};
    for (const s of filtered) {
      if (!groups[s.day_of_week]) groups[s.day_of_week] = [];
      groups[s.day_of_week].push(s);
    }
    // Sort each day's entries by start_time
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return groups;
  }, [filtered]);

  const sortedDays = useMemo(() => Object.keys(grouped).map(Number).sort((a, b) => a - b), [grouped]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, semester_id: semesters[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (sched: Schedule) => {
    setEditing(sched);
    setForm({
      subject_id: sched.subject_id,
      faculty_id: sched.faculty_id,
      classroom_id: sched.classroom_id ?? '',
      semester_id: sched.semester_id,
      day_of_week: sched.day_of_week,
      start_time: sched.start_time.slice(0, 5),
      end_time: sched.end_time.slice(0, 5),
      section: sched.section,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject_id || !form.faculty_id || !form.semester_id) {
      toast('Subject, faculty and semester are required', 'error');
      return;
    }
    if (form.end_time <= form.start_time) {
      toast('End time must be after start time', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      subject_id: form.subject_id,
      faculty_id: form.faculty_id,
      classroom_id: form.classroom_id || null,
      semester_id: form.semester_id,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      section: form.section.trim() || 'A',
    };
    const { error } = editing
      ? await supabase.from('schedules').update(payload).eq('id', editing.id)
      : await supabase.from('schedules').insert(payload);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editing ? 'Schedule updated' : 'Schedule created', 'success');
    setModalOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('schedules').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Schedule deleted', 'success');
    setDeleteTarget(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schedules</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage the weekly timetable</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Schedule</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value === '' ? '' : Number(e.target.value))} className="input-field sm:w-48">
          <option value="">All days</option>
          {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)} className="input-field sm:w-56">
          <option value="">All faculty</option>
          {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : sortedDays.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarDays} title="No schedules found" description="Add your first timetable entry to get started." action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Schedule</Button>} />
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map((day) => (
            <div key={day} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-6 py-3 bg-slate-50 dark:bg-slate-800/50">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{dayName(day)}</h3>
                <span className="badge-neutral">{grouped[day].length} class{grouped[day].length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {grouped[day].map((s) => {
                  const fac = s.faculty ?? facultyMap.get(s.faculty_id);
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      {/* Time block */}
                      <div className="flex flex-col items-center justify-center w-20 flex-shrink-0">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatTime(s.start_time)}</span>
                        <Clock className="h-3 w-3 text-slate-300 my-0.5" />
                        <span className="text-xs text-slate-400">{formatTime(s.end_time)}</span>
                      </div>
                      {/* Subject + faculty */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{s.subject?.name ?? 'Unknown'}</span>
                          <span className="badge-info text-[10px]">{s.section}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {fac && (
                            <span className="inline-flex items-center gap-1.5">
                              <Avatar name={fac.full_name} src={fac.avatar_url} size={16} />
                              {fac.full_name}
                            </span>
                          )}
                          {s.classroom && (
                            <span className="inline-flex items-center gap-1">
                              <DoorOpen className="h-3 w-3" /> {s.classroom.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Schedule' : 'Add Schedule'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="input-field" required>
                <option value="">Select subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Faculty</label>
              <select value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })} className="input-field" required>
                <option value="">Select faculty…</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester</label>
              <select value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })} className="input-field" required>
                <option value="">Select semester…</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>Sem {s.semester_number} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Classroom <span className="text-slate-400 font-normal">(optional)</span></label>
              <select value={form.classroom_id} onChange={(e) => setForm({ ...form, classroom_id: e.target.value })} className="input-field">
                <option value="">No classroom</option>
                {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name} {c.building ? `(${c.building})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Day of Week</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="input-field" required>
              {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
              <input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time</label>
              <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Section</label>
              <input type="text" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Schedule" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Delete this timetable entry?</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
