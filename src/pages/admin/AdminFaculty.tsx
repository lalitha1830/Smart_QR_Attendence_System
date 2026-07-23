import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Users, BookOpen } from 'lucide-react';
import { useProfiles, useDepartments } from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, Avatar, EmptyState, LoadingSpinner } from '../../components/ui';
import type { Profile } from '../../types';

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  department_id: string;
  is_active: boolean;
}

const emptyForm: FormState = { full_name: '', email: '', phone: '', department_id: '', is_active: true };

type FacultyProfile = Profile & { department?: { name: string } | null };

export default function AdminFaculty() {
  const { data: profiles, loading, refetch } = useProfiles('faculty');
  const { data: departments } = useDepartments();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);

  // Fetch subject assignment counts for each faculty member
  const fetchCounts = useCallback(async () => {
    const { data } = await supabase.from('faculty_assignments').select('faculty_id');
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r: { faculty_id: string }) => {
      counts[r.faculty_id] = (counts[r.faculty_id] ?? 0) + 1;
    });
    setSubjectCounts(counts);
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (profiles as FacultyProfile[]).filter((p) => {
      const matchesSearch = !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchesDept = !deptFilter || p.department_id === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [profiles, search, deptFilter]);

  const openEdit = (faculty: Profile) => {
    setEditing(faculty);
    setForm({
      full_name: faculty.full_name,
      email: faculty.email,
      phone: faculty.phone ?? '',
      department_id: faculty.department_id ?? '',
      is_active: faculty.is_active,
    });
    setModalOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, department_id: departments[0]?.id ?? '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast('Name and email are required', 'error');
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        department_id: form.department_id || null,
        is_active: form.is_active,
      }).eq('id', editing.id);
      setSaving(false);
      if (error) { toast(error.message, 'error'); return; }
      toast('Faculty updated', 'success');
    } else {
      toast('New faculty accounts must be created via Supabase Auth. Only existing profiles can be edited here.', 'warning');
      setSaving(false);
      setModalOpen(false);
      return;
    }
    setModalOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Faculty profile removed', 'success');
    setDeleteTarget(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Faculty</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage faculty members</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Faculty</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input-field sm:w-56">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No faculty found"
            description={search || deptFilter ? 'Try adjusting your filters.' : 'Faculty profiles will appear here.'}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Faculty</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Subjects</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((faculty) => (
                  <tr key={faculty.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={faculty.full_name} src={faculty.avatar_url} size={40} />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{faculty.full_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{faculty.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {faculty.department?.name ?? deptMap.get(faculty.department_id ?? '') ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        {subjectCounts[faculty.id] ?? 0} assigned
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {faculty.is_active ? <span className="badge-success">Active</span> : <span className="badge-neutral">Inactive</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(faculty)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(faculty)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove">
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

      {/* Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Faculty' : 'Add Faculty'}>
        {editing ? (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 px-4 py-3 mb-4 flex items-center gap-3">
            <Avatar name={editing.full_name} src={editing.avatar_url} size={36} />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Editing profile for <span className="font-medium text-slate-700 dark:text-slate-300">{editing.email}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 mb-4 text-xs text-amber-700 dark:text-amber-300">
            To add new faculty, create their auth account first via Supabase, then edit their profile here.
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" disabled={!editing} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="input-field">
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Active account</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Faculty" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Remove <span className="font-semibold">{deleteTarget?.full_name}</span>'s profile?
              The auth account will remain.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Remove</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
