import React, { useState, useEffect, useRef } from 'react';
import type { MedicineSchedule } from '../types';
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Utensils, 
  Volume2, 
  VolumeX, 
  AlertTriangle,
  FileText
} from 'lucide-react';

interface DueMedicineBannerProps {
  dueSchedules: MedicineSchedule[];
  patientName: string;
  onTakeDose: (scheduleId: number, notes?: string) => Promise<void>;
  onMissDose: (scheduleId: number, notes?: string) => Promise<void>;
}

export const DueMedicineBanner: React.FC<DueMedicineBannerProps> = ({
  dueSchedules,
  patientName,
  onTakeDose,
  onMissDose,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const playedForRef = useRef<Set<number>>(new Set());

  // Web Audio API Chime generator
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1 (C5 - 523.25 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2 (E5 - 659.25 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);
    } catch {
      // Audio context might be restricted before first user interaction
    }
  };

  useEffect(() => {
    if (dueSchedules.length > 0) {
      const current = dueSchedules[activeIdx] || dueSchedules[0];
      if (current && !playedForRef.current.has(current.id)) {
        playChime();
        playedForRef.current.add(current.id);
      }
    }
  }, [dueSchedules, activeIdx, soundEnabled]);

  if (dueSchedules.length === 0) {
    return null;
  }

  const currentSchedule = dueSchedules[activeIdx] || dueSchedules[0];
  const medicine = currentSchedule.medicine;

  const handleTake = async () => {
    setIsProcessing(true);
    try {
      await onTakeDose(currentSchedule.id, notes.trim() || undefined);
      setNotes('');
      setShowNotes(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMiss = async () => {
    setIsProcessing(true);
    try {
      await onMissDose(currentSchedule.id, notes.trim() || undefined);
      setNotes('');
      setShowNotes(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFoodInstruction = (food?: string) => {
    switch (food) {
      case 'before_food':
        return 'Before Food (Empty Stomach)';
      case 'after_food':
        return 'After Food / Meals';
      case 'with_food':
        return 'Take With Food or Meals';
      default:
        return 'No specific food constraints';
    }
  };

  return (
    <div className="mb-6 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border-2 border-amber-500 shadow-xl overflow-hidden animate-pulse-border">
      {/* Header bar */}
      <div className="bg-amber-500 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/20 rounded-lg animate-bounce">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              MEDICINE DUE NOW — TIME FOR YOUR MEDICATION!
            </h2>
            <p className="text-xs text-amber-100 font-medium">
              Reminder for <span className="underline font-semibold">{patientName}</span>
              {dueSchedules.length > 1 && ` • Dose ${activeIdx + 1} of ${dueSchedules.length} due`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dueSchedules.length > 1 && (
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs font-semibold">
              {dueSchedules.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    idx === activeIdx ? 'bg-white text-amber-700 font-bold' : 'text-white hover:bg-white/30'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            title={soundEnabled ? 'Mute reminder chime' : 'Enable reminder chime'}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-amber-200" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Medicine Details - Large and Readable for Elders */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {medicine?.name || 'Scheduled Medicine'}
              </h3>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-200 text-sm font-bold rounded-full border border-amber-500/30">
                {medicine?.medicine_type || 'Tablet'}
              </span>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-bold rounded-full border border-blue-500/20 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Scheduled: {currentSchedule.scheduled_time}
              </span>
            </div>

            <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Dosage: <span className="text-amber-700 dark:text-amber-400 font-bold">{medicine?.dosage || '1 dose'}</span>
            </div>

            {/* Instruction details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <Utensils className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{formatFoodInstruction(medicine?.before_after_food)}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="truncate">{medicine?.instructions || 'Take as prescribed with warm water.'}</span>
              </div>
            </div>

            {medicine?.additional_notes && (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Note: {medicine.additional_notes}
              </p>
            )}

            {/* Optional note toggler */}
            <div className="mt-3">
              {!showNotes ? (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  + Add patient note (e.g., taken with juice)
                </button>
              ) : (
                <div className="mt-2">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter any notes (optional)..."
                    className="w-full max-w-md px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - Massive & Accessible for Elderly */}
          <div className="flex flex-col sm:flex-row gap-3 min-w-[320px]">
            <button
              onClick={handleTake}
              disabled={isProcessing}
              className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-lg sm:text-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
              <span>I HAVE TAKEN THIS</span>
            </button>

            <button
              onClick={handleMiss}
              disabled={isProcessing}
              className="py-4 px-5 bg-rose-100 hover:bg-rose-200 active:scale-98 text-rose-800 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-200 border-2 border-rose-300 dark:border-rose-800 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-6 h-6 flex-shrink-0 text-rose-600" />
              <span>MISSED</span>
            </button>
          </div>
        </div>

        {/* Live Grace Period notice */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-medium">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            Automatic Caregiver Alert grace period is active. If not confirmed, your caregiver will be notified automatically.
          </span>
          <span className="font-bold underline cursor-pointer" onClick={playChime}>
            Replay Bell Chime 🔔
          </span>
        </div>
      </div>
    </div>
  );
};
