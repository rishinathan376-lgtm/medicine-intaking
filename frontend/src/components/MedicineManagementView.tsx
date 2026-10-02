import React, { useState } from 'react';
import {
  Pill,
  Search,
  PlusCircle,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Power,
  Edit,
  Trash2,
  Utensils,
  Check,
} from 'lucide-react';
import type { Medicine, Patient, PatientMedicineOverview } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface MedicineManagementViewProps {
  patient: Patient | null;
  medicines: Medicine[];
  overview: PatientMedicineOverview | null;
  onAddMedicine: () => void;
  onEditMedicine: (medicine: Medicine) => void;
  onToggleActive: (medicineId: number) => Promise<void>;
  onDeleteMedicine: (medicineId: number) => Promise<void>;
  highContrast?: boolean;
}

type MedicineCategory = 'all' | 'today' | 'upcoming' | 'active' | 'completed';

export const MedicineManagementView: React.FC<MedicineManagementViewProps> = ({
  patient,
  medicines,
  overview,
  onAddMedicine,
  onEditMedicine,
  onToggleActive,
  onDeleteMedicine,
  highContrast = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<MedicineCategory>('all');
  const [medicineToDelete, setMedicineToDelete] = useState<Medicine | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const patientName = patient?.user?.full_name || 'Margaret Wilson';

  // Format 24-hr time e.g. "08:00" to "8:00 AM"
  const formatTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHour = h % 12 || 12;
      return `${formattedHour}:${m < 10 ? '0' : ''}${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const foodInstructionLabel = (foodTag?: string) => {
    switch (foodTag) {
      case 'before_food':
        return 'Before Food';
      case 'after_food':
        return 'After Food';
      case 'with_food':
        return 'With Food';
      default:
        return 'No Food Constraint';
    }
  };

  // Determine list based on category
  const getCategoryList = (): Medicine[] => {
    const today = new Date().toISOString().split('T')[0];
    switch (activeCategory) {
      case 'active':
        return medicines.filter((m) => m.is_active && (!m.end_date || m.end_date >= today));
      case 'completed':
        return medicines.filter((m) => !m.is_active || (m.end_date && m.end_date < today));
      case 'today':
      case 'upcoming':
      case 'all':
      default:
        return medicines;
    }
  };

  const filteredMedicines = getCategoryList().filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.dosage.toLowerCase().includes(term) ||
      (m.medicine_type && m.medicine_type.toLowerCase().includes(term)) ||
      (m.instructions && m.instructions.toLowerCase().includes(term))
    );
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleToggle = async (medicineId: number) => {
    setTogglingId(medicineId);
    try {
      await onToggleActive(medicineId);
    } catch (err: any) {
      showToast(`Error updating medicine: ${err.message || 'Action failed'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!medicineToDelete) return;
    setDeleting(true);
    try {
      await onDeleteMedicine(medicineToDelete.id);
      showToast(`✓ Prescription for ${medicineToDelete.name} deleted.`);
      setMedicineToDelete(null);
    } catch (err: any) {
      showToast(`Error deleting medicine: ${err.message || 'Action failed'}`);
    } finally {
      setDeleting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-black text-slate-900">Medicine Management</h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
              {patientName}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Configure prescriptions, multiple daily reminder times, food timings, and stock inventory.
          </p>
        </div>

        <button
          onClick={onAddMedicine}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-base shadow-md transition transform active:scale-95 shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Prescribe Medicine</span>
        </button>
      </div>

      {/* Category Tabs: All, Today, Upcoming, Active, Completed */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'all' as MedicineCategory, label: 'All Prescriptions', count: medicines.length },
          {
            id: 'today' as MedicineCategory,
            label: "Today's Schedule",
            count: overview?.today_schedules.length || 0,
          },
          {
            id: 'upcoming' as MedicineCategory,
            label: 'Upcoming Doses Today',
            count: overview?.upcoming_schedules.length || 0,
          },
          {
            id: 'active' as MedicineCategory,
            label: 'Active Prescriptions',
            count: medicines.filter((m) => m.is_active && (!m.end_date || m.end_date >= today)).length,
          },
          {
            id: 'completed' as MedicineCategory,
            label: 'Completed / Expired',
            count: medicines.filter((m) => !m.is_active || (m.end_date && m.end_date < today)).length,
          },
        ].map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition border ${
                isActive
                  ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SPECIAL SUB-VIEW: TODAY'S SCHEDULES */}
      {activeCategory === 'today' && overview && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-700" />
            Today's Scheduled Medication Timeline ({overview.today_schedules.length} Doses)
          </h3>
          {overview.today_schedules.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200">
              <p className="text-slate-500 font-semibold">No doses scheduled for today.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.today_schedules.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                    s.status === 'taken'
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : s.status === 'missed'
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-slate-900">
                        {formatTime(s.scheduled_time)}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {s.medicine?.medicine_type || 'Tablet'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900">{s.medicine?.name}</div>
                    <div className="text-xs font-semibold text-slate-500">{s.medicine?.dosage}</div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                      s.status === 'taken'
                        ? 'bg-emerald-200 text-emerald-900'
                        : s.status === 'missed'
                        ? 'bg-rose-200 text-rose-900'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {s.status === 'taken' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {s.status === 'missed' && <AlertCircle className="w-3.5 h-3.5" />}
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SPECIAL SUB-VIEW: UPCOMING DOSES TODAY */}
      {activeCategory === 'upcoming' && overview && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Upcoming Doses Remaining Today ({overview.upcoming_schedules.length})
          </h3>
          {overview.upcoming_schedules.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200">
              <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-slate-800 font-bold">All doses for today have been completed!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.upcoming_schedules.map((s) => (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/50 flex items-center justify-between"
                >
                  <div>
                    <span className="px-2.5 py-1 rounded-lg font-black text-sm bg-sky-700 text-white">
                      {formatTime(s.scheduled_time)}
                    </span>
                    <h4 className="text-xl font-black text-slate-900 mt-2">{s.medicine?.name}</h4>
                    <p className="text-sm font-semibold text-sky-800">{s.medicine?.dosage}</p>
                    <p className="text-xs text-slate-600 mt-1">{s.medicine?.instructions}</p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-200 text-amber-950">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH INPUT BAR */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by medicine name, dosage, form, or instructions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-sky-500 bg-white text-sm font-medium shadow-xs"
        />
      </div>

      {/* MEDICINE CARDS LIST */}
      {filteredMedicines.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border-2 border-slate-200">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-xl font-bold text-slate-700">No prescriptions found</h4>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting your search query or add a new prescription above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMedicines.map((med) => {
            const isExpired = med.end_date && med.end_date < today;
            const statusLabel = isExpired ? 'Expired' : med.is_active ? 'Active' : 'Disabled';
            const statusBadgeColor = isExpired
              ? 'bg-slate-200 text-slate-700'
              : med.is_active
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-amber-100 text-amber-900 border-amber-300';

            const times = med.times_list?.length
              ? med.times_list
              : med.reminder_times
              ? med.reminder_times.split(',').map((t) => t.trim())
              : [];

            return (
              <div
                key={med.id}
                className={`p-6 md:p-7 rounded-3xl border-2 transition shadow-sm flex flex-col justify-between ${
                  !med.is_active
                    ? 'bg-slate-100/60 border-slate-300 opacity-80'
                    : highContrast
                    ? 'bg-zinc-900 border-white text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header: Type Badge, Name, Dosage & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
                          {med.medicine_type || 'Tablet'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadgeColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">
                        {med.name}
                      </h3>
                      <p className="text-base font-bold text-sky-800 mt-0.5">
                        {med.dosage} • {med.frequency}
                      </p>
                    </div>

                    {/* Stock Quantity Tag */}
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold uppercase text-slate-400 block">Stock</span>
                      <span
                        className={`text-lg font-black ${
                          med.quantity < 10 ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {med.quantity} doses
                      </span>
                    </div>
                  </div>

                  {/* Multiple Reminder Times Display */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      Daily Reminder Times ({times.length} scheduled)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {times.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded-xl text-xs font-black bg-sky-50 text-sky-900 border border-sky-300 shadow-2xs"
                        >
                          {formatTime(t)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Details: Dates & Food Instructions */}
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="font-semibold">{foodInstructionLabel(med.before_after_food)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>
                        {med.start_date} {med.end_date ? `to ${med.end_date}` : '(Ongoing)'}
                      </span>
                    </div>
                  </div>

                  {/* Instructions */}
                  {med.instructions && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                      <strong>Instructions:</strong> {med.instructions}
                    </p>
                  )}
                </div>

                {/* Card Actions: Toggle Active, Edit, Delete */}
                <div className="pt-4 mt-5 border-t border-slate-200 flex items-center justify-between gap-3">
                  {/* Enable / Disable toggle button */}
                  <button
                    disabled={togglingId === med.id}
                    onClick={() => handleToggle(med.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      med.is_active
                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{togglingId === med.id ? 'Updating...' : med.is_active ? 'Disable' : 'Enable'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditMedicine(med)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="Edit Prescription"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setMedicineToDelete(med)}
                      className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                      title="Delete Medicine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {medicineToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setMedicineToDelete(null)}
          onConfirm={confirmDelete}
          title="Delete Prescription"
          message={
            <span>
              Are you sure you want to permanently delete <strong>{medicineToDelete.name}</strong> ({medicineToDelete.dosage})? All scheduled reminders and medication logs for this medicine will also be removed.
            </span>
          }
          confirmLabel="Delete Prescription"
          variant="danger"
          isLoading={deleting}
          highContrast={highContrast}
        />
      )}

      {/* Local Toast Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
