import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/apiAuth';
import { parseCookies } from '@/lib/cookies';
import { getProfileDir } from '@/lib/profilePath';
import { verifyPinterestCookies } from '@/lib/platforms/pinterest';

export async function POST(req: Request) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cookies, accountIndex = 0 } = await req.json();
  const { cookieList, cookieMap, error } = parseCookies(cookies, '.pinterest.com');
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  const profileDir = getProfileDir(userId, 'pinterest', accountIndex);
  const result = await verifyPinterestCookies({ cookieList, cookieMap, profileDir });
  return NextResponse.json(result);
}
