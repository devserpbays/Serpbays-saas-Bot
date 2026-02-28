'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SocialAccount, AccountHealth, CookieHealthStatus } from '@/lib/types';
import { PLATFORMS, PlatformIcon } from '@/lib/platforms/config';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  User, Save, Loader2, Check, Timer,
  ShieldCheck, ShieldAlert, ShieldX, ShieldOff,
  Link2, Plus, Mail, Calendar,
} from 'lucide-react';

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: (tab: string) => void;
}

const SCHEDULER_OPTIONS = [
  { label: '15 min', value: '*/15 * * * *', minutes: 15 },
  { label: '30 min', value: '*/30 * * * *', minutes: 30 },
  { label: '45 min', value: '*/45 * * * *', minutes: 45 },
  { label: '1 hr', value: '*/60 * * * *', minutes: 60 },
  { label: '1.5 hr', value: '*/90 * * * *', minutes: 90 },
  { label: '2 hr', value: '*/120 * * * *', minutes: 120 },
];

interface ProfileData {
  user: { _id: string; name: string; email: string; createdAt: string };
  settings: {
    platforms: string[];
    socialAccounts: SocialAccount[];
    platformSchedules?: Record<string, { cronInterval?: string }>;
  } | null;
  workspace: { name: string } | null;
  health: { accounts: AccountHealth[] } | null;
}

export default function ProfilePanel({ open, onClose, onOpenSettings }: ProfilePanelProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [selectedInterval, setSelectedInterval] = useState('*/15 * * * *');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        setName(data.user?.name || '');
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
    if (open) fetchProfile();
  }, [open, fetchProfile]);

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
    if (status === 'healthy') return <ShieldCheck className="w-3.5 h-3.5 text-green-500" />;
    if (status === 'stale') return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
    if (status === 'invalid') return <ShieldX className="w-3.5 h-3.5 text-red-500" />;
    return <ShieldOff className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const healthBadgeClass = (status: CookieHealthStatus) => {
    if (status === 'healthy') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (status === 'stale') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (status === 'invalid') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  const healthLabel = (status: CookieHealthStatus) => {
    if (status === 'healthy') return 'Healthy';
    if (status === 'stale') return 'Stale';
    if (status === 'invalid') return 'Invalid';
    return 'Missing';
  };

  const socialAccounts = profile?.settings?.socialAccounts || [];
  const healthAccounts = profile?.health?.accounts || [];
  const enabledPlatforms = profile?.settings?.platforms || [];

  const connectedPlatforms = PLATFORMS.filter(
    (p) => socialAccounts.some((a) => a.platform === p.id)
  );
  const availablePlatforms = PLATFORMS.filter(
    (p) => !socialAccounts.some((a) => a.platform === p.id)
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" />
            Profile
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-6">

            {/* User Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{profile?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.user?.email}</p>
                  {profile?.workspace && (
                    <Badge variant="outline" className="mt-1 text-[10px]">{profile.workspace.name}</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="profile-name" className="text-xs">Display Name</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    {profile?.user?.email}
                  </div>
                </div>
                {profile?.user?.createdAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Member since {new Date(profile.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Connected Platforms */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                Connected Platforms
              </h3>
              {connectedPlatforms.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No platforms connected yet.</p>
              ) : (
                <div className="space-y-2">
                  {connectedPlatforms.map((platform) => {
                    const accounts = socialAccounts.filter((a) => a.platform === platform.id);
                    const health = healthAccounts.find((h) => h.platform === platform.id);
                    const isEnabled = enabledPlatforms.includes(platform.id);

                    return (
                      <div key={platform.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border">
                        <PlatformIcon platform={platform.id} className="w-6 h-6" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground">{platform.label}</span>
                            {isEnabled ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-500/15 text-green-400 border-green-500/30">On</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">Off</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {accounts.map((a) => `@${a.username || a.displayName || a.id}`).join(', ')}
                          </p>
                        </div>
                        {health && (
                          <Badge variant="outline" className={`text-[10px] gap-1 px-1.5 ${healthBadgeClass(health.status)}`}>
                            {healthIcon(health.status)}
                            {healthLabel(health.status)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Available Integrations */}
            {availablePlatforms.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  Add Integration
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {availablePlatforms.map((platform) => (
                    <Button
                      key={platform.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 h-auto py-2 px-3"
                      onClick={() => {
                        onClose();
                        onOpenSettings?.('platforms');
                      }}
                    >
                      <PlatformIcon platform={platform.id} className="w-5 h-5" />
                      <span className="text-xs">{platform.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Auto-Scheduler Interval */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                Auto-Scheduler Interval
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                How often the cron job runs to scrape, evaluate, and auto-post.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SCHEDULER_OPTIONS.map((opt) => {
                  const isSelected = selectedInterval === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={`h-auto py-2.5 flex-col gap-0.5 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                      onClick={() => setSelectedInterval(opt.value)}
                    >
                      <span className="text-base font-bold">{opt.minutes < 60 ? opt.minutes : opt.minutes / 60}</span>
                      <span className="text-[10px] opacity-70">{opt.minutes < 60 ? 'min' : opt.minutes === 60 ? 'hour' : 'hours'}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Runs every <strong className="text-foreground">{SCHEDULER_OPTIONS.find((o) => o.value === selectedInterval)?.label}</strong> during active hours.
              </p>
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
              ) : saved ? (
                <><Check className="w-4 h-4 text-green-500" />Saved</>
              ) : (
                <><Save className="w-4 h-4" />Save Changes</>
              )}
            </Button>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
