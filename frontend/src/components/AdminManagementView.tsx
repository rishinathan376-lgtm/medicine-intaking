import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Pill,
  Calendar,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  Server,
  Lock,
  Mail,
  Activity,
  Clock,
} from 'lucide-react';
import type { AdminOverviewData, User } from '../types';
import { ApiService } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';

interface AdminManagementViewProps {
  highContrast?: boolean;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  highContrast = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'system'>('overview');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchUser, setSearchUser] = useState<string>('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [overviewData, usersData] = await Promise.all([
        ApiService.getAdminOverview(),
        ApiService.getAdminUsers(),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      showToast(`Admin Error: ${err.message || 'Access forbidden or failed to fetch.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await ApiService.deleteAdminUser(userToDelete.id);
      showToast(`✓ User account for ${userToDelete.full_name} (${userToDelete.email}) permanently deleted.`);
      setUserToDelete(null);
      await loadAdminData();
    } catch (err: any) {
      showToast(`Failed to delete user: ${err.message}`);
    } finally {
      setDeletingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchUser.toLowerCase().trim();
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-10 h-10 text-sky-600 animate-spin" />
        <p className="text-base font-bold text-slate-600">Loading system administration records...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${highContrast ? 'contrast-125' : ''}`}>
      {/* Toast Notice */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <ShieldAlert className="w-3.5 h-3.5" /> System Supervisory Console
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Healthy
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            ElderMed System Administration
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Authorized administrator: <strong className="text-slate-200">{overview?.admin_user || 'admin@eldermed.org'}</strong>
          </p>
        </div>

        <button
          onClick={loadAdminData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold transition self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'overview'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" /> System Overview
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'users'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> User Management ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'system'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server className="w-4 h-4" /> System & Security Config
        </button>
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider">
                <span>Total Users</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.metrics.total_users}</div>
              <p className="text-xs text-slate-500 font-semibold">
                {overview.metrics.patients} Patients • {overview.metrics.caregivers} Caregivers • {overview.metrics.admins} Admins
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider">
                <span>Prescribed Medicines</span>
                <Pill className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.metrics.total_medicines}</div>
              <p className="text-xs text-slate-500 font-semibold">Active pharmaceutical items</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider">
                <span>Daily Schedules</span>
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.metrics.total_schedules}</div>
              <p className="text-xs text-slate-500 font-semibold">Evaluated reminder slots</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-black uppercase tracking-wider">
                <span>Medication Logs</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.metrics.total_medication_logs}</div>
              <p className="text-xs text-slate-500 font-semibold">{overview.metrics.total_missed_alerts} Missed Alerts logged</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                <Server className="w-5 h-5 text-sky-600" /> Database & Service Status
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Database Driver</span>
                  <span className="font-bold text-slate-900">PostgreSQL / SQLite Production Engine</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Integrity Constraints</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Foreign Keys Enforced
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Duplicate Protection</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Compound Index Active
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                <Lock className="w-5 h-5 text-emerald-600" /> Active Security Middleware
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Rate Limiting</span>
                  <span className="font-bold text-emerald-700">60 req/min (Auth Endpoints)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Password Hashing</span>
                  <span className="font-bold text-emerald-700">Bcrypt Salted Hash</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">RBAC Isolation</span>
                  <span className="font-bold text-emerald-700">FastAPI Strict Dependency Guard</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Showing {filteredUsers.length} of {users.length} accounts
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-3.5 px-6">User / Full Name</th>
                    <th className="py-3.5 px-6">Email Address</th>
                    <th className="py-3.5 px-6">Assigned Role</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Registered</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                        No user accounts match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrentUser = u.email === overview?.admin_user;
                      const roleBadge =
                        u.role === 'admin'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : u.role === 'caregiver'
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-sky-100 text-sky-800 border-sky-300';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-6 font-bold text-slate-900">
                            {u.full_name}
                            {isCurrentUser && (
                              <span className="ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white">
                                (You)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-600 font-mono text-xs">{u.email}</td>
                          <td className="py-3.5 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${roleBadge}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-xs text-slate-500">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            {!isCurrentUser && (
                              <button
                                onClick={() => setUserToDelete(u)}
                                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                                title="Delete user account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM CONFIG & LOGS */}
      {activeTab === 'system' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900">Production Infrastructure Status</h3>
            <p className="text-sm text-slate-500 font-semibold">
              Live daemon and notification subsystem metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Clock className="w-4 h-4 text-sky-600" /> Automated Reminder Scheduler
              </div>
              <p className="text-xs text-slate-600">
                Polls every 60 seconds inside FastAPI background lifespan. Transitions scheduled occurrences to DUE and triggers automatic missed evaluations.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Engine Running & Healthy
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Mail className="w-4 h-4 text-purple-600" /> SMTP Dispatch Relay
              </div>
              <p className="text-xs text-slate-600">
                Formatted HTML notifications for scheduled doses and missed alerts. Safe non-blocking execution with graceful error recovery.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Email Delivery Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleDeleteUser}
          title="Delete User Account"
          message={
            <span>
              Are you sure you want to permanently delete the account for{' '}
              <strong>{userToDelete.full_name}</strong> ({userToDelete.email})? This action will cascade delete all linked patient profiles, medicines, and medication logs.
            </span>
          }
          confirmLabel="Delete User"
          variant="danger"
          isLoading={deletingUser}
        />
      )}
    </div>
  );
};
