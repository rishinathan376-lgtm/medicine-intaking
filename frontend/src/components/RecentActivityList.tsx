import React from 'react';
import { CheckCircle2, AlertTriangle, Bell, Clock } from 'lucide-react';
import type { RecentActivityItem } from '../types';

interface RecentActivityListProps {
  activities: RecentActivityItem[];
  highContrast?: boolean;
}

export const RecentActivityList: React.FC<RecentActivityListProps> = ({
  activities,
  highContrast = false,
}) => {
  return (
    <div
      className={`rounded-2xl border-2 p-6 shadow-sm ${
        highContrast ? 'bg-zinc-900 border-white text-white' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-700" />
          Recent Activity & Notifications
        </h3>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Log</span>
      </div>

      {activities.length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">No recent activity recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                item.type === 'taken'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : item.type === 'missed'
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.type === 'taken' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {item.type === 'missed' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
                {item.type !== 'taken' && item.type !== 'missed' && (
                  <Bell className="w-5 h-5 text-sky-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 mt-0.5 leading-snug">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
