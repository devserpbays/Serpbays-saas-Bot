'use client';

import type { PostStatus } from '@/lib/types';

const statusConfig: Record<PostStatus, { label: string; className: string; icon: React.ReactNode }> = {
  new: {
    label: 'New',
    className: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  evaluating: {
    label: 'Evaluating',
    className: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200 animate-pulse',
    icon: (
      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" d="M12 3a9 9 0 1 1-6.36 2.64" />
      </svg>
    ),
  },
  evaluated: {
    label: 'Evaluated',
    className: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.3 24.3 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.25 48.25 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 ring-1 ring-green-200',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 ring-1 ring-red-200',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
  posted: {
    label: 'Posted',
    className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg>
    ),
  },
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  const config = statusConfig[status] || statusConfig.new;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
