import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Building2, DoorOpen, Users } from 'lucide-react';
import { useClassrooms } from '../../hooks/useData';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Modal, EmptyState, LoadingSpinner } from '../../components/ui';
import type { Classroom } from '../../types';

interface FormState {
  name: string;
  building: string;
  capacity: number;
  room_type: string;
}

const emptyForm: FormState = { name: '', building: '', capacity: 60, room_type: 'lecture_hall' };

const ROOM_TYPES = [
  { value: 'lecture_hall', label: 'Lecture Hall' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'seminar_room', label: 'Seminar Room' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'virtual', label: 'Virtual' },
];

const roomTypeLabel = (v: string) => ROOM_TYPES.find((r) => r.value === v)?.label ?? v;

export default function AdminClassrooms() {
  const { data: classrooms, loading, refetch } = useClassrooms();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Classroom | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.building ?? '').toLowerCase().includes(q) ||
        roomTypeLabel(c.room_type).toLowerCase().includes(q),
    );
  }, [classrooms, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (room: Classroom) => {
    setEditing(room);
    setForm({
      name: room.name,
      building: room.building ?? '',
      capacity: room.capacity ?? 60,
      room_type: room.room_type,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Room name is required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      building: form.building.trim() || null,
      capacity: Number(form.capacity) || null,
      room_type: form.room_type,
    };
    const { error } = editing
      ? await supabase.from('classrooms').update(payload).eq('id', editing.id)
      : await supabase.from('classrooms').insert(payload);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editing ? 'Classroom updated' : 'Classroom created', 'success');
    setModalOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('classrooms').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Classroom deleted', 'success');
    setDeleteTarget(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Classrooms</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage lecture halls, labs and rooms</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Classroom</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, building or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Card grid for classrooms */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="No classrooms found"
            description={search ? 'Try a different search term.' : 'Create your first classroom to get started.'}
            action={!search && <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Classroom</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((room) => (
            <div key={room.id} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
                    <DoorOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{room.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{room.building ?? 'No building'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(room)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(room)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <span className="badge-info">{roomTypeLabel(room.room_type)}</span>
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Users className="h-3.5 w-3.5" /> {room.capacity ?? '—'} seats
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Classroom' : 'Add Classroom'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Room Name</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A-101" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Building</label>
              <input type="text" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="e.g. Block A" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Room Type</label>
            <select value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="input-field">
              {ROOM_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Classroom" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex-shrink-0"><Trash2 className="h-5 w-5" /></div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Delete <span className="font-semibold">{deleteTarget?.name}</span>?</p>
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
