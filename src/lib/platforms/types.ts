import type { Cookie } from 'playwright';

export interface VerificationResult {
  success: boolean;
  username?: string;
  displayName?: string;
  accountId?: string;
  profileDir?: string;
  error?: string;
}

export interface VerifyOptions {
  cookieList: Cookie[];
  cookieMap: Record<string, string>;
  profileDir: string;
}

export interface ScrapedPost {
  url: string;
  platform: string;
  author: string;
  content: string;
  scrapedAt: Date;
  likeCount?: number;
  replyCount?: number;
  viewCount?: number;
}

export interface ScrapeContext {
  keywords: string[];
  cookieMap: Record<string, string>;
  cookieList: Cookie[];
  profileDir: string;
  subreddits?: string[];
  facebookGroups?: string[];
}

export const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
];

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

export const NAVIGATION_TIMEOUT = 30000;
