import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Utensils, Info } from 'lucide-react';
import type { MedicineSchedule } from '../types';

interface ScheduleCardProps {
  schedule: MedicineSchedule;
  onTake: (scheduleId: number) => void;
  onMiss: (scheduleId: number) => void;
  loadingId?: number | null;
  highContrast?: boolean;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onTake,
  onMiss,
  loadingId,
  highContrast = false,
}) => {
  const medicine = schedule.medicine;
  const isDue = schedule.status === 'due';
  const isUpcoming = schedule.status === 'upcoming' || schedule.status === 'pending';
  const isTaken = schedule.status === 'taken';
  const isMissed = schedule.status === 'missed';
  const isPendingOrDue = isDue || isUpcoming;
  const isLoading = loadingId === schedule.id;

  // Format 24-hr time e.g. "08:00" to "8:00 AM"
  const formatTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHour = h % 12 || 12;
      return `${formattedHour}:${m < 10 ? '0' : ''}${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const foodInstructionLabel = (foodTag?: string) => {
    switch (foodTag) {
      case 'before_food':
        return 'Before Meals (Empty Stomach)';
      case 'after_food':
        return 'After Meals (With or Post Food)';
      case 'with_food':
        return 'Take with Food / Meals';
      default:
        return 'No Food Restrictions';
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 p-6 transition shadow-sm ${
        isDue
          ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
          : isTaken
          ? highContrast
            ? 'bg-zinc-950 border-emerald-400 text-white'
            : 'bg-emerald-50/60 border-emerald-200'
          : isMissed
          ? highContrast
            ? 'bg-zinc-950 border-rose-500 text-white'
            : 'bg-rose-50/60 border-rose-200'
          : highContrast
          ? 'bg-zinc-900 border-white text-white'
          : 'bg-white border-slate-200 hover:border-sky-300'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Scheduled Time & Medicine Info */}
        <div className="space-y-2">
          {/* Time Badge & Status Pill */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-lg ${
                isDue
                  ? 'bg-amber-500 text-white'
                  : isTaken
                  ? 'bg-emerald-600 text-white'
                  : isMissed
                  ? 'bg-rose-600 text-white'
                  : 'bg-sky-700 text-white'
              }`}
            >
              <Clock className="w-5 h-5" />
              {formatTime(schedule.scheduled_time)}
            </span>

            {/* Food Instruction Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-300">
              <Utensils className="w-4 h-4 text-amber-700" />
              {foodInstructionLabel(medicine?.before_after_food)}
            </span>

            {/* Status indicator */}
            {isDue && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-amber-500 text-white animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                DUE NOW
              </span>
            )}

            {isTaken && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold bg-emerald-200 text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                Taken Confirmed
              </span>
            )}

            {isMissed && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold bg-rose-200 text-rose-950">
                <AlertCircle className="w-4 h-4 text-rose-800" />
                Missed - Alert Sent
              </span>
            )}
          </div>

          {/* Medicine Name & Dosage */}
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {medicine?.name || 'Medication'}
            </h3>
            <p className="text-lg font-bold text-sky-800 dark:text-sky-300 mt-0.5">
              Dosage: {medicine?.dosage} • {medicine?.frequency}
            </p>
          </div>

          {/* Instructions */}
          {medicine?.instructions && (
            <div className="flex items-start gap-2 pt-1 text-slate-700 dark:text-slate-300 text-base">
              <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-snug">{medicine.instructions}</p>
            </div>
          )}
        </div>

        {/* Right Side: Action Buttons (Large, high-contrast, easy to tap) */}
        <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
          {isPendingOrDue ? (
            <>
              <button
                disabled={isLoading}
                onClick={() => onTake(schedule.id)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-md transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>{isLoading ? 'Updating...' : 'MARK AS TAKEN'}</span>
              </button>

              <button
                disabled={isLoading}
                onClick={() => onMiss(schedule.id)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-base transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <AlertCircle className="w-5 h-5 text-rose-700" />
                <span>Missed</span>
              </button>
            </>
          ) : isTaken ? (
            <div className="px-5 py-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              <span>Dose Completed</span>
            </div>
          ) : (
            <div className="px-5 py-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-bold text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-700" />
              <span>Caregiver Contacted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
