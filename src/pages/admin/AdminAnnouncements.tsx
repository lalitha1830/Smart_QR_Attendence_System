import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Megaphone, Bell } from 'lucide-react';
import { useAnnouncements, useDepartments } from '../../hooks/useData';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDateTime, truncate } from '../../lib/utils';
import type { Announcement, TargetAudience } from '../../types';

interface FormState {
  title: string;
  message: string;
  target_audience: TargetAudience;
  target_department_id: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  title: '', message: '', target_audience: 'all', target_department_id: '', is_active: true,
};

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'All Students' },
  { value: 'faculty', label: 'All Faculty' },
  { value: 'department', label: 'Specific Department' },
  { value: 'section', label: 'Specific Section' },
];

const audienceLabel = (v: TargetAudience) => AUDIENCE_OPTIONS.find((a) => a.value === v)?.label ?? v;

type AnnouncementRow = Announcement & {
  creator?: { full_name: string } | null;
  department?: { name: string } | null;
};

export default function AdminAnnouncements() {
  const { data: announcements, loading, refetch } = useAnnouncements();
  const { data: departments } = useDepartments();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return announcements as AnnouncementRow[];
    return (announcements as AnnouncementRow[]).filter(
      (a) => a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q),
    );
  }, [announcements, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditing(ann);
    setForm({
      title: ann.title,
      message: ann.message,
      target_audience: ann.target_audience,
      target_department_id: ann.target_department_id ?? '',
      is_active: ann.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      toast('Title and message are required', 'error');
      return;
    }
    setSaving(true);
    const needsDept = form.target_audience === 'department';
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      target_audience: form.target_audience,
      target_department_id: needsDept ? form.target_department_id || null : null,
      is_active: form.is_active,
      created_by: profile?.id,
    };
    const { error } = editing
      ? await supabase.from('announcements').update({
          title: payload.title,
          message: payload.message,
          target_audience: payload.target_audience,
          target_department_id: payload.target_department_id,
          is_active: payload.is_active,
        }).eq('id', editing.id)
      : await supabase.from('announcements').insert(payload);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editing ? 'Announcement updated' : 'Announcement published', 'success');
    setModalOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('announcements').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Announcement deleted', 'success');
    setDeleteTarget(null);
    refetch();
  };

  const toggleActive = async (ann: Announcement) => {
    const { error } = await supabase.from('announcements').update({ is_active: !ann.is_active }).eq('id', ann.id);
    if (error) { toast(error.message, 'error'); return; }
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Broadcast messages to students and faculty</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> New Announcement</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by title or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Announcement cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Megaphone} title="No announcements" description={search ? 'Try a different search.' : 'Publish your first announcement.'} action={!search && <Button onClick={openAdd}><Plus className="h-4 w-4" /> New Announcement</Button>} />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ann) => (
            <div key={ann.id} className="card p-5 group">
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 ${ann.is_active ? 'bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{ann.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDateTime(ann.created_at)} · by {ann.creator?.full_name ?? 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => openEdit(ann)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(ann)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{truncate(ann.message, 200)}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge-info">{audienceLabel(ann.target_audience)}</span>
                    {ann.target_department_id && (
                      <span className="badge-neutral">{ann.department?.name ?? deptMap.get(ann.target_department_id) ?? 'Department'}</span>
                    )}
                    <button onClick={() => toggleActive(ann)} className="ml-auto text-xs font-medium">
                      {ann.is_active ? <span className="badge-success">Active</span> : <span className="badge-neutral">Inactive</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Announcement' : 'New Announcement'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
            <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mid-term exam schedule" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Message</label>
            <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your announcement…" rows={4} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Target Audience</label>
              <select value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value as TargetAudience, target_department_id: '' })} className="input-field">
                {AUDIENCE_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            {form.target_audience === 'department' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
                <select value={form.target_department_id} onChange={(e) => setForm({ ...form, target_department_id: e.target.value })} className="input-field" required>
                  <option value="">Select department…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Active (visible to users)</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Publish'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Announcement" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Delete <span className="font-semibold">{deleteTarget?.title}</span>?</p>
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
