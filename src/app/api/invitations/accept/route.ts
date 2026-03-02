import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUserId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
  }

  const invitation = await db.invitation.findFirst({ where: { token, status: 'pending' } });
  if (!invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  if (new Date() > invitation.expiresAt) {
    await db.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  // Verify email matches
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== invitation.email) {
    return NextResponse.json({ error: 'Invitation was sent to a different email' }, { status: 403 });
  }

  // Check if workspace exists
  const workspace = await db.workspace.findUnique({ where: { id: invitation.workspaceId } });
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace no longer exists' }, { status: 404 });
  }

  // Check if already a member
  const existingMember = await db.workspaceMember.findFirst({
    where: { workspaceId: invitation.workspaceId, userId },
  });
  if (existingMember) {
    await db.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } });
    return NextResponse.json({ success: true, workspaceId: workspace.id, message: 'Already a member' });
  }

  // Add to workspace
  await db.$transaction([
    db.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        joinedAt: new Date(),
      },
    }),
    db.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } }),
    db.activityLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        action: 'member.joined',
        targetType: 'user',
        targetId: userId,
        meta: { role: invitation.role },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: invitation.role,
  });
}
