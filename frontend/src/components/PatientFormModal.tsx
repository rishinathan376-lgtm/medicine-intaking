import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';
import type { Patient, PatientFormData } from '../types';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PatientFormData) => Promise<void>;
  patientToEdit?: Patient | null;
}

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  patientToEdit,
}) => {
  const [formData, setFormData] = useState<PatientFormData>({
    full_name: '',
    email: '',
    phone_number: '',
    age: 70,
    gender: 'Female',
    date_of_birth: '1954-01-01',
    address: '',
    health_conditions: '',
    allergies: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: 'Daughter',
    caregiver_name: '',
    caregiver_phone: '',
    caregiver_email: '',
    profile_photo: '',
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (patientToEdit) {
      setFormData({
        full_name: patientToEdit.user?.full_name || '',
        email: patientToEdit.user?.email || '',
        phone_number: patientToEdit.user?.phone_number || '',
        age: patientToEdit.age || 70,
        gender: patientToEdit.gender || 'Female',
        date_of_birth: patientToEdit.date_of_birth || '',
        address: patientToEdit.address || '',
        health_conditions: patientToEdit.health_conditions || '',
        allergies: patientToEdit.allergies || '',
        emergency_contact_name: patientToEdit.emergency_contact_name || '',
        emergency_contact_phone: patientToEdit.emergency_contact_phone || '',
        emergency_contact_relation: patientToEdit.emergency_contact_relation || '',
        caregiver_name: patientToEdit.caregiver_name || '',
        caregiver_phone: patientToEdit.caregiver_phone || '',
        caregiver_email: patientToEdit.caregiver_email || '',
        profile_photo: patientToEdit.profile_photo || '',
        notes: patientToEdit.notes || '',
      });
    } else {
      // Default new patient
      setFormData({
        full_name: '',
        email: '',
        phone_number: '',
        age: 70,
        gender: 'Female',
        date_of_birth: '1954-01-01',
        address: '',
        health_conditions: '',
        allergies: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relation: 'Family Member',
        caregiver_name: '',
        caregiver_phone: '',
        caregiver_email: '',
        profile_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
        notes: '',
      });
    }
    setError(null);
  }, [patientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'age' ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setError('Please provide the patient full name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!formData.phone_number.trim()) {
      setError('Please provide a phone number for medical contact.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving patient details.');
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!patientToEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {isEditMode ? 'Edit Patient Information' : 'Register New Patient'}
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Comprehensive Healthcare Profile
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

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {/* SECTION 1: PERSONAL DETAILS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 mb-3 border-b border-sky-100 pb-1">
              1. Personal & Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="e.g. Margaret Wilson"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-sky-500 text-base font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. patient@eldermed.org"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  name="phone_number"
                  required
                  placeholder="e.g. +1 (555) 123-4567"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    name="age"
                    min="1"
                    max="125"
                    value={formData.age || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender || 'Female'}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  name="address"
                  placeholder="e.g. 42 Elmwood Grove, Apt 4B, Springfield, MA"
                  value={formData.address || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: MEDICAL CONDITIONS & ALLERGIES */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-3 border-b border-rose-100 pb-1">
              2. Medical Profile & Drug Allergies
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Health Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  name="health_conditions"
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Mild Osteoarthritis"
                  value={formData.health_conditions || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Known Allergies & Drug Adverse Reactions
                </label>
                <input
                  type="text"
                  name="allergies"
                  placeholder="e.g. Penicillin (rash), Sulfa drugs, Peanuts"
                  value={formData.allergies || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-rose-300 focus:border-rose-500 text-sm font-medium bg-rose-50/30"
                />
                <span className="text-xs text-rose-600 font-semibold block mt-0.5">
                  Crucial for medication interaction safety.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3: EMERGENCY CONTACT */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 border-b border-amber-100 pb-1">
              3. Emergency Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  placeholder="e.g. Sarah Wilson"
                  value={formData.emergency_contact_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  name="emergency_contact_phone"
                  placeholder="e.g. +1 (555) 987-6543"
                  value={formData.emergency_contact_phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  name="emergency_contact_relation"
                  placeholder="e.g. Daughter, Spouse, Son"
                  value={formData.emergency_contact_relation || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: CAREGIVER INFORMATION */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-3 border-b border-emerald-100 pb-1">
              4. Assigned Caregiver Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Caregiver Name
                </label>
                <input
                  type="text"
                  name="caregiver_name"
                  placeholder="e.g. Sarah Wilson / Nurse Jenny"
                  value={formData.caregiver_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Caregiver Phone
                </label>
                <input
                  type="text"
                  name="caregiver_phone"
                  placeholder="e.g. +1 (555) 987-6543"
                  value={formData.caregiver_phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Caregiver Email
                </label>
                <input
                  type="email"
                  name="caregiver_email"
                  placeholder="e.g. caregiver@eldermed.org"
                  value={formData.caregiver_email || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: PROFILE PHOTO & NOTES */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-200 pb-1">
              5. Profile Photo & Special Notes
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Profile Photo URL
                </label>
                <input
                  type="url"
                  name="profile_photo"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.profile_photo || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  Caregiver Notes & Preferences
                </label>
                <textarea
                  rows={2}
                  name="notes"
                  placeholder="e.g. Prefers taking morning meds with warm water. Needs assistance opening caps."
                  value={formData.notes || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base shadow transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Saving...' : isEditMode ? 'Update Patient' : 'Save Patient'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
