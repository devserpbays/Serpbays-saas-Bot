'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Pencil, Send, Settings, UserPlus, User, UserMinus, Plus, RefreshCw, Circle, Loader2, Clock, Zap,
} from 'lucide-react';

interface ActivityLog {
  _id: string;
  action: string;
  userName: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'post.approved': {
    label: 'approved a post',
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    icon: <Check className="w-3 h-3 text-green-400" />,
  },
  'post.auto_approved': {
    label: 'auto-approved a post',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    icon: <Zap className="w-3 h-3 text-amber-400" />,
  },
  'post.rejected': {
    label: 'rejected a post',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    icon: <X className="w-3 h-3 text-red-400" />,
  },
  'post.edited': {
    label: 'edited a reply',
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    icon: <Pencil className="w-3 h-3 text-blue-400" />,
  },
  'post.posted': {
    label: 'posted a reply',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    icon: <Send className="w-3 h-3 text-emerald-400" />,
  },
  'settings.updated': {
    label: 'updated settings',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    icon: <Settings className="w-3 h-3 text-muted-foreground" />,
  },
  'member.invited': {
    label: 'invited a member',
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    icon: <UserPlus className="w-3 h-3 text-purple-400" />,
  },
  'member.joined': {
    label: 'joined the workspace',
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    icon: <User className="w-3 h-3 text-green-400" />,
  },
  'member.removed': {
    label: 'removed a member',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    icon: <UserMinus className="w-3 h-3 text-red-400" />,
  },
  'workspace.created': {
    label: 'created the workspace',
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    icon: <Plus className="w-3 h-3 text-blue-400" />,
  },
  'workspace.updated': {
    label: 'updated workspace settings',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    icon: <RefreshCw className="w-3 h-3 text-muted-foreground" />,
  },
};

const FALLBACK = {
  label: 'performed an action',
  color: 'text-muted-foreground',
  bg: 'bg-muted',
  icon: <Circle className="w-3 h-3 text-muted-foreground" />,
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
      <div className="flex items-center justify-center gap-2 py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading activity...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-6">
        <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {logs.map((log) => {
        const config = ACTION_LABELS[log.action] || FALLBACK;
        const timeAgo = getTimeAgo(new Date(log.createdAt));
        const metaEmail = log.meta?.email as string | undefined;
        const metaScore = log.meta?.score as number | undefined;
        const metaPlatform = log.meta?.platform as string | undefined;

        return (
          <div key={log._id} className="flex items-start gap-3 text-sm py-2 px-2 rounded-lg hover:bg-accent transition-colors">
            <span className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              {config.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="leading-snug">
                <span className="font-semibold text-foreground">{log.userName || 'System'}</span>
                {' '}
                <span className={config.color}>{config.label}</span>
                {metaEmail && (
                  <span className="text-muted-foreground"> ({metaEmail})</span>
                )}
                {metaScore !== undefined && metaPlatform && (
                  <span className="text-muted-foreground"> (score {metaScore}, {metaPlatform})</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
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
