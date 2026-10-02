import type {
  DashboardSummary,
  Medicine,
  MedicineFormData,
  MedicineSchedule,
  MedicationLog,
  Patient,
  PatientFormData,
  PatientMedicineOverview,
  Notification,
  CaregiverAlert,
  CaregiverDashboardSummary,
  CaregiverPatientSummary,
  CaregiverPatientDetail,
  PatientHomeScreenData,
  AdminOverviewData,
  User,
} from '../types';

const RAW_API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '').trim();
const API_BASE = RAW_API_URL ? `${RAW_API_URL.replace(/\/+$/, '')}/api/v1` : '/api/v1';

export class ApiService {
  private static activeRole: 'patient' | 'caregiver' | 'admin' = 'patient';
  private static activeCaregiverEmail: string = 'caregiver@eldermed.org';
  private static activePatientId: number = 1;
  private static activePatientEmail: string = 'patient@eldermed.org';
  private static activeAdminEmail: string = 'admin@eldermed.org';

  static setActiveRole(role: 'patient' | 'caregiver' | 'admin') {
    this.activeRole = role;
  }

  static getActiveRole(): 'patient' | 'caregiver' | 'admin' {
    return this.activeRole;
  }

  static setActiveCaregiver(email: string) {
    this.activeCaregiverEmail = email;
  }

  static getActiveCaregiver(): string {
    return this.activeCaregiverEmail;
  }

  static setActivePatient(patientId: number, email?: string) {
    this.activePatientId = patientId;
    if (email) {
      this.activePatientEmail = email;
    }
  }

  static getActivePatientId(): number {
    return this.activePatientId;
  }

  static setActiveAdmin(email: string) {
    this.activeAdminEmail = email;
  }

