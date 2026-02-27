import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/apiAuth';
import { checkCookieHealth } from '@/lib/cookieHealth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const health = await checkCookieHealth(ctx.workspaceId);
  return NextResponse.json(health);
}
