import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import Settings from '@/models/Settings';
import ActivityLog from '@/models/ActivityLog';
import { getProfileDir } from '@/lib/profilePath';
import type { ApiContext } from '@/lib/types';
import type { Cookie } from 'playwright';
import type { PostReplyResult } from '@/lib/platforms/types';

export interface ResolvedPost {
  postId: string;
  postUrl: string;
  replyText: string;
  platform: string;
  cookieMap: Record<string, string>;
  cookieList: Cookie[];
  profileDir: string;
  accountId: string;
  postedTone: string;
}

/**
 * Loads and validates a post for reply posting.
 * Returns resolved post data or an error string.
 */
export async function resolvePostForReply(
  ctx: ApiContext,
  postId: string,
  platformName: string
): Promise<ResolvedPost | string> {
  await connectDB();

  const post = await Post.findOne({ _id: postId, workspaceId: ctx.workspaceId });
  if (!post) return 'Post not found';

  if (post.status === 'posted') return 'Already posted';
  if (post.status !== 'approved') return 'Post must be approved before posting';
  if (post.platform !== platformName) return `Post is not a ${platformName} post`;

  // Determine reply text: editedReply > selected variation > aiReply
  let replyText = '';
  let postedTone = '';

  if (post.editedReply) {
    replyText = post.editedReply;
  } else if (
    post.aiReplies?.length > 0 &&
    post.selectedVariationIndex >= 0 &&
    post.selectedVariationIndex < post.aiReplies.length
  ) {
    const variation = post.aiReplies[post.selectedVariationIndex];
    replyText = variation.text;
    postedTone = variation.tone || '';
  } else if (post.aiReply) {
    replyText = post.aiReply;
    postedTone = post.aiTone || '';
  }

  if (!replyText) return 'No reply text available';

  // Load settings to find the active social account
  const settings = await Settings.findOne({ workspaceId: ctx.workspaceId }).lean();
  if (!settings) return 'No settings found for workspace';

  const accounts = (settings.socialAccounts as Array<{
    platform: string;
    accountIndex?: number;
    active?: boolean;
    id?: string;
  }>) || [];
  const account = accounts.find((a) => a.platform === platformName && a.active !== false);
  if (!account) return `No active ${platformName} account connected`;

  const accountIndex = account.accountIndex || 0;
  const profileDir = getProfileDir(ctx.workspaceId, platformName, accountIndex);

  // Load cookies from .verified file
  let cookieMap: Record<string, string> = {};
  let accountId = account.id || '';

  const verifiedPath = join(profileDir, '.verified');
  if (existsSync(verifiedPath)) {
    try {
      const data = JSON.parse(readFileSync(verifiedPath, 'utf-8'));
      if (data.cookieMap) cookieMap = data.cookieMap;
      if (data.accountId) accountId = data.accountId;
    } catch {}
  }

  // Fallback to legacy userId-based path
  if (Object.keys(cookieMap).length === 0) {
    const legacyDir = getProfileDir(ctx.userId, platformName, accountIndex);
    const legacyPath = join(legacyDir, '.verified');
    if (existsSync(legacyPath)) {
      try {
        const data = JSON.parse(readFileSync(legacyPath, 'utf-8'));
        if (data.cookieMap) cookieMap = data.cookieMap;
        if (data.accountId) accountId = data.accountId;
      } catch {}
    }
  }

  if (Object.keys(cookieMap).length === 0) {
    return `No verified cookies found for ${platformName}. Please re-verify your account.`;
  }

  // Build cookieList from cookieMap for Playwright-based platforms
  const domainMap: Record<string, string> = {
    twitter: '.x.com',
    reddit: '.reddit.com',
    facebook: '.facebook.com',
    quora: '.quora.com',
    youtube: '.youtube.com',
    pinterest: '.pinterest.com',
  };
  const domain = domainMap[platformName] || `.${platformName}.com`;
  const ninetyDays = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

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

  return {
    postId,
    postUrl: post.url,
    replyText,
    platform: platformName,
    cookieMap,
    cookieList,
    profileDir,
    accountId,
    postedTone,
  };
}

/**
 * After a successful platform post, update the post record and log activity.
 */
export async function finalizePostedReply(
  ctx: ApiContext,
  postId: string,
  result: PostReplyResult,
  accountId: string,
  postedTone: string
): Promise<void> {
  await Post.updateOne(
    { _id: postId },
    {
      $set: {
        status: 'posted',
        postedAt: new Date(),
        postedByAccount: accountId,
        replyUrl: result.replyUrl || '',
        postedTone,
      },
    }
  );

  await ActivityLog.create({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: 'post.posted',
    targetType: 'post',
    targetId: postId,
    meta: { replyUrl: result.replyUrl || '', accountId },
  });
}
