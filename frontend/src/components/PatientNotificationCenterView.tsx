import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Info,
} from 'lucide-react';
import type { Notification } from '../types';
import { ApiService } from '../services/api';

interface PatientNotificationCenterViewProps {
  patientId: number;
  highContrast?: boolean;
  fontSize?: 'normal' | 'large' | 'xl';
}

export const PatientNotificationCenterView: React.FC<PatientNotificationCenterViewProps> = ({
  patientId,
  highContrast = false,
  fontSize = 'normal',
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [markingReadId, setMarkingReadId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const notifs = await ApiService.getNotifications(
        patientId,
        filterType !== 'all' ? filterType : undefined,
        unreadOnly
      );
      setNotifications(notifs);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      showToast(`Error: ${err.message || 'Could not load notifications.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [patientId, filterType, unreadOnly]);

  // Mark single notification as read
  const handleMarkAsRead = async (notifId: number) => {
    setMarkingReadId(notifId);
    try {
      await ApiService.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true, status: 'read' } : n))
      );
      showToast('✓ Notification marked as read.');
    } catch (err: any) {
      console.error('Mark read error:', err);
      showToast('Failed to mark notification as read.');
    } finally {
      setMarkingReadId(null);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      const res = await ApiService.markAllNotificationsRead(patientId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, status: 'read' })));
      showToast(`✓ All ${res.updated_count || 'unread'} notifications marked as read.`);
    } catch (err: any) {
      console.error('Mark all read error:', err);
      showToast('Failed to mark all as read.');
    }
  };

  // Helper for notification type badge & icon
  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'missed_alert':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          label: 'Missed Medicine Alert',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      case 'reminder':
      case 'due_alert':
        return {
          icon: <Clock className="w-5 h-5 text-amber-600" />,
          label: 'Medicine Reminder',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'caregiver_message':
      case 'emergency':
        return {
          icon: <MessageSquare className="w-5 h-5 text-purple-600" />,
          label: 'Caregiver Update',
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-600" />,
          label: 'System Notification',
          bg: 'bg-sky-100 text-sky-800 border-sky-300',
        };
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      className={`space-y-6 sm:space-y-8 pb-12 ${highContrast ? 'contrast-125' : ''} ${
        fontSize === 'large' ? 'text-lg' : fontSize === 'xl' ? 'text-xl' : ''
      }`}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-6 py-4 rounded-3xl bg-slate-950 text-white shadow-2xl flex items-center gap-3 border-2 border-slate-700 animate-slide-up max-w-md">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <span className="text-base font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
              <Bell className="w-4 h-4" /> Notification Center
            </span>
            {unreadCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-rose-600 text-white">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">
            Your Medicine Messages & Reminders
          </h2>
          <p className="text-sm sm:text-base font-bold text-slate-500 mt-1">
            Important reminder alerts, caregiver notifications, and intake updates.
          </p>
        </div>

        {/* Header Action: Mark All Read & Refresh */}
        <div className="flex items-center gap-3 self-start md:self-center">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm sm:text-base shadow-sm transition flex items-center gap-2"
            >
              <CheckCheck className="w-5 h-5 text-emerald-400" />
              Mark All as Read
            </button>
          )}

          <button
            onClick={loadNotifications}
            disabled={loading}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Refresh Notifications"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Messages' },
            { id: 'reminder', label: '⏰ Medicine Reminders' },
            { id: 'missed_alert', label: '⚠️ Missed Alerts' },
            { id: 'general', label: 'ℹ️ System Notifications' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition ${
                filterType === tab.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Unread Only Toggle */}
        <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
          />
          Show Unread Only
        </label>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center rounded-3xl bg-white border-2 border-slate-200 space-y-3">
            <RefreshCw className="w-10 h-10 text-sky-600 animate-spin mx-auto" />
            <div className="text-base font-bold text-slate-600">Loading your notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-white border-2 border-slate-200 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-black text-slate-800">You are all caught up!</h3>
            <p className="text-sm font-semibold text-slate-500">
              There are no new notifications matching your filter.
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const badge = getNotificationBadge(notif.notification_type);
            return (
              <div
                key={notif.id}
                className={`p-6 rounded-3xl border-2 transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !notif.is_read
                    ? 'bg-white border-sky-400 ring-2 ring-sky-100'
                    : 'bg-slate-50/70 border-slate-200 opacity-80'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3.5 rounded-2xl bg-slate-100 flex-shrink-0">
                    {badge.icon}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {!notif.is_read && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white">
                          NEW
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-400">
                        {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                      {notif.title}
                    </h4>

                    <p className="text-sm sm:text-base font-semibold text-slate-700">
                      {notif.message}
                    </p>

                    {notif.scheduled_time && (
                      <div className="text-xs font-bold text-slate-500 mt-1">
                        Scheduled for: <strong className="text-slate-800">{notif.scheduled_time}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mark as read button if unread */}
                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    disabled={markingReadId === notif.id}
                    className="self-end md:self-center px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-black transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    Mark Read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
