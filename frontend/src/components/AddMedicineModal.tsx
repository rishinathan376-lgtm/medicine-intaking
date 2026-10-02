import React, { useState, useEffect } from 'react';
import { X, Pill, Check, Clock, Plus, AlertCircle } from 'lucide-react';
import type { Medicine, MedicineFormData } from '../types';

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MedicineFormData) => Promise<void>;
  patientId: number;
  medicineToEdit?: Medicine | null;
}

const MEDICINE_TYPES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Drops',
  'Inhaler',
  'Patch',
  'Ointment',
];

const PRESET_TIMES = [
  { label: 'Morning', time: '08:00' },
  { label: 'Noon', time: '13:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '21:00' },
];

export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  patientId,
  medicineToEdit,
}) => {
  const [name, setName] = useState('');
  const [medicineType, setMedicineType] = useState('Tablet');
  const [dosage, setDosage] = useState('');
  const [quantity, setQuantity] = useState('30');
  const [frequency, setFrequency] = useState('Once daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00']);
  const [newTimeInput, setNewTimeInput] = useState('14:00');
  const [beforeAfterFood, setBeforeAfterFood] = useState<'before_food' | 'after_food' | 'with_food' | 'none'>('after_food');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (medicineToEdit) {
      setName(medicineToEdit.name || '');
      setMedicineType(medicineToEdit.medicine_type || 'Tablet');
      setDosage(medicineToEdit.dosage || '');
      setQuantity(medicineToEdit.quantity?.toString() || '30');
      setFrequency(medicineToEdit.frequency || 'Once daily');
      setStartDate(medicineToEdit.start_date || new Date().toISOString().split('T')[0]);
      setEndDate(medicineToEdit.end_date || '');
      
      const times = medicineToEdit.times_list?.length
        ? medicineToEdit.times_list
        : medicineToEdit.reminder_times
        ? medicineToEdit.reminder_times.split(',').map((t) => t.trim())
        : ['08:00'];
      setReminderTimes(times);

      setBeforeAfterFood(medicineToEdit.before_after_food || 'after_food');
      setInstructions(medicineToEdit.instructions || '');
      setNotes(medicineToEdit.additional_notes || '');
    } else {
      setName('');
      setMedicineType('Tablet');
      setDosage('');
      setQuantity('30');
      setFrequency('Once daily');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setReminderTimes(['08:00']);
      setBeforeAfterFood('after_food');
      setInstructions('');
      setNotes('');
    }
    setError(null);
  }, [medicineToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddTime = (timeToAdd: string) => {
    if (!timeToAdd) return;
    if (reminderTimes.includes(timeToAdd)) return;
    const sorted = [...reminderTimes, timeToAdd].sort();
    setReminderTimes(sorted);
  };

  const handleRemoveTime = (timeToRemove: string) => {
    if (reminderTimes.length <= 1) {
      setError('A prescription must have at least one scheduled reminder time.');
      return;
    }
    setReminderTimes(reminderTimes.filter((t) => t !== timeToRemove));
  };

  const formatDisplayTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHour = h % 12 || 12;
      return `${formattedHour}:${m < 10 ? '0' : ''}${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide the medicine name.');
      return;
    }
    if (!dosage.trim()) {
      setError('Please provide the dosage (e.g. 500 mg, 1 Tablet).');
      return;
    }
    if (reminderTimes.length === 0) {
      setError('Please add at least one reminder time.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: MedicineFormData = {
      patient_id: patientId,
      name: name.trim(),
      medicine_type: medicineType,
      dosage: dosage.trim(),
      quantity: parseInt(quantity, 10) || 30,
      frequency,
      reminder_times: reminderTimes,
      start_date: startDate,
      end_date: endDate ? endDate : undefined,
      before_after_food: beforeAfterFood,
      instructions: instructions.trim() || undefined,
      additional_notes: notes.trim() || undefined,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving prescription');
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!medicineToEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {isEditMode ? 'Edit Prescription' : 'Prescribe Medicine'}
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Multi-Time Scheduling & Safety Rules
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

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Medicine Name & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-900 mb-1">
                Medicine Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Paracetamol / Metformin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-base font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">
                Form / Type
              </label>
              <select
                value={medicineType}
                onChange={(e) => setMedicineType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
              >
                {MEDICINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dosage & Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">
                Dosage *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 500 mg, 1 Tablet, 10 ml"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">
                Stock Quantity (Units / Pills)
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
              />
            </div>
          </div>

          {/* Frequency & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
              >
                <option value="Once daily">Once daily</option>
                <option value="Twice daily">Twice daily</option>
                <option value="3 times per day">3 times per day</option>
                <option value="4 times per day">4 times per day</option>
                <option value="Every 8 hours">Every 8 hours</option>
                <option value="Every 12 hours">Every 12 hours</option>
                <option value="As needed (PRN)">As needed (PRN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium bg-white"
              />
            </div>
          </div>

          {/* MULTI-TIME REMINDER BUILDER */}
          <div className="p-4 rounded-2xl bg-sky-50/70 border-2 border-sky-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-700" />
                Scheduled Reminder Times (Multiple per day) *
              </label>
              <span className="text-[11px] font-bold text-sky-700">
                {reminderTimes.length} time(s) set
              </span>
            </div>

            {/* List of active time chips */}
            <div className="flex flex-wrap gap-2">
              {reminderTimes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm bg-white text-sky-950 border border-sky-300 shadow-xs"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  {formatDisplayTime(t)}
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(t)}
                    className="w-5 h-5 rounded-full hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-400 transition ml-1"
                    title={`Remove ${t}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Custom Time Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="time"
                value={newTimeInput}
                onChange={(e) => setNewTimeInput(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-sky-300 bg-white text-sm font-semibold focus:border-sky-600"
              />
              <button
                type="button"
                onClick={() => handleAddTime(newTimeInput)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Add Time
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-sky-200/60">
              <span className="text-[11px] font-bold text-sky-800 mr-1">Quick Add:</span>
              {PRESET_TIMES.map((p) => (
                <button
                  type="button"
                  key={p.time}
                  onClick={() => handleAddTime(p.time)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition ${
                    reminderTimes.includes(p.time)
                      ? 'bg-sky-200 text-sky-900 border-sky-400'
                      : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  {p.label} ({p.time})
                </button>
              ))}
            </div>
          </div>

          {/* Food Instructions */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              Food Relationship
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'after_food', label: 'After Food' },
                { id: 'before_food', label: 'Before Food' },
                { id: 'with_food', label: 'With Food' },
                { id: 'none', label: 'No Constraint' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setBeforeAfterFood(item.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    beforeAfterFood === item.id
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Instructions */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              Instructions
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Swallow with a full glass of water. Do not crush or chew."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              Additional Notes & Precautions
            </label>
            <input
              type="text"
              placeholder="e.g. Check blood pressure before taking; report dizziness"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 text-sm font-medium"
            />
          </div>

          {/* Action buttons */}
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
              <Check className="w-5 h-5" />
              <span>{loading ? 'Saving...' : isEditMode ? 'Update Medicine' : 'Save Prescription'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
