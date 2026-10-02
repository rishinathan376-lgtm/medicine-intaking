import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Bell,
  Check,
} from 'lucide-react';
import type {
  DashboardSummary,
  Medicine,
  MedicineFormData,
  Patient,
  PatientFormData,
  PatientMedicineOverview,
  CaregiverAlert,
  UserRole,
} from './types';
import { ApiService } from './services/api';
import { Header } from './components/Header';
import { PatientProfileCard } from './components/PatientProfileCard';
import { NavigationTabs } from './components/NavigationTabs';
import { AddMedicineModal } from './components/AddMedicineModal';
import { MedicineManagementView } from './components/MedicineManagementView';
import { PatientsManagementView } from './components/PatientsManagementView';
import { PatientFormModal } from './components/PatientFormModal';
import { PatientDetailsModal } from './components/PatientDetailsModal';
import { DueMedicineBanner } from './components/DueMedicineBanner';
import { RemindersManagementView } from './components/RemindersManagementView';
import { CaregiverDashboardView } from './components/CaregiverDashboardView';
import { PatientReminderHomeView } from './components/PatientReminderHomeView';
import { PatientNotificationCenterView } from './components/PatientNotificationCenterView';
import { MedicationHistoryView } from './components/MedicationHistoryView';
import { AdminManagementView } from './components/AdminManagementView';
import { ConfirmationModal } from './components/ConfirmationModal';

