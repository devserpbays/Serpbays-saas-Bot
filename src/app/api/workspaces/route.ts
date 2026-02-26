import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Workspace from '@/models/Workspace';
import Settings from '@/models/Settings';
import ActivityLog from '@/models/ActivityLog';
import { getApiUserId } from '@/lib/apiAuth';

export async function GET() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const workspaces = await Workspace.find({ 'members.userId': userId })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const workspace = await Workspace.create({
    name,
    slug: `${slug}-${Date.now().toString(36)}`,
    ownerId: userId,
    members: [{
      userId,
      role: 'owner',
      joinedAt: new Date(),
    }],
  });

  // Create default settings for the workspace
  await Settings.create({
    userId,
    workspaceId: workspace._id,
    companyName: name,
    companyDescription: '',
    keywords: [],
    platforms: ['twitter', 'reddit'],
    subreddits: [],
    promptTemplate: '',
  });

  // Log activity
  await ActivityLog.create({
    workspaceId: workspace._id,
    userId,
    action: 'workspace.created',
    targetType: 'workspace',
    targetId: workspace._id.toString(),
    meta: { name },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
