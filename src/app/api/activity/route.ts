import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ActivityLog from '@/models/ActivityLog';
import User from '@/models/User';
import { getApiContext } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const { searchParams } = req.nextUrl;
  const limit = parseInt(searchParams.get('limit') || '50');
  const page = parseInt(searchParams.get('page') || '1');

  const [logs, total] = await Promise.all([
    ActivityLog.find({ workspaceId: ctx.workspaceId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments({ workspaceId: ctx.workspaceId }),
  ]);

  // Enrich with user names
  const userIds = [...new Set(logs.map(l => (l.userId as { toString(): string }).toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = new Map(users.map(u => [(u._id as { toString(): string }).toString(), u]));

  const enrichedLogs = logs.map(log => ({
    ...log,
    userName: (userMap.get((log.userId as { toString(): string }).toString()) as { name?: string })?.name || 'Unknown',
  }));

  return NextResponse.json({ logs: enrichedLogs, total, page, limit });
}
