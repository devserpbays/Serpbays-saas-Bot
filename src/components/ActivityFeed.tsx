'use client';

import { useState, useEffect, useCallback } from 'react';

interface ActivityLog {
  _id: string;
  action: string;
  userName: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'post.approved': { label: 'approved a post', color: 'text-green-600' },
  'post.rejected': { label: 'rejected a post', color: 'text-red-600' },
  'post.edited': { label: 'edited a reply', color: 'text-blue-600' },
  'post.posted': { label: 'posted a reply', color: 'text-indigo-600' },
  'settings.updated': { label: 'updated settings', color: 'text-gray-600' },
  'member.invited': { label: 'invited a member', color: 'text-purple-600' },
  'member.joined': { label: 'joined the workspace', color: 'text-green-600' },
  'member.removed': { label: 'removed a member', color: 'text-red-600' },
  'workspace.created': { label: 'created the workspace', color: 'text-blue-600' },
  'workspace.updated': { label: 'updated workspace settings', color: 'text-gray-600' },
};

export default function ActivityFeed() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=20');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (loading) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">Loading activity...</div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">No activity yet</div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {logs.map((log) => {
        const config = ACTION_LABELS[log.action] || { label: log.action, color: 'text-gray-500' };
        const timeAgo = getTimeAgo(new Date(log.createdAt));
        const metaEmail = log.meta?.email as string | undefined;

        return (
          <div key={log._id} className="flex items-start gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
              {(log.userName || '?')[0].toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-800">{log.userName}</span>
              {' '}
              <span className={config.color}>{config.label}</span>
              {metaEmail && (
                <span className="text-gray-500"> ({metaEmail})</span>
              )}
              <div className="text-xs text-gray-400">{timeAgo}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
