'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import type { IPost, SocialAccount, WorkspaceRole } from '@/lib/types';
import PostCard from './PostCard';
import SettingsPanel from './SettingsPanel';
import ActivityFeed from './ActivityFeed';

interface PostsResponse {
  posts: IPost[];
  total: number;
  page: number;
  limit: number;
}

interface Stats {
  total: number;
  new: number;
  evaluating: number;
  evaluated: number;
  approved: number;
  rejected: number;
  posted: number;
  byPlatform: Record<string, number>;
  postedByPlatform: Record<string, number>;
  competitorOpportunities: number;
  tonePerformance: Array<{ platform: string; tone: string; avgEngagementScore: number; totalPosts: number }>;
}

interface PipelineResult {
  scraped: number;
  newPosts: number;
  evaluated: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

interface WorkspaceInfo {
  _id: string;
  name: string;
  slug: string;
  members: Array<{ userId: string; role: string }>;
}

interface KeywordMetric {
  keyword: string;
  totalPosts: number;
  avgScore: number;
  trend: 'rising' | 'falling' | 'stable';
  trendPercent: number;
}

interface PlatformMeta {
  id: string;
  label: string;
  activeCls: string;
  inactiveCls: string;
  iconBg: string;
  icon: React.ReactNode;
}

const PLATFORM_META: PlatformMeta[] = [
  {
    id: 'twitter',
    label: 'Twitter/X',
    activeCls: 'bg-black text-white border-black',
    inactiveCls: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
    iconBg: 'bg-black',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'reddit',
    label: 'Reddit',
    activeCls: 'bg-orange-600 text-white border-orange-600',
    inactiveCls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    iconBg: 'bg-orange-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    activeCls: 'bg-blue-600 text-white border-blue-600',
    inactiveCls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    iconBg: 'bg-blue-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'quora',
    label: 'Quora',
    activeCls: 'bg-red-600 text-white border-red-600',
    inactiveCls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    iconBg: 'bg-red-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M12.071 0C5.4 0 .001 5.4.001 12.071c0 6.248 4.759 11.41 10.85 12.003-.044-.562-.094-1.407-.094-2.001 0-.666.023-1.406.068-2.028-.447.045-.896.068-1.349.068-3.734 0-5.941-2.162-5.941-5.95 0-3.78 2.207-5.941 5.941-5.941 3.733 0 5.94 2.161 5.94 5.941 0 1.873-.509 3.374-1.407 4.38l1.047 1.986c.423.806.847 1.166 1.336 1.166.888 0 1.406-.949 1.406-2.688V12.07C17.8 6.37 15.292 0 12.071 0zm-1.595 17.624c.263-.01.526-.022.786-.022h.026l-.803-1.523c.598-.861.941-2.083.941-3.578 0-3.022-1.73-4.697-4.689-4.697-2.97 0-4.7 1.675-4.7 4.697 0 3.031 1.73 4.706 4.7 4.706.575 0 1.127-.056 1.739-.183z" />
      </svg>
    ),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    activeCls: 'bg-red-500 text-white border-red-500',
    inactiveCls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    iconBg: 'bg-red-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    activeCls: 'bg-red-700 text-white border-red-700',
    inactiveCls: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
    iconBg: 'bg-red-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
      </svg>
    ),
  },
];

const statusFilters: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'evaluated', label: 'Evaluated' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'posted', label: 'Posted' },
];

const POLL_INTERVAL_MS = 10_000;

