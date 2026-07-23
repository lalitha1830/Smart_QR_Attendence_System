import { useEffect, useState, useCallback } from 'react';
import {
  UserCircle, Mail, Phone, Building2, Shield, Save, Lock, Eye, EyeOff,
  CheckCircle2, Camera, CalendarDays, BadgeCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Avatar, SkeletonCard } from '../../components/ui';
import { formatDate } from '../../lib/utils';
import type { Department } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  faculty: 'Faculty Member',
  student: 'Student',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'badge-info',
  faculty: 'badge-success',
  student: 'badge-warning',
};

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [department, setDepartment] = useState<Department | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setFullName(profile.full_name);
    setPhone(profile.phone ?? '');
    setAvatarUrl(profile.avatar_url ?? '');

    // Fetch department
    if (profile.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('*')
        .eq('id', profile.department_id)
        .maybeSingle();
      setDepartment(dept as Department | null);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!fullName.trim()) {
      toast('Full name cannot be empty.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast('Profile updated successfully!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      toast(message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('Please fill in all password fields.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      toast('New password must be at least 6 characters.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match.', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        toast('Current password is incorrect.', 'error');
        setSavingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password.';
      toast(message, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account information</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile summary card */}
        <div className="space-y-6">
          <div className="card p-6 text-center">
            {/* Avatar */}
            <div className="relative inline-block">
              <Avatar name={profile.full_name} src={profile.avatar_url} size={96} />
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white dark:ring-slate-800">
                <Camera className="h-4 w-4" />
              </div>
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{profile.full_name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>

            <div className="mt-3 flex justify-center">
              <span className={ROLE_COLORS[profile.role] ?? 'badge-neutral'}>
                <BadgeCheck className="h-3.5 w-3.5" /> {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>

            {/* Info list */}
            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex-shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-slate-400 font-medium">Email</p>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex-shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-slate-400 font-medium">Phone</p>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{profile.phone || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex-shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-slate-400 font-medium">Department</p>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{department?.name ?? 'Not assigned'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex-shrink-0">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-slate-400 font-medium">Member Since</p>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{formatDate(profile.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex-shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-slate-400 font-medium">Status</p>
                  <p className="flex items-center gap-1 text-accent-600 dark:text-accent-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {profile.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit profile */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Edit Information</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Update your personal details</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="input-field pl-10 opacity-60 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed. Contact admin if needed.</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Avatar URL</label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="input-field pl-10"
                  />
                </div>
                {avatarUrl && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-accent-500" /> Preview will show after saving.
                  </p>
                )}
              </div>

              <Button type="submit" loading={savingProfile} className="w-full sm:w-auto">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </form>
          </div>

          {/* Change password */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-600/10 text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Change Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Keep your account secure</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10 pr-10"
                  />
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="input-field pl-10 pr-10"
                  />
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                )}
              </div>

              <Button type="submit" loading={savingPassword} variant="secondary" className="w-full sm:w-auto">
                <Shield className="h-4 w-4" /> Update Password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
