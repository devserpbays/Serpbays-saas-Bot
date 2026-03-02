import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUserId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { workspaceId } = await req.json();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  // Verify membership
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
    include: { workspace: true },
  });

  if (!member) {
    return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 404 });
  }

  // Update user's active workspace
  await db.user.update({
    where: { id: userId },
    data: { activeWorkspaceId: workspaceId },
  });

  return NextResponse.json({
    success: true,
    workspaceId,
    workspaceName: member.workspace.name,
  });
}
