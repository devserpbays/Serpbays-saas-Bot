import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { parseCookies } from '@/lib/cookies';
import { getProfileDir } from '@/lib/profilePath';
import { verifyPinterestCookies } from '@/lib/platforms/pinterest';

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { cookies, accountIndex = 0 } = await req.json();
  const { cookieList, cookieMap, error } = parseCookies(cookies, '.pinterest.com');
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  const profileDir = getProfileDir(ctx.workspaceId, 'pinterest', accountIndex);
  const result = await verifyPinterestCookies({ cookieList, cookieMap, profileDir });
  return NextResponse.json(result);
}
