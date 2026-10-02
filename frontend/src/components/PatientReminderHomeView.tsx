import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  ShieldCheck,
  Check,
  X as XIcon,
  Bell,
  Coffee,
  Utensils,
  AlertTriangle,
} from 'lucide-react';
import type { PatientHomeScreenData } from '../types';
import { ApiService } from '../services/api';

interface PatientReminderHomeViewProps {
  patientId: number;
  onNavigateToNotifications?: () => void;
  highContrast?: boolean;
  fontSize?: 'normal' | 'large' | 'xl';
}

export const PatientReminderHomeView: React.FC<PatientReminderHomeViewProps> = ({
  patientId,
  onNavigateToNotifications,
  highContrast = false,
  fontSize = 'normal',
}) => {
  const [data, setData] = useState<PatientHomeScreenData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Live clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Play audio chime if active reminder exists
  const playChime = () => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // AudioContext fallback
    }
  };

  // Load Patient Reminder Home Data
  const loadHomeData = async () => {
    setLoading(true);
    try {
      const result = await ApiService.getPatientReminderHome(patientId);
      setData(result);
      if (result.active_reminder && result.active_reminder.status === 'due') {
        playChime();
      }
    } catch (err: any) {
      console.error('Failed to load patient reminder home:', err);
      showToast(`Error: ${err.message || 'Failed to load medication schedule.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
    // Auto-refresh every 12 seconds to detect upcoming/due transitions in real-time
    const interval = setInterval(loadHomeData, 12000);
    return () => clearInterval(interval);
  }, [patientId]);

  // Handle Dose Action (TAKE or MISSED)
  const handleDoseAction = async (scheduleId: number, action: 'taken' | 'missed') => {
    if (actionLoadingId) return; // Prevent duplicate rapid clicks
    setActionLoadingId(scheduleId);
    try {
      const notes = action === 'taken' ? 'Confirmed taken by patient on home screen' : 'Marked missed by patient';
      await ApiService.recordScheduleAction(scheduleId, action, notes);
      
      showToast(
        action === 'taken'
          ? '✓ Great job! Medicine recorded as TAKEN.'
          : '⚠️ Medicine marked as MISSED. Your caregiver has been alerted.'
      );

      // Immediately refresh home screen data
      await loadHomeData();
    } catch (err: any) {
      console.error('Action error:', err);
      showToast(`Action failed: ${err.message || 'Please try again.'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Font size multiplier classes
  const fontSizes = {
    normal: {
      title: 'text-2xl sm:text-3xl',
      headline: 'text-3xl sm:text-4xl',
      subhead: 'text-lg sm:text-xl',
      body: 'text-base sm:text-lg',
      button: 'text-lg sm:text-xl',
    },
    large: {
      title: 'text-3xl sm:text-4xl',
      headline: 'text-4xl sm:text-5xl',
      subhead: 'text-xl sm:text-2xl',
      body: 'text-lg sm:text-xl',
      button: 'text-xl sm:text-2xl',
    },
    xl: {
      title: 'text-4xl sm:text-5xl',
      headline: 'text-5xl sm:text-6xl',
      subhead: 'text-2xl sm:text-3xl',
      body: 'text-xl sm:text-2xl',
      button: 'text-2xl sm:text-3xl',
    },
  }[fontSize];

  // Helper for before/after food badge
  const renderFoodBadge = (instruction?: string) => {
    if (!instruction) return null;
    const lower = instruction.toLowerCase();
    if (lower.includes('before')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black bg-amber-100 text-amber-900 border border-amber-300">
          <Utensils className="w-4 h-4" /> Before Food
        </span>
      );
    }
    if (lower.includes('after')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black bg-blue-100 text-blue-900 border border-blue-300">
          <Coffee className="w-4 h-4" /> After Food
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black bg-slate-100 text-slate-800 border border-slate-300">
        <Utensils className="w-4 h-4" /> {instruction}
      </span>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-12 h-12 text-teal-600 animate-spin" />
        <p className="text-xl font-bold text-slate-600">Loading your medicine schedule...</p>
      </div>
    );
  }

  const activeReminder = data?.active_reminder;
  const nextMedicine = data?.next_medicine;

  return (
    <div className={`space-y-6 sm:space-y-8 pb-12 ${highContrast ? 'contrast-125' : ''}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-6 py-4 rounded-3xl bg-slate-950 text-white shadow-2xl flex items-center gap-3 border-2 border-slate-700 animate-slide-up max-w-md">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <span className="text-base font-bold">{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER: Patient Name, Live Digital Clock & Quick Controls */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-4 h-4" /> Patient Medication Home
            </span>
            {data && data.unread_notifications_count > 0 && onNavigateToNotifications && (
              <button
                onClick={onNavigateToNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-rose-600 text-white animate-pulse"
              >
                <Bell className="w-3.5 h-3.5" /> {data.unread_notifications_count} New Messages
              </button>
            )}
          </div>

          <h1 className={`${fontSizes.headline} font-black text-slate-900 tracking-tight`}>
            Good Day, {data?.patient_name || 'Margaret'}!
          </h1>
          <p className={`${fontSizes.body} font-bold text-slate-500`}>
            Here is your simple medicine schedule for today.
          </p>
        </div>

        {/* Live Big Clock & Date Card */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 sm:p-5 rounded-3xl border-2 border-slate-200 self-start md:self-center">
          <div className="p-3.5 rounded-2xl bg-sky-100 text-sky-700">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-600 mt-0.5">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Sound Alert Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`ml-2 p-2.5 rounded-2xl border transition ${
              audioEnabled ? 'bg-sky-600 text-white border-sky-700' : 'bg-slate-200 text-slate-500 border-slate-300'
            }`}
            title={audioEnabled ? 'Sound Alerts On' : 'Sound Alerts Off'}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ACTIVE REMINDER SECTION: Triggered when a medicine is DUE NOW */}
      {activeReminder && activeReminder.status === 'due' && (
        <div className="p-6 sm:p-10 rounded-3xl bg-amber-50 border-4 border-amber-400 shadow-xl space-y-6 relative overflow-hidden animate-pulse-border">
          {/* Top Banner Tag */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500 text-white font-black text-sm sm:text-base tracking-wider uppercase shadow-sm">
              <AlertTriangle className="w-5 h-5" />
              Time To Take Your Medicine Now
            </div>
            <span className="text-sm sm:text-base font-black text-amber-900">
              Scheduled: {activeReminder.scheduled_time}
            </span>
          </div>

          {/* Medicine Details Hero Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-300 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-400">
                  Prescription Medicine
                </div>
                <h2 className={`${fontSizes.headline} font-black text-slate-900`}>
                  {activeReminder.medicine?.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap text-base sm:text-lg font-bold text-slate-700">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-300">
                    Dosage: {activeReminder.medicine?.dosage}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-300">
                    Type: {activeReminder.medicine?.medicine_type || 'Tablet'}
                  </span>
                  {renderFoodBadge(activeReminder.medicine?.before_after_food)}
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-amber-100 text-amber-800 text-center sm:text-right">
                <div className="text-xs font-black uppercase">Scheduled Time</div>
                <div className="text-2xl sm:text-3xl font-black">{activeReminder.scheduled_time}</div>
              </div>
            </div>

            {/* Clear Elderly Instructions */}
            {activeReminder.medicine?.instructions && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="text-xs font-black uppercase text-amber-900">Special Instructions:</div>
                <div className={`${fontSizes.body} font-bold text-amber-950 mt-1`}>
                  "{activeReminder.medicine.instructions}"
                </div>
              </div>
            )}
          </div>

          {/* LARGE INTERACTIVE BUTTONS: TAKE MEDICINE & MISSED */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-2">
            {/* BIG GREEN TAKE MEDICINE BUTTON */}
            <button
              onClick={() => handleDoseAction(activeReminder.id, 'taken')}
              disabled={actionLoadingId === activeReminder.id}
              className={`w-full min-h-[72px] sm:min-h-[84px] px-8 py-5 rounded-3xl font-black ${fontSizes.button} text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition shadow-lg hover:shadow-xl flex items-center justify-center gap-4 border-2 border-emerald-700`}
            >
              {actionLoadingId === activeReminder.id ? (
                <RefreshCw className="w-8 h-8 animate-spin" />
              ) : (
                <Check className="w-8 h-8 stroke-[3]" />
              )}
              <span>TAKE MEDICINE</span>
            </button>

            {/* BIG AMBER/RED MISSED BUTTON */}
            <button
              onClick={() => handleDoseAction(activeReminder.id, 'missed')}
              disabled={actionLoadingId === activeReminder.id}
              className={`w-full min-h-[72px] sm:min-h-[84px] px-8 py-5 rounded-3xl font-black ${fontSizes.button} text-slate-800 bg-rose-100 hover:bg-rose-200 active:scale-98 transition shadow flex items-center justify-center gap-4 border-2 border-rose-300`}
            >
              <XIcon className="w-8 h-8 text-rose-600 stroke-[3]" />
              <span>MISSED THIS DOSE</span>
            </button>
          </div>
        </div>
      )}

      {/* UPCOMING NEXT MEDICINE HERO CARD (When no dose is due now) */}
      {(!activeReminder || activeReminder.status !== 'due') && nextMedicine && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-sky-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-900 font-black text-xs sm:text-sm uppercase tracking-wider border border-sky-300">
              <Clock className="w-4 h-4 text-sky-600" />
              Your Next Medicine
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-500">
              Scheduled for Today
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className={`${fontSizes.headline} font-black text-slate-900`}>
                {nextMedicine.medicine?.name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base font-bold text-slate-600">
                <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
                  {nextMedicine.medicine?.dosage}
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
                  {nextMedicine.medicine?.medicine_type || 'Tablet'}
                </span>
                {renderFoodBadge(nextMedicine.medicine?.before_after_food)}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-sky-50 border border-sky-200 text-center sm:text-right">
              <div className="text-xs font-black uppercase text-sky-800">Scheduled At</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{nextMedicine.scheduled_time}</div>
            </div>
          </div>

          {nextMedicine.medicine?.instructions && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700">
              <strong>Instructions:</strong> {nextMedicine.medicine.instructions}
            </div>
          )}

          {/* Quick Pre-confirmation buttons if user wants to take now */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleDoseAction(nextMedicine.id, 'taken')}
              disabled={actionLoadingId === nextMedicine.id}
              className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg shadow-sm transition flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> Take Ahead of Time
            </button>
            <button
              onClick={() => handleDoseAction(nextMedicine.id, 'missed')}
              disabled={actionLoadingId === nextMedicine.id}
              className="py-4 px-6 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-sm sm:text-base transition"
            >
              Mark as Missed
            </button>
          </div>
        </div>
      )}

      {/* TODAY'S CHRONOLOGICAL SCHEDULE SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`${fontSizes.title} font-black text-slate-900`}>
              Today's Complete Schedule ({data?.today_schedules.length || 0} Doses)
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Chronological order of all your medicines for today.
            </p>
          </div>

          {/* Progress summary pill */}
          {data && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border-2 border-slate-200 text-xs sm:text-sm font-bold shadow-sm">
              <span className="text-emerald-700">{data.today_taken} Taken</span>
              <span>•</span>
              <span className="text-rose-700">{data.today_missed} Missed</span>
              <span>•</span>
              <span className="text-slate-500">{data.today_pending} Remaining</span>
            </div>
          )}
        </div>

        {/* Schedule List */}
        <div className="space-y-4">
          {(data?.today_schedules || []).length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border-2 border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <div className="text-lg font-black text-slate-800">No medicines scheduled for today!</div>
              <p className="text-sm font-semibold text-slate-500 mt-1">Enjoy your day and stay hydrated.</p>
            </div>
          ) : (
            data?.today_schedules.map((schedule) => {
              const isDue = schedule.status === 'due';
              const isTaken = schedule.status === 'taken';
              const isMissed = schedule.status === 'missed';

              return (
                <div
                  key={schedule.id}
                  className={`p-5 sm:p-6 rounded-3xl border-2 transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDue
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300'
                      : isTaken
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : isMissed
                      ? 'bg-rose-50/50 border-rose-300 opacity-90'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Left: Time & Medicine Info */}
                  <div className="flex items-start gap-4">
                    {/* Time Badge */}
                    <div className={`p-3.5 rounded-2xl text-center min-w-[90px] ${
                      isDue
                        ? 'bg-amber-500 text-white font-black'
                        : isTaken
                        ? 'bg-emerald-600 text-white font-black'
                        : isMissed
                        ? 'bg-rose-600 text-white font-black'
                        : 'bg-slate-100 text-slate-800 font-bold border border-slate-200'
                    }`}>
                      <div className="text-sm sm:text-base">{schedule.scheduled_time}</div>
                      <div className="text-[10px] font-black uppercase mt-0.5">
                        {isDue ? 'DUE NOW' : schedule.status}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${fontSizes.title} font-black text-slate-900`}>
                          {schedule.medicine?.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700">
                          {schedule.medicine?.dosage}
                        </span>
                        {renderFoodBadge(schedule.medicine?.before_after_food)}
                      </div>

                      {schedule.medicine?.instructions && (
                        <div className="text-xs sm:text-sm font-semibold text-slate-600">
                          {schedule.medicine.instructions}
                        </div>
                      )}

                      {/* Taken Timestamp */}
                      {isTaken && schedule.taken_at && (
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Taken at {new Date(schedule.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}

                      {/* Missed Warning */}
                      {isMissed && (
                        <div className="text-xs font-bold text-rose-800 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          Missed dose • Caregiver notified
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    {isTaken ? (
                      <span className="px-5 py-2.5 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Completed
                      </span>
                    ) : isMissed ? (
                      <span className="px-5 py-2.5 rounded-2xl bg-rose-100 text-rose-800 border border-rose-300 font-black text-sm flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-600" /> Missed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleDoseAction(schedule.id, 'taken')}
                          disabled={actionLoadingId === schedule.id}
                          className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base shadow-sm transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          TAKE MEDICINE
                        </button>
                        <button
                          onClick={() => handleDoseAction(schedule.id, 'missed')}
                          disabled={actionLoadingId === schedule.id}
                          className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-bold text-sm transition"
                        >
                          MISSED
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
