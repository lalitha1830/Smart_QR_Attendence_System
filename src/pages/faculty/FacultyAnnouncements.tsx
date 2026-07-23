import { useEffect, useState, useCallback } from 'react';
import {
  Megaphone, Plus, Send, Trash2, Edit3, X, Save, Users, GraduationCap,
  Building2, Globe, BookOpen, Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Button, EmptyState, Modal,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { Announcement, TargetAudience, Profile } from '../../types';

type MyAnnouncement = Announcement & { creator: Profile };

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Everyone', icon: Globe },
  { value: 'students', label: 'Students', icon: GraduationCap },
  { value: 'faculty', label: 'Faculty', icon: Users },
  { value: 'section', label: 'Specific Section', icon: BookOpen },
  { value: 'department', label: 'Department', icon: Building2 },
];

const audienceBadge: Record<TargetAudience, string> = {
  all: 'badge-info',
  students: 'badge-success',
  faculty: 'badge-warning',
  section: 'badge-neutral',
  department: 'badge-neutral',
};

function audienceLabel(a: TargetAudience): string {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a;
}

export default function FacultyAnnouncements() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const facultyId = profile?.id ?? '';

  const [announcements, setAnnouncements] = useState<MyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MyAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<TargetAudience>('all');

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*, creator:profiles!created_by(*)')
      .eq('created_by', facultyId)
      .order('created_at', { ascending: false });
    if (error) toast('Failed to load announcements', 'error');
    setAnnouncements((data as MyAnnouncement[]) ?? []);
    setLoading(false);
  }, [facultyId, toast]);

  useEffect(() => { if (facultyId) fetchAnnouncements(); }, [facultyId, fetchAnnouncements]);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setAudience('all');
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (a: MyAnnouncement) => {
    setEditing(a);
    setTitle(a.title);
    setMessage(a.message);
    setAudience(a.target_audience);
    setModalOpen(true);
  };

  const save = async () => {
    if (!title.trim() || !message.trim()) {
      toast('Title and message are required', 'warning');
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('announcements')
        .update({ title, message, target_audience: audience })
        .eq('id', editing.id);
      if (error) toast('Failed to update announcement', 'error');
      else {
        toast('Announcement updated', 'success');
        setModalOpen(false);
        resetForm();
        await fetchAnnouncements();
      }
    } else {
      const { error } = await supabase.from('announcements').insert({
        title,
        message,
        target_audience: audience,
        created_by: facultyId,
        is_active: true,
      });
      if (error) toast('Failed to create announcement', 'error');
      else {
        toast('Announcement published', 'success');
        setModalOpen(false);
        resetForm();
        await fetchAnnouncements();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (a: MyAnnouncement) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !a.is_active })
      .eq('id', a.id);
    if (error) toast('Failed to update status', 'error');
    else {
      toast(a.is_active ? 'Announcement archived' : 'Announcement reactivated', 'info');
      await fetchAnnouncements();
    }
  };

  const remove = async (a: MyAnnouncement) => {
    setDeleting(a.id);
    const { error } = await supabase.from('announcements').delete().eq('id', a.id);
    if (error) toast('Failed to delete announcement', 'error');
    else {
      toast('Announcement deleted', 'success');
      await fetchAnnouncements();
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create and manage announcements for students and faculty.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Create your first announcement to broadcast to students or faculty."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create Announcement
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a, idx) => {
            const AudIcon = AUDIENCE_OPTIONS.find((o) => o.value === a.target_audience)?.icon ?? Globe;
            return (
              <div
                key={a.id}
                className="card p-5 animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${a.is_active ? 'bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">{a.title}</h3>
                        <span className={audienceBadge[a.target_audience]}>
                          <AudIcon className="h-3 w-3" /> {audienceLabel(a.target_audience)}
                        </span>
                        {!a.is_active && <span className="badge badge-neutral">Archived</span>}
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {a.message}
                      </p>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="h-3.5 w-3.5" /> {formatDateTime(a.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/50">
                  <Button variant="ghost" className="px-2.5 text-xs" onClick={() => openEdit(a)}>
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" className="px-2.5 text-xs" onClick={() => toggleActive(a)}>
                    {a.is_active ? 'Archive' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-600/15 ml-auto"
                    loading={deleting === a.id}
                    onClick={() => remove(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Class rescheduled for tomorrow"
              className="input-field"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement…"
              rows={5}
              className="input-field resize-none"
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-slate-400">{message.length}/1000</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Target Audience
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((o) => {
                const active = audience === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAudience(o.value)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300 ring-2 ring-brand-500/20'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <o.icon className="h-4 w-4" /> {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setModalOpen(false); resetForm(); }}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button className="flex-1" loading={saving} onClick={save}>
              {editing ? <><Save className="h-4 w-4" /> Save</> : <><Send className="h-4 w-4" /> Publish</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
