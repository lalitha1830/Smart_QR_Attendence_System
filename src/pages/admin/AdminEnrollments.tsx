import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, ClipboardList, UserCog } from 'lucide-react';
import {
  useEnrollments, useFacultyAssignments, useProfiles, useCourses, useSemesters, useSubjects,
} from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, Avatar, EmptyState, LoadingSpinner } from '../../components/ui';
import type { Enrollment, FacultyAssignment } from '../../types';

type Tab = 'enrollments' | 'assignments';

/* ---------- Enrollment form ---------- */
interface EnrFormState {
  student_id: string;
  course_id: string;
  semester_id: string;
  roll_number: string;
  section: string;
}
const emptyEnrForm: EnrFormState = { student_id: '', course_id: '', semester_id: '', roll_number: '', section: 'A' };

/* ---------- Assignment form ---------- */
interface AssignFormState {
  faculty_id: string;
  subject_id: string;
  semester_id: string;
  section: string;
}
const emptyAssignForm: AssignFormState = { faculty_id: '', subject_id: '', semester_id: '', section: 'A' };

export default function AdminEnrollments() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('enrollments');

  // Data hooks
  const { data: enrollments, loading: enrLoading, refetch: refetchEnr } = useEnrollments();
  const { data: assignments, loading: assignLoading, refetch: refetchAssign } = useFacultyAssignments();
  const { data: students } = useProfiles('student');
  const { data: faculty } = useProfiles('faculty');
  const { data: courses } = useCourses();
  const { data: semesters } = useSemesters();
  const { data: subjects } = useSubjects();

  const [search, setSearch] = useState('');

  // Enrollment modal
  const [enrModal, setEnrModal] = useState(false);
  const [editingEnr, setEditingEnr] = useState<Enrollment | null>(null);
  const [enrForm, setEnrForm] = useState<EnrFormState>(emptyEnrForm);
  const [enrSaving, setEnrSaving] = useState(false);
  const [enrDeleteTarget, setEnrDeleteTarget] = useState<Enrollment | null>(null);
  const [enrDeleting, setEnrDeleting] = useState(false);

  // Assignment modal
  const [assignModal, setAssignModal] = useState(false);
  const [editingAssign, setEditingAssign] = useState<FacultyAssignment | null>(null);
  const [assignForm, setAssignForm] = useState<AssignFormState>(emptyAssignForm);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignDeleteTarget, setAssignDeleteTarget] = useState<FacultyAssignment | null>(null);
  const [assignDeleting, setAssignDeleting] = useState(false);

  // Lookup maps
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const facultyMap = useMemo(() => new Map(faculty.map((f) => [f.id, f])), [faculty]);
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const semesterMap = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const filteredEnrollments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) => {
      const name = e.student?.full_name ?? studentMap.get(e.student_id)?.full_name ?? '';
      const course = e.course?.name ?? courseMap.get(e.course_id)?.name ?? '';
      return name.toLowerCase().includes(q) || course.toLowerCase().includes(q) || (e.roll_number ?? '').toLowerCase().includes(q);
    });
  }, [enrollments, search, studentMap, courseMap]);

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const name = a.faculty?.full_name ?? facultyMap.get(a.faculty_id)?.full_name ?? '';
      const subj = a.subject?.name ?? subjectMap.get(a.subject_id)?.name ?? '';
      return name.toLowerCase().includes(q) || subj.toLowerCase().includes(q);
    });
  }, [assignments, search, facultyMap, subjectMap]);

  /* ---------- Enrollment handlers ---------- */
  const openAddEnr = () => {
    setEditingEnr(null);
    setEnrForm({ ...emptyEnrForm, section: 'A' });
    setEnrModal(true);
  };
  const openEditEnr = (enr: Enrollment) => {
    setEditingEnr(enr);
    setEnrForm({
      student_id: enr.student_id,
      course_id: enr.course_id,
      semester_id: enr.semester_id,
      roll_number: enr.roll_number ?? '',
      section: enr.section,
    });
    setEnrModal(true);
  };
  const handleSaveEnr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrForm.student_id || !enrForm.course_id || !enrForm.semester_id) {
      toast('Student, course and semester are required', 'error');
      return;
    }
    setEnrSaving(true);
    const payload = {
      student_id: enrForm.student_id,
      course_id: enrForm.course_id,
      semester_id: enrForm.semester_id,
      roll_number: enrForm.roll_number.trim() || null,
      section: enrForm.section.trim() || 'A',
    };
    const { error } = editingEnr
      ? await supabase.from('enrollments').update(payload).eq('id', editingEnr.id)
      : await supabase.from('enrollments').insert(payload);
    setEnrSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editingEnr ? 'Enrollment updated' : 'Enrollment created', 'success');
    setEnrModal(false);
    refetchEnr();
  };
  const handleDeleteEnr = async () => {
    if (!enrDeleteTarget) return;
    setEnrDeleting(true);
    const { error } = await supabase.from('enrollments').delete().eq('id', enrDeleteTarget.id);
    setEnrDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Enrollment removed', 'success');
    setEnrDeleteTarget(null);
    refetchEnr();
  };

  /* ---------- Assignment handlers ---------- */
  const openAddAssign = () => {
    setEditingAssign(null);
    setAssignForm({ ...emptyAssignForm, section: 'A' });
    setAssignModal(true);
  };
  const openEditAssign = (a: FacultyAssignment) => {
    setEditingAssign(a);
    setAssignForm({
      faculty_id: a.faculty_id,
      subject_id: a.subject_id,
      semester_id: a.semester_id ?? '',
      section: a.section,
    });
    setAssignModal(true);
  };
  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.faculty_id || !assignForm.subject_id) {
      toast('Faculty and subject are required', 'error');
      return;
    }
    setAssignSaving(true);
    const payload = {
      faculty_id: assignForm.faculty_id,
      subject_id: assignForm.subject_id,
      semester_id: assignForm.semester_id || null,
      section: assignForm.section.trim() || 'A',
    };
    const { error } = editingAssign
      ? await supabase.from('faculty_assignments').update(payload).eq('id', editingAssign.id)
      : await supabase.from('faculty_assignments').insert(payload);
    setAssignSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editingAssign ? 'Assignment updated' : 'Assignment created', 'success');
    setAssignModal(false);
    refetchAssign();
  };
  const handleDeleteAssign = async () => {
    if (!assignDeleteTarget) return;
    setAssignDeleting(true);
    const { error } = await supabase.from('faculty_assignments').delete().eq('id', assignDeleteTarget.id);
    setAssignDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Assignment removed', 'success');
    setAssignDeleteTarget(null);
    refetchAssign();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enrollments & Assignments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage student enrollments and faculty subject assignments</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-fit">
        <button
          onClick={() => setTab('enrollments')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'enrollments' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          <ClipboardList className="h-4 w-4" /> Enrollments
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'assignments' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          <UserCog className="h-4 w-4" /> Faculty Assignments
        </button>
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={tab === 'enrollments' ? 'Search by student, course or roll number…' : 'Search by faculty or subject…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <Button onClick={tab === 'enrollments' ? openAddEnr : openAddAssign}>
          <Plus className="h-4 w-4" /> {tab === 'enrollments' ? 'Add Enrollment' : 'Add Assignment'}
        </Button>
      </div>

      {/* Content */}
      {tab === 'enrollments' ? (
        <div className="card overflow-hidden">
          {enrLoading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
          ) : filteredEnrollments.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No enrollments" description={search ? 'Try a different search.' : 'Add your first student enrollment.'} />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Semester</th>
                    <th className="px-6 py-3">Roll No.</th>
                    <th className="px-6 py-3">Section</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredEnrollments.map((enr) => {
                    const student = enr.student ?? studentMap.get(enr.student_id);
                    return (
                      <tr key={enr.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={student?.full_name ?? '?'} src={student?.avatar_url} size={36} />
                            <span className="font-medium text-slate-800 dark:text-slate-200">{student?.full_name ?? 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{enr.course?.name ?? courseMap.get(enr.course_id)?.name ?? '—'}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{enr.semester?.name ?? semesterMap.get(enr.semester_id)?.name ?? '—'}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{enr.roll_number ?? '—'}</td>
                        <td className="px-6 py-4"><span className="badge-info">{enr.section}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditEnr(enr)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEnrDeleteTarget(enr)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {assignLoading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
          ) : filteredAssignments.length === 0 ? (
            <EmptyState icon={UserCog} title="No assignments" description={search ? 'Try a different search.' : 'Assign a subject to a faculty member.'} />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Faculty</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Semester</th>
                    <th className="px-6 py-3">Section</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredAssignments.map((a) => {
                    const fac = a.faculty ?? facultyMap.get(a.faculty_id);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={fac?.full_name ?? '?'} src={fac?.avatar_url} size={36} />
                            <span className="font-medium text-slate-800 dark:text-slate-200">{fac?.full_name ?? 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.subject?.name ?? subjectMap.get(a.subject_id)?.name ?? '—'}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.semester?.name ?? '—'}</td>
                        <td className="px-6 py-4"><span className="badge-info">{a.section}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditAssign(a)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setAssignDeleteTarget(a)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enrollment modal */}
      <Modal open={enrModal} onClose={() => setEnrModal(false)} title={editingEnr ? 'Edit Enrollment' : 'Add Enrollment'} size="lg">
        <form onSubmit={handleSaveEnr} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Student</label>
            <select value={enrForm.student_id} onChange={(e) => setEnrForm({ ...enrForm, student_id: e.target.value })} className="input-field" required>
              <option value="">Select student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course</label>
              <select value={enrForm.course_id} onChange={(e) => setEnrForm({ ...enrForm, course_id: e.target.value })} className="input-field" required>
                <option value="">Select course…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester</label>
              <select value={enrForm.semester_id} onChange={(e) => setEnrForm({ ...enrForm, semester_id: e.target.value })} className="input-field" required>
                <option value="">Select semester…</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>Sem {s.semester_number} — {s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Roll Number</label>
              <input type="text" value={enrForm.roll_number} onChange={(e) => setEnrForm({ ...enrForm, roll_number: e.target.value })} placeholder="e.g. 2025CS001" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Section</label>
              <input type="text" value={enrForm.section} onChange={(e) => setEnrForm({ ...enrForm, section: e.target.value })} placeholder="e.g. A" className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEnrModal(false)}>Cancel</Button>
            <Button type="submit" loading={enrSaving}>{editingEnr ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assignment modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={editingAssign ? 'Edit Assignment' : 'Add Assignment'} size="lg">
        <form onSubmit={handleSaveAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Faculty</label>
            <select value={assignForm.faculty_id} onChange={(e) => setAssignForm({ ...assignForm, faculty_id: e.target.value })} className="input-field" required>
              <option value="">Select faculty…</option>
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name} ({f.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
            <select value={assignForm.subject_id} onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })} className="input-field" required>
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester <span className="text-slate-400 font-normal">(optional)</span></label>
              <select value={assignForm.semester_id} onChange={(e) => setAssignForm({ ...assignForm, semester_id: e.target.value })} className="input-field">
                <option value="">No specific semester</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>Sem {s.semester_number} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Section</label>
              <input type="text" value={assignForm.section} onChange={(e) => setAssignForm({ ...assignForm, section: e.target.value })} placeholder="e.g. A" className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button type="submit" loading={assignSaving}>{editingAssign ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete enrollment */}
      <Modal open={!!enrDeleteTarget} onClose={() => setEnrDeleteTarget(null)} title="Remove Enrollment" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Remove this enrollment?</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEnrDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={enrDeleting} onClick={handleDeleteEnr}>Remove</Button>
          </div>
        </div>
      </Modal>

      {/* Delete assignment */}
      <Modal open={!!assignDeleteTarget} onClose={() => setAssignDeleteTarget(null)} title="Remove Assignment" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Remove this faculty assignment?</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAssignDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={assignDeleting} onClick={handleDeleteAssign}>Remove</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
