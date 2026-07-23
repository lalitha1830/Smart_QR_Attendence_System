import { useEffect, useState, useCallback } from 'react';
import {
  CalendarDays, Clock, MapPin, User, BookOpen, LayoutGrid,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCard, EmptyState } from '../../components/ui';
import { formatTime, dayName } from '../../lib/utils';
import type { Schedule, Subject, Profile, Classroom } from '../../types';

interface ScheduleWithRelations extends Schedule {
  subject: Subject;
  faculty: Profile;
  classroom: Classroom | null;
}

const DAYS = [1, 2, 3, 4, 5, 6]; // Monday–Saturday
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Stable palette per subject id
const SUBJECT_COLORS = [
  { bg: 'bg-brand-50 dark:bg-brand-600/15', border: 'border-brand-200 dark:border-brand-700/50', text: 'text-brand-700 dark:text-brand-300', dot: 'bg-brand-500' },
  { bg: 'bg-accent-50 dark:bg-accent-600/15', border: 'border-accent-200 dark:border-accent-700/50', text: 'text-accent-700 dark:text-accent-300', dot: 'bg-accent-500' },
  { bg: 'bg-amber-50 dark:bg-amber-600/15', border: 'border-amber-200 dark:border-amber-700/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  { bg: 'bg-violet-50 dark:bg-violet-600/15', border: 'border-violet-200 dark:border-violet-700/50', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  { bg: 'bg-rose-50 dark:bg-rose-600/15', border: 'border-rose-200 dark:border-rose-700/50', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { bg: 'bg-sky-50 dark:bg-sky-600/15', border: 'border-sky-200 dark:border-sky-700/50', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  { bg: 'bg-teal-50 dark:bg-teal-600/15', border: 'border-teal-200 dark:border-teal-700/50', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  { bg: 'bg-indigo-50 dark:bg-indigo-600/15', border: 'border-indigo-200 dark:border-indigo-700/50', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
];

function colorForSubject(subjectId: string): typeof SUBJECT_COLORS[number] {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

export default function StudentTimetable() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 1);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('semester_id, section')
        .eq('student_id', profile.id)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!enrollment) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('schedules')
        .select('*, subject:subjects(*), faculty:profiles(*), classroom:classrooms(*)')
        .eq('semester_id', enrollment.semester_id)
        .eq('section', enrollment.section)
        .in('day_of_week', DAYS)
        .order('day_of_week')
        .order('start_time');

      setSchedules((data as ScheduleWithRelations[]) ?? []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by day
  const byDay = useCallback((day: number) => schedules.filter((s) => s.day_of_week === day), [schedules]);

  // Build time slots from all schedules
  const allTimeSlots = Array.from(new Set(schedules.map((s) => `${s.start_time}-${s.end_time}`))).sort();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timetable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your weekly class schedule</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const todayDow = new Date().getDay();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timetable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your weekly class schedule</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setView('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'week' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'day' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CalendarDays className="h-4 w-4" /> Day
          </button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="No timetable found"
            description="Your weekly timetable will appear here once your admin assigns class schedules to your section. If you believe this is an error, contact your administrator."
          />
        </div>
      ) : view === 'week' ? (
        /* ---------- Week grid view ---------- */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[800px]">
              {/* Day header row */}
              <div className="grid grid-cols-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {DAYS.map((d, i) => {
                  const isToday = todayDow === d;
                  return (
                    <div
                      key={d}
                      className={`px-3 py-3 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${
                        isToday ? 'bg-brand-50 dark:bg-brand-600/10' : ''
                      }`}
                    >
                      <p className={`text-sm font-semibold ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {DAY_LABELS[i]}
                      </p>
                      {isToday && <span className="text-[10px] text-brand-500 font-medium">Today</span>}
                    </div>
                  );
                })}
              </div>

              {/* Schedule rows */}
              {allTimeSlots.length === 0 ? (
                <div className="py-12">
                  <EmptyState icon={CalendarDays} title="Empty timetable" description="No classes scheduled for any day this week." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {allTimeSlots.map((slot) => {
                    const [start, end] = slot.split('-');
                    return (
                      <div key={slot} className="grid grid-cols-6">
                        {DAYS.map((d) => {
                          const cls = byDay(d).find((s) => s.start_time === start && s.end_time === end);
                          if (!cls) {
                            return <div key={d} className="min-h-[80px] border-r border-slate-100 dark:border-slate-700/40 last:border-r-0 p-1.5" />;
                          }
                          const color = colorForSubject(cls.subject.id);
                          const isToday = todayDow === d;
                          return (
                            <div key={d} className={`min-h-[80px] border-r border-slate-100 dark:border-slate-700/40 last:border-r-0 p-1.5 ${isToday ? 'bg-brand-50/30 dark:bg-brand-600/5' : ''}`}>
                              <div className={`h-full rounded-lg border p-2 ${color.bg} ${color.border} ${color.text} flex flex-col`}>
                                <p className="text-xs font-bold leading-tight line-clamp-2">{cls.subject.name}</p>
                                <p className="text-[10px] mt-1 flex items-center gap-0.5 opacity-80">
                                  <User className="h-2.5 w-2.5" /> {cls.faculty.full_name.split(' ').slice(-1)[0]}
                                </p>
                                {cls.classroom && (
                                  <p className="text-[10px] flex items-center gap-0.5 opacity-80 mt-0.5">
                                    <MapPin className="h-2.5 w-2.5" /> {cls.classroom.name}
                                  </p>
                                )}
                                <p className="text-[10px] mt-auto pt-1 font-semibold opacity-70">
                                  {formatTime(start)} - {formatTime(end)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ---------- Day list view ---------- */
        <div className="space-y-4">
          {/* Day selector */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-thin pb-1">
            {DAYS.map((d, i) => {
              const isToday = todayDow === d;
              const isSelected = selectedDay === d;
              const count = byDay(d).length;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border min-w-[80px] transition-all flex-shrink-0 ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15 dark:border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-sm font-bold">{DAY_LABELS[i]}</span>
                  <span className="text-[10px]">{dayName(d)}</span>
                  {isToday && <span className="text-[9px] text-accent-500 font-semibold">TODAY</span>}
                  {count > 0 && <span className={`text-[10px] mt-0.5 px-1.5 rounded-full ${isSelected ? 'bg-brand-100 dark:bg-brand-600/30' : 'bg-slate-100 dark:bg-slate-700'}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Selected day classes */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="h-5 w-5 text-brand-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">{dayName(selectedDay)}</h3>
              <span className="text-xs text-slate-400">{byDay(selectedDay).length} class{byDay(selectedDay).length !== 1 ? 'es' : ''}</span>
            </div>

            {byDay(selectedDay).length === 0 ? (
              <EmptyState icon={CalendarDays} title="No classes on this day" description="Pick another day to view its schedule." />
            ) : (
              <div className="space-y-3">
                {byDay(selectedDay)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((s) => {
                    const color = colorForSubject(s.subject.id);
                    return (
                      <div key={s.id} className={`flex items-stretch gap-3 rounded-xl border p-4 ${color.bg} ${color.border}`}>
                        {/* Time column */}
                        <div className="flex flex-col items-center justify-center flex-shrink-0 w-20 py-2 rounded-lg bg-white/60 dark:bg-slate-800/40">
                          <span className={`text-sm font-bold ${color.text}`}>{formatTime(s.start_time)}</span>
                          <span className="text-[10px] text-slate-400 my-0.5">to</span>
                          <span className={`text-sm font-bold ${color.text}`}>{formatTime(s.end_time)}</span>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className={`h-3 w-3 rounded-full ${color.dot} mt-1 flex-shrink-0`} />
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{s.subject.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.subject.code}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" /> {s.faculty.full_name}
                            </span>
                            {s.classroom && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" /> {s.classroom.name}
                                {s.classroom.building && <span className="text-slate-400">· {s.classroom.building}</span>}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> {s.subject.credits} credits
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend of subjects */}
      {schedules.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-500" /> Subjects this semester
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Map(schedules.map((s) => [s.subject.id, s.subject])).values()).map((subj) => {
              const color = colorForSubject(subj.id);
              return (
                <span key={subj.id} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${color.bg} ${color.text}`}>
                  <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                  {subj.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
