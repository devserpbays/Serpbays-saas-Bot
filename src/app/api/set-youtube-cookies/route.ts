import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { parseCookies } from '@/lib/cookies';
import { getProfileDir } from '@/lib/profilePath';
import { verifyYoutubeCookies } from '@/lib/platforms/youtube';

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { cookies, accountIndex = 0 } = await req.json();
  const { cookieList, cookieMap, error } = parseCookies(cookies, '.youtube.com');
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  const profileDir = getProfileDir(ctx.workspaceId, 'youtube', accountIndex);
  const result = await verifyYoutubeCookies({ cookieList, cookieMap, profileDir });
  return NextResponse.json(result);
}
