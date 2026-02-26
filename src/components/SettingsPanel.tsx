'use client';

import { useState, useEffect } from 'react';
import type { ISettings, SocialAccount, Competitor, WorkspaceRole, KeywordSuggestion } from '@/lib/types';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  role?: WorkspaceRole;
}

interface PlatformConfig {
  id: string;
  label: string;
  cookieEndpoint: string;
  cookiePlaceholder: string;
  accentCls: string;
  iconBg: string;
  icon: React.ReactNode;
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

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: 'twitter', label: 'Twitter / X', cookieEndpoint: '/api/set-twitter-cookies',
    cookiePlaceholder: 'Paste cookies as JSON array (from Cookie Editor extension) or key=value; format...',
    accentCls: 'border-sky-300 bg-sky-50', iconBg: 'bg-black',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
  },
  {
    id: 'reddit', label: 'Reddit', cookieEndpoint: '/api/set-reddit-cookies',
    cookiePlaceholder: 'Paste Reddit cookies as JSON array or key=value; format...',
    accentCls: 'border-orange-300 bg-orange-50', iconBg: 'bg-orange-600',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>,
  },
  {
    id: 'facebook', label: 'Facebook', cookieEndpoint: '/api/set-fb-cookies',
    cookiePlaceholder: 'Paste Facebook cookies as JSON array or key=value; format...',
    accentCls: 'border-blue-300 bg-blue-50', iconBg: 'bg-blue-600',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
  {
    id: 'quora', label: 'Quora', cookieEndpoint: '/api/set-quora-cookies',
    cookiePlaceholder: 'Paste Quora cookies as JSON array or key=value; format...',
    accentCls: 'border-red-300 bg-red-50', iconBg: 'bg-red-600',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M12.071 0C5.4 0 .001 5.4.001 12.071c0 6.248 4.759 11.41 10.85 12.003-.044-.562-.094-1.407-.094-2.001 0-.666.023-1.406.068-2.028-.447.045-.896.068-1.349.068-3.734 0-5.941-2.162-5.941-5.95 0-3.78 2.207-5.941 5.941-5.941 3.733 0 5.94 2.161 5.94 5.941 0 1.873-.509 3.374-1.407 4.38l1.047 1.986c.423.806.847 1.166 1.336 1.166.888 0 1.406-.949 1.406-2.688V12.07C17.8 6.37 15.292 0 12.071 0zm-1.595 17.624c.263-.01.526-.022.786-.022h.026l-.803-1.523c.598-.861.941-2.083.941-3.578 0-3.022-1.73-4.697-4.689-4.697-2.97 0-4.7 1.675-4.7 4.697 0 3.031 1.73 4.706 4.7 4.706.575 0 1.127-.056 1.739-.183z" /></svg>,
  },
  {
    id: 'youtube', label: 'YouTube', cookieEndpoint: '/api/set-youtube-cookies',
    cookiePlaceholder: 'Paste YouTube cookies as JSON array or key=value; format...',
    accentCls: 'border-red-300 bg-red-50', iconBg: 'bg-red-500',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>,
  },
  {
    id: 'pinterest', label: 'Pinterest', cookieEndpoint: '/api/set-pinterest-cookies',
    cookiePlaceholder: 'Paste Pinterest cookies as JSON array or key=value; format...',
    accentCls: 'border-red-300 bg-red-50', iconBg: 'bg-red-700',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" /></svg>,
  },
];

