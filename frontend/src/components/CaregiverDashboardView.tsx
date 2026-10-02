import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Bell,
  ShieldCheck,
  Eye,
  Check,
  CheckCheck,
  AlertTriangle,
  UserCheck,
  Phone,
  Pill,
  X,
} from 'lucide-react';
import type {
  CaregiverDashboardSummary,
  CaregiverPatientDetail,
  MedicationLog,
} from '../types';
import { ApiService } from '../services/api';

interface CaregiverDashboardViewProps {
  onSelectPatientForToday?: (patientId: number) => void;
  highContrast?: boolean;
}

export const CaregiverDashboardView: React.FC<CaregiverDashboardViewProps> = ({
  onSelectPatientForToday,
  highContrast = false,
}) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<CaregiverDashboardSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_attention' | 'good_adherence'>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'active' | 'reviewed' | 'resolved'>('all');
  
  // Caregiver Switcher State (demonstrating multi-caregiver authorization isolation)
  const [currentCaregiverEmail, setCurrentCaregiverEmail] = useState<string>('caregiver@eldermed.org');

  // Selected Patient Details Modal State
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientDetails, setPatientDetails] = useState<CaregiverPatientDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // History Filter State inside Patient Details
  const [historyLogs, setHistoryLogs] = useState<MedicationLog[]>([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyMedFilter, setHistoryMedFilter] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Alert Action Loading
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    try {
      ApiService.setActiveCaregiver(currentCaregiverEmail);
      const data = await ApiService.getCaregiverDashboard();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load caregiver dashboard:', err);
      showToast(`Error: ${err.message || 'Failed to fetch caregiver dashboard.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [currentCaregiverEmail]);

  // Handle Caregiver Switch
  const handleSwitchCaregiver = (email: string) => {
    setCurrentCaregiverEmail(email);
    setSelectedPatientId(null);
    setPatientDetails(null);
    showToast(`Switched active caregiver to: ${email}`);
  };

  // Load Detailed Patient View
  const handleOpenPatientDetails = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const details = await ApiService.getCaregiverPatientDetails(patientId);
      setPatientDetails(details);
      setHistoryLogs(details.medication_history);
      // Reset filters
      setHistoryStatusFilter('all');
      setHistoryMedFilter('');
      setHistoryStartDate('');
      setHistoryEndDate('');
    } catch (err: any) {
      console.error('Error loading patient details:', err);
      setDetailsError(err.message || 'Unauthorized or failed to load patient details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filter Patient History inside Modal
  const handleFilterHistory = async () => {
    if (!selectedPatientId) return;
    setLoadingHistory(true);
    try {
      const medId = historyMedFilter ? parseInt(historyMedFilter) : undefined;
      const logs = await ApiService.getCaregiverPatientHistory(
        selectedPatientId,
        historyStatusFilter,
        medId,
        historyStartDate || undefined,
        historyEndDate || undefined
      );
      setHistoryLogs(logs);
    } catch (err: any) {
      console.error('Failed to filter history:', err);
      showToast(`History filter error: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Update Missed Medicine Alert Status (Reviewed / Resolved)
  const handleUpdateAlert = async (alertId: number, newStatus: 'reviewed' | 'resolved') => {
    setUpdatingAlertId(alertId);
    try {
      const updated = await ApiService.updateCaregiverAlertStatus(alertId, newStatus, `Marked as ${newStatus} by caregiver`);
      showToast(`✓ Alert marked as ${newStatus.toUpperCase()}`);
      
      // Update local alerts list
      if (summary) {
        setSummary({
          ...summary,
          missed_alerts: summary.missed_alerts.map((a) =>
            a.id === alertId ? { ...a, alert_status: updated.alert_status } : a
          ),
        });
      }

      // If patient details modal is open, update its alerts too
      if (patientDetails) {
        setPatientDetails({
          ...patientDetails,
          active_alerts: patientDetails.active_alerts.map((a) =>
            a.id === alertId ? { ...a, alert_status: updated.alert_status } : a
          ),
        });
      }
    } catch (err: any) {
      console.error('Failed to update alert:', err);
      showToast(`Failed to update alert: ${err.message}`);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  // Filtered Patients List
  const filteredPatients = (summary?.assigned_patients || []).filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchName = p.patient_name.toLowerCase().includes(q);
    const matchPhone = (p.phone_number || '').includes(q);
    const matchQuery = !q || matchName || matchPhone;

    if (!matchQuery) return false;

    if (statusFilter === 'needs_attention') {
      return p.today_missed > 0 || p.active_alerts_count > 0 || p.adherence_percentage < 70;
    }
    if (statusFilter === 'good_adherence') {
      return p.adherence_percentage >= 80;
    }
    return true;
  });

  // Filtered Alerts List
  const filteredAlerts = (summary?.missed_alerts || []).filter((a) => {
    if (alertFilter === 'all') return true;
    return a.alert_status.toLowerCase() === alertFilter.toLowerCase();
  });

  return (
    <div className={`space-y-8 pb-12 ${highContrast ? 'contrast-125' : ''}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up">
          <Activity className="w-5 h-5 text-sky-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Caregiver Persona Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-white border-2 border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
              <ShieldCheck className="w-3.5 h-3.5" /> Caregiver Command Portal
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Live DB Synced
            </span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mt-2">
            Caregiver Medication Monitoring
          </h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Real-time oversight of assigned patients, today's dosing schedules, missed medicine alerts, and verified adherence metrics.
          </p>
        </div>

        {/* Multi-Caregiver Selector for Demonstration & Verification */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2">
            Active Caregiver:
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSwitchCaregiver('caregiver@eldermed.org')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                currentCaregiverEmail === 'caregiver@eldermed.org'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Sarah Wilson (Caregiver #1)
            </button>
            <button
              onClick={() => handleSwitchCaregiver('nurse.jennifer@eldermed.org')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                currentCaregiverEmail === 'nurse.jennifer@eldermed.org'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Nurse Jennifer (Caregiver #2)
            </button>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* CORE DASHBOARD: 6 Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Assigned Patients */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Assigned</span>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">
              {loading ? '...' : summary?.total_assigned_patients ?? 0}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">Patients Monitored</div>
          </div>
        </div>

        {/* Medicines Scheduled Today */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Scheduled</span>
            <Calendar className="w-5 h-5 text-sky-600" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900">
              {loading ? '...' : summary?.total_scheduled_today ?? 0}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">Doses Today</div>
          </div>
        </div>

        {/* Medicines Taken Today */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Taken</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-600">
              {loading ? '...' : summary?.total_taken_today ?? 0}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">Doses Confirmed</div>
          </div>
        </div>

        {/* Missed Medicines Today */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Missed</span>
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-rose-600">
              {loading ? '...' : summary?.total_missed_today ?? 0}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">Doses Missed</div>
          </div>
        </div>

        {/* Pending Reminders */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Pending</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-amber-600">
              {loading ? '...' : summary?.total_pending_today ?? 0}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">Upcoming Doses</div>
          </div>
        </div>

        {/* Medication Adherence Percentage */}
        <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Adherence</span>
            <Activity className="w-5 h-5 text-sky-700" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black ${
                (summary?.overall_adherence_percentage ?? 100) >= 80
                  ? 'text-emerald-600'
                  : (summary?.overall_adherence_percentage ?? 100) >= 60
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}>
                {loading ? '...' : `${summary?.overall_adherence_percentage ?? 100}%`}
              </span>
            </div>
            {/* Visual Mini Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (summary?.overall_adherence_percentage ?? 100) >= 80
                    ? 'bg-emerald-500'
                    : (summary?.overall_adherence_percentage ?? 100) >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, summary?.overall_adherence_percentage ?? 100))}%` }}
              />
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-1">Verified Audit Rate</div>
          </div>
        </div>
      </div>

      {/* SECTION: MISSED MEDICINE ALERTS */}
      <div className="p-6 rounded-3xl bg-white border-2 border-rose-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Missed Medicine Alerts
                {summary && summary.missed_alerts.filter((a) => a.alert_status === 'active' || a.alert_status === 'unread').length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                    {summary.missed_alerts.filter((a) => a.alert_status === 'active' || a.alert_status === 'unread').length} Active
                  </span>
                )}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Actionable alerts generated when scheduled doses expire without patient intake.
              </p>
            </div>
          </div>

          {/* Alert Status Filter */}
          <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-2xl border border-rose-200">
            {(['all', 'active', 'reviewed', 'resolved'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setAlertFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                  alertFilter === filter
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-900 hover:bg-rose-100'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="mt-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">No {alertFilter !== 'all' ? alertFilter : ''} alerts found</div>
              <div className="text-xs text-slate-400 mt-0.5">All medication schedules for assigned patients are under control.</div>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  alert.alert_status === 'resolved'
                    ? 'bg-slate-50/70 border-slate-200 opacity-80'
                    : alert.alert_status === 'reviewed'
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-rose-50 border-rose-300 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${
                    alert.alert_status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : alert.alert_status === 'reviewed'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-200 text-rose-800'
                  }`}>
                    {alert.alert_status === 'resolved' ? (
                      <CheckCheck className="w-5 h-5" />
                    ) : alert.alert_status === 'reviewed' ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900">{alert.patient_name}</span>
                      <span className="text-xs font-bold text-slate-500">•</span>
                      <span className="text-sm font-bold text-slate-800">{alert.medicine_name}</span>
                      {alert.dosage && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                          {alert.dosage}
                        </span>
                      )}
                      <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        alert.alert_status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : alert.alert_status === 'reviewed'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-600 text-white border-rose-700'
                      }`}>
                        {alert.alert_status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mt-1 flex-wrap">
                      <span>Scheduled: <strong className="text-slate-700">{alert.scheduled_time}</strong></span>
                      <span>•</span>
                      <span>Alert Generated: <strong className="text-slate-700">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      <span>•</span>
                      <span>Current Status: <strong className="text-rose-600 font-bold capitalize">{alert.status}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Actions: Mark as Reviewed & Mark as Resolved */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {alert.alert_status !== 'reviewed' && alert.alert_status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateAlert(alert.id, 'reviewed')}
                      disabled={updatingAlertId === alert.id}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Mark Reviewed
                    </button>
                  )}

                  {alert.alert_status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateAlert(alert.id, 'resolved')}
                      disabled={updatingAlertId === alert.id}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  )}

                  {alert.alert_status === 'resolved' && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCheck className="w-4 h-4 text-emerald-600" /> Resolved by Caregiver
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PATIENT OVERVIEW SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              Assigned Patients Overview ({filteredPatients.length})
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Select any patient to inspect active medicines, today's schedule, intake audit logs, and alerts.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient or phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-300 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Quick Status Filter */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('needs_attention')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'needs_attention'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Needs Attention
              </button>
              <button
                onClick={() => setStatusFilter('good_adherence')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'good_adherence'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                High Adherence (≥80%)
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Patients Cards Grid */}
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border-2 border-slate-200">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <div className="text-lg font-bold text-slate-800">No assigned patients match your search</div>
            <div className="text-sm text-slate-500 mt-1">Try modifying your search or switching caregiver accounts.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {filteredPatients.map((patient) => {
              const isAttentionNeeded = patient.today_missed > 0 || patient.active_alerts_count > 0;
              return (
                <div
                  key={patient.patient_id}
                  className={`rounded-3xl bg-white border-2 transition shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    isAttentionNeeded ? 'border-rose-200' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-slate-100 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {patient.profile_photo ? (
                          <img
                            src={patient.profile_photo}
                            alt={patient.patient_name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm">
                            {patient.patient_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xl font-black text-slate-900">
                              {patient.patient_name}
                            </h4>
                            {patient.active_alerts_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {patient.active_alerts_count} Alert
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Age {patient.age || '—'}</span>
                            <span>•</span>
                            <span>{patient.gender || 'Patient'}</span>
                            {patient.phone_number && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" /> {patient.phone_number}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visual Adherence Gauge Badge */}
                      <div className="text-right">
                        <div className={`text-2xl font-black ${
                          patient.adherence_percentage >= 80
                            ? 'text-emerald-600'
                            : patient.adherence_percentage >= 60
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}>
                          {patient.adherence_percentage}%
                        </div>
                        <div className="text-[10px] font-black uppercase text-slate-400">Adherence</div>
                      </div>
                    </div>

                    {/* Health Conditions */}
                    {patient.health_conditions && (
                      <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <strong className="text-slate-800">Conditions:</strong> {patient.health_conditions}
                      </div>
                    )}
                  </div>

                  {/* Card Body: Today's Status, Next Medicine, Last Status */}
                  <div className="p-6 space-y-4 text-xs font-semibold">
                    {/* Today's Medication Status */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[11px]">
                        <span>Today's Status</span>
                        <span>{patient.today_taken} / {patient.today_total} Completed</span>
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        {patient.today_status_summary}
                      </div>
                      {/* Mini bar */}
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${patient.today_total > 0 ? (patient.today_taken / patient.today_total) * 100 : 0}%` }}
                        />
                        <div
                          className="bg-rose-500 h-full"
                          style={{ width: `${patient.today_total > 0 ? (patient.today_missed / patient.today_total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Next Medicine & Last Medication Status 2-col */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Next Medicine */}
                      <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200">
                        <div className="text-[10px] font-black uppercase tracking-wider text-sky-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-600" /> Next Medicine
                        </div>
                        {patient.next_medicine ? (
                          <div className="mt-1.5">
                            <div className="text-sm font-black text-slate-900 truncate">
                              {patient.next_medicine.name}
                            </div>
                            <div className="text-xs text-sky-900 font-bold mt-0.5">
                              {patient.next_medicine.scheduled_time} • {patient.next_medicine.dosage}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-2 font-normal italic">
                            No remaining doses today
                          </div>
                        )}
                      </div>

                      {/* Last Medication Status */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-slate-400" /> Last Dose Log
                        </div>
                        {patient.last_medication_status ? (
                          <div className="mt-1.5">
                            <div className="text-sm font-black text-slate-900 truncate">
                              {patient.last_medication_status.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                patient.last_medication_status.status === 'taken'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {patient.last_medication_status.status}
                              </span>
                              <span className="text-slate-500 font-normal">
                                at {patient.last_medication_status.scheduled_time}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-2 font-normal italic">
                            No historical logs recorded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: View Patient Details Action */}
                  <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    {onSelectPatientForToday && (
                      <button
                        onClick={() => onSelectPatientForToday(patient.patient_id)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 transition"
                      >
                        Patient Today View →
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenPatientDetails(patient.patient_id)}
                      className="ml-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      View Complete Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION: NOTIFICATIONS & IMPORTANT PATIENT ALERTS */}
      <div className="p-6 rounded-3xl bg-white border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Caregiver Notifications Stream
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Missed doses, upcoming critical medicines, and schedule updates.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {summary?.recent_notifications.length || 0} Recent Events
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {(summary?.recent_notifications || []).length === 0 ? (
            <div className="py-6 text-center text-xs font-semibold text-slate-400">
              No recent notifications recorded.
            </div>
          ) : (
            summary?.recent_notifications.slice(0, 8).map((notif) => (
              <div key={notif.id} className="py-3.5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${
                    notif.notification_type === 'missed_alert'
                      ? 'bg-rose-100 text-rose-700'
                      : notif.notification_type === 'due_alert'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{notif.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{notif.message}</div>
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PATIENT DETAILS DRILL-DOWN MODAL */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-5 border-b border-slate-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-100 text-sky-700">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {patientDetails?.patient.user?.full_name || `Patient #${selectedPatientId}`}
                  </h3>
                  <div className="text-xs font-semibold text-slate-500">
                    Comprehensive Medication Intake & Adherence Record
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPatientId(null);
                  setPatientDetails(null);
                }}
                className="p-2 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {loadingDetails ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-10 h-10 text-sky-600 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-slate-700">Fetching verified patient data...</div>
                </div>
              ) : detailsError ? (
                <div className="p-6 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-black text-base">
                    <AlertCircle className="w-5 h-5 text-rose-600" /> Authorization or Data Error
                  </div>
                  <p className="text-sm">{detailsError}</p>
                </div>
              ) : patientDetails ? (
                <>
                  {/* 1. PATIENT INFORMATION */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
                      1. Patient Profile Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold">Age & Gender:</span>
                        <div className="text-sm font-black text-slate-800 mt-0.5">
                          {patientDetails.patient.age || '—'} yrs • {patientDetails.patient.gender || '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">Phone Number:</span>
                        <div className="text-sm font-black text-slate-800 mt-0.5">
                          {patientDetails.patient.user?.phone_number || '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">Emergency Contact:</span>
                        <div className="text-sm font-black text-slate-800 mt-0.5">
                          {patientDetails.patient.emergency_contact_name} ({patientDetails.patient.emergency_contact_phone || '—'})
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">Adherence Rate:</span>
                        <div className="text-sm font-black text-emerald-600 mt-0.5">
                          {patientDetails.adherence_percentage}% ({patientDetails.adherence_breakdown.total_taken} of {patientDetails.adherence_breakdown.total_logged} taken)
                        </div>
                      </div>
                    </div>
                    {patientDetails.patient.health_conditions && (
                      <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                        <strong className="text-slate-800">Health Conditions:</strong> {patientDetails.patient.health_conditions}
                      </div>
                    )}
                    {patientDetails.patient.allergies && (
                      <div className="text-xs text-slate-600">
                        <strong className="text-slate-800">Known Allergies:</strong> {patientDetails.patient.allergies}
                      </div>
                    )}
                  </div>

                  {/* 2. ACTIVE MEDICINES */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
                      2. Active Prescriptions ({patientDetails.active_medicines.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {patientDetails.active_medicines.map((med) => (
                        <div key={med.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
                            <Pill className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900">{med.name}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">
                              {med.dosage} • {med.medicine_type} • {med.frequency}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              Times: <strong className="text-slate-800">{med.reminder_times || 'Scheduled times'}</strong>
                            </div>
                            {med.instructions && (
                              <div className="text-xs text-slate-500 italic mt-0.5">
                                "{med.instructions}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3, 4, 5, 6. TODAY'S MEDICINE SCHEDULE: TAKEN, MISSED, UPCOMING */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
                        3. Today's Medicine Schedule ({patientDetails.today_schedules.length} Doses)
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {patientDetails.taken_schedules.length} Taken
                        </span>
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          {patientDetails.missed_schedules.length} Missed
                        </span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {patientDetails.upcoming_schedules.length} Upcoming
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Taken List */}
                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Taken Medicines ({patientDetails.taken_schedules.length})
                        </div>
                        {patientDetails.taken_schedules.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-2">No doses taken yet today.</div>
                        ) : (
                          patientDetails.taken_schedules.map((s) => (
                            <div key={s.id} className="p-2.5 rounded-xl bg-white border border-emerald-200 text-xs">
                              <div className="font-black text-slate-900">{s.medicine?.name}</div>
                              <div className="text-slate-500 font-semibold">{s.scheduled_time} • {s.medicine?.dosage}</div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Missed List */}
                      <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                        <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Missed Medicines ({patientDetails.missed_schedules.length})
                        </div>
                        {patientDetails.missed_schedules.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-2">No missed doses today.</div>
                        ) : (
                          patientDetails.missed_schedules.map((s) => (
                            <div key={s.id} className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs">
                              <div className="font-black text-slate-900">{s.medicine?.name}</div>
                              <div className="text-rose-600 font-bold">{s.scheduled_time} • Missed</div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Upcoming List */}
                      <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2">
                        <div className="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-sky-600" />
                          Upcoming Medicines ({patientDetails.upcoming_schedules.length})
                        </div>
                        {patientDetails.upcoming_schedules.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-2">No pending doses remaining today.</div>
                        ) : (
                          patientDetails.upcoming_schedules.map((s) => (
                            <div key={s.id} className="p-2.5 rounded-xl bg-white border border-sky-200 text-xs">
                              <div className="font-black text-slate-900">{s.medicine?.name}</div>
                              <div className="text-sky-700 font-bold">{s.scheduled_time} • {s.status}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 7. MEDICATION HISTORY WITH FILTERS */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
                        7. Medication Adherence History Audit Log
                      </h4>
                      <span className="text-xs font-bold text-slate-500">
                        {historyLogs.length} Records Found
                      </span>
                    </div>

                    {/* Filter Bar */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* Status Filter */}
                      <div>
                        <label className="font-bold text-slate-500 mb-1 block">Status</label>
                        <select
                          value={historyStatusFilter}
                          onChange={(e) => setHistoryStatusFilter(e.target.value)}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 font-semibold"
                        >
                          <option value="all">All Logs</option>
                          <option value="taken">Taken Only</option>
                          <option value="missed">Missed Only</option>
                        </select>
                      </div>

                      {/* Medicine Filter */}
                      <div>
                        <label className="font-bold text-slate-500 mb-1 block">Medicine</label>
                        <select
                          value={historyMedFilter}
                          onChange={(e) => setHistoryMedFilter(e.target.value)}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 font-semibold"
                        >
                          <option value="">All Medicines</option>
                          {patientDetails.active_medicines.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date Filter */}
                      <div>
                        <label className="font-bold text-slate-500 mb-1 block">From Date</label>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 font-semibold"
                        />
                      </div>

                      {/* Filter Action */}
                      <div className="flex items-end">
                        <button
                          onClick={handleFilterHistory}
                          disabled={loadingHistory}
                          className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Filter className="w-3.5 h-3.5" />
                          Apply Filters
                        </button>
                      </div>
                    </div>

                    {/* Logs Table */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider sticky top-0">
                            <tr>
                              <th className="py-2.5 px-4">Medicine</th>
                              <th className="py-2.5 px-4">Scheduled Time</th>
                              <th className="py-2.5 px-4">Status</th>
                              <th className="py-2.5 px-4">Actual Intake</th>
                              <th className="py-2.5 px-4">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historyLogs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-slate-400">
                                  No medication logs matching filters.
                                </td>
                              </tr>
                            ) : (
                              historyLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition">
                                  <td className="py-2.5 px-4 font-bold text-slate-900">
                                    {log.medicine?.name || 'Medication'}
                                  </td>
                                  <td className="py-2.5 px-4 font-semibold text-slate-700">
                                    {log.scheduled_time}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <span className={`px-2 py-0.5 rounded-full font-black uppercase text-[10px] ${
                                      log.status === 'taken'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-600">
                                    {log.actual_taken_time
                                      ? new Date(log.actual_taken_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">
                                    {log.caregiver_notes || log.patient_notes || '—'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 8. PATIENT SPECIFIC ALERTS & NOTIFICATIONS */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-500">
                      8. Patient Alerts & Notifications ({patientDetails.notifications.length})
                    </h4>
                    <div className="space-y-2">
                      {patientDetails.notifications.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-2">No alerts on record for this patient.</div>
                      ) : (
                        patientDetails.notifications.slice(0, 5).map((n) => (
                          <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <strong className="text-slate-800">{n.title}</strong>: {n.message}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setSelectedPatientId(null);
                  setPatientDetails(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Close Patient Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
