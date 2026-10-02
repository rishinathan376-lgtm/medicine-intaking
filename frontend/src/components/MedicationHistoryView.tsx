import React, { useState, useEffect } from 'react';
import {
  History,
  Filter,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  RotateCcw,
} from 'lucide-react';
import type { MedicationLog, Patient, Medicine } from '../types';
import { ApiService } from '../services/api';

interface MedicationHistoryViewProps {
  patients: Patient[];
  selectedPatientId: number;
  onSelectPatient: (patientId: number) => void;
  currentPatient?: Patient;
  medicines: Medicine[];
  highContrast?: boolean;
}

export const MedicationHistoryView: React.FC<MedicationHistoryViewProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  currentPatient,
  medicines,
  highContrast = false,
}) => {
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters state
  const [patientFilter, setPatientFilter] = useState<number>(selectedPatientId);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [medicineFilter, setMedicineFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadLogs = async (patientId: number) => {
    setLoading(true);
    try {
      const data = await ApiService.getMedicationLogs(patientId);
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPatientFilter(selectedPatientId);
    loadLogs(selectedPatientId);
  }, [selectedPatientId]);

  const handlePatientChange = (id: number) => {
    setPatientFilter(id);
    onSelectPatient(id);
    loadLogs(id);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setMedicineFilter('all');
    setDateFilter('');
    setSearchFilter('');
  };

  // Filter logs locally
  const filteredLogs = logs.filter((log) => {
    // 1. Status Filter
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;

    // 2. Medicine Filter
    if (medicineFilter !== 'all') {
      const medId = parseInt(medicineFilter);
      if (log.medicine_id !== medId) return false;
    }

    // 3. Date Filter
    if (dateFilter) {
      const logDate = log.scheduled_date || log.created_at.split('T')[0];
      if (logDate !== dateFilter) return false;
    }

    // 4. Text Search
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase().trim();
      const medName = log.medicine?.name?.toLowerCase() || '';
      const notes = (log.patient_notes || log.caregiver_notes || '').toLowerCase();
      if (!medName.includes(term) && !notes.includes(term)) return false;
    }

    return true;
  });

  const activePatientObj = patients.find((p) => p.id === patientFilter) || currentPatient;

  return (
    <div className={`space-y-6 text-left ${highContrast ? 'contrast-125' : ''}`}>
      {/* Title & Patient Selector Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Medication Adherence History{activePatientObj?.user?.full_name ? `: ${activePatientObj.user.full_name}` : ''}
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Verified Audit Logs
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Historical logs of scheduled, taken, and missed medication doses.
          </p>
        </div>

        {/* Patient Switcher Filter */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-2xs self-start md:self-auto">
          <Users className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-500">Patient:</span>
          <select
            value={patientFilter}
            onChange={(e) => handlePatientChange(Number(e.target.value))}
            className="bg-transparent font-bold text-sm text-slate-900 focus:outline-none cursor-pointer pr-2"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.user?.full_name} ({p.age} yrs)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FILTER BAR: Status, Medicine, Date, Search, Reset */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Filter Audit Records</span>
          </div>

          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['all', 'taken', 'missed'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  statusFilter === f
                    ? f === 'taken'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : f === 'missed'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* 2. Medicine Filter */}
          <div className="relative">
            <select
              value={medicineFilter}
              onChange={(e) => setMedicineFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Prescribed Medicines</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.dosage})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date Filter */}
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* 4. Text Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notes or medicines..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* TABLE / AUDIT LOG LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-500">Loading medication history records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-base font-bold text-slate-700">No medication history available</div>
            <p className="text-xs text-slate-400">
              No audit logs match your selected filter criteria. Try adjusting or resetting the filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Medicine & Dosage</th>
                  <th className="py-4 px-6">Scheduled Time</th>
                  <th className="py-4 px-6">Actual Time</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Notes / Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const logDate = log.scheduled_date || log.created_at.split('T')[0];
                  const isTaken = log.status === 'taken';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      {/* Date */}
                      <td className="py-4 px-6 font-semibold text-slate-700 text-xs sm:text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{logDate}</span>
                        </div>
                      </td>

                      {/* Medicine */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">
                          {log.medicine?.name || 'Prescribed Dose'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {log.medicine?.dosage} • {log.medicine?.medicine_type || 'Tablet'}
                        </div>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-4 px-6 font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.scheduled_time}</span>
                        </div>
                      </td>

                      {/* Actual Taken Time */}
                      <td className="py-4 px-6 text-slate-600 whitespace-nowrap">
                        {log.actual_taken_time
                          ? new Date(log.actual_taken_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isTaken ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertCircle className="w-3.5 h-3.5" /> Missed
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-6 text-xs text-slate-600 max-w-xs truncate">
                        {log.patient_notes || log.caregiver_notes || 'Confirmed via reminder system'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
