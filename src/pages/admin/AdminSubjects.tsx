import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, BookOpen } from 'lucide-react';
import { useSubjects, useDepartments, useCourses, useAcademicYears, useSemesters } from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, EmptyState, LoadingSpinner } from '../../components/ui';
import type { Subject } from '../../types';

interface FormState {
  name: string;
  code: string;
  department_id: string;
  course_id: string;
  semester_id: string;
  credits: number;
  description: string;
}

const emptyForm: FormState = {
  name: '', code: '', department_id: '', course_id: '', semester_id: '', credits: 3, description: '',
};

type SubjectWithDept = Subject & { departments?: { name: string } | null };

export default function AdminSubjects() {
  const { data: subjects, loading, refetch } = useSubjects();
  const { data: departments } = useDepartments();
  const { data: allCourses } = useCourses();
  const { data: academicYears } = useAcademicYears();
  const { data: allSemesters } = useSemesters();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects as SubjectWithDept[];
    return (subjects as SubjectWithDept[]).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.departments?.name ?? '').toLowerCase().includes(q),
    );
  }, [subjects, search]);

  // Courses filtered by selected department in the form
  const formCourses = useMemo(
    () => (form.department_id ? allCourses.filter((c) => c.department_id === form.department_id) : []),
    [allCourses, form.department_id],
  );

  // Semesters joined with their academic year label for display
  const semesterOptions = useMemo(() => {
    const yearMap = new Map(academicYears.map((y) => [y.id, y.year_label]));
    return allSemesters.map((s) => ({
      id: s.id,
      label: `Sem ${s.semester_number} — ${s.name} (${yearMap.get(s.academic_year_id) ?? '?'})`,
    }));
  }, [allSemesters, academicYears]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, department_id: departments[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (subj: Subject) => {
    setEditing(subj);
    setForm({
      name: subj.name,
      code: subj.code,
      department_id: subj.department_id,
      course_id: subj.course_id ?? '',
      semester_id: subj.semester_id ?? '',
      credits: subj.credits,
      description: subj.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.department_id) {
      toast('Name, code and department are required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      department_id: form.department_id,
      course_id: form.course_id || null,
      semester_id: form.semester_id || null,
      credits: Number(form.credits) || 3,
      description: form.description.trim() || null,
    };
    const { error } = editing
      ? await supabase.from('subjects').update(payload).eq('id', editing.id)
      : await supabase.from('subjects').insert(payload);
    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(editing ? 'Subject updated' : 'Subject created', 'success');
    setModalOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('subjects').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Subject deleted', 'success');
    setDeleteTarget(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subjects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage subjects taught in the institution</p>
        </div>
        <Button onClick={openAdd} disabled={departments.length === 0}>
          <Plus className="h-4 w-4" /> Add Subject
        </Button>
      </div>

      {departments.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          You need to create a department before adding subjects.
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, code or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No subjects found"
            description={search ? 'Try a different search term.' : 'Create your first subject to get started.'}
            action={!search && departments.length > 0 && <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Subject</Button>}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Credits</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((subj) => (
                  <tr key={subj.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 flex-shrink-0">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{subj.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="badge-info">{subj.code}</span></td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {subj.departments?.name ?? deptMap.get(subj.department_id) ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{subj.credits}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(subj)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(subj)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Subject' : 'Add Subject'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Data Structures" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Code</label>
              <input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CS201" className="input-field uppercase" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value, course_id: '' })}
              className="input-field"
              required
            >
              <option value="">Select department…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course <span className="text-slate-400 font-normal">(optional)</span></label>
              <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="input-field" disabled={formCourses.length === 0}>
                <option value="">{formCourses.length === 0 ? 'No courses for department' : 'Select course…'}</option>
                {formCourses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester <span className="text-slate-400 font-normal">(optional)</span></label>
              <select value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })} className="input-field" disabled={semesterOptions.length === 0}>
                <option value="">{semesterOptions.length === 0 ? 'No semesters defined' : 'Select semester…'}</option>
                {semesterOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Credits</label>
              <input type="number" min={1} max={10} required value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description…" rows={3} className="input-field resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Subject" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
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
