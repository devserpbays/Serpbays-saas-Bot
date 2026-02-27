'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import type { IPost, SocialAccount, WorkspaceRole, SchedulerStatus } from '@/lib/types';
import PostCard from './PostCard';
import SettingsPanel from './SettingsPanel';
import ActivityFeed from './ActivityFeed';
import { PLATFORMS, PLATFORM_MAP, PlatformIcon } from '@/lib/platforms/config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Settings, LogOut, Clock, Play, Loader2, ChevronDown, ChevronLeft,
  ChevronRight, Plus, AlertTriangle, TrendingUp, TrendingDown, Minus,
  FlaskConical, BarChart3, FileText, Timer, Square, Zap,
} from 'lucide-react';

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
  autoApproved: number;
  autoPosted: number;
  byPlatform: Record<string, number>;
  postedByPlatform: Record<string, number>;
  competitorOpportunities: number;
  tonePerformance: Array<{ platform: string; tone: string; avgEngagementScore: number; totalPosts: number }>;
}

interface PipelineResult {
  scraped: number;
  newPosts: number;
  evaluated: number;
  autoApproved: number;
  autoPosted: number;
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
    autoApproved: 0, autoPosted: 0,
    byPlatform: {},
    postedByPlatform: {},
    competitorOpportunities: 0,
    tonePerformance: [],
  });

  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceInfo | null>(null);
  const [userRole, setUserRole] = useState<WorkspaceRole>('owner');

  const [keywordMetrics, setKeywordMetrics] = useState<KeywordMetric[]>([]);
  const [showOpportunities, setShowOpportunities] = useState(false);

  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [schedulerToggling, setSchedulerToggling] = useState(false);

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
        autoApproved:     data.autoApproved ?? 0,
        autoPosted:       data.autoPosted ?? 0,
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

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data: SchedulerStatus = await res.json();
        setScheduler(data);
      }
    } catch {/* silent */}
  }, []);

  const handleSchedulerToggle = async () => {
    setSchedulerToggling(true);
    try {
      const action = scheduler?.running ? 'stop' : 'start';
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data: SchedulerStatus = await res.json();
        setScheduler(data);
      }
    } catch {/* silent */}
    setSchedulerToggling(false);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (activeWorkspace) {
      fetchPosts();
      fetchStats();
      fetchSettings();
      fetchKeywordMetrics();
      fetchSchedulerStatus();
    }
  }, [activeWorkspace, fetchPosts, fetchStats, fetchSettings, fetchKeywordMetrics, fetchSchedulerStatus]);

  useEffect(() => {
    if (!activeWorkspace) return;
    pollRef.current = setInterval(() => {
      fetchStats();
      fetchPosts();
      fetchSchedulerStatus();
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeWorkspace, fetchStats, fetchPosts, fetchSchedulerStatus]);

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
      ? enabledPlatforms.map((p) => PLATFORM_MAP[p]?.label ?? p).join(', ')
      : 'all platforms';
    setPipelineStep(`Scraping ${platformNames}, evaluating, and auto-posting...`);

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
        scraped: 0, newPosts: 0, evaluated: 0, autoApproved: 0, autoPosted: 0, skipped: 0,
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

  const visiblePlatforms = PLATFORMS.filter(
    (p) => enabledPlatforms.includes(p.id) || (stats.byPlatform[p.id] ?? 0) > 0
  );

  const accountsForPlatform = (platformId: string) =>
    socialAccounts.filter((a) => a.platform === platformId);

  const trendIcon = (trend: string) => {
    if (trend === 'rising') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
    if (trend === 'falling') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Serpbays</h1>
            <Badge variant="outline" className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>

            {/* Workspace Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <span className="truncate max-w-[160px]">
                    {activeWorkspace?.name || 'Select Workspace'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws._id}
                    onClick={() => handleWorkspaceSwitch(ws._id)}
                    className={ws._id === activeWorkspace?._id ? 'bg-accent' : ''}
                  >
                    {ws.name}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {ws.members.length} member{ws.members.length !== 1 ? 's' : ''}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateWorkspace}>
                  <Plus className="w-4 h-4" />
                  New Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {userRole !== 'owner' && (
              <Badge variant="secondary">{userRole}</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {session?.user && (
              <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">{session.user.name}</span>
            )}
            <Button
              variant={showActivity ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowActivity(!showActivity)}
            >
              <Clock className="w-4 h-4" />
              Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="text-muted-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Activity Feed */}
        {showActivity && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowActivity(false)}>Hide</Button>
              </div>
              <ActivityFeed />
            </CardContent>
          </Card>
        )}

        {/* Competitor Opportunities Alert */}
        {stats.competitorOpportunities > 0 && (
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-400">
              {stats.competitorOpportunities} Competitor Opportunit{stats.competitorOpportunities === 1 ? 'y' : 'ies'}
            </AlertTitle>
            <AlertDescription className="text-amber-400/80 flex items-center justify-between">
              <span>Posts where competitors are mentioned negatively — great time to engage.</span>
              <Button
                variant={showOpportunities ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setShowOpportunities(!showOpportunities); setPage(1); }}
                className="ml-4 shrink-0"
              >
                {showOpportunities ? 'Show All' : 'View'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total',      value: stats.total,      dot: 'bg-muted-foreground', auto: 0 },
            { label: 'New',        value: stats.new,         dot: 'bg-blue-500', auto: 0 },
            { label: 'Evaluating', value: stats.evaluating,  dot: 'bg-yellow-500', auto: 0 },
            { label: 'Evaluated',  value: stats.evaluated,   dot: 'bg-purple-500', auto: 0 },
            { label: 'Approved',   value: stats.approved,    dot: 'bg-green-500', auto: stats.autoApproved },
            { label: 'Rejected',   value: stats.rejected,    dot: 'bg-red-500', auto: 0 },
            { label: 'Posted',     value: stats.posted,      dot: 'bg-emerald-500', auto: stats.autoPosted },
          ].map(({ label, value, dot, auto }) => (
            <Card key={label}>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
                <div className="text-xs font-semibold flex items-center justify-center gap-1.5 mt-0.5 text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {label}
                </div>
                {auto > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium">{auto} auto</span>
                  </div>
                )}
              </CardContent>
            </Card>
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
                <Button
                  key={p.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setPlatformFilter(active ? '' : p.id); setPage(1); }}
                  className={`gap-2 ${active ? p.activeCls : ''}`}
                >
                  <PlatformIcon platform={p.id} className="w-5 h-5" />
                  <span>{p.label}</span>
                  <span className="font-bold">{total}</span>
                  {posted > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {posted} posted
                    </Badge>
                  )}
                  {accounts.length > 0 && (
                    <span className="flex items-center -space-x-1 ml-0.5">
                      {accounts.slice(0, 3).map((acc) => (
                        <span
                          key={acc.id}
                          className="w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold bg-muted text-muted-foreground"
                          title={acc.displayName || acc.username}
                        >
                          {(acc.displayName || acc.username || '?')[0].toUpperCase()}
                        </span>
                      ))}
                      {accounts.length > 3 && (
                        <span className="w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold bg-muted text-muted-foreground">
                          +{accounts.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </Button>
              );
            })}
            {platformFilter && (
              <Button variant="link" size="sm" onClick={() => { setPlatformFilter(''); setPage(1); }}>
                Clear filter
              </Button>
            )}
          </div>
        )}

        {/* Keyword Performance */}
        {keywordMetrics.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Keyword Performance (14d)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Keyword</th>
                      <th className="pb-2 font-medium text-right">Posts</th>
                      <th className="pb-2 font-medium text-right">Avg Score</th>
                      <th className="pb-2 font-medium text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywordMetrics.slice(0, 10).map((m) => (
                      <tr key={m.keyword} className="border-b border-border/50">
                        <td className="py-2 font-medium text-foreground">{m.keyword}</td>
                        <td className="py-2 text-right text-muted-foreground">{m.totalPosts}</td>
                        <td className="py-2 text-right text-muted-foreground">{m.avgScore}</td>
                        <td className="py-2 text-right flex items-center justify-end gap-1">
                          {trendIcon(m.trend)}
                          <span className={`text-xs ${
                            m.trend === 'rising' ? 'text-green-500' :
                            m.trend === 'falling' ? 'text-red-500' : 'text-muted-foreground'
                          }`}>
                            {m.trendPercent > 0 ? '+' : ''}{m.trendPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* A/B Tone Performance */}
        {stats.tonePerformance.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                A/B Tone Performance
              </h2>
              <div className="space-y-3">
                {stats.tonePerformance.slice(0, 8).map((tp, i) => {
                  const maxScore = stats.tonePerformance[0]?.avgEngagementScore || 1;
                  const barWidth = (tp.avgEngagementScore / maxScore) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 text-right">{tp.platform}</span>
                      <span className="text-xs font-medium text-foreground w-24">{tp.tone}</span>
                      <div className="flex-1 bg-muted rounded-full h-4 relative">
                        <div
                          className="bg-primary rounded-full h-4 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {tp.avgEngagementScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {tp.totalPosts} posts
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Run Full Pipeline */}
        {canAct && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Play className="w-4 h-4 text-muted-foreground" />
                    Run Full Job
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Scrapes{' '}
                    {enabledPlatforms.length > 0
                      ? enabledPlatforms.map((p) => PLATFORM_MAP[p]?.label ?? p).join(', ')
                      : 'all platforms'}
                    , evaluates new posts, auto-approves high scorers, and auto-posts approved replies.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSchedulerToggle}
                    disabled={schedulerToggling}
                    size="sm"
                    variant={scheduler?.running ? 'destructive' : 'outline'}
                  >
                    {schedulerToggling ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /></>
                    ) : scheduler?.running ? (
                      <><Square className="w-3.5 h-3.5" />Stop Scheduler</>
                    ) : (
                      <><Timer className="w-3.5 h-3.5" />Auto-Schedule</>
                    )}
                  </Button>
                  <Button
                    onClick={handleRunPipeline}
                    disabled={isAnyActionRunning}
                    size="lg"
                  >
                    {pipelineRunning ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Running...</>
                    ) : (
                      <><Play className="w-4 h-4" />Start Job</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Scheduler Status */}
              {scheduler?.running && (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-400">Scheduler Active</span>
                  <span className="text-xs text-emerald-400/70">
                    Every {Math.round((scheduler.intervalMs || 900000) / 60000)} min
                  </span>
                  {scheduler.nextRunAt && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Next run: {new Date(scheduler.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {scheduler.lastRunAt && (
                    <span className="text-xs text-muted-foreground">
                      Last: {new Date(scheduler.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {scheduler.error && (
                    <span className="text-xs text-destructive ml-2">{scheduler.error}</span>
                  )}
                </div>
              )}

              {pipelineStep && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pipelineStep}
                </div>
              )}

              {pipelineResult && !pipelineRunning && (
                <Alert variant={pipelineResult.errors.length ? 'destructive' : 'default'}
                  className={!pipelineResult.errors.length ? 'border-green-500/30 bg-green-500/10' : ''}>
                  <AlertTitle>{pipelineResult.errors.length ? 'Job complete with errors' : 'Job complete'}</AlertTitle>
                  <AlertDescription>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                      {[
                        { label: 'Scraped',   value: pipelineResult.scraped },
                        { label: 'New Posts', value: pipelineResult.newPosts },
                        { label: 'Evaluated', value: pipelineResult.evaluated },
                        { label: 'Auto-Approved', value: pipelineResult.autoApproved || 0 },
                        { label: 'Auto-Posted', value: pipelineResult.autoPosted || 0 },
                        { label: 'Skipped',   value: pipelineResult.skipped },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-card/70 rounded p-2 text-center border border-border">
                          <div className="text-lg font-bold text-foreground">{value}</div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                    {pipelineResult.errors.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {pipelineResult.errors.map((e, i) => (
                          <li key={i} className="text-destructive text-xs">{e}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Secondary Actions */}
        {canAct && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manual steps:</span>
            <Button onClick={handleScrape} disabled={isAnyActionRunning} size="sm">
              {scraping ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scraping...</> : 'Scrape Only'}
            </Button>
            <Button onClick={handleEvaluate} disabled={isAnyActionRunning} size="sm" variant="secondary">
              {evaluating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Evaluating...</> : 'Evaluate Only'}
            </Button>
            {actionMessage && (
              <span className={`text-sm ${actionMessage.startsWith('Error') ? 'text-destructive' : 'text-green-500'}`}>
                {actionMessage}
              </span>
            )}
          </div>
        )}

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(({ value, label }) => (
            <Button
              key={value}
              variant={statusFilter === value && !showOpportunities ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(value); setPage(1); setShowOpportunities(false); }}
            >
              {label}
              {value === 'evaluating' && stats.evaluating > 0 && (
                <Badge className="ml-1.5 bg-yellow-500 text-yellow-950 text-[10px] px-1.5">{stats.evaluating}</Badge>
              )}
              {value === 'approved' && stats.approved > 0 && (
                <Badge className="ml-1.5 bg-green-500 text-white text-[10px] px-1.5">{stats.approved}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">No posts found</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  {activeWorkspace
                    ? <>Configure your settings and click <strong className="text-foreground">Start Job</strong> to begin scraping and evaluating posts.</>
                    : 'Select or create a workspace to get started.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <PostCard key={post._id} post={post} onUpdate={handlePostUpdate} role={userRole} />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-foreground">{page}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <SettingsPanel open={settingsOpen} onClose={handleSettingsClose} workspaceId={activeWorkspace?._id} role={userRole} />
    </div>
  );
}
