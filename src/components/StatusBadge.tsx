'use client';

import type { PostStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Circle, Loader2, FlaskConical, Check, X, Send } from 'lucide-react';

const statusConfig: Record<PostStatus, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  new: {
    label: 'New',
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
    icon: <Circle className="w-3 h-3" />,
  },
  evaluating: {
    label: 'Evaluating',
    className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse hover:bg-yellow-500/20',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  evaluated: {
    label: 'Evaluated',
    className: 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/20',
    icon: <FlaskConical className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20',
    icon: <Check className="w-3 h-3" />,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20',
    icon: <X className="w-3 h-3" />,
  },
  posted: {
    label: 'Posted',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
    icon: <Send className="w-3 h-3" />,
  },
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  const config = statusConfig[status] || statusConfig.new;
  return (
    <Badge variant="outline" className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
