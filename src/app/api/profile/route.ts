import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { auth } from '@/lib/auth';
import User from '@/models/User';
import Settings from '@/models/Settings';
import Workspace from '@/models/Workspace';
import { checkCookieHealth } from '@/lib/cookieHealth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const user = await User.findById(session.user.id).select('-password').lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const workspaceId = session.user.activeWorkspaceId;
  let settings = null;
  let workspace = null;
  let health = null;

  if (workspaceId) {
    settings = await Settings.findOne({ workspaceId }).lean();
    workspace = await Workspace.findById(workspaceId).lean();
    health = await checkCookieHealth(workspaceId);
  }

  return NextResponse.json({ user, settings, workspace, health });
}

/** Update user profile (name) or scheduler interval */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const body = await req.json();

  // Update user name if provided
  if (body.name) {
    await User.findByIdAndUpdate(session.user.id, { name: body.name });
  }

  // Update scheduler interval if provided
  if (body.schedulerInterval && session.user.activeWorkspaceId) {
    const validIntervals = ['*/15 * * * *', '*/30 * * * *', '*/45 * * * *', '*/60 * * * *', '*/90 * * * *', '*/120 * * * *'];
    if (!validIntervals.includes(body.schedulerInterval)) {
      return NextResponse.json({ error: 'Invalid scheduler interval' }, { status: 400 });
    }

    const settings = await Settings.findOne({ workspaceId: session.user.activeWorkspaceId });
    if (settings) {
      // Apply interval to all platform schedules
      const schedules = settings.platformSchedules || new Map();
      const platforms = settings.platforms || [];

      for (const platform of platforms) {
        const existing = schedules.get(platform) || {};
        schedules.set(platform, {
          timezone: existing.timezone || 'Asia/Kolkata',
          days: existing.days || [1, 2, 3, 4, 5],
          startHour: existing.startHour ?? 9,
          endHour: existing.endHour ?? 18,
          cronInterval: body.schedulerInterval,
        });
      }

      settings.platformSchedules = schedules;
      await settings.save();
    }
  }

  const user = await User.findById(session.user.id).select('-password').lean();
  return NextResponse.json({ success: true, user });
}