export default function Dashboard() {
  const { data: session, update: updateSession } = useSession();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const [scraping, setScraping] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState('');
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);

  const [stats, setStats] = useState<Stats>({
    total: 0, new: 0, evaluating: 0, evaluated: 0,
    approved: 0, rejected: 0, posted: 0,
    byPlatform: {},
    postedByPlatform: {},
    competitorOpportunities: 0,
    tonePerformance: [],
  });

  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceInfo | null>(null);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [userRole, setUserRole] = useState<WorkspaceRole>('owner');

  // Keyword metrics
  const [keywordMetrics, setKeywordMetrics] = useState<KeywordMetric[]>([]);

  // Opportunity filter
  const [showOpportunities, setShowOpportunities] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);

      if (session?.user?.activeWorkspaceId) {
        const active = (data.workspaces || []).find(
          (w: WorkspaceInfo) => w._id === session.user.activeWorkspaceId
        );
        if (active) {
          setActiveWorkspace(active);
          const member = active.members.find(
            (m: { userId: string }) => m.userId === session.user.id
          );
          if (member) setUserRole(member.role as WorkspaceRole);
        }
      }
    } catch {/* silent */}
  }, [session?.user?.activeWorkspaceId, session?.user?.id]);

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (platformFilter) params.set('platform', platformFilter);
    if (showOpportunities) params.set('opportunities', 'true');
    params.set('page', String(page));
    params.set('limit', '20');
    const res = await fetch(`/api/posts?${params}`);
    const data: PostsResponse = await res.json();
    setPosts(data.posts);
    setTotal(data.total);
  }, [statusFilter, platformFilter, page, showOpportunities]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats({
        total:            data.total ?? 0,
        new:              data.byStatus?.new ?? 0,
        evaluating:       data.byStatus?.evaluating ?? 0,
        evaluated:        data.byStatus?.evaluated ?? 0,
        approved:         data.byStatus?.approved ?? 0,
        rejected:         data.byStatus?.rejected ?? 0,
        posted:           data.byStatus?.posted ?? 0,
        byPlatform:       data.byPlatform ?? {},
        postedByPlatform: data.postedByPlatform ?? {},
        competitorOpportunities: data.competitorOpportunities ?? 0,
        tonePerformance:  data.tonePerformance ?? [],
      });
    } catch {/* silent */}
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setEnabledPlatforms(data.settings.platforms ?? []);
        setSocialAccounts(data.settings.socialAccounts ?? []);
      }
    } catch {/* silent */}
  }, []);

  const fetchKeywordMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/keyword-metrics?days=14');
      const data = await res.json();
      setKeywordMetrics(data.keywords || []);
    } catch {/* silent */}
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (activeWorkspace) {
      fetchPosts();
      fetchStats();
      fetchSettings();
      fetchKeywordMetrics();
    }
  }, [activeWorkspace, fetchPosts, fetchStats, fetchSettings, fetchKeywordMetrics]);

  useEffect(() => {
    if (!activeWorkspace) return;
    pollRef.current = setInterval(() => {
      fetchStats();
      fetchPosts();
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeWorkspace, fetchStats, fetchPosts]);

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    try {
      await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      await updateSession({ activeWorkspaceId: workspaceId });
      const ws = workspaces.find(w => w._id === workspaceId);
      if (ws) {
        setActiveWorkspace(ws);
        const member = ws.members.find(m => m.userId === session?.user?.id);
        if (member) setUserRole(member.role as WorkspaceRole);
      }
      setShowWorkspaceSwitcher(false);
      setPage(1);
    } catch {/* silent */}
  };

  const handleCreateWorkspace = async () => {
    const name = prompt('Workspace name:');
    if (!name) return;
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.workspace) {
        await handleWorkspaceSwitch(data.workspace._id);
        fetchWorkspaces();
      }
    } catch {/* silent */}
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    fetchSettings();
  };

  const handleScrape = async () => {
    setScraping(true);
    setActionMessage('');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        setActionMessage(`Error: ${data.error}`);
      } else {
        const errMsg = data.errors?.length ? ` (${data.errors.length} errors)` : '';
        setActionMessage(`Scraped ${data.totalScraped} posts, ${data.newPosts} new${errMsg}`);
        fetchPosts();
        fetchStats();
      }
    } catch {
      setActionMessage('Scrape failed');
    }
    setScraping(false);
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setActionMessage('');
    try {
      const res = await fetch('/api/evaluate', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setActionMessage(`Error: ${data.error}`);
      } else {
        setActionMessage(`Evaluated ${data.evaluated}/${data.total} posts`);
        fetchPosts();
        fetchStats();
        fetchKeywordMetrics();
      }
    } catch {
      setActionMessage('Evaluation failed');
    }
    setEvaluating(false);
  };

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineResult(null);
    const platformNames = enabledPlatforms.length
      ? enabledPlatforms.map((p) => PLATFORM_META.find((m) => m.id === p)?.label ?? p).join(', ')
      : 'all platforms';
    setPipelineStep(`Scraping ${platformNames}...`);

    try {
      const res = await fetch('/api/run-pipeline', { method: 'POST' });
      const data: PipelineResult = await res.json();
      setPipelineResult(data);
      setPipelineStep('');
      fetchPosts();
      fetchStats();
      fetchKeywordMetrics();
    } catch {
      setPipelineStep('');
      setPipelineResult({
        scraped: 0, newPosts: 0, evaluated: 0, skipped: 0,
        errors: ['Pipeline request failed — check server logs'],
        startedAt: '', finishedAt: '',
      });
    }
    setPipelineRunning(false);
  };

  const handlePostUpdate = async (id: string, data: Record<string, unknown>) => {
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    fetchPosts();
    fetchStats();
  };

  const totalPages = Math.ceil(total / 20);
  const isAnyActionRunning = scraping || evaluating || pipelineRunning;
  const canAct = userRole === 'owner' || userRole === 'editor';

  const visiblePlatforms = PLATFORM_META.filter(
    (p) => enabledPlatforms.includes(p.id) || (stats.byPlatform[p.id] ?? 0) > 0
  );

  const accountsForPlatform = (platformId: string) =>
    socialAccounts.filter((a) => a.platform === platformId);

  const trendIcon = (trend: string) => {
    if (trend === 'rising') return <span className="text-green-500">&#9650;</span>;
    if (trend === 'falling') return <span className="text-red-500">&#9660;</span>;
    return <span className="text-gray-400">&#8212;</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Serpbays</h1>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
            {/* Workspace Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <span className="font-medium truncate max-w-[160px]">
                  {activeWorkspace?.name || 'Select Workspace'}
                </span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showWorkspaceSwitcher && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="p-2 space-y-0.5">
                    {workspaces.map((ws) => (
                      <button
                        key={ws._id}
                        onClick={() => handleWorkspaceSwitch(ws._id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          ws._id === activeWorkspace?._id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {ws.name}
                        <span className="text-xs text-gray-400 ml-2">
                          {ws.members.length} member{ws.members.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={handleCreateWorkspace}
                      className="w-full text-left px-3 py-2 rounded-md text-sm text-blue-600 hover:bg-blue-50 font-medium"
                    >
                      + New Workspace
                    </button>
                  </div>
                </div>
              )}
            </div>
            {userRole !== 'owner' && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">
                {userRole}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="text-sm text-gray-500">{session.user.name}</span>
            )}
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
            >
              Activity
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
            >
              Settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="px-4 py-2 text-gray-500 text-sm rounded-md hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Activity Feed (collapsible) */}
        {showActivity && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
              <button onClick={() => setShowActivity(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                Hide
              </button>
            </div>
            <ActivityFeed />
          </div>
        )}

        {/* Competitor Opportunities Alert */}
        {stats.competitorOpportunities > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#9888;</span>
              <div>
                <p className="font-semibold text-amber-800">
                  {stats.competitorOpportunities} Competitor Opportunit{stats.competitorOpportunities === 1 ? 'y' : 'ies'}
                </p>
                <p className="text-sm text-amber-600">
                  Posts where competitors are mentioned negatively — great time to engage.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowOpportunities(!showOpportunities); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                showOpportunities
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              {showOpportunities ? 'Show All' : 'View'}
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total',      value: stats.total,      color: 'bg-gray-100 text-gray-800' },
            { label: 'New',        value: stats.new,         color: 'bg-blue-100 text-blue-800' },
            { label: 'Evaluating', value: stats.evaluating,  color: 'bg-yellow-100 text-yellow-800' },
            { label: 'Evaluated',  value: stats.evaluated,   color: 'bg-purple-100 text-purple-800' },
            { label: 'Approved',   value: stats.approved,    color: 'bg-green-100 text-green-800' },
            { label: 'Rejected',   value: stats.rejected,    color: 'bg-red-100 text-red-800' },
            { label: 'Posted',     value: stats.posted,      color: 'bg-gray-100 text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${color} rounded-lg p-3 text-center`}>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* Platform breakdown */}
        {visiblePlatforms.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {visiblePlatforms.map((p) => {
              const active = platformFilter === p.id;
              const total = stats.byPlatform[p.id] ?? 0;
              const posted = stats.postedByPlatform[p.id] ?? 0;
              const accounts = accountsForPlatform(p.id);

              return (
                <button
                  key={p.id}
                  onClick={() => { setPlatformFilter(active ? '' : p.id); setPage(1); }}
                  className={`border rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${active ? p.activeCls : p.inactiveCls}`}
                >
                  <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${p.iconBg}`}>
                    {p.icon}
                  </span>
                  <span>{p.label}</span>
                  <span className="font-bold">{total}</span>
                  {posted > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      {posted} posted
                    </span>
                  )}
                  {accounts.length > 0 && (
                    <span className="flex items-center -space-x-1 ml-0.5">
                      {accounts.slice(0, 3).map((acc) => (
                        <span
                          key={acc.id}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${active ? 'border-white/40 bg-white/20 text-white' : 'border-white bg-gray-200 text-gray-600'}`}
                          title={acc.displayName || acc.username}
                        >
                          {(acc.displayName || acc.username || '?')[0].toUpperCase()}
                        </span>
                      ))}
                      {accounts.length > 3 && (
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${active ? 'border-white/40 bg-white/20 text-white' : 'border-white bg-gray-200 text-gray-500'}`}>
                          +{accounts.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
            {platformFilter && (
              <button
                onClick={() => { setPlatformFilter(''); setPage(1); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 underline self-center"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Keyword Performance */}
        {keywordMetrics.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Keyword Performance (14d)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Keyword</th>
                    <th className="pb-2 font-medium text-right">Posts</th>
                    <th className="pb-2 font-medium text-right">Avg Score</th>
                    <th className="pb-2 font-medium text-right">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordMetrics.slice(0, 10).map((m) => (
                    <tr key={m.keyword} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{m.keyword}</td>
                      <td className="py-2 text-right text-gray-600">{m.totalPosts}</td>
                      <td className="py-2 text-right text-gray-600">{m.avgScore}</td>
                      <td className="py-2 text-right">
                        {trendIcon(m.trend)}
                        <span className={`text-xs ml-1 ${
                          m.trend === 'rising' ? 'text-green-600' :
                          m.trend === 'falling' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {m.trendPercent > 0 ? '+' : ''}{m.trendPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* A/B Tone Performance */}
        {stats.tonePerformance.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">A/B Tone Performance</h2>
            <div className="space-y-3">
              {stats.tonePerformance.slice(0, 8).map((tp, i) => {
                const maxScore = stats.tonePerformance[0]?.avgEngagementScore || 1;
                const barWidth = (tp.avgEngagementScore / maxScore) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 text-right">{tp.platform}</span>
                    <span className="text-xs font-medium text-gray-700 w-24">{tp.tone}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                      <div
                        className="bg-blue-500 rounded-full h-4 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-12 text-right">
                      {tp.avgEngagementScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {tp.totalPosts} posts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Run Full Pipeline */}
        {canAct && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Run Full Job</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Scrapes{' '}
                  {enabledPlatforms.length > 0
                    ? enabledPlatforms.map((p) => PLATFORM_META.find((m) => m.id === p)?.label ?? p).join(', ')
                    : 'all platforms'}
                  , then evaluates every new post in one click.
                </p>
              </div>
              <button
                onClick={handleRunPipeline}
                disabled={isAnyActionRunning}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pipelineRunning ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                    </svg>
                    Start Job
                  </>
                )}
              </button>
            </div>

            {pipelineStep && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {pipelineStep}
              </div>
            )}

            {pipelineResult && !pipelineRunning && (
              <div className={`rounded-lg p-4 text-sm space-y-1 ${
                pipelineResult.errors.length ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}>
                <p className={`font-semibold ${pipelineResult.errors.length ? 'text-red-700' : 'text-green-700'}`}>
                  Job complete
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {[
                    { label: 'Scraped',   value: pipelineResult.scraped },
                    { label: 'New Posts', value: pipelineResult.newPosts },
                    { label: 'Evaluated', value: pipelineResult.evaluated },
                    { label: 'Skipped',   value: pipelineResult.skipped },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/70 rounded p-2 text-center">
                      <div className="text-lg font-bold text-gray-800">{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {pipelineResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pipelineResult.errors.map((e, i) => (
                      <li key={i} className="text-red-600 text-xs">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Secondary Actions */}
        {canAct && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Manual steps:</span>
            <button
              onClick={handleScrape}
              disabled={isAnyActionRunning}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {scraping ? 'Scraping...' : 'Scrape Only'}
            </button>
            <button
              onClick={handleEvaluate}
              disabled={isAnyActionRunning}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {evaluating ? 'Evaluating...' : 'Evaluate Only'}
            </button>
            {actionMessage && (
              <span className={`text-sm ${actionMessage.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {actionMessage}
              </span>
            )}
          </div>
        )}

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setStatusFilter(value); setPage(1); setShowOpportunities(false); }}
              className={`px-3 py-1.5 text-sm rounded-md ${
                statusFilter === value && !showOpportunities
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
              {value === 'evaluating' && stats.evaluating > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.evaluating}
                </span>
              )}
              {value === 'approved' && stats.approved > 0 && (
                <span className="ml-1.5 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.approved}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
              <p className="text-lg">No posts found</p>
              <p className="text-sm mt-1">
                {activeWorkspace
                  ? <>Configure your settings and click <strong>Start Job</strong> to begin.</>
                  : 'Select or create a workspace to get started.'
                }
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post._id} post={post} onUpdate={handlePostUpdate} role={userRole} />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <SettingsPanel open={settingsOpen} onClose={handleSettingsClose} workspaceId={activeWorkspace?._id} role={userRole} />
    </div>
  );
}