export const App: React.FC = () => {
  // Accessibility state
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>('normal');
  const [highContrast, setHighContrast] = useState<boolean>(false);

  // Role & Navigation state
  const [currentRole, setCurrentRole] = useState<UserRole>('patient');
  const [activeTab, setActiveTab] = useState<string>('patient-home');

  // Application data state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medOverview, setMedOverview] = useState<PatientMedicineOverview | null>(null);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modals state
  const [isAddMedModalOpen, setIsAddMedModalOpen] = useState<boolean>(false);
  const [medicineToEdit, setMedicineToEdit] = useState<Medicine | null>(null);
  const [isPatientFormOpen, setIsPatientFormOpen] = useState<boolean>(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [isPatientDetailsOpen, setIsPatientDetailsOpen] = useState<boolean>(false);
  const [patientForDetails, setPatientForDetails] = useState<Patient | null>(null);
  const [confirmMissScheduleId, setConfirmMissScheduleId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load all patients and active patient dashboard + medicine overview
  const loadPatientsAndDashboard = async (patientIdToLoad?: number) => {
    try {
      setLoading(true);
      const allPatients = await ApiService.getPatients();
      setPatients(allPatients);

      const targetId = patientIdToLoad || selectedPatientId || (allPatients.length > 0 ? allPatients[0].id : 1);
      setSelectedPatientId(targetId);

      const activePt = allPatients.find((p) => p.id === targetId);
      if (activePt && activePt.user) {
        ApiService.setActivePatient(targetId, activePt.user.email);
      }

      const [sumData, medsData, overviewData, alertsData] = await Promise.all([
        ApiService.getPatientDashboard(targetId).catch(() => ApiService.getDashboardSummary(targetId)),
        ApiService.getMedicines(targetId),
        ApiService.getPatientMedicineOverview(targetId).catch(() => null),
        ApiService.getCaregiverAlerts(targetId).catch(() => []),
      ]);

      setSummary(sumData);
      setMedicines(medsData);
      setMedOverview(overviewData);
      setAlerts(alertsData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      showToast('Connecting to backend services...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientsAndDashboard();
    // Auto refresh every 15 seconds for live reminder & grace period updates
    const interval = setInterval(() => {
      if (selectedPatientId) {
        ApiService.getPatientDashboard(selectedPatientId).then(setSummary).catch(() => {});
        ApiService.getPatientMedicineOverview(selectedPatientId).then(setMedOverview).catch(() => {});
        ApiService.getCaregiverAlerts(selectedPatientId).then(setAlerts).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Switch Active Patient
  const handleSelectPatient = async (patientId: number) => {
    setSelectedPatientId(patientId);
    const p = patients.find((pt: Patient) => pt.id === patientId);
    if (p && p.user) {
      ApiService.setActivePatient(patientId, p.user.email);
    }
    await loadPatientsAndDashboard(patientId);
    showToast(`✓ Switched to patient ${p?.user?.full_name || ''}.`);
  };

  // Switch Role
  const handleSelectRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    ApiService.setActiveRole(newRole);
    if (newRole === 'patient') {
      setActiveTab('patient-home');
      showToast('Switched to Patient View');
    } else if (newRole === 'caregiver') {
      setActiveTab('caregiver-dashboard');
      showToast('Switched to Caregiver View');
    } else {
      setActiveTab('admin-dashboard');
      showToast('Switched to System Administrator View');
    }
  };

  // Switch to Patient and Navigate to Patient Home
  const handleSelectPatientAndGoToHome = async (patientId: number) => {
    await handleSelectPatient(patientId);
    if (currentRole === 'patient') {
      setActiveTab('patient-home');
    } else {
      setActiveTab('caregiver-dashboard');
    }
  };

  // Save Patient
  const handleSavePatient = async (formData: PatientFormData) => {
    try {
      if (patientToEdit) {
        const updated = await ApiService.updatePatient(patientToEdit.id, formData);
        showToast(`✓ Updated details for ${updated.user?.full_name}.`);
        await loadPatientsAndDashboard(patientToEdit.id);
      } else {
        const created = await ApiService.createPatient(formData);
        showToast(`✓ Registered new patient ${created.user?.full_name}.`);
        await loadPatientsAndDashboard(created.id);
      }
    } catch (err: any) {
      showToast(`Error saving patient: ${err.message || 'Operation failed'}`);
    }
  };

  // Delete Patient
  const handleDeletePatient = async (patientId: number) => {
    try {
      await ApiService.deletePatient(patientId);
      showToast('✓ Patient record removed.');
      const remaining = patients.filter((p: Patient) => p.id !== patientId);
      const nextId = remaining.length > 0 ? remaining[0].id : 1;
      await loadPatientsAndDashboard(nextId);
    } catch (err: any) {
      showToast(`Error deleting patient: ${err.message || 'Operation failed'}`);
    }
  };

  // Save Medicine (Create or Edit)
  const handleSaveMedicine = async (formData: MedicineFormData) => {
    try {
      if (medicineToEdit) {
        const updated = await ApiService.updateMedicine(medicineToEdit.id, formData);
        showToast(`✓ Updated prescription for ${updated.name}.`);
      } else {
        const created = await ApiService.createMedicine(formData);
        showToast(`✓ Prescribed ${created.name} with ${formData.reminder_times.length} scheduled times.`);
      }
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error saving prescription: ${err.message || 'Operation failed'}`);
    }
  };

  // Toggle Medicine Active/Disabled
  const handleToggleMedicineActive = async (medicineId: number) => {
    try {
      const updated = await ApiService.toggleMedicineActive(medicineId);
      showToast(
        updated.is_active
          ? `✓ Enabled ${updated.name} (scheduled for reminders).`
          : `⚠️ Disabled ${updated.name}.`
      );
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error toggling medicine: ${err.message || 'Operation failed'}`);
    }
  };

  // Delete Medicine
  const handleDeleteMedicine = async (medicineId: number) => {
    try {
      await ApiService.deleteMedicine(medicineId);
      showToast('✓ Prescription removed.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error deleting prescription: ${err.message || 'Operation failed'}`);
    }
  };

  // Handle Mark as Taken
  const handleTakeDose = async (scheduleId: number, notes?: string) => {
    try {
      setActionLoadingId(scheduleId);
      await ApiService.recordScheduleAction(scheduleId, 'taken', notes);
      showToast('✓ Great job! Medicine recorded as TAKEN.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to record dose'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Mark as Missed (Confirmed)
  const handleConfirmMissDose = async () => {
    if (!confirmMissScheduleId) return;
    try {
      setActionLoadingId(confirmMissScheduleId);
      await ApiService.recordScheduleAction(confirmMissScheduleId, 'missed', 'Marked missed by patient');
      showToast('⚠️ Medicine marked as MISSED. Your caregiver has been alerted.');
      setConfirmMissScheduleId(null);
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to record action'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Acknowledge Caregiver Alert
  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await ApiService.acknowledgeAlert(alertId);
      showToast('✓ Caregiver alert marked as acknowledged.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to update alert'}`);
    }
  };

  // Test Simulation Helpers
  const handleTriggerDue = async (scheduleId: number) => {
    try {
      await ApiService.triggerScheduleDue(scheduleId);
      showToast('⚡ Fast-forward: Dose set to DUE NOW! Notice chime and banner.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Simulation failed'}`);
    }
  };

  const handleTriggerMissed = async (scheduleId: number) => {
    try {
      await ApiService.triggerScheduleMissed(scheduleId);
      showToast('⚡ Fast-forward: Dose marked MISSED! Caregiver alert dispatched.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Simulation failed'}`);
    }
  };

  const handleSimulateTime = async (timeStr: string) => {
    try {
      const res = await ApiService.simulateTime(timeStr);
      showToast(`⚡ Evaluated for ${timeStr}: ${res.details?.due_processed || 0} due, ${res.details?.missed_processed || 0} missed.`);
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Simulation failed'}`);
    }
  };

  const handleRunSchedulerCheck = async () => {
    try {
      await ApiService.processReminders();
      showToast('✓ Scheduler check executed.');
      await loadPatientsAndDashboard(selectedPatientId);
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Scheduler check failed'}`);
    }
  };

  const currentPatient = summary?.patient || patients.find((p: Patient) => p.id === selectedPatientId) || patients[0];

  const dueSchedules = summary?.today_schedules.filter((s: any) => s.status === 'due') || [];

  return (
    <div
      className={`min-h-screen flex flex-col transition-all ${
        highContrast ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'
      } ${
        fontSize === 'large'
          ? 'text-elder-large'
          : fontSize === 'xl'
          ? 'text-elder-xl'
          : 'text-elder-normal'
      }`}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-bold shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in max-w-md">
          <Bell className="w-5 h-5 text-yellow-300 shrink-0" />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Accessible Header with Role Switcher & Multi-Patient Switcher */}
      <Header
        patient={currentPatient}
        patientsList={patients}
        onSelectPatient={handleSelectPatient}
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        fontSize={fontSize}
        setFontSize={setFontSize}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        onCallCaregiver={() => {
          const phone =
            currentPatient?.emergency_contact_phone ||
            currentPatient?.caregiver_phone ||
            '+1 (555) 987-6543';
          window.open(`tel:${phone}`);
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Loading Indicator */}
        {(loading || actionLoadingId !== null) && (
          <div className="fixed top-4 right-4 z-50 bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {actionLoadingId !== null ? 'Recording dose...' : 'Updating...'}
          </div>
        )}

        {/* Due Medicine Banner (Visible whenever any dose is due) */}
        {dueSchedules.length > 0 && currentRole === 'patient' && (
          <DueMedicineBanner
            dueSchedules={dueSchedules}
            patientName={currentPatient?.user?.full_name || 'Patient'}
            onTakeDose={handleTakeDose}
            onMissDose={(id) => Promise.resolve(setConfirmMissScheduleId(id))}
          />
        )}

        {/* Role-Based Navigation Tabs */}
        <NavigationTabs
          currentRole={currentRole}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={summary?.upcoming_count || 0}
          dueCount={dueSchedules.length}
          alertsCount={alerts.length}
          totalMedicinesCount={summary?.total_medicines || medicines.length}
          totalPatientsCount={patients.length}
          highContrast={highContrast}
        />

        {/* ========================================================================= */}
        {/* PATIENT ROLE VIEWS                                                        */}
        {/* ========================================================================= */}

        {/* 1. PATIENT HOME */}
        {currentRole === 'patient' && activeTab === 'patient-home' && (
          <PatientReminderHomeView
            patientId={selectedPatientId}
            onNavigateToNotifications={() => setActiveTab('patient-notifications')}
            highContrast={highContrast}
            fontSize={fontSize}
          />
        )}

        {/* 2. TODAY'S MEDICINES (Chronological Schedule) */}
        {currentRole === 'patient' && activeTab === 'patient-today' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  Today's Medicines: {currentPatient?.user?.full_name}
                </h2>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  Chronological schedule of prescribed doses for today.
                </p>
              </div>

              {summary && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 text-xs sm:text-sm font-bold shadow-2xs">
                  <span className="text-emerald-700">{summary.taken_count} Taken</span>
                  <span>•</span>
                  <span className="text-rose-700">{summary.missed_count} Missed</span>
                  <span>•</span>
                  <span className="text-slate-500">{summary.upcoming_count} Remaining</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {(summary?.today_schedules || []).length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-black text-slate-800">No medicines scheduled for today!</h3>
                  <p className="text-xs text-slate-500">All prescribed courses are up to date.</p>
                </div>
              ) : (
                summary?.today_schedules.map((schedule: any) => {
                  const isDue = schedule.status === 'due';
                  const isTaken = schedule.status === 'taken';
                  const isMissed = schedule.status === 'missed';

                  return (
                    <div
                      key={schedule.id}
                      className={`p-5 sm:p-6 rounded-3xl border-2 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDue
                          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300'
                          : isTaken
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : isMissed
                          ? 'bg-rose-50/40 border-rose-300 opacity-90'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3.5 rounded-2xl text-center min-w-[90px] ${
                            isDue
                              ? 'bg-amber-500 text-white font-black'
                              : isTaken
                              ? 'bg-emerald-600 text-white font-black'
                              : isMissed
                              ? 'bg-rose-600 text-white font-black'
                              : 'bg-slate-100 text-slate-800 font-bold border border-slate-200'
                          }`}
                        >
                          <div className="text-sm sm:text-base">{schedule.scheduled_time}</div>
                          <div className="text-[10px] font-black uppercase mt-0.5">
                            {isDue ? 'DUE NOW' : schedule.status}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black text-slate-900">
                              {schedule.medicine?.name}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                              {schedule.medicine?.dosage}
                            </span>
                          </div>

                          {schedule.medicine?.instructions && (
                            <div className="text-xs sm:text-sm font-semibold text-slate-600">
                              {schedule.medicine.instructions}
                            </div>
                          )}

                          {isTaken && schedule.taken_at && (
                            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Taken at {new Date(schedule.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}

                          {isMissed && (
                            <div className="text-xs font-bold text-rose-800 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              Missed dose • Caregiver alerted
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        {isTaken ? (
                          <span className="px-5 py-2.5 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs sm:text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed
                          </span>
                        ) : isMissed ? (
                          <span className="px-5 py-2.5 rounded-2xl bg-rose-100 text-rose-800 border border-rose-300 font-black text-xs sm:text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600" /> Missed
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTakeDose(schedule.id)}
                              disabled={actionLoadingId === schedule.id}
                              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-xs transition flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              TAKE MEDICINE
                            </button>
                            <button
                              onClick={() => setConfirmMissScheduleId(schedule.id)}
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
        )}

        {/* 3. PATIENT HISTORY */}
        {currentRole === 'patient' && activeTab === 'patient-history' && (
          <MedicationHistoryView
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatient}
            currentPatient={currentPatient}
            medicines={medicines}
            highContrast={highContrast}
          />
        )}

        {/* 4. PATIENT NOTIFICATIONS */}
        {currentRole === 'patient' && activeTab === 'patient-notifications' && (
          <PatientNotificationCenterView
            patientId={selectedPatientId}
            highContrast={highContrast}
            fontSize={fontSize}
          />
        )}

        {/* 5. PATIENT PROFILE */}
        {currentRole === 'patient' && activeTab === 'patient-profile' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <PatientProfileCard
              patient={currentPatient}
              onEdit={(p) => {
                setPatientToEdit(p);
                setIsPatientFormOpen(true);
              }}
              highContrast={highContrast}
              totalMedicines={summary?.total_medicines || medicines.length}
              adherencePercentage={summary?.adherence_percentage || 95}
              todayTotalDoses={summary?.today_total || 4}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* CAREGIVER ROLE VIEWS                                                      */}
        {/* ========================================================================= */}

        {/* 1. CAREGIVER DASHBOARD & ALERTS */}
        {currentRole === 'caregiver' && (activeTab === 'caregiver-dashboard' || activeTab === 'caregiver-alerts') && (
          <div className="space-y-6">
            <CaregiverDashboardView
              onSelectPatientForToday={(patientId) => {
                handleSelectPatientAndGoToHome(patientId);
              }}
              highContrast={highContrast}
            />

            {/* Collapsible Simulation Controls for Testing */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-left">
              <details className="group">
                <summary className="font-black text-sm text-slate-700 cursor-pointer flex items-center justify-between select-none">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-600" />
                    Interactive Reminder Lifecycle Simulator & Test Controls
                  </span>
                  <span className="text-xs text-sky-600 font-bold group-open:rotate-180 transition">
                    ▼ Click to expand simulator
                  </span>
                </summary>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <RemindersManagementView
                    schedules={summary?.today_schedules || []}
                    alerts={alerts}
                    patientName={currentPatient?.user?.full_name || 'Patient'}
                    onTakeDose={handleTakeDose}
                    onMissDose={(id) => Promise.resolve(setConfirmMissScheduleId(id))}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                    onTriggerDue={handleTriggerDue}
                    onTriggerMissed={handleTriggerMissed}
                    onSimulateTime={handleSimulateTime}
                    onRunSchedulerCheck={handleRunSchedulerCheck}
                  />
                </div>
              </details>
            </div>
          </div>
        )}

        {/* 2. CAREGIVER PATIENTS */}
        {currentRole === 'caregiver' && activeTab === 'caregiver-patients' && (
          <PatientsManagementView
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatientAndGoToHome}
            onAddPatient={() => {
              setPatientToEdit(null);
              setIsPatientFormOpen(true);
            }}
            onEditPatient={(patient) => {
              setPatientToEdit(patient);
              setIsPatientFormOpen(true);
            }}
            onViewPatient={(patient) => {
              setPatientForDetails(patient);
              setIsPatientDetailsOpen(true);
            }}
            onDeletePatient={handleDeletePatient}
            highContrast={highContrast}
          />
        )}

        {/* 3. CAREGIVER MEDICINES */}
        {currentRole === 'caregiver' && activeTab === 'caregiver-medicines' && (
          <MedicineManagementView
            patient={currentPatient}
            medicines={medicines}
            overview={medOverview}
            onAddMedicine={() => {
              setMedicineToEdit(null);
              setIsAddMedModalOpen(true);
            }}
            onEditMedicine={(med) => {
              setMedicineToEdit(med);
              setIsAddMedModalOpen(true);
            }}
            onToggleActive={handleToggleMedicineActive}
            onDeleteMedicine={handleDeleteMedicine}
            highContrast={highContrast}
          />
        )}

        {/* 4. CAREGIVER HISTORY */}
        {currentRole === 'caregiver' && activeTab === 'caregiver-history' && (
          <MedicationHistoryView
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatient}
            currentPatient={currentPatient}
            medicines={medicines}
            highContrast={highContrast}
          />
        )}

        {/* 5. CAREGIVER PROFILE */}
        {currentRole === 'caregiver' && activeTab === 'caregiver-profile' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <PatientProfileCard
              patient={currentPatient}
              onEdit={(p) => {
                setPatientToEdit(p);
                setIsPatientFormOpen(true);
              }}
              highContrast={highContrast}
              totalMedicines={summary?.total_medicines || medicines.length}
              adherencePercentage={summary?.adherence_percentage || 95}
              todayTotalDoses={summary?.today_total || 4}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN ROLE VIEWS                                                          */}
        {/* ========================================================================= */}

        {currentRole === 'admin' && activeTab.startsWith('admin-') && (
          <AdminManagementView
            highContrast={highContrast}
          />
        )}
      </main>

      {/* Confirmation Modal for Marking Missed Dose */}
      {confirmMissScheduleId && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setConfirmMissScheduleId(null)}
          onConfirm={handleConfirmMissDose}
          title="Mark Dose as Missed"
          message="Are you sure you want to mark this dose as missed? An automatic notification alert will be dispatched to your caregiver."
          confirmLabel="Mark as Missed"
          variant="warning"
          isLoading={actionLoadingId === confirmMissScheduleId}
          highContrast={highContrast}
        />
      )}

      {/* Add / Edit Medicine Modal */}
      <AddMedicineModal
        isOpen={isAddMedModalOpen}
        onClose={() => {
          setIsAddMedModalOpen(false);
          setMedicineToEdit(null);
        }}
        onSave={handleSaveMedicine}
        patientId={currentPatient?.id || 1}
        medicineToEdit={medicineToEdit}
      />

      {/* Patient Create/Edit Modal */}
      <PatientFormModal
        isOpen={isPatientFormOpen}
        onClose={() => setIsPatientFormOpen(false)}
        onSave={handleSavePatient}
        patientToEdit={patientToEdit}
      />

      {/* Patient View Details Modal */}
      <PatientDetailsModal
        isOpen={isPatientDetailsOpen}
        onClose={() => setIsPatientDetailsOpen(false)}
        patient={patientForDetails}
        onEdit={(p) => {
          setPatientToEdit(p);
          setIsPatientFormOpen(true);
        }}
        onSelectDashboard={handleSelectPatientAndGoToHome}
      />
    </div>
  );
};

export default App;
