import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { checkCookieHealth } from '@/lib/cookieHealth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, activeWorkspaceId: true, createdAt: true, updatedAt: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const workspaceId = session.user.activeWorkspaceId;
  let settings = null;
  let workspace = null;
  let health = null;

  if (workspaceId) {
    settings = await db.settings.findUnique({ where: { workspaceId } });
    workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
    health = await checkCookieHealth(workspaceId);
  }

  return NextResponse.json({ user, settings, workspace, health });
}

/** Update user profile (name) or scheduler interval */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Update user name if provided
  if (body.name) {
    await db.user.update({ where: { id: session.user.id }, data: { name: body.name } });
  }

  // Update scheduler interval if provided
  if (body.schedulerInterval && session.user.activeWorkspaceId) {
    const validIntervals = ['*/15 * * * *', '*/30 * * * *', '*/45 * * * *', '*/60 * * * *', '*/90 * * * *', '*/120 * * * *'];
    if (!validIntervals.includes(body.schedulerInterval)) {
      return NextResponse.json({ error: 'Invalid scheduler interval' }, { status: 400 });
    }

    const settings = await db.settings.findUnique({ where: { workspaceId: session.user.activeWorkspaceId } });
    if (settings) {
      const platforms = (settings.platforms as unknown as string[]) || [];
      const currentSchedules = (settings.platformSchedules as Record<string, unknown>) || {};
      const updatedSchedules: Record<string, unknown> = {};

      for (const platform of platforms) {
        const existing = (currentSchedules[platform] as Record<string, unknown>) || {};
        updatedSchedules[platform] = {
          timezone: existing.timezone || 'Asia/Kolkata',
          days: existing.days || [1, 2, 3, 4, 5],
          startHour: existing.startHour ?? 9,
          endHour: existing.endHour ?? 18,
          cronInterval: body.schedulerInterval,
        };
      }

      await db.settings.update({
        where: { workspaceId: session.user.activeWorkspaceId },
        data: { platformSchedules: updatedSchedules as unknown as import('@prisma/client').Prisma.InputJsonValue },
      });
    }
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, activeWorkspaceId: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ success: true, user });
}
