'use client';

import { useState, useEffect } from 'react';
import type { ISettings, SocialAccount, Competitor, WorkspaceRole, KeywordSuggestion } from '@/lib/types';
import { PLATFORMS, PlatformIcon, type PlatformConfig } from '@/lib/platforms/config';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Settings, X, Plus, Minus, Loader2, Check, UserPlus, Sparkles, FlaskConical,
} from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  role?: WorkspaceRole;
}

interface MemberInfo {
  userId: string;
  role: string;
  name: string;
  email: string;
  joinedAt?: string;
}

interface InvitationInfo {
  _id: string;
  email: string;
  role: string;
  expiresAt: string;
  token: string;
}

function AccountChip({ account, onRemove }: { account: SocialAccount; onRemove: (id: string) => void }) {
  const initial = (account.displayName || account.username || '?')[0].toUpperCase();
  return (
    <Badge variant="secondary" className="gap-1.5 pr-1">
      <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[9px] font-bold">
        {initial}
      </span>
      <span>{account.displayName || account.username || account.id}</span>
      {account.username && account.displayName && account.username !== account.displayName && (
        <span className="text-muted-foreground">@{account.username}</span>
      )}
      <button onClick={() => onRemove(account.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );
}

function AddAccountForm({ platform, nextIndex, onSuccess, onCancel }: {
  platform: PlatformConfig; nextIndex: number;
  onSuccess: (account: SocialAccount) => void; onCancel: () => void;
}) {
  const [cookieText, setCookieText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!cookieText.trim()) { setError('Please paste your cookies first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(platform.cookieEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieText.trim(), accountIndex: nextIndex }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Verification failed'); setLoading(false); return; }
      const newAccount: SocialAccount = {
        id: data.accountId || `${platform.id}_${Date.now()}`,
        platform: platform.id, username: data.username || '',
        displayName: data.displayName || data.username || '',
        profileDir: data.profileDir || '', accountIndex: nextIndex,
        addedAt: new Date().toISOString(), active: true,
      };
      await fetch('/api/social-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });
      onSuccess(newAccount);
    } catch (err) { setError((err as Error).message || 'Request failed'); }
    setLoading(false);
  };

  return (
    <div className="mt-2 p-3 border border-dashed border-border rounded-lg bg-muted/50 space-y-2">
      <p className="text-xs text-muted-foreground">Export cookies using the <span className="font-medium text-foreground">Cookie Editor</span> extension, then paste them below.</p>
      <Textarea value={cookieText} onChange={(e) => setCookieText(e.target.value)}
        className="font-mono text-xs resize-none"
        rows={4} placeholder={platform.cookiePlaceholder} disabled={loading} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={handleSubmit} disabled={loading} size="sm">
          {loading ? (<><Loader2 className="w-3 h-3 animate-spin" />Verifying...</>) : 'Verify & Connect'}
        </Button>
        <Button onClick={onCancel} disabled={loading} size="sm" variant="ghost">Cancel</Button>
      </div>
    </div>
  );
}

export default function SettingsPanel({ open, onClose, workspaceId, role = 'owner' }: SettingsPanelProps) {
  const canEdit = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const [settings, setSettings] = useState<ISettings>({
    userId: '', companyName: '', companyDescription: '',
    keywords: [], platforms: ['twitter', 'reddit'], subreddits: [],
    promptTemplate: '', socialAccounts: [],
    competitors: [], competitorAlertThreshold: 60,
    abTestingEnabled: true, abVariationCount: 3,
    abTonePresets: ['helpful', 'professional', 'witty'], abAutoOptimize: false,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [subredditInput, setSubredditInput] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [openForms, setOpenForms] = useState<Record<string, boolean>>({});

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [discoveringKeywords, setDiscoveringKeywords] = useState(false);

  const [toneInput, setToneInput] = useState('');

  useEffect(() => {
    if (open) {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data.settings) setSettings({
            ...data.settings,
            socialAccounts: data.settings.socialAccounts ?? [],
            competitors: data.settings.competitors ?? [],
            abTonePresets: data.settings.abTonePresets ?? ['helpful', 'professional', 'witty'],
          });
        });

      if (workspaceId) {
        fetch(`/api/workspaces/${workspaceId}/members`)
          .then(r => r.json())
          .then(data => setMembers(data.members || []));
        fetch(`/api/workspaces/${workspaceId}/invite`)
          .then(r => r.json())
          .then(data => setInvitations(data.invitations || []));
      }
    }
  }, [open, workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (data.settings) {
      setSettings({ ...data.settings, socialAccounts: data.settings.socialAccounts ?? [], competitors: data.settings.competitors ?? [], abTonePresets: data.settings.abTonePresets ?? ['helpful', 'professional', 'witty'] });
      setMessage('Settings saved!');
      setTimeout(() => setMessage(''), 2000);
    }
    setSaving(false);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.keywords.includes(keywordInput.trim())) {
      setSettings({ ...settings, keywords: [...settings.keywords, keywordInput.trim()] });
      setKeywordInput('');
    }
  };

  const addSubreddit = () => {
    const val = subredditInput.trim().replace(/^\/?(r\/)?/, '');
    if (val && !settings.subreddits.includes(val)) {
      setSettings({ ...settings, subreddits: [...settings.subreddits, val] });
      setSubredditInput('');
    }
  };

  const addCompetitor = () => {
    const name = competitorInput.trim();
    if (name && !(settings.competitors || []).some(c => c.name === name)) {
      setSettings({ ...settings, competitors: [...(settings.competitors || []), { name }] });
      setCompetitorInput('');
    }
  };

  const removeCompetitor = (name: string) => {
    setSettings({ ...settings, competitors: (settings.competitors || []).filter(c => c.name !== name) });
  };

  const togglePlatform = (platform: string) => {
    const current = settings.platforms || [];
    if (current.includes(platform)) {
      setSettings({ ...settings, platforms: current.filter((p) => p !== platform) });
    } else {
      setSettings({ ...settings, platforms: [...current, platform] });
    }
  };

  const accountsForPlatform = (platformId: string) =>
    (settings.socialAccounts || []).filter((a) => a.platform === platformId);
  const nextIndexForPlatform = (platformId: string) =>
    accountsForPlatform(platformId).length;

  const handleAccountAdded = (account: SocialAccount) => {
    setSettings((prev) => ({ ...prev, socialAccounts: [...(prev.socialAccounts || []), account] }));
    setOpenForms((prev) => ({ ...prev, [account.platform]: false }));
  };

  const handleAccountRemoved = async (accountId: string) => {
    await fetch(`/api/social-accounts?id=${encodeURIComponent(accountId)}`, { method: 'DELETE' });
    setSettings((prev) => ({ ...prev, socialAccounts: (prev.socialAccounts || []).filter((a) => a.id !== accountId) }));
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !workspaceId) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (data.invitation) {
        setInvitations(prev => [data.invitation, ...prev]);
        setInviteEmail('');
        setMessage(`Invitation sent! Token: ${data.invitation.token}`);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage(`Error: ${data.error}`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch { setMessage('Failed to send invitation'); }
    setInviting(false);
  };

  const handleDiscoverKeywords = async () => {
    setDiscoveringKeywords(true);
    try {
      const res = await fetch('/api/keyword-suggestions', { method: 'POST' });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch { /* silent */ }
    setDiscoveringKeywords(false);
  };

  const addSuggestedKeyword = (kw: string) => {
    if (!settings.keywords.includes(kw)) {
      setSettings({ ...settings, keywords: [...settings.keywords, kw] });
    }
    setSuggestions(prev => prev.filter(s => s.keyword !== kw));
  };

  const addTonePreset = () => {
    const tone = toneInput.trim().toLowerCase();
    if (tone && !(settings.abTonePresets || []).includes(tone)) {
      setSettings({ ...settings, abTonePresets: [...(settings.abTonePresets || []), tone] });
      setToneInput('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            Settings
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="general" className="px-6">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="Your Company Name" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>Company Description</Label>
              <Textarea value={settings.companyDescription} onChange={(e) => setSettings({ ...settings, companyDescription: e.target.value })}
                rows={3} placeholder="What does your company do? What problems do you solve?" disabled={!canEdit} />
            </div>

            {/* Competitors */}
            <div className="space-y-2">
              <Label>Competitors to Track</Label>
              <p className="text-xs text-muted-foreground">The AI will detect mentions and sentiment toward these competitors.</p>
              {canEdit && (
                <div className="flex gap-2">
                  <Input value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                    placeholder="Competitor name..." className="flex-1" />
                  <Button onClick={addCompetitor} size="sm" variant="destructive">Add</Button>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {(settings.competitors || []).map((c: Competitor) => (
                  <Badge key={c.name} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1">
                    {c.name}
                    {canEdit && (
                      <button onClick={() => removeCompetitor(c.name)} className="text-red-400 hover:text-red-300">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-2">
              <Label>Custom Prompt Template (optional)</Label>
              <Textarea value={settings.promptTemplate} onChange={(e) => setSettings({ ...settings, promptTemplate: e.target.value })}
                className="font-mono text-xs" rows={5}
                placeholder="Use {postContent}, {companyName}, {companyDescription} as variables..." disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Leave empty to use the default prompt. Custom prompts disable A/B testing.</p>
            </div>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-3 mt-4">
            {PLATFORMS.map((platform) => {
              const enabled = settings.platforms?.includes(platform.id) ?? false;
              const accounts = accountsForPlatform(platform.id);
              const formOpen = openForms[platform.id] ?? false;
              return (
                <div key={platform.id} className={`border rounded-xl p-3 transition-colors ${enabled ? platform.accentCls : 'border-border bg-muted/30'}`}>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`platform-${platform.id}`}
                      checked={enabled}
                      onCheckedChange={() => togglePlatform(platform.id)}
                      disabled={!canEdit}
                    />
                    <label htmlFor={`platform-${platform.id}`} className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <PlatformIcon platform={platform.id} />
                      <span className="text-sm font-medium text-foreground">{platform.label}</span>
                    </label>
                    {accounts.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {accounts.map((acc) => <AccountChip key={acc.id} account={acc} onRemove={handleAccountRemoved} />)}
                      </div>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => setOpenForms((prev) => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                      >
                        {formOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                  {formOpen && canEdit && (
                    <AddAccountForm platform={platform} nextIndex={nextIndexForPlatform(platform.id)}
                      onSuccess={handleAccountAdded} onCancel={() => setOpenForms((prev) => ({ ...prev, [platform.id]: false }))} />
                  )}
                </div>
              );
            })}

            {/* Subreddits */}
            {settings.platforms?.includes('reddit') && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Subreddits to Monitor</Label>
                  <p className="text-xs text-muted-foreground">Leave empty to search all of Reddit.</p>
                  {canEdit && (
                    <div className="flex gap-2">
                      <div className="flex items-center flex-1 border border-border rounded-md overflow-hidden">
                        <span className="px-2 text-sm text-muted-foreground bg-muted">r/</span>
                        <Input value={subredditInput} onChange={(e) => setSubredditInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubreddit()}
                          className="border-0 rounded-none focus-visible:ring-0" placeholder="subreddit name" />
                      </div>
                      <Button onClick={addSubreddit} size="sm" className="bg-orange-600 hover:bg-orange-700">Add</Button>
                    </div>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {(settings.subreddits || []).map((sr) => (
                      <Badge key={sr} variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 gap-1">
                        r/{sr}
                        {canEdit && <button onClick={() => setSettings({ ...settings, subreddits: settings.subreddits.filter((s) => s !== sr) })} className="text-orange-400 hover:text-orange-300"><X className="w-3 h-3" /></button>}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label>Keywords to Monitor</Label>
              {canEdit && (
                <div className="flex gap-2">
                  <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                    placeholder="Add a keyword..." className="flex-1" />
                  <Button onClick={addKeyword} size="sm">Add</Button>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {settings.keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1">
                    {kw}
                    {canEdit && <button onClick={() => setSettings({ ...settings, keywords: settings.keywords.filter((k) => k !== kw) })} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
                  </Badge>
                ))}
              </div>

              {/* Keyword Discovery */}
              {canEdit && (
                <div className="mt-3">
                  <Button onClick={handleDiscoverKeywords} disabled={discoveringKeywords} size="sm" variant="outline">
                    <Sparkles className="w-3.5 h-3.5" />
                    {discoveringKeywords ? 'Discovering...' : 'Discover Keywords (AI)'}
                  </Button>
                  {suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Suggestions:</p>
                      <div className="flex gap-1 flex-wrap">
                        {suggestions.map((s) => (
                          <Button key={s.keyword} onClick={() => addSuggestedKeyword(s.keyword)} size="sm" variant="outline" className="text-xs h-7" title={s.reason}>
                            <Plus className="w-3 h-3" /> {s.keyword} <span className="text-muted-foreground">({s.confidence}%)</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Advanced Tab (A/B Testing + Team) */}
          <TabsContent value="advanced" className="space-y-5 mt-4">
            {/* A/B Testing */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                A/B Testing for Replies
              </h3>
              <div className="flex items-center gap-3">
                <Switch
                  id="ab-testing"
                  checked={settings.abTestingEnabled !== false}
                  onCheckedChange={(checked) => setSettings({ ...settings, abTestingEnabled: checked })}
                  disabled={!canEdit}
                />
                <Label htmlFor="ab-testing">Enable A/B variations</Label>
              </div>
              {settings.abTestingEnabled !== false && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Variations per post: {settings.abVariationCount || 3}</Label>
                    <input type="range" min={2} max={5} value={settings.abVariationCount || 3}
                      onChange={(e) => setSettings({ ...settings, abVariationCount: parseInt(e.target.value) })}
                      className="w-full accent-primary" disabled={!canEdit} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tone presets:</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {(settings.abTonePresets || []).map((tone) => (
                        <Badge key={tone} variant="secondary" className="gap-1">
                          {tone}
                          {canEdit && <button onClick={() => setSettings({ ...settings, abTonePresets: (settings.abTonePresets || []).filter(t => t !== tone) })}
                            className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
                        </Badge>
                      ))}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Input value={toneInput} onChange={(e) => setToneInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTonePreset()}
                          className="text-xs" placeholder="Add tone..." />
                        <Button onClick={addTonePreset} size="sm">Add</Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="auto-optimize"
                      checked={settings.abAutoOptimize === true}
                      onCheckedChange={(checked) => setSettings({ ...settings, abAutoOptimize: checked })}
                      disabled={!canEdit}
                    />
                    <Label htmlFor="auto-optimize" className="text-xs">Auto-optimize (use performance data to improve tones)</Label>
                  </div>
                </>
              )}
            </div>

            {/* Team Management */}
            {workspaceId && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  Team Members
                </h3>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-foreground">{m.name || m.email}</span>
                        {m.name && <span className="text-muted-foreground ml-1.5">{m.email}</span>}
                      </div>
                      <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
                    </div>
                  ))}
                </div>
                {invitations.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Pending Invitations:</p>
                    {invitations.map((inv) => (
                      <div key={inv._id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{inv.email}</span>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">pending ({inv.role})</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <div className="flex gap-2 items-end">
                    <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address" className="flex-1 text-xs" />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                      className="border border-border bg-background rounded-md px-2 py-2 text-xs">
                      <option value="editor">Editor</option>
                      <option value="reviewer">Reviewer</option>
                    </select>
                    <Button onClick={handleInvite} disabled={inviting} size="sm" className="bg-purple-600 hover:bg-purple-700">
                      {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Invite'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {canEdit && (
          <SheetFooter className="px-6 py-4 border-t border-border mt-4">
            <div className="flex items-center gap-3 w-full">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                ) : (
                  <><Check className="w-4 h-4" />Save Settings</>
                )}
              </Button>
              {message && (
                <span className={`text-sm font-medium flex items-center gap-1 ${message.startsWith('Error') ? 'text-destructive' : 'text-green-500'}`}>
                  {!message.startsWith('Error') && <Check className="w-4 h-4" />}
                  {message}
                </span>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
