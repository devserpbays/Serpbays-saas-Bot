import type { Cookie } from 'playwright';

interface ParseResult {
  cookieList: Cookie[];
  cookieMap: Record<string, string>;
  error?: string;
}

const PLATFORM_DOMAIN_MAP: Record<string, string> = {
  twitter: '.x.com',
  reddit: '.reddit.com',
  facebook: '.facebook.com',
  quora: '.quora.com',
  youtube: '.youtube.com',
  pinterest: '.pinterest.com',
};

// Google auth cookies that must be set on .google.com for YouTube to work
const GOOGLE_COOKIE_RE = /^(__Secure-|SID$|HSID$|SSID$|APISID$|SAPISID$|LOGIN_INFO$)/;

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
}

/**
 * Build a Playwright cookie list from a flat cookieMap for a given platform.
 * If a stored cookie list (with original domains) is available, uses that instead.
 * For YouTube, also sets Google auth cookies on .google.com domain.
 */
export function buildCookieList(
  cookieMap: Record<string, string>,
  platform: string,
  storedCookieList?: StoredCookie[]
): Cookie[] {
  const ninetyDays = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  // If we have a stored cookie list with original domains, use it directly
  if (storedCookieList && storedCookieList.length > 0) {
    return storedCookieList.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: ninetyDays,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax' as const,
    }));
  }

  // Fallback: rebuild from flat cookieMap
  const domain = PLATFORM_DOMAIN_MAP[platform] || `.${platform}.com`;

  const cookieList: Cookie[] = Object.entries(cookieMap).map(([name, value]) => ({
    name,
    value,
    domain,
    path: '/',
    expires: ninetyDays,
    httpOnly: false,
    secure: true,
    sameSite: 'Lax' as const,
  }));

  // YouTube needs Google cookies on .google.com domain for authentication
  if (platform === 'youtube') {
    for (const [name, value] of Object.entries(cookieMap)) {
      if (GOOGLE_COOKIE_RE.test(name)) {
        cookieList.push({
          name,
          value,
          domain: '.google.com',
          path: '/',
          expires: ninetyDays,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        });
      }
    }
  }

  return cookieList;
}

/**
 * Parse cookies from various formats into a Playwright-compatible cookie list.
 * Supports:
 *  - JSON array from Cookie Editor extension: [{name, value, domain, ...}]
 *  - Key=value string: "auth_token=xxx; ct0=yyy"
 *  - Flat object: {auth_token: "xxx", ct0: "yyy"}
 */
export function parseCookies(
  cookies: string | Record<string, string> | Array<Record<string, string>>,
  defaultDomain: string
): ParseResult {
  const ninetyDays = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  try {
    let rawList: Array<Record<string, string>>;

    if (typeof cookies === 'string') {
      const trimmed = cookies.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else {
          // Flat object format
          rawList = Object.entries(parsed).map(([name, value]) => ({
            name,
            value: String(value),
          }));
        }
      } else {
        // key=value string format
        rawList = trimmed
          .split(/;\s*/)
          .filter(Boolean)
          .reduce<Record<string, string>[]>((acc, pair) => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx !== -1) {
              acc.push({
                name: pair.slice(0, eqIdx).trim(),
                value: pair.slice(eqIdx + 1).trim(),
              });
            }
            return acc;
          }, []);
      }
    } else if (Array.isArray(cookies)) {
      rawList = cookies;
    } else {
      // Plain object
      rawList = Object.entries(cookies).map(([name, value]) => ({
        name,
        value: String(value),
      }));
    }

    if (!rawList.length) {
      return { cookieList: [], cookieMap: {}, error: 'No cookies found in input' };
    }

    const cookieMap: Record<string, string> = {};
    const cookieList: Cookie[] = rawList.map((c) => {
      const name = c.name || c.Name || '';
      const value = c.value || c.Value || '';
      cookieMap[name] = value;

      let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';
      const ss = (c.sameSite || c.SameSite || '').toLowerCase();
      if (ss === 'strict') sameSite = 'Strict';
      else if (ss === 'none' || ss === 'no_restriction') sameSite = 'None';

      return {
        name,
        value,
        domain: c.domain || c.Domain || defaultDomain,
        path: c.path || c.Path || '/',
        expires: Number(c.expirationDate || c.expires || c.Expires) || ninetyDays,
        httpOnly: Boolean(c.httpOnly ?? c.HttpOnly ?? false),
        secure: Boolean(c.secure ?? c.Secure ?? true),
        sameSite,
      };
    });

    return { cookieList, cookieMap };
  } catch (err) {
    return {
      cookieList: [],
      cookieMap: {},
      error: `Failed to parse cookies: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
