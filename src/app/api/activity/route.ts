import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit = parseInt(searchParams.get('limit') || '50');
  const page = parseInt(searchParams.get('page') || '1');

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.activityLog.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);

  // Enrich with user names
  const userIds = [...new Set(logs.map(l => l.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const enrichedLogs = logs.map(log => ({
    ...log,
    userName: userMap.get(log.userId)?.name || 'Unknown',
  }));

  return NextResponse.json({ logs: enrichedLogs, total, page, limit });
}
