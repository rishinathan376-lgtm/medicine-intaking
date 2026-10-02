import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  Mail,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  LayoutDashboard,
} from 'lucide-react';
import type { Patient } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface PatientsManagementViewProps {
  patients: Patient[];
  selectedPatientId: number;
  onSelectPatient: (patientId: number) => void;
  onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void;
  onViewPatient: (patient: Patient) => void;
  onDeletePatient: (patientId: number) => Promise<void>;
  highContrast?: boolean;
}

export const PatientsManagementView: React.FC<PatientsManagementViewProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  onEditPatient,
  onViewPatient,
  onDeletePatient,
  highContrast = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Client-side filtering in addition to backend search
  const filteredPatients = patients.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = p.user?.full_name?.toLowerCase() || '';
    const phone = p.user?.phone_number?.toLowerCase() || '';
    const email = p.user?.email?.toLowerCase() || '';
    const conditions = p.health_conditions?.toLowerCase() || '';
    const caregiver = p.caregiver_name?.toLowerCase() || '';
    return (
      name.includes(term) ||
      phone.includes(term) ||
      email.includes(term) ||
      conditions.includes(term) ||
      caregiver.includes(term)
    );
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    setDeleting(true);
    try {
      await onDeletePatient(patientToDelete.id);
      showToast(`✓ Patient record for ${patientToDelete.user?.full_name} deleted.`);
      setPatientToDelete(null);
    } catch (err: any) {
      showToast(`Error deleting patient: ${err.message || 'Action failed'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Search, View Mode, Add Patient */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Patient Directory & Management</h2>
          <p className="text-sm font-semibold text-slate-500">
            View profiles, health conditions, assigned caregivers, and switch active patient dashboard.
          </p>
        </div>

        <button
          onClick={onAddPatient}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-base shadow-md transition transform active:scale-95 shrink-0"
        >
          <UserPlus className="w-5 h-5" />
          <span>Add New Patient</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patients by name, phone, conditions, or caregiver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 text-sm font-medium"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end sm:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'cards'
                ? 'bg-white text-sky-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Card View"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'table'
                ? 'bg-white text-sky-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Table View"
          >
            <TableIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Zero State */}
      {filteredPatients.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border-2 border-slate-200">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-slate-700">No matching patients found</h3>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting your search criteria or register a new patient above.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => {
            const isSelected = patient.id === selectedPatientId;
            const fullName = patient.user?.full_name || 'Patient';
            const conditions = patient.health_conditions?.split(',') || [];

            return (
              <div
                key={patient.id}
                className={`p-6 rounded-3xl border-2 transition shadow-sm flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/40 ring-2 ring-sky-300'
                    : highContrast
                    ? 'bg-zinc-900 border-white text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header: Avatar & Name */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {patient.profile_photo ? (
                        <img
                          src={patient.profile_photo}
                          alt={fullName}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xl shrink-0">
                          {fullName.charAt(0)}
                        </div>
                      )}

                      <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">
                          {fullName}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          Age: {patient.age || '—'} yrs • {patient.gender || 'Female'}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-sky-600 text-white uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>{patient.user?.phone_number || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span className="truncate">{patient.user?.email || 'No email'}</span>
                    </div>
                  </div>

                  {/* Health Conditions */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Health Conditions:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
                      {conditions.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {c.trim()}
                        </span>
                      ))}
                      {conditions.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-lg text-xs font-semibold text-slate-400">
                          +{conditions.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Caregiver Snippet */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block">
                      Caregiver: {patient.caregiver_name || patient.emergency_contact_name || 'Sarah Wilson'}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {patient.caregiver_phone || patient.emergency_contact_phone || '+1 (555) 987-6543'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectPatient(patient.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>{isSelected ? 'Viewing' : 'Select Dashboard'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onViewPatient(patient)}
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditPatient(patient)}
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                      title="Edit Patient"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPatientToDelete(patient)}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Patient"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-4 px-6">Patient</th>
                  <th className="py-4 px-6">Contact</th>
                  <th className="py-4 px-6">Health Conditions</th>
                  <th className="py-4 px-6">Caregiver</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => {
                  const isSelected = patient.id === selectedPatientId;
                  const fullName = patient.user?.full_name || 'Patient';
                  const conditions = patient.health_conditions?.split(',') || [];

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isSelected ? 'bg-sky-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {patient.profile_photo ? (
                            <img
                              src={patient.profile_photo}
                              alt={fullName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm shrink-0">
                              {fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {fullName}
                              {isSelected && (
                                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-sky-600 text-white">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              Age: {patient.age || '—'} • {patient.gender || 'Female'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        <div className="font-semibold">{patient.user?.phone_number || '—'}</div>
                        <div className="text-slate-500">{patient.user?.email || '—'}</div>
                      </td>

                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {conditions.slice(0, 2).map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {c.trim()}
                            </span>
                          ))}
                          {conditions.length > 2 && (
                            <span className="text-[11px] text-slate-400 font-semibold">
                              +{conditions.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        <div className="font-bold">
                          {patient.caregiver_name || patient.emergency_contact_name || 'Sarah Wilson'}
                        </div>
                        <div className="text-slate-500">
                          {patient.caregiver_phone || patient.emergency_contact_phone || '—'}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectPatient(patient.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              isSelected
                                ? 'bg-sky-600 text-white'
                                : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                            }`}
                          >
                            {isSelected ? 'Active' : 'Select'}
                          </button>
                          <button
                            onClick={() => onViewPatient(patient)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditPatient(patient)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPatientToDelete(patient)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Patient Confirmation Modal */}
      {patientToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setPatientToDelete(null)}
          onConfirm={confirmDelete}
          title="Delete Patient Record"
          message={
            <span>
              Are you sure you want to permanently delete the patient record for{' '}
              <strong>{patientToDelete.user?.full_name}</strong>? All associated prescriptions, dose schedules, and medication logs will also be removed.
            </span>
          }
          confirmLabel="Delete Patient"
          variant="danger"
          isLoading={deleting}
          highContrast={highContrast}
        />
      )}

      {/* Toast Notice */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
