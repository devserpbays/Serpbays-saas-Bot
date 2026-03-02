import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUserId } from '@/lib/apiAuth';

export async function GET() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: 'desc' } },
  });

  const workspaces = memberships.map(m => m.workspace);

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const workspace = await db.workspace.create({
    data: {
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'owner',
          joinedAt: new Date(),
        },
      },
    },
  });

  // Create default settings for the workspace
  await db.settings.create({
    data: {
      userId,
      workspaceId: workspace.id,
      companyName: name,
      companyDescription: '',
      keywords: [],
      platforms: ['twitter', 'reddit'],
      subreddits: [],
      promptTemplate: '',
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      workspaceId: workspace.id,
      userId,
      action: 'workspace.created',
      targetType: 'workspace',
      targetId: workspace.id,
      meta: { name },
    },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
