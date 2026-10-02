import {
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  HeartPulse,
  AlertTriangle,
  Edit,
  User,
  Calendar,
  Pill,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import type { Patient } from '../types';

interface PatientProfileCardProps {
  patient?: Patient;
  onEdit?: (patient: Patient) => void;
  highContrast?: boolean;
  totalMedicines?: number;
  adherencePercentage?: number;
  todayTotalDoses?: number;
}

export const PatientProfileCard: React.FC<PatientProfileCardProps> = ({
  patient,
  onEdit,
  highContrast = false,
  totalMedicines = 4,
  adherencePercentage = 92,
  todayTotalDoses = 4,
}) => {
  const fullName = patient?.user?.full_name || 'Margaret Wilson';
  const age = patient?.age || 74;
  const gender = patient?.gender || 'Female';
  const dob = patient?.date_of_birth || '1952-03-12';
  const address = patient?.address || '42 Elmwood Grove, Apt 4B, Springfield, MA 01103';
  const phone = patient?.user?.phone_number || '+1 (555) 123-4567';
  const email = patient?.user?.email || 'patient@eldermed.org';
  const conditions = patient?.health_conditions?.split(',') || [
    'Hypertension',
    'Type 2 Diabetes Mellitus',
    'Mild Osteoarthritis',
  ];
  const allergies = patient?.allergies
    ? patient.allergies.split(',')
    : ['Penicillin (mild rash)'];

  const emergencyName = patient?.emergency_contact_name || 'Sarah Wilson (Daughter)';
  const emergencyPhone = patient?.emergency_contact_phone || '+1 (555) 987-6543';
  const emergencyRelation = patient?.emergency_contact_relation || 'Daughter';

  const caregiverName = patient?.caregiver_name || 'Sarah Wilson';
  const caregiverPhone = patient?.caregiver_phone || '+1 (555) 987-6543';
  const caregiverEmail = patient?.caregiver_email || 'caregiver@eldermed.org';

  const notes =
    patient?.notes ||
    'Prefers taking morning medications with warm water. Allergic to penicillin.';

  return (
    <div
      className={`rounded-3xl border-2 p-6 sm:p-8 shadow-sm space-y-8 text-left ${
        highContrast ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-slate-200'
      }`}
    >
      {/* Top Banner: Photo, Name, and Quick Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          {patient?.profile_photo ? (
            <img
              src={patient.profile_photo}
              alt={fullName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-200 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-2xl border border-sky-200 shrink-0">
              {fullName.charAt(0)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{fullName}</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Monitored Patient
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Patient ID: #{patient?.id || 1} • Registered on ElderMed Healthcare Network
            </p>
          </div>
        </div>

        {onEdit && patient && (
          <button
            onClick={() => onEdit(patient)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition self-start sm:self-auto"
          >
            <Edit className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* SECTION 1: PERSONAL INFORMATION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-black text-slate-900 border-b border-slate-100 pb-2">
          <User className="w-5 h-5 text-sky-600" />
          <h3>1. Personal Information</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</span>
            <div className="font-bold text-slate-900">{fullName}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Age & Gender</span>
            <div className="font-bold text-slate-900">{age} years • {gender}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-sky-600" /> Date of Birth
            </span>
            <div className="font-bold text-slate-900">{dob}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Phone className="w-3.5 h-3.5 text-sky-600" /> Contact Phone
            </span>
            <div className="font-bold text-slate-900">{phone}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Mail className="w-3.5 h-3.5 text-sky-600" /> Email Address
            </span>
            <div className="font-bold text-slate-900 truncate">{email}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-sky-600" /> Home Address
            </span>
            <div className="font-bold text-slate-900">{address}</div>
          </div>
        </div>
      </section>

      {/* SECTION 2: HEALTH INFORMATION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-black text-slate-900 border-b border-slate-100 pb-2">
          <HeartPulse className="w-5 h-5 text-rose-600" />
          <h3>2. Health Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Medical Diagnoses & Health Conditions
            </span>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                >
                  {c.trim()}
                </span>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-rose-900 block flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Known Allergies & Drug Warnings
            </span>
            <div className="flex flex-wrap gap-2">
              {allergies.map((a, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-100 text-rose-900 border border-rose-300"
                >
                  {a.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {notes && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong className="text-slate-900 font-bold">Clinical Care Notes:</strong> {notes}
          </div>
        )}
      </section>

      {/* SECTION 3: CAREGIVER INFORMATION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-black text-slate-900 border-b border-slate-100 pb-2">
          <HeartHandshake className="w-5 h-5 text-emerald-600" />
          <h3>3. Caregiver Information</h3>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
              Designated Primary Caregiver
            </span>
            <div className="text-lg font-black text-emerald-950">{caregiverName}</div>
            <div className="text-sm font-semibold text-emerald-800 flex items-center gap-3 flex-wrap">
              <span>Phone: {caregiverPhone}</span>
              <span>•</span>
              <span>Email: {caregiverEmail}</span>
            </div>
          </div>

          <a
            href={`tel:${caregiverPhone}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition self-start sm:self-auto"
          >
            <Phone className="w-4 h-4" /> Call Caregiver
          </a>
        </div>
      </section>

      {/* SECTION 4: EMERGENCY CONTACT */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-black text-slate-900 border-b border-slate-100 pb-2">
          <Phone className="w-5 h-5 text-amber-600" />
          <h3>4. Emergency Contact</h3>
        </div>

        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-amber-900">
              Immediate Emergency Response
            </span>
            <div className="text-lg font-black text-amber-950">
              {emergencyName} <span className="text-sm font-normal text-amber-800">({emergencyRelation})</span>
            </div>
            <div className="text-sm font-semibold text-amber-800">
              Phone: {emergencyPhone}
            </div>
          </div>

          <a
            href={`tel:${emergencyPhone}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow transition self-start sm:self-auto"
          >
            <Phone className="w-4 h-4" /> Emergency Dial
          </a>
        </div>
      </section>

      {/* SECTION 5: MEDICATION SUMMARY */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-black text-slate-900 border-b border-slate-100 pb-2">
          <Pill className="w-5 h-5 text-sky-600" />
          <h3>5. Medication Summary</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Prescriptions</span>
            <div className="text-3xl font-black text-slate-900">{totalMedicines}</div>
            <p className="text-xs text-slate-500 font-semibold">Active pharmaceutical orders</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Scheduled Doses</span>
            <div className="text-3xl font-black text-slate-900">{todayTotalDoses}</div>
            <p className="text-xs text-slate-500 font-semibold">Daily reminders scheduled</p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-1 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Adherence Score</span>
            <div className="text-3xl font-black text-emerald-700">{adherencePercentage}%</div>
            <p className="text-xs text-emerald-600 font-semibold flex items-center justify-center sm:justify-start gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> High Clinical Adherence
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