  static getActiveAdmin(): string {
    return this.activeAdminEmail;
  }

  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.activeRole === 'admin') {
      headers['X-Admin-Email'] = this.activeAdminEmail;
    } else if (this.activeRole === 'caregiver') {
      headers['X-Caregiver-Email'] = this.activeCaregiverEmail;
    } else {
      headers['X-Patient-Id'] = this.activePatientId.toString();
      headers['X-Patient-Email'] = this.activePatientEmail;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        ...headers,
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errorBody.detail || `Request failed with status ${res.status}`);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json();
  }

  // Dashboard Summary
  static async getDashboardSummary(patientId?: number): Promise<DashboardSummary> {
    const query = patientId ? `?patient_id=${patientId}` : '';
    return this.request<DashboardSummary>(`/dashboard/summary${query}`);
  }

  // Medicines Management
  static async getMedicines(
    patientId?: number,
    statusFilter: string = 'all',
    search?: string
  ): Promise<Medicine[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId.toString());
    if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
    if (search && search.trim()) params.append('search', search.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Medicine[]>(`/medicines${query}`);
  }

  static async getMedicine(medicineId: number): Promise<Medicine> {
    return this.request<Medicine>(`/medicines/${medicineId}`);
  }

  static async createMedicine(medicineData: MedicineFormData): Promise<Medicine> {
    return this.request<Medicine>('/medicines', {
      method: 'POST',
      body: JSON.stringify(medicineData),
    });
  }

  static async updateMedicine(
    medicineId: number,
    medicineData: Partial<MedicineFormData>
  ): Promise<Medicine> {
    return this.request<Medicine>(`/medicines/${medicineId}`, {
      method: 'PUT',
      body: JSON.stringify(medicineData),
    });
  }

  static async toggleMedicineActive(medicineId: number): Promise<Medicine> {
    return this.request<Medicine>(`/medicines/${medicineId}/toggle`, {
      method: 'PATCH',
    });
  }

  static async deleteMedicine(medicineId: number): Promise<void> {
    await this.request<void>(`/medicines/${medicineId}`, {
      method: 'DELETE',
    });
  }

  static async getPatientMedicineOverview(patientId: number): Promise<PatientMedicineOverview> {
    return this.request<PatientMedicineOverview>(`/medicines/patient/${patientId}/overview`);
  }

  // Schedules
  static async getTodaySchedules(patientId?: number): Promise<MedicineSchedule[]> {
    const query = patientId ? `?patient_id=${patientId}` : '';
    return this.request<MedicineSchedule[]>(`/schedules/today${query}`);
  }

  static async recordScheduleAction(
    scheduleId: number,
    action: 'taken' | 'missed',
    patientNotes?: string,
    caregiverNotes?: string
  ): Promise<MedicineSchedule> {
    return this.request<MedicineSchedule>(`/schedules/${scheduleId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        patient_notes: patientNotes,
        caregiver_notes: caregiverNotes,
      }),
    });
  }

  // Medication Logs / History
  static async getMedicationLogs(patientId?: number, statusFilter?: string): Promise<MedicationLog[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId.toString());
    if (statusFilter) params.append('status_filter', statusFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<MedicationLog[]>(`/logs${query}`);
  }

  // Patients Management CRUD
  static async getPatients(search?: string): Promise<Patient[]> {
    const query = search ? `?search=${encodeURIComponent(search.trim())}` : '';
    return this.request<Patient[]>(`/patients${query}`);
  }

  static async getPrimaryPatient(): Promise<Patient> {
    return this.request<Patient>('/patients/primary');
  }

  static async getPatient(patientId: number): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientId}`);
  }

  static async createPatient(data: PatientFormData): Promise<Patient> {
    return this.request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updatePatient(patientId: number, data: Partial<PatientFormData>): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deletePatient(patientId: number): Promise<void> {
    await this.request<void>(`/patients/${patientId}`, {
      method: 'DELETE',
    });
  }

  static async getPatientDashboard(patientId: number): Promise<DashboardSummary> {
    return this.request<DashboardSummary>(`/patients/${patientId}/dashboard`);
  }

  // Notifications & Caregiver Alerts
  static async getNotifications(
    patientId?: number,
    notificationType?: string,
    unreadOnly?: boolean
  ): Promise<Notification[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId.toString());
    if (notificationType) params.append('notification_type', notificationType);
    if (unreadOnly) params.append('unread_only', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Notification[]>(`/notifications${query}`);
  }

  static async getCaregiverAlerts(patientId?: number): Promise<CaregiverAlert[]> {
    const query = patientId ? `?patient_id=${patientId}` : '';
    return this.request<CaregiverAlert[]>(`/notifications/alerts${query}`);
  }

  static async getPatientDueReminders(patientId: number): Promise<Notification[]> {
    return this.request<Notification[]>(`/notifications/patient/${patientId}/due`);
  }

  static async markNotificationRead(notificationId: number): Promise<Notification> {
    return this.request<Notification>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  static async acknowledgeAlert(notificationId: number): Promise<Notification> {
    return this.request<Notification>(`/notifications/${notificationId}/acknowledge`, {
      method: 'PATCH',
    });
  }

  // Fast-Forward & Test Simulation Helpers
  static async triggerScheduleDue(scheduleId: number): Promise<MedicineSchedule> {
    return this.request<MedicineSchedule>(`/schedules/${scheduleId}/trigger-due`, {
      method: 'POST',
    });
  }

  static async triggerScheduleMissed(scheduleId: number): Promise<MedicineSchedule> {
    return this.request<MedicineSchedule>(`/schedules/${scheduleId}/trigger-missed`, {
      method: 'POST',
    });
  }

  static async processReminders(): Promise<any> {
    return this.request<any>('/schedules/process-reminders', {
      method: 'POST',
    });
  }

  static async simulateTime(simulatedTime: string): Promise<any> {
    return this.request<any>(`/schedules/simulate-time?simulated_time=${encodeURIComponent(simulatedTime)}`, {
      method: 'POST',
    });
  }

  // Caregiver Dashboard Endpoints
  static async getCaregiverDashboard(): Promise<CaregiverDashboardSummary> {
    return this.request<CaregiverDashboardSummary>('/caregivers/dashboard');
  }

  static async getCaregiverPatients(search?: string): Promise<CaregiverPatientSummary[]> {
    const query = search ? `?search=${encodeURIComponent(search.trim())}` : '';
    return this.request<CaregiverPatientSummary[]>(`/caregivers/patients${query}`);
  }

  static async getCaregiverPatientDetails(patientId: number): Promise<CaregiverPatientDetail> {
    return this.request<CaregiverPatientDetail>(`/caregivers/patients/${patientId}/details`);
  }

  static async getCaregiverPatientHistory(
    patientId: number,
    status?: string,
    medicineId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<MedicationLog[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (medicineId) params.append('medicine_id', medicineId.toString());
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<MedicationLog[]>(`/caregivers/patients/${patientId}/history${query}`);
  }

  static async updateCaregiverAlertStatus(
    alertId: number,
    status: 'reviewed' | 'resolved' | 'active',
    notes?: string
  ): Promise<CaregiverAlert> {
    return this.request<CaregiverAlert>(`/caregivers/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  static async getFilteredCaregiverAlerts(statusFilter?: string): Promise<CaregiverAlert[]> {
    const query = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    return this.request<CaregiverAlert[]>(`/caregivers/alerts${query}`);
  }

  // Patient Reminder Screen & Notification Center Endpoints
  static async getPatientReminderHome(patientId: number): Promise<PatientHomeScreenData> {
    return this.request<PatientHomeScreenData>(`/patients/${patientId}/reminder-home`);
  }

  static async markAllNotificationsRead(patientId: number): Promise<{ message: string; updated_count: number }> {
    return this.request<{ message: string; updated_count: number }>(`/notifications/patient/${patientId}/read-all`, {
      method: 'PUT',
    });
  }

  static async assignPatientToCaregiver(caregiverId: number, patientId: number): Promise<Patient> {
    return this.request<Patient>(`/caregivers/${caregiverId}/assign-patient/${patientId}`, {
      method: 'PUT',
    });
  }

  // Admin Supervisory Endpoints
  static async getAdminOverview(): Promise<AdminOverviewData> {
    return this.request<AdminOverviewData>('/admin/overview');
  }

  static async getAdminUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users');
  }

  static async deleteAdminUser(userId: number): Promise<void> {
    await this.request<void>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

