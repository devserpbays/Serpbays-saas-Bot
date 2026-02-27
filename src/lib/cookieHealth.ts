import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { getProfileDir } from '@/lib/profilePath';
import type { SocialAccount, AccountHealth, CookieHealthResult, CookieHealthStatus } from '@/lib/types';

/**
 * Required cookies per platform.
 * If any of these are missing the status is 'invalid'.
 */
const REQUIRED_COOKIES: Record<string, string[]> = {
  twitter:   ['auth_token', 'ct0'],
  reddit:    [],
  facebook:  ['c_user', 'xs'],
  quora:     ['m-b'],
  youtube:   ['SID'],
  pinterest: ['_pinterest_sess'],
};

/** Cookie age thresholds */
const STALE_THRESHOLD_HOURS = 72; // 3 days = stale warning

/**
 * Check the health of all social account cookies for a workspace.
 */
export async function checkCookieHealth(workspaceId: string): Promise<CookieHealthResult> {
  await connectDB();

  const settings = await Settings.findOne({ workspaceId }).lean();
  if (!settings) {
    return { accounts: [], summary: { healthy: 0, stale: 0, missing: 0, invalid: 0 } };
  }

  const settingsObj = settings as Record<string, unknown>;
  const userId = (settingsObj.userId as { toString(): string }).toString();
  const accounts = (settingsObj.socialAccounts as SocialAccount[]) || [];
  const enabledPlatforms = (settingsObj.platforms as string[]) || [];

  const results: AccountHealth[] = [];

  for (const account of accounts) {
    if (account.active === false) continue;
    if (!enabledPlatforms.includes(account.platform)) continue;

    const health = checkAccountHealth(account, workspaceId, userId);
    results.push(health);
  }

  // Also check enabled platforms with no account
  for (const platform of enabledPlatforms) {
    const hasAccount = accounts.some(
      (a) => a.platform === platform && a.active !== false
    );
    if (!hasAccount) {
      results.push({
        accountId: '',
        platform,
        username: '',
        status: 'missing',
        verifiedAt: null,
        ageHours: null,
        missingCookies: [],
        message: 'No account connected',
      });
    }
  }

  const summary: Record<CookieHealthStatus, number> = { healthy: 0, stale: 0, missing: 0, invalid: 0 };
  for (const r of results) {
    summary[r.status]++;
  }

  return { accounts: results, summary };
}

/**
 * Check a single social account's cookie health.
 */
function checkAccountHealth(
  account: SocialAccount,
  workspaceId: string,
  userId: string
): AccountHealth {
  const base: Omit<AccountHealth, 'status' | 'verifiedAt' | 'ageHours' | 'missingCookies' | 'message'> = {
    accountId: account.id,
    platform: account.platform,
    username: account.username || account.displayName || '',
  };

  // Try workspace-scoped path first, then legacy userId-scoped
  const profileDir = getProfileDir(workspaceId, account.platform, account.accountIndex || 0);
  const verifiedPath = join(profileDir, '.verified');

  let data: Record<string, unknown> | null = null;

  if (existsSync(verifiedPath)) {
    try {
      data = JSON.parse(readFileSync(verifiedPath, 'utf-8'));
    } catch { /* corrupt file */ }
  }

  // Fallback to legacy path
  if (!data) {
    const legacyDir = getProfileDir(userId, account.platform, account.accountIndex || 0);
    const legacyPath = join(legacyDir, '.verified');
    if (existsSync(legacyPath)) {
      try {
        data = JSON.parse(readFileSync(legacyPath, 'utf-8'));
      } catch { /* corrupt file */ }
    }
  }

  if (!data) {
    return {
      ...base,
      status: 'missing',
      verifiedAt: null,
      ageHours: null,
      missingCookies: [],
      message: 'No verified cookies found',
    };
  }

  // Extract verification timestamp
  let verifiedAt: string | null = null;
  let ageHours: number | null = null;

  if (data.verifiedAt) {
    verifiedAt = String(data.verifiedAt);
    const ageMs = Date.now() - new Date(verifiedAt).getTime();
    ageHours = Math.round(ageMs / (1000 * 60 * 60));
  } else {
    // Use file mtime as fallback
    try {
      const realPath = existsSync(join(getProfileDir(workspaceId, account.platform, account.accountIndex || 0), '.verified'))
        ? join(getProfileDir(workspaceId, account.platform, account.accountIndex || 0), '.verified')
        : join(getProfileDir(userId, account.platform, account.accountIndex || 0), '.verified');
      const stat = statSync(realPath);
      verifiedAt = stat.mtime.toISOString();
      ageHours = Math.round((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60));
    } catch { /* skip */ }
  }

  // Check required cookies
  const cookieMap = data.cookieMap as Record<string, string> | undefined;
  if (!cookieMap || Object.keys(cookieMap).length === 0) {
    return {
      ...base,
      status: 'invalid',
      verifiedAt,
      ageHours,
      missingCookies: REQUIRED_COOKIES[account.platform] || [],
      message: 'Cookie data is empty',
    };
  }

  const required = REQUIRED_COOKIES[account.platform] || [];
  const missing = required.filter((key) => !cookieMap[key]);

  if (missing.length > 0) {
    return {
      ...base,
      status: 'invalid',
      verifiedAt,
      ageHours,
      missingCookies: missing,
      message: `Missing required cookies: ${missing.join(', ')}`,
    };
  }

  // Check staleness
  if (ageHours !== null && ageHours > STALE_THRESHOLD_HOURS) {
    return {
      ...base,
      status: 'stale',
      verifiedAt,
      ageHours,
      missingCookies: [],
      message: `Cookies are ${ageHours}h old — may need refreshing`,
    };
  }

  return {
    ...base,
    status: 'healthy',
    verifiedAt,
    ageHours,
    missingCookies: [],
    message: ageHours !== null ? `Verified ${ageHours}h ago` : 'Cookies present',
  };
}
