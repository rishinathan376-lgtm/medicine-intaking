import React from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  AlertTriangle,
  ShieldCheck,
  Edit,
  LayoutDashboard,
} from 'lucide-react';
import type { Patient } from '../types';

interface PatientDetailsModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (patient: Patient) => void;
  onSelectDashboard: (patientId: number) => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  patient,
  isOpen,
  onClose,
  onEdit,
  onSelectDashboard,
}) => {
  if (!isOpen || !patient) return null;

  const fullName = patient.user?.full_name || 'Patient';
  const email = patient.user?.email || 'N/A';
  const phone = patient.user?.phone_number || 'N/A';
  const conditions = patient.health_conditions?.split(',') || [];
  const allergies = patient.allergies ? patient.allergies.split(',') : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            {patient.profile_photo ? (
              <img
                src={patient.profile_photo}
                alt={fullName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-200 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-2xl border border-sky-200">
                {fullName.charAt(0)}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900">{fullName}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Active
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Age: {patient.age || '—'} yrs • {patient.gender || 'Female'} • DOB: {patient.date_of_birth || '—'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-6 text-left text-sm">
          {/* 1. Contact & Address */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Contact & Location
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-sky-700 shrink-0" />
                <span><strong>Phone:</strong> {phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-700 shrink-0" />
                <span><strong>Email:</strong> {email}</span>
              </div>
              <div className="flex items-start gap-2 md:col-span-2">
                <MapPin className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <span><strong>Address:</strong> {patient.address || 'Address on file'}</span>
              </div>
            </div>
          </div>

          {/* 2. Medical Conditions */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <HeartPulse className="w-4 h-4 text-rose-600" /> Diagnosed Health Conditions
            </h4>
            {conditions.length === 0 ? (
              <p className="text-slate-400 text-sm italic">No specific health conditions recorded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {conditions.map((c, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200 shadow-xs"
                  >
                    {c.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 3. Allergies & Precautions (Critical Highlight) */}
          <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-700" /> Drug Allergies & Safety Precautions
            </h4>
            <div className="flex flex-wrap gap-2 pt-1">
              {allergies.length > 0 ? (
                allergies.map((a, i) => (
                  <span
                    key={i}
                    className="px-3 py-0.5 rounded-lg text-xs font-bold bg-rose-200/80 text-rose-950 border border-rose-300"
                  >
                    {a.trim()}
                  </span>
                ))
              ) : (
                <p className="text-xs font-semibold text-rose-800">No known drug allergies reported.</p>
              )}
            </div>
          </div>

          {/* 4. Emergency & Caregiver 2-Column Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block">
                Emergency Contact
              </span>
              <div className="text-base font-bold text-amber-950">
                {patient.emergency_contact_name || 'Emergency contact on file'}
              </div>
              <p className="text-sm font-semibold text-amber-800">
                {patient.emergency_contact_phone || '—'}
              </p>
              <span className="text-xs text-amber-700 block">
                Relation: {patient.emergency_contact_relation || 'Family'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700" /> Designated Caregiver
              </span>
              <div className="text-base font-bold text-emerald-950">
                {patient.caregiver_name || 'Sarah Wilson'}
              </div>
              <p className="text-sm font-semibold text-emerald-800">
                {patient.caregiver_phone || '+1 (555) 987-6543'}
              </p>
              <span className="text-xs text-emerald-700 block">
                Email: {patient.caregiver_email || 'caregiver@eldermed.org'}
              </span>
            </div>
          </div>

          {/* 5. Special Notes */}
          {patient.notes && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-500 block mb-1">
                Special Care Notes & Instructions
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{patient.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onSelectDashboard(patient.id);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow transition transform active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Open Patient Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(patient);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Details</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
