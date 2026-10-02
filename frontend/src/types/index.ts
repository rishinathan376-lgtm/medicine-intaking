export type UserRole = 'patient' | 'caregiver' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
  is_active: boolean;
  created_at: string;
}

export interface Patient {
  id: number;
  user_id: number;
  age?: number;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  health_conditions?: string;
  allergies?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  caregiver_name?: string;
  caregiver_phone?: string;
  caregiver_email?: string;
  caregiver_id?: number;
  profile_photo?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  user?: User;
}

export interface PatientFormData {
  full_name: string;
  email: string;
  phone_number: string;
  age?: number;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  health_conditions?: string;
  allergies?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  caregiver_name?: string;
  caregiver_phone?: string;
  caregiver_email?: string;
  profile_photo?: string;
  notes?: string;
}

export interface MedicineReminderTime {
  id: number;
  medicine_id: number;
  reminder_time: string;
  dose_label?: string;
}

export interface Medicine {
  id: number;
  patient_id: number;
  name: string;
  medicine_type: string;  // Tablet, Capsule, Syrup, Injection, Drops, Inhaler, Patch, Ointment
  dosage: string;
  quantity: number;
  instructions?: string;
  start_date: string;
  end_date?: string;
  reminder_times?: string;
  frequency: string;
  before_after_food: 'before_food' | 'after_food' | 'with_food' | 'none';
  additional_notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  reminder_times_rel?: MedicineReminderTime[];
  times_list?: string[];
}

export interface MedicineFormData {
  patient_id: number;
  name: string;
  medicine_type: string;
  dosage: string;
  quantity: number;
  instructions?: string;
  start_date: string;
  end_date?: string;
  reminder_times: string[];
  frequency: string;
  before_after_food: 'before_food' | 'after_food' | 'with_food' | 'none';
  additional_notes?: string;
  is_active?: boolean;
}

export interface PatientMedicineOverview {
  today_schedules: MedicineSchedule[];
  upcoming_schedules: MedicineSchedule[];
  active_medicines: Medicine[];
  completed_medicines: Medicine[];
}

export interface MedicineSchedule {
  id: number;
  medicine_id: number;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  status: 'upcoming' | 'due' | 'taken' | 'missed' | 'pending';
  taken_at?: string;
  notified_caregiver: boolean;
  reminder_sent_at?: string;
  created_at: string;
  medicine?: Medicine;
}

export interface MedicationLog {
  id: number;
  schedule_id?: number;
  medicine_id: number;
  patient_id: number;
  status: 'taken' | 'missed';
  scheduled_date?: string;
  scheduled_time: string;
  actual_taken_time?: string;
  caregiver_notes?: string;
  patient_notes?: string;
  created_at: string;
  medicine?: Medicine;
}

export interface Notification {
  id: number;
  user_id?: number;
  patient_id?: number;
  medicine_id?: number;
  schedule_id?: number;
  title: string;
  message: string;
  notification_type: 'reminder' | 'due_alert' | 'missed_alert' | 'emergency' | 'general' | string;
  channel: 'in_app' | 'email' | string;
  status: 'unread' | 'read' | 'active' | 'acknowledged' | 'resolved' | string;
  scheduled_time?: string;
  missed_at?: string;
  is_read: boolean;
  sent_at?: string;
  created_at: string;
  patient_name?: string;
  medicine_name?: string;
}

export interface CaregiverAlert {
  id: number;
  patient_id: number;
  patient_name: string;
  medicine_id?: number;
  medicine_name: string;
  dosage?: string;
  scheduled_time: string;
  status: string;
  missed_at?: string;
  alert_status: string;
  caregiver_name?: string;
  caregiver_email?: string;
  caregiver_phone?: string;
  created_at: string;
}

export interface RecentActivityItem {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  type: 'taken' | 'missed' | 'alert' | 'added';
  badge_color: string;
}

export interface DashboardSummary {
  total_medicines: number;
  today_total: number;
  taken_count: number;
  missed_count: number;
  upcoming_count: number;
  adherence_percentage: number;
  patient?: Patient;
  today_schedules: MedicineSchedule[];
  recent_activities: RecentActivityItem[];
}

export interface NextMedicineInfo {
  name: string;
  dosage: string;
  scheduled_time: string;
  before_after_food?: string;
  instructions?: string;
}

export interface LastMedicationInfo {
  name: string;
  status: string; // "taken" | "missed"
  scheduled_time: string;
  actual_taken_time?: string;
}

export interface CaregiverPatientSummary {
  patient_id: number;
  patient_name: string;
  age?: number;
  gender?: string;
  phone_number?: string;
  profile_photo?: string;
  health_conditions?: string;
  allergies?: string;
  today_total: number;
  today_taken: number;
  today_missed: number;
  today_pending: number;
  today_status_summary: string;
  next_medicine?: NextMedicineInfo;
  last_medication_status?: LastMedicationInfo;
  adherence_percentage: number;
  active_alerts_count: number;
}

export interface CaregiverDashboardSummary {
  caregiver_id: number;
  caregiver_name: string;
  caregiver_email: string;
  relationship?: string;
  total_assigned_patients: number;
  total_scheduled_today: number;
  total_taken_today: number;
  total_missed_today: number;
  total_pending_today: number;
  overall_adherence_percentage: number;
  assigned_patients: CaregiverPatientSummary[];
  missed_alerts: CaregiverAlert[];
  recent_notifications: Notification[];
}

export interface CaregiverPatientDetail {
  patient: Patient;
  active_medicines: Medicine[];
  today_schedules: MedicineSchedule[];
  taken_schedules: MedicineSchedule[];
  missed_schedules: MedicineSchedule[];
  upcoming_schedules: MedicineSchedule[];
  medication_history: MedicationLog[];
  notifications: Notification[];
  active_alerts: CaregiverAlert[];
  adherence_percentage: number;
  adherence_breakdown: {
    total_logged: number;
    total_taken: number;
    total_missed: number;
    today_scheduled: number;
    today_completed: number;
  };
}

export interface AlertStatusUpdate {
  status: 'reviewed' | 'resolved' | 'active';
  notes?: string;
}

export interface PatientHomeScreenData {
  patient_id: number;
  patient_name: string;
  age?: number;
  gender?: string;
  profile_photo?: string;
  caregiver_name?: string;
  caregiver_phone?: string;
  server_time: string;
  formatted_date: string;
  formatted_time: string;
  active_reminder?: MedicineSchedule;
  next_medicine?: MedicineSchedule;
  today_schedules: MedicineSchedule[];
  today_total: number;
  today_taken: number;
  today_missed: number;
  today_pending: number;
  today_due: number;
  unread_notifications_count: number;
  adherence_percentage: number;
}

export interface AdminOverviewMetrics {
  total_users: number;
  patients: number;
  caregivers: number;
  admins: number;
  total_medicines: number;
  total_schedules: number;
  total_medication_logs: number;
  total_missed_alerts: number;
}

export interface AdminOverviewData {
  status: string;
  system: string;
  admin_user: string;
  metrics: AdminOverviewMetrics;
}


