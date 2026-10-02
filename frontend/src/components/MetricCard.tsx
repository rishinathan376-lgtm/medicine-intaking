import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  variant: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  highContrast?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant,
  highContrast = false,
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-sky-50',
      border: 'border-sky-300',
      text: 'text-sky-900',
      iconBg: 'bg-sky-600 text-white',
    },
    green: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      text: 'text-emerald-900',
      iconBg: 'bg-emerald-600 text-white',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-900',
      iconBg: 'bg-amber-500 text-white',
    },
    red: {
      bg: 'bg-rose-50',
      border: 'border-rose-300',
      text: 'text-rose-900',
      iconBg: 'bg-rose-600 text-white',
    },
    purple: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-300',
      text: 'text-indigo-900',
      iconBg: 'bg-indigo-600 text-white',
    },
  };

  const scheme = colorMap[variant];

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex items-center justify-between shadow-sm transition-all ${
        highContrast
          ? 'bg-zinc-900 border-white text-white'
          : `${scheme.bg} ${scheme.border}`
      }`}
    >
      <div>
        <span
          className={`text-sm font-bold uppercase tracking-wider block mb-1 ${
            highContrast ? 'text-yellow-300' : 'text-slate-600'
          }`}
        >
          {title}
        </span>
        <div
          className={`text-4xl font-extrabold tracking-tight my-1 ${
            highContrast ? 'text-white' : scheme.text
          }`}
        >
          {value}
        </div>
        <p
          className={`text-sm font-medium ${
            highContrast ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {subtitle}
        </p>
      </div>

      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${scheme.iconBg}`}
      >
        {icon}
      </div>
    </div>
  );
};
