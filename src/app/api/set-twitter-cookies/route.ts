import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/apiAuth';
import { parseCookies } from '@/lib/cookies';
import { getProfileDir } from '@/lib/profilePath';
import { verifyTwitterCookies } from '@/lib/platforms/twitter';

export async function POST(req: Request) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cookies, accountIndex = 0 } = await req.json();
  const { cookieList, cookieMap, error } = parseCookies(cookies, '.x.com');
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  const profileDir = getProfileDir(userId, 'twitter', accountIndex);
  const result = await verifyTwitterCookies({ cookieList, cookieMap, profileDir });
  return NextResponse.json(result);
}
