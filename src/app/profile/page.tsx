'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PLATFORMS, PLATFORM_MAP, PlatformIcon } from '@/lib/platforms/config';
import type { SocialAccount, AccountHealth, CookieHealthStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  User, ArrowLeft, Save, Loader2, Check, Timer,
  ShieldCheck, ShieldAlert, ShieldX, ShieldOff,
  Link2, Plus, Settings,
} from 'lucide-react';

const SCHEDULER_OPTIONS = [
  { label: '15 minutes', value: '*/15 * * * *', minutes: 15 },
  { label: '30 minutes', value: '*/30 * * * *', minutes: 30 },
  { label: '45 minutes', value: '*/45 * * * *', minutes: 45 },
  { label: '1 hour', value: '*/60 * * * *', minutes: 60 },
  { label: '1.5 hours', value: '*/90 * * * *', minutes: 90 },
  { label: '2 hours', value: '*/120 * * * *', minutes: 120 },
];

interface ProfileData {
  user: { _id: string; name: string; email: string; createdAt: string };
  settings: {
    platforms: string[];
    socialAccounts: SocialAccount[];
    platformSchedules?: Record<string, { cronInterval?: string }>;
  } | null;
  workspace: { name: string; slug: string; members: Array<{ userId: string; role: string }> } | null;
  health: { accounts: AccountHealth[]; summary: Record<CookieHealthStatus, number> } | null;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [selectedInterval, setSelectedInterval] = useState('*/15 * * * *');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        setName(data.user?.name || '');

        // Resolve current scheduler interval from platform schedules
        if (data.settings?.platformSchedules) {
          const schedules = Object.values(data.settings.platformSchedules);
          if (schedules.length > 0 && schedules[0].cronInterval) {
            setSelectedInterval(schedules[0].cronInterval);
          }
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedulerInterval: selectedInterval }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  const healthIcon = (status: CookieHealthStatus) => {
    if (status === 'healthy') return <ShieldCheck className="w-4 h-4 text-green-500" />;
    if (status === 'stale') return <ShieldAlert className="w-4 h-4 text-amber-500" />;
    if (status === 'invalid') return <ShieldX className="w-4 h-4 text-red-500" />;
    return <ShieldOff className="w-4 h-4 text-muted-foreground" />;
  };

  const healthLabel = (status: CookieHealthStatus) => {
    if (status === 'healthy') return 'Healthy';
    if (status === 'stale') return 'Stale';
    if (status === 'invalid') return 'Invalid';
    return 'Missing';
  };

  const healthBadgeClass = (status: CookieHealthStatus) => {
    if (status === 'healthy') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (status === 'stale') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (status === 'invalid') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledPlatforms = profile?.settings?.platforms || [];
  const socialAccounts = profile?.settings?.socialAccounts || [];
  const healthAccounts = profile?.health?.accounts || [];
  const allPlatforms = PLATFORMS;

  // Connected platforms (have at least 1 account)
  const connectedPlatforms = allPlatforms.filter(
    (p) => socialAccounts.some((a) => a.platform === p.id)
  );

  // Available-to-connect platforms (no account yet)
  const availablePlatforms = allPlatforms.filter(
    (p) => !socialAccounts.some((a) => a.platform === p.id)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Profile</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>
            ) : saved ? (
              <><Check className="w-3.5 h-3.5 text-green-500" />Saved</>
            ) : (
              <><Save className="w-3.5 h-3.5" />Save Changes</>
            )}
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* User Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{profile?.user?.name || 'User'}</h2>
                <p className="text-sm text-muted-foreground">{profile?.user?.email}</p>
                {profile?.workspace && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {profile.workspace.name}
                  </Badge>
                )}
              </div>
            </div>

            <Separator className="mb-5" />

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profile?.user?.email || ''} disabled className="mt-1.5 opacity-60" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              {profile?.user?.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Member since {new Date(profile.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connected Platforms */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              Connected Platforms
            </h3>

            {connectedPlatforms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No platforms connected yet. Add your first platform below.
              </p>
            ) : (
              <div className="space-y-3">
                {connectedPlatforms.map((platform) => {
                  const accounts = socialAccounts.filter((a) => a.platform === platform.id);
                  const health = healthAccounts.find((h) => h.platform === platform.id);
                  const isEnabled = enabledPlatforms.includes(platform.id);

                  return (
                    <div
                      key={platform.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                    >
                      <PlatformIcon platform={platform.id} className="w-8 h-8" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{platform.label}</span>
                          {isEnabled ? (
                            <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30">
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {accounts.map((acc) => (
                            <span key={acc.id} className="text-xs text-muted-foreground">
                              @{acc.username || acc.displayName || acc.id}
                            </span>
                          ))}
                        </div>
                      </div>
                      {health && (
                        <Badge variant="outline" className={`text-xs gap-1 ${healthBadgeClass(health.status)}`}>
                          {healthIcon(health.status)}
                          {healthLabel(health.status)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Integrations */}
        {availablePlatforms.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-muted-foreground" />
                Available Integrations
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect more platforms to expand your reach.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availablePlatforms.map((platform) => (
                  <Button
                    key={platform.id}
                    variant="outline"
                    className="justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => router.push('/dashboard?openSettings=platforms')}
                  >
                    <PlatformIcon platform={platform.id} className="w-7 h-7" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{platform.label}</p>
                      <p className="text-xs text-muted-foreground">Click to connect</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-Scheduler Interval */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
              <Timer className="w-4 h-4 text-muted-foreground" />
              Auto-Scheduler Interval
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set how often the cron job runs to scrape, evaluate, and auto-post.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SCHEDULER_OPTIONS.map((opt) => {
                const isSelected = selectedInterval === opt.value;
                return (
                  <Button
                    key={opt.value}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className={`h-auto py-3 flex-col gap-1 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                    onClick={() => setSelectedInterval(opt.value)}
                  >
                    <span className="text-lg font-bold">{opt.minutes < 60 ? opt.minutes : opt.minutes / 60}</span>
                    <span className="text-xs text-inherit opacity-70">{opt.minutes < 60 ? 'minutes' : opt.minutes === 60 ? 'hour' : 'hours'}</span>
                  </Button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              The scheduler will run every <strong className="text-foreground">{SCHEDULER_OPTIONS.find((o) => o.value === selectedInterval)?.label}</strong> during active hours.
              Changes take effect next time you start the scheduler.
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Quick Actions
            </h3>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard?openSettings=general')}>
                <Settings className="w-3.5 h-3.5" />
                Open Settings
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard?openSettings=platforms')}>
                <Link2 className="w-3.5 h-3.5" />
                Manage Platforms
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