function AccountChip({ account, onRemove }: { account: SocialAccount; onRemove: (id: string) => void }) {
  const initial = (account.displayName || account.username || '?')[0].toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-full shadow-sm">
      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {initial}
      </span>
      <span className="font-medium">{account.displayName || account.username || account.id}</span>
      {account.username && account.displayName && account.username !== account.displayName && (
        <span className="text-gray-400">@{account.username}</span>
      )}
      <button onClick={() => onRemove(account.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-0.5 leading-none" title="Remove account">
        &times;
      </button>
    </span>
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
    <div className="mt-2 p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50 space-y-2">
      <p className="text-xs text-gray-500">Export cookies using the <span className="font-medium text-gray-700">Cookie Editor</span> extension, then paste them below.</p>
      <textarea value={cookieText} onChange={(e) => setCookieText(e.target.value)}
        className="w-full border border-gray-300 rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        rows={4} placeholder={platform.cookiePlaceholder} disabled={loading} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={handleSubmit} disabled={loading}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? (<><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Verifying...</>) : 'Verify & Connect'}
        </button>
        <button onClick={onCancel} disabled={loading} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
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

  // Team management
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  // Keyword suggestions
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [discoveringKeywords, setDiscoveringKeywords] = useState(false);

  // A/B tone input
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="space-y-5">

          {/* Team Management */}
          {workspaceId && (
            <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-purple-800">Team Members</h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{m.name || m.email}</span>
                      {m.name && <span className="text-gray-400 ml-1.5">{m.email}</span>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      m.role === 'owner' ? 'bg-purple-200 text-purple-700' :
                      m.role === 'editor' ? 'bg-blue-200 text-blue-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>{m.role}</span>
                  </div>
                ))}
              </div>
              {invitations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Pending Invitations:</p>
                  {invitations.map((inv) => (
                    <div key={inv._id} className="flex items-center justify-between text-xs text-gray-500">
                      <span>{inv.email}</span>
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">pending ({inv.role})</span>
                    </div>
                  ))}
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address" className="w-full border border-gray-300 rounded-md p-2 text-xs" />
                  </div>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                    className="border border-gray-300 rounded-md p-2 text-xs">
                    <option value="editor">Editor</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                  <button onClick={handleInvite} disabled={inviting}
                    className="px-3 py-2 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 disabled:opacity-50">
                    {inviting ? '...' : 'Invite'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Company Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input type="text" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Your Company Name" disabled={!canEdit} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Description</label>
            <textarea value={settings.companyDescription} onChange={(e) => setSettings({ ...settings, companyDescription: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm" rows={3}
              placeholder="What does your company do? What problems do you solve?" disabled={!canEdit} />
          </div>

          {/* Platforms & Accounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platforms &amp; Connected Accounts</label>
            <div className="space-y-2">
              {PLATFORM_CONFIGS.map((platform) => {
                const enabled = settings.platforms?.includes(platform.id) ?? false;
                const accounts = accountsForPlatform(platform.id);
                const formOpen = openForms[platform.id] ?? false;
                return (
                  <div key={platform.id} className={`border rounded-xl p-3 transition-colors ${enabled ? platform.accentCls : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`platform-${platform.id}`} checked={enabled} onChange={() => togglePlatform(platform.id)}
                        className="rounded border-gray-300 cursor-pointer" disabled={!canEdit} />
                      <label htmlFor={`platform-${platform.id}`} className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <span className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${platform.iconBg}`}>{platform.icon}</span>
                        <span className="text-sm font-medium text-gray-800">{platform.label}</span>
                      </label>
                      {accounts.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {accounts.map((acc) => <AccountChip key={acc.id} account={acc} onRemove={handleAccountRemoved} />)}
                        </div>
                      )}
                      {canEdit && (
                        <button onClick={() => setOpenForms((prev) => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                          className="ml-auto flex-shrink-0 w-7 h-7 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 flex items-center justify-center transition-colors text-base leading-none"
                          title={`Add ${platform.label} account`}>
                          {formOpen ? '-' : '+'}
                        </button>
                      )}
                    </div>
                    {formOpen && canEdit && (
                      <AddAccountForm platform={platform} nextIndex={nextIndexForPlatform(platform.id)}
                        onSuccess={handleAccountAdded} onCancel={() => setOpenForms((prev) => ({ ...prev, [platform.id]: false }))} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Competitors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competitors to Track</label>
            <p className="text-xs text-gray-500 mb-2">The AI will detect mentions and sentiment toward these competitors.</p>
            {canEdit && (
              <div className="flex gap-2 mb-2">
                <input type="text" value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                  className="flex-1 border border-gray-300 rounded-md p-2 text-sm" placeholder="Competitor name..." />
                <button onClick={addCompetitor} className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">Add</button>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {(settings.competitors || []).map((c: Competitor) => (
                <span key={c.name} className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200">
                  {c.name}
                  {canEdit && (
                    <button onClick={() => removeCompetitor(c.name)} className="text-red-400 hover:text-red-600">&times;</button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords to Monitor</label>
            {canEdit && (
              <div className="flex gap-2 mb-2">
                <input type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  className="flex-1 border border-gray-300 rounded-md p-2 text-sm" placeholder="Add a keyword..." />
                <button onClick={addKeyword} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Add</button>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {settings.keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  {kw}
                  {canEdit && <button onClick={() => setSettings({ ...settings, keywords: settings.keywords.filter((k) => k !== kw) })} className="text-blue-400 hover:text-blue-600">&times;</button>}
                </span>
              ))}
            </div>
            {/* Keyword Discovery */}
            {canEdit && (
              <div className="mt-3">
                <button onClick={handleDiscoverKeywords} disabled={discoveringKeywords}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-50">
                  {discoveringKeywords ? 'Discovering...' : 'Discover Keywords (AI)'}
                </button>
                {suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Suggestions:</p>
                    <div className="flex gap-1 flex-wrap">
                      {suggestions.map((s) => (
                        <button key={s.keyword} onClick={() => addSuggestedKeyword(s.keyword)}
                          className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"
                          title={s.reason}>
                          + {s.keyword} <span className="text-indigo-400">({s.confidence}%)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subreddits */}
          {settings.platforms?.includes('reddit') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subreddits to Monitor</label>
              <p className="text-xs text-gray-500 mb-2">Leave empty to search all of Reddit.</p>
              {canEdit && (
                <div className="flex gap-2 mb-2">
                  <div className="flex items-center flex-1 border border-gray-300 rounded-md overflow-hidden">
                    <span className="px-2 text-sm text-gray-500 bg-gray-50">r/</span>
                    <input type="text" value={subredditInput} onChange={(e) => setSubredditInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSubreddit()}
                      className="flex-1 p-2 text-sm border-0 outline-none" placeholder="subreddit name" />
                  </div>
                  <button onClick={addSubreddit} className="px-3 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700">Add</button>
                </div>
              )}
              <div className="flex gap-1 flex-wrap">
                {(settings.subreddits || []).map((sr) => (
                  <span key={sr} className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                    r/{sr}
                    {canEdit && <button onClick={() => setSettings({ ...settings, subreddits: settings.subreddits.filter((s) => s !== sr) })} className="text-orange-400 hover:text-orange-600">&times;</button>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* A/B Testing */}
          <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-blue-800">A/B Testing for Replies</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.abTestingEnabled !== false}
                  onChange={(e) => setSettings({ ...settings, abTestingEnabled: e.target.checked })}
                  className="rounded border-gray-300" disabled={!canEdit} />
                <span className="text-gray-700">Enable A/B variations</span>
              </label>
            </div>
            {settings.abTestingEnabled !== false && (
              <>
                <div>
                  <label className="text-xs text-gray-600">Variations per post: {settings.abVariationCount || 3}</label>
                  <input type="range" min={2} max={5} value={settings.abVariationCount || 3}
                    onChange={(e) => setSettings({ ...settings, abVariationCount: parseInt(e.target.value) })}
                    className="w-full" disabled={!canEdit} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Tone presets:</label>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {(settings.abTonePresets || []).map((tone) => (
                      <span key={tone} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {tone}
                        {canEdit && <button onClick={() => setSettings({ ...settings, abTonePresets: (settings.abTonePresets || []).filter(t => t !== tone) })}
                          className="text-blue-400 hover:text-blue-600">&times;</button>}
                      </span>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <input type="text" value={toneInput} onChange={(e) => setToneInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTonePreset()}
                        className="flex-1 border border-gray-300 rounded-md p-1.5 text-xs" placeholder="Add tone..." />
                      <button onClick={addTonePreset} className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700">Add</button>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.abAutoOptimize === true}
                    onChange={(e) => setSettings({ ...settings, abAutoOptimize: e.target.checked })}
                    className="rounded border-gray-300" disabled={!canEdit} />
                  <span className="text-gray-700 text-xs">Auto-optimize (use performance data to improve tones)</span>
                </label>
              </>
            )}
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Prompt Template (optional)</label>
            <textarea value={settings.promptTemplate} onChange={(e) => setSettings({ ...settings, promptTemplate: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm font-mono" rows={5}
              placeholder="Use {postContent}, {companyName}, {companyDescription} as variables..." disabled={!canEdit} />
            <p className="text-xs text-gray-500 mt-1">Leave empty to use the default prompt. Custom prompts disable A/B testing.</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {message && <span className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{message}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
