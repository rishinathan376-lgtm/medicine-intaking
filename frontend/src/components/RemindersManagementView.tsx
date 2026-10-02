import React, { useState } from 'react';
import type { MedicineSchedule, CaregiverAlert } from '../types';
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  FastForward, 
  RotateCw, 
  Utensils, 
  Check, 
  Mail, 
  Phone,
  Sparkles,
  Search
} from 'lucide-react';

interface RemindersManagementViewProps {
  schedules: MedicineSchedule[];
  alerts: CaregiverAlert[];
  patientName: string;
  onTakeDose: (scheduleId: number, notes?: string) => Promise<void>;
  onMissDose: (scheduleId: number, notes?: string) => Promise<void>;
  onAcknowledgeAlert: (alertId: number) => Promise<void>;
  onTriggerDue: (scheduleId: number) => Promise<void>;
  onTriggerMissed: (scheduleId: number) => Promise<void>;
  onSimulateTime: (timeStr: string) => Promise<void>;
  onRunSchedulerCheck: () => Promise<void>;
}

export const RemindersManagementView: React.FC<RemindersManagementViewProps> = ({
  schedules,
  alerts,
  patientName,
  onTakeDose,
  onMissDose,
  onAcknowledgeAlert,
  onTriggerDue,
  onTriggerMissed,
  onSimulateTime,
  onRunSchedulerCheck,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'upcoming' | 'taken' | 'missed' | 'alerts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [simTimeInput, setSimTimeInput] = useState('11:00');
  const [isProcessing, setIsProcessing] = useState<number | null>(null);
  const [showSimPanel, setShowSimPanel] = useState(false);

  // Group schedules
  const dueSchedules = schedules.filter(s => s.status === 'due');
  const upcomingSchedules = schedules.filter(s => s.status === 'upcoming' || s.status === 'pending');
  const takenSchedules = schedules.filter(s => s.status === 'taken');
  const missedSchedules = schedules.filter(s => s.status === 'missed');

  // Filtered schedules for current tab
  let displayedSchedules: MedicineSchedule[] = [];
  if (activeTab === 'all') displayedSchedules = schedules;
  else if (activeTab === 'due') displayedSchedules = dueSchedules;
  else if (activeTab === 'upcoming') displayedSchedules = upcomingSchedules;
  else if (activeTab === 'taken') displayedSchedules = takenSchedules;
  else if (activeTab === 'missed') displayedSchedules = missedSchedules;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayedSchedules = displayedSchedules.filter(s => 
      s.medicine?.name.toLowerCase().includes(q) ||
      s.scheduled_time.includes(q) ||
      s.medicine?.dosage.toLowerCase().includes(q)
    );
  }

  const handleTake = async (id: number) => {
    setIsProcessing(id);
    try {
      await onTakeDose(id);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleMiss = async (id: number) => {
    setIsProcessing(id);
    try {
      await onMissDose(id);
    } finally {
      setIsProcessing(null);
    }
  };

  const formatFoodInstruction = (food?: string) => {
    switch (food) {
      case 'before_food':
        return 'Before Food';
      case 'after_food':
        return 'After Food';
      case 'with_food':
        return 'With Food';
      default:
        return 'Anytime';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Simulation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Bell className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Medicine Reminders & Alerts
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Active Patient: <span className="font-bold text-slate-700 dark:text-slate-200">{patientName}</span> • Real-time backend reminder engine
              </p>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onRunSchedulerCheck()}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            Check Scheduler
          </button>

          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            {showSimPanel ? 'Hide Simulation Tools' : 'Fast-Forward & Test Tools'}
          </button>
        </div>
      </div>

      {/* Fast-Forward Simulation Panel */}
      {showSimPanel && (
        <div className="p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-500/30 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Interactive Reminder Simulator & Fast-Forward Bar
              </h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded-md">
              Testing Mode Active
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Test reminders instantly without waiting for the scheduled time. You can make any dose <span className="font-bold underline">Due Now</span> to hear the chime and see the elderly banner, or simulate a specific time like 11:00 AM.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm">
              <span className="text-xs font-semibold text-slate-500">Fast-Forward Time:</span>
              <input
                type="time"
                value={simTimeInput}
                onChange={(e) => setSimTimeInput(e.target.value)}
                className="font-mono font-bold text-sm bg-transparent text-slate-800 dark:text-white outline-none cursor-pointer"
              />
              <button
                onClick={() => onSimulateTime(simTimeInput)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Simulate
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Quick Presets:</span>
              {['08:00', '11:00', '13:00', '14:00', '20:00', '21:00'].map(t => (
                <button
                  key={t}
                  onClick={() => { setSimTimeInput(t); onSimulateTime(t); }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white border border-slate-200 dark:border-slate-700 rounded-md font-mono text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Today's Reminders
            <span className="px-2 py-0.5 rounded-full text-xs bg-white/20">
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('due')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'due'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dueSchedules.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-400'}`} />
            Due Now
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'due' ? 'bg-white/20' : 'bg-amber-500/10 text-amber-600'}`}>
              {dueSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Upcoming
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
              {upcomingSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('taken')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'taken'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Taken
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600">
              {takenSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('missed')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'missed'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Missed
            <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500/10 text-rose-600">
              {missedSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-red-700 text-white shadow-md shadow-red-700/20'
                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Caregiver Alerts
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'alerts' ? 'bg-white/20' : 'bg-red-500/10 text-red-600'}`}>
              {alerts.length}
            </span>
          </button>
        </div>

        {/* Search */}
        {activeTab !== 'alerts' && (
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reminder doses..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* Tab 1-5: Scheduled Doses View */}
      {activeTab !== 'alerts' && (
        <div>
          {displayedSchedules.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Bell className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                No reminders found for this category
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {searchQuery ? 'Try adjusting your search query.' : 'There are currently no scheduled doses matching this status.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSchedules.map((schedule) => {
                const med = schedule.medicine;
                const isDue = schedule.status === 'due';
                const isTaken = schedule.status === 'taken';
                const isMissed = schedule.status === 'missed';

                return (
                  <div
                    key={schedule.id}
                    className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                      isDue
                        ? 'border-2 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20'
                        : isTaken
                        ? 'border-emerald-200 dark:border-emerald-950/60 bg-emerald-500/5'
                        : isMissed
                        ? 'border-rose-200 dark:border-rose-950/60 bg-rose-500/5'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {/* Header: Name, Type, Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {med?.name || 'Medication'}
                          </h3>
                          <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full">
                            {med?.medicine_type || 'Tablet'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                          Dosage: <span className="text-blue-600 dark:text-blue-400">{med?.dosage}</span>
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isDue && (
                          <span className="px-3 py-1 bg-amber-500 text-white text-xs font-black rounded-full flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            DUE NOW
                          </span>
                        )}
                        {isTaken && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            TAKEN
                          </span>
                        )}
                        {isMissed && (
                          <span className="px-3 py-1 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold rounded-full flex items-center gap-1 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            MISSED
                          </span>
                        )}
                        {!isDue && !isTaken && !isMissed && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-full flex items-center gap-1 border border-blue-300 dark:border-blue-800">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            UPCOMING
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scheduled Time & Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>Scheduled: <strong>{schedule.scheduled_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Utensils className="w-4 h-4 text-emerald-500" />
                        <span>Food: <strong>{formatFoodInstruction(med?.before_after_food)}</strong></span>
                      </div>
                    </div>

                    {med?.instructions && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                        <strong>Instructions:</strong> {med.instructions}
                      </p>
                    )}

                    {schedule.taken_at && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-3 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Taken confirmed at: {new Date(schedule.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {/* Action Buttons for elderly */}
                    {!isTaken && !isMissed && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleTake(schedule.id)}
                          disabled={isProcessing === schedule.id}
                          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>TAKEN</span>
                        </button>
                        <button
                          onClick={() => handleMiss(schedule.id)}
                          disabled={isProcessing === schedule.id}
                          className="py-3 px-4 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-300 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5 text-rose-500" />
                          <span>MISSED</span>
                        </button>
                      </div>
                    )}

                    {/* Testing / Fast Forward Quick Triggers */}
                    {showSimPanel && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-amber-500/30 flex items-center justify-between text-xs">
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">Fast Test:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onTriggerDue(schedule.id)}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-800 hover:text-white rounded-md font-bold transition-colors cursor-pointer"
                          >
                            ⚡ Make Due Now
                          </button>
                          <button
                            onClick={() => onTriggerMissed(schedule.id)}
                            className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-800 hover:text-white rounded-md font-bold transition-colors cursor-pointer"
                          >
                            ⚡ Test Missed Alert
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Caregiver Alerts Dedicated Table / Cards */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
              Caregiver alerts are created automatically whenever a medicine is missed or exceeds the configured grace period.
            </span>
            <span className="font-bold">
              Total Alerts: {alerts.length}
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No Missed Medicine Alerts
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                All medications are on schedule and adherence is in good standing.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                    alert.alert_status === 'active'
                      ? 'border-2 border-red-500 shadow-md shadow-red-500/10'
                      : 'border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-xl mt-0.5">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-lg font-black text-slate-900 dark:text-white">
                            {alert.patient_name} — Missed: {alert.medicine_name}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            alert.alert_status === 'active'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {alert.alert_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
                          <div>
                            Scheduled Time: <strong className="text-slate-900 dark:text-white">{alert.scheduled_time}</strong>
                          </div>
                          <div>
                            Missed Recorded: <strong className="text-slate-900 dark:text-white">{new Date(alert.missed_at || alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                          </div>
                          <div>
                            Status: <strong className="text-rose-600 dark:text-rose-400 capitalize">{alert.status}</strong>
                          </div>
                        </div>

                        {/* Caregiver info */}
                        <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Caregiver: {alert.caregiver_name || 'Assigned Caregiver'}
                          </span>
                          {alert.caregiver_email && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Mail className="w-3.5 h-3.5" />
                              {alert.caregiver_email} (Alert Dispatched)
                            </span>
                          )}
                          {alert.caregiver_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {alert.caregiver_phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acknowledge Button */}
                    <div className="sm:self-center">
                      {alert.alert_status === 'active' ? (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          Acknowledge Alert
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <Check className="w-4 h-4" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
