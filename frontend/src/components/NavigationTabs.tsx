import React from 'react';
import {
  Calendar,
  Users,
  Pill,
  History,
  User,
  HeartHandshake,
  Bell,
  Server,
  Activity,
  AlertTriangle,
  Home,
} from 'lucide-react';
import type { UserRole } from '../types';

export type NavigationTabId =
  | 'patient-home'
  | 'patient-today'
  | 'patient-history'
  | 'patient-notifications'
  | 'patient-profile'
  | 'caregiver-dashboard'
  | 'caregiver-patients'
  | 'caregiver-medicines'
  | 'caregiver-alerts'
  | 'caregiver-history'
  | 'caregiver-profile'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-patients'
  | 'admin-system';

interface NavigationTabsProps {
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  pendingCount: number;
  dueCount?: number;
  alertsCount?: number;
  totalMedicinesCount: number;
  totalPatientsCount: number;
  highContrast?: boolean;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  currentRole,
  activeTab,
  setActiveTab,
  pendingCount,
  dueCount = 0,
  alertsCount = 0,
  totalMedicinesCount,
  totalPatientsCount,
  highContrast = false,
}) => {
  // Navigation item configurations per authorized role
  const patientTabs = [
    {
      id: 'patient-home',
      label: 'Home',
      icon: <Home className="w-5 h-5 shrink-0" />,
      badge: dueCount > 0 ? `${dueCount} Due Now` : pendingCount > 0 ? `${pendingCount} Next` : 'On Track',
      badgeColor:
        dueCount > 0
          ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
          : pendingCount > 0
          ? 'bg-sky-100 text-sky-900 border-sky-300'
          : 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'patient-today',
      label: "Today's Medicines",
      icon: <Calendar className="w-5 h-5 shrink-0" />,
      badge: `${totalMedicinesCount} Active`,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    },
    {
      id: 'patient-history',
      label: 'History',
      icon: <History className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'patient-notifications',
      label: 'Notifications',
      icon: <Bell className="w-5 h-5 shrink-0" />,
      badge: alertsCount > 0 ? `${alertsCount} New` : undefined,
      badgeColor: 'bg-rose-500 text-white border-rose-600',
    },
    {
      id: 'patient-profile',
      label: 'Profile',
      icon: <User className="w-5 h-5 shrink-0" />,
    },
  ];

  const caregiverTabs = [
    {
      id: 'caregiver-dashboard',
      label: 'Dashboard',
      icon: <HeartHandshake className="w-5 h-5 shrink-0" />,
      badge: alertsCount > 0 ? `${alertsCount} Alerts` : 'Healthy',
      badgeColor:
        alertsCount > 0
          ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
          : 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'caregiver-patients',
      label: 'Patients',
      icon: <Users className="w-5 h-5 shrink-0" />,
      badge: `${totalPatientsCount} Assigned`,
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    },
    {
      id: 'caregiver-medicines',
      label: 'Medicines',
      icon: <Pill className="w-5 h-5 shrink-0" />,
      badge: `${totalMedicinesCount} Total`,
      badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    {
      id: 'caregiver-alerts',
      label: 'Alerts',
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
      badge: alertsCount > 0 ? `${alertsCount} Unresolved` : undefined,
      badgeColor: 'bg-amber-500 text-white border-amber-600',
    },
    {
      id: 'caregiver-history',
      label: 'History',
      icon: <History className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'caregiver-profile',
      label: 'Profile',
      icon: <User className="w-5 h-5 shrink-0" />,
    },
  ];

  const adminTabs = [
    {
      id: 'admin-dashboard',
      label: 'Dashboard',
      icon: <Activity className="w-5 h-5 shrink-0" />,
      badge: 'Operational',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'admin-users',
      label: 'Users',
      icon: <Users className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'admin-patients',
      label: 'Patients',
      icon: <User className="w-5 h-5 shrink-0" />,
      badge: `${totalPatientsCount} Records`,
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    },
    {
      id: 'admin-system',
      label: 'System Management',
      icon: <Server className="w-5 h-5 shrink-0" />,
    },
  ];

  const tabs =
    currentRole === 'patient'
      ? patientTabs
      : currentRole === 'caregiver'
      ? caregiverTabs
      : adminTabs;

  return (
    <nav
      className="w-full flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
      aria-label={`${currentRole} portal navigation`}
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base whitespace-nowrap transition border-2 shadow-sm ${
              isActive
                ? highContrast
                  ? 'bg-yellow-300 text-black border-yellow-400'
                  : 'bg-sky-700 text-white border-sky-800 shadow-md'
                : highContrast
                ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge && (
              <span
                className={`ml-1 text-xs font-black px-2.5 py-0.5 rounded-full border ${
                  isActive
                    ? highContrast
                      ? 'bg-black text-yellow-300 border-black'
                      : 'bg-white/20 text-white border-white/30'
                    : t.badgeColor
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
