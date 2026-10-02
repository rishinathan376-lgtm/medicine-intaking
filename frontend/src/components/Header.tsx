import React from 'react';
import { Phone, Heart, ShieldAlert, Users, Shield, User, HeartHandshake } from 'lucide-react';
import type { Patient, UserRole } from '../types';

interface HeaderProps {
  patient?: Patient;
  patientsList?: Patient[];
  onSelectPatient?: (patientId: number) => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  fontSize: 'normal' | 'large' | 'xl';
  setFontSize: (size: 'normal' | 'large' | 'xl') => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  onCallCaregiver: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  patient,
  patientsList = [],
  onSelectPatient,
  currentRole,
  onSelectRole,
  fontSize,
  setFontSize,
  highContrast,
  setHighContrast,
  onCallCaregiver,
}) => {
  const patientName = patient?.user?.full_name || 'Margaret Wilson';
  const emergencyPhone = patient?.emergency_contact_phone || patient?.caregiver_phone || '+1 (555) 987-6543';
  const emergencyContactName = patient?.emergency_contact_name || patient?.caregiver_name || 'Sarah Wilson (Daughter)';

  return (
    <header className="w-full shadow-sm">
      {/* 1. Accessibility & Emergency Top Ribbon */}
      <div
        className={`w-full px-4 py-2 transition-colors border-b flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
          highContrast
            ? 'bg-black text-yellow-300 border-yellow-400'
            : 'bg-amber-50 text-amber-950 border-amber-200'
        }`}
      >
        {/* Emergency contact info with clear click to call */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-black px-2 py-0.5 rounded bg-red-600 text-white text-[11px] uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5" /> Emergency
          </span>
          <span>Caregiver Contact: <strong>{emergencyContactName}</strong></span>
          <a
            href={`tel:${emergencyPhone}`}
            className="inline-flex items-center gap-1 font-bold underline text-blue-700 hover:text-blue-900 ml-1"
            title={`Direct call ${emergencyPhone}`}
          >
            <Phone className="w-3.5 h-3.5" /> {emergencyPhone}
          </a>
        </div>

        {/* Accessibility Controls: Font Size & Contrast */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded-xl border border-amber-300 text-slate-800">
            <span className="text-xs font-bold mr-1">Text:</span>
            <button
              onClick={() => setFontSize('normal')}
              className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                fontSize === 'normal' ? 'bg-sky-600 text-white' : 'hover:bg-amber-100 text-slate-700'
              }`}
              title="Standard text size"
            >
              A
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-2 py-0.5 rounded text-sm font-bold transition ${
                fontSize === 'large' ? 'bg-sky-600 text-white' : 'hover:bg-amber-100 text-slate-700'
              }`}
              title="Large text size"
            >
              A+
            </button>
            <button
              onClick={() => setFontSize('xl')}
              className={`px-2.5 py-0.5 rounded text-base font-extrabold transition ${
                fontSize === 'xl' ? 'bg-sky-600 text-white' : 'hover:bg-amber-100 text-slate-700'
              }`}
              title="Extra large text size"
            >
              A++
            </button>
          </div>

          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
              highContrast
                ? 'bg-yellow-300 text-black border-black font-black'
                : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {highContrast ? 'Standard' : 'High Contrast'}
          </button>
        </div>
      </div>

      {/* 2. Main Navigation & Branding Banner */}
      <div
        className={`px-4 sm:px-8 py-3.5 border-b flex flex-wrap items-center justify-between gap-4 ${
          highContrast ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white border-slate-200'
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-sky-900">ElderMed</h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Healthcare System
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Medicine Intaking & Reminder Assistant</p>
          </div>
        </div>

        {/* Role Selector & Identity Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Active Role Switcher Badge */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => onSelectRole('patient')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                currentRole === 'patient'
                  ? 'bg-sky-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Patient view"
            >
              <User className="w-3.5 h-3.5" />
              <span>Patient</span>
            </button>

            <button
              onClick={() => onSelectRole('caregiver')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                currentRole === 'caregiver'
                  ? 'bg-sky-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Caregiver view"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Caregiver</span>
            </button>

            <button
              onClick={() => onSelectRole('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                currentRole === 'admin'
                  ? 'bg-sky-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Admin view"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Patient Quick Selector (Visible in Patient & Caregiver mode) */}
          {currentRole !== 'admin' && patientsList.length > 1 && onSelectPatient && (
            <div className="relative flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
              <Users className="w-4 h-4 text-sky-700 mr-1.5 shrink-0" />
              <select
                value={patient?.id || ''}
                onChange={(e) => onSelectPatient(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-3"
                aria-label="Select active patient"
              >
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user?.full_name} ({p.age} yrs)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Patient Badge */}
          {currentRole !== 'admin' && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {patientName.charAt(0)}
              </div>
              <span className="font-bold text-slate-800">{patientName}</span>
            </div>
          )}

          {/* Emergency Call Button */}
          <button
            onClick={onCallCaregiver}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition transform active:scale-95"
            title="Call primary emergency caregiver"
          >
            <Phone className="w-4 h-4" />
            <span>Call Caregiver</span>
          </button>
        </div>
      </div>
    </header>
  );
};
