import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, CalendarRange, CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { useAcademicYears, useSemesters } from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate } from '../../lib/utils';
import type { AcademicYear, Semester } from '../../types';

/* ---------- Year form ---------- */
interface YearFormState {
  year_label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}
const emptyYearForm: YearFormState = { year_label: '', start_date: '', end_date: '', is_active: true };

/* ---------- Semester form ---------- */
interface SemFormState {
  academic_year_id: string;
  semester_number: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}
const emptySemForm: SemFormState = {
  academic_year_id: '', semester_number: 1, name: '', start_date: '', end_date: '', is_active: true,
};

export default function AdminAcademic() {
  const { data: years, loading: yearsLoading, refetch: refetchYears } = useAcademicYears();
  const { data: semesters, loading: semLoading, refetch: refetchSemesters } = useSemesters();
  const { toast } = useToast();

  // Year modal state
  const [yearModal, setYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearForm, setYearForm] = useState<YearFormState>(emptyYearForm);
  const [yearSaving, setYearSaving] = useState(false);
  const [yearDeleteTarget, setYearDeleteTarget] = useState<AcademicYear | null>(null);
  const [yearDeleting, setYearDeleting] = useState(false);

  // Semester modal state
  const [semModal, setSemModal] = useState(false);
  const [editingSem, setEditingSem] = useState<Semester | null>(null);
  const [semForm, setSemForm] = useState<SemFormState>(emptySemForm);
  const [semSaving, setSemSaving] = useState(false);
  const [semDeleteTarget, setSemDeleteTarget] = useState<Semester | null>(null);
  const [semDeleting, setSemDeleting] = useState(false);

  const yearMap = useMemo(() => new Map(years.map((y) => [y.id, y.year_label])), [years]);

  /* ---------- Year handlers ---------- */
  const openAddYear = () => {
    setEditingYear(null);
    setYearForm(emptyYearForm);
    setYearModal(true);
  };
  const openEditYear = (y: AcademicYear) => {
    setEditingYear(y);
    setYearForm({ year_label: y.year_label, start_date: y.start_date, end_date: y.end_date, is_active: y.is_active });
    setYearModal(true);
  };
  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearForm.year_label.trim() || !yearForm.start_date || !yearForm.end_date) {
      toast('All fields are required', 'error');
      return;
    }
    if (yearForm.end_date < yearForm.start_date) {
      toast('End date must be after start date', 'error');
      return;
    }
    setYearSaving(true);
    const payload = {
      year_label: yearForm.year_label.trim(),
      start_date: yearForm.start_date,
      end_date: yearForm.end_date,
      is_active: yearForm.is_active,
    };
    const { error } = editingYear
      ? await supabase.from('academic_years').update(payload).eq('id', editingYear.id)
      : await supabase.from('academic_years').insert(payload);
    setYearSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editingYear ? 'Academic year updated' : 'Academic year created', 'success');
    setYearModal(false);
    refetchYears();
  };
  const handleDeleteYear = async () => {
    if (!yearDeleteTarget) return;
    setYearDeleting(true);
    const { error } = await supabase.from('academic_years').delete().eq('id', yearDeleteTarget.id);
    setYearDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Academic year deleted', 'success');
    setYearDeleteTarget(null);
    refetchYears();
    refetchSemesters();
  };
  const toggleYearActive = async (y: AcademicYear) => {
    const { error } = await supabase.from('academic_years').update({ is_active: !y.is_active }).eq('id', y.id);
    if (error) { toast(error.message, 'error'); return; }
    refetchYears();
  };

  /* ---------- Semester handlers ---------- */
  const openAddSem = () => {
    setEditingSem(null);
    setSemForm({ ...emptySemForm, academic_year_id: years[0]?.id ?? '' });
    setSemModal(true);
  };
  const openEditSem = (s: Semester) => {
    setEditingSem(s);
    setSemForm({
      academic_year_id: s.academic_year_id,
      semester_number: s.semester_number,
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      is_active: s.is_active,
    });
    setSemModal(true);
  };
  const handleSaveSem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semForm.academic_year_id || !semForm.name.trim() || !semForm.start_date || !semForm.end_date) {
      toast('All fields are required', 'error');
      return;
    }
    if (semForm.end_date < semForm.start_date) {
      toast('End date must be after start date', 'error');
      return;
    }
    setSemSaving(true);
    const payload = {
      academic_year_id: semForm.academic_year_id,
      semester_number: Number(semForm.semester_number) || 1,
      name: semForm.name.trim(),
      start_date: semForm.start_date,
      end_date: semForm.end_date,
      is_active: semForm.is_active,
    };
    const { error } = editingSem
      ? await supabase.from('semesters').update(payload).eq('id', editingSem.id)
      : await supabase.from('semesters').insert(payload);
    setSemSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editingSem ? 'Semester updated' : 'Semester created', 'success');
    setSemModal(false);
    refetchSemesters();
  };
  const handleDeleteSem = async () => {
    if (!semDeleteTarget) return;
    setSemDeleting(true);
    const { error } = await supabase.from('semesters').delete().eq('id', semDeleteTarget.id);
    setSemDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Semester deleted', 'success');
    setSemDeleteTarget(null);
    refetchSemesters();
  };
  const toggleSemActive = async (s: Semester) => {
    const { error } = await supabase.from('semesters').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) { toast(error.message, 'error'); return; }
    refetchSemesters();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Academic Structure</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage academic years and semesters</p>
      </div>

      {/* Academic Years */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Academic Years</h2>
            <span className="badge-neutral">{years.length}</span>
          </div>
          <Button onClick={openAddYear}><Plus className="h-4 w-4" /> Add Year</Button>
        </div>

        <div className="card overflow-hidden">
          {yearsLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size={28} /></div>
          ) : years.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No academic years" description="Create your first academic year." action={<Button onClick={openAddYear}><Plus className="h-4 w-4" /> Add Year</Button>} />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Year Label</th>
                    <th className="px-6 py-3">Start</th>
                    <th className="px-6 py-3">End</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {years.map((y) => (
                    <tr key={y.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{y.year_label}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(y.start_date)}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(y.end_date)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleYearActive(y)} className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors">
                          {y.is_active ? (
                            <><CheckCircle2 className="h-4 w-4 text-accent-500" /><span className="badge-success">Active</span></>
                          ) : (
                            <><Circle className="h-4 w-4 text-slate-400" /><span className="badge-neutral">Inactive</span></>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditYear(y)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setYearDeleteTarget(y)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
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
      </section>

      {/* Semesters */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Semesters</h2>
            <span className="badge-neutral">{semesters.length}</span>
          </div>
          <Button onClick={openAddSem} disabled={years.length === 0}><Plus className="h-4 w-4" /> Add Semester</Button>
        </div>

        {years.length === 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Create an academic year before adding semesters.
          </div>
        )}

        <div className="card overflow-hidden">
          {semLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size={28} /></div>
          ) : semesters.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No semesters" description="Create your first semester." action={years.length > 0 && <Button onClick={openAddSem}><Plus className="h-4 w-4" /> Add Semester</Button>} />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Semester</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Start</th>
                    <th className="px-6 py-3">End</th>
                    <th className="px-6 py-3">Academic Year</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {semesters.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4"><span className="badge-info">Sem {s.semester_number}</span></td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(s.start_date)}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(s.end_date)}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{yearMap.get(s.academic_year_id) ?? '—'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSemActive(s)} className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors">
                          {s.is_active ? (
                            <><CheckCircle2 className="h-4 w-4 text-accent-500" /><span className="badge-success">Active</span></>
                          ) : (
                            <><Circle className="h-4 w-4 text-slate-400" /><span className="badge-neutral">Inactive</span></>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditSem(s)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setSemDeleteTarget(s)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
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
      </section>

      {/* Year modal */}
      <Modal open={yearModal} onClose={() => setYearModal(false)} title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}>
        <form onSubmit={handleSaveYear} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Year Label</label>
            <input type="text" required value={yearForm.year_label} onChange={(e) => setYearForm({ ...yearForm, year_label: e.target.value })} placeholder="e.g. 2025-2026" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
              <input type="date" required value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
              <input type="date" required value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={yearForm.is_active} onChange={(e) => setYearForm({ ...yearForm, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setYearModal(false)}>Cancel</Button>
            <Button type="submit" loading={yearSaving}>{editingYear ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Semester modal */}
      <Modal open={semModal} onClose={() => setSemModal(false)} title={editingSem ? 'Edit Semester' : 'Add Semester'}>
        <form onSubmit={handleSaveSem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Academic Year</label>
            <select value={semForm.academic_year_id} onChange={(e) => setSemForm({ ...semForm, academic_year_id: e.target.value })} className="input-field" required>
              <option value="">Select year…</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester Number</label>
              <input type="number" min={1} max={12} required value={semForm.semester_number} onChange={(e) => setSemForm({ ...semForm, semester_number: Number(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
              <input type="text" required value={semForm.name} onChange={(e) => setSemForm({ ...semForm, name: e.target.value })} placeholder="e.g. Fall 2025" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
              <input type="date" required value={semForm.start_date} onChange={(e) => setSemForm({ ...semForm, start_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
              <input type="date" required value={semForm.end_date} onChange={(e) => setSemForm({ ...semForm, end_date: e.target.value })} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={semForm.is_active} onChange={(e) => setSemForm({ ...semForm, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSemModal(false)}>Cancel</Button>
            <Button type="submit" loading={semSaving}>{editingSem ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete year confirm */}
      <Modal open={!!yearDeleteTarget} onClose={() => setYearDeleteTarget(null)} title="Delete Academic Year" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Delete <span className="font-semibold">{yearDeleteTarget?.year_label}</span>? All semesters within it will also be removed.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setYearDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={yearDeleting} onClick={handleDeleteYear}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Delete semester confirm */}
      <Modal open={!!semDeleteTarget} onClose={() => setSemDeleteTarget(null)} title="Delete Semester" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Delete <span className="font-semibold">{semDeleteTarget?.name}</span>?</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setSemDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={semDeleting} onClick={handleDeleteSem}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
