import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getApiUserId } from '@/lib/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (!['owner', 'editor'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }

  if (!['editor', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be editor or reviewer' }, { status: 400 });
  }

  // Check for existing pending invitation
  const existingInvite = await db.invitation.findFirst({
    where: { workspaceId: id, email: email.toLowerCase(), status: 'pending' },
  });
  if (existingInvite) {
    return NextResponse.json({ error: 'Invitation already pending for this email' }, { status: 409 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await db.invitation.create({
    data: {
      workspaceId: id,
      email: email.toLowerCase(),
      role,
      invitedBy: userId,
      token,
      status: 'pending',
      expiresAt,
    },
  });

  await db.activityLog.create({
    data: {
      workspaceId: id,
      userId,
      action: 'member.invited',
      targetType: 'invitation',
      targetId: invitation.id,
      meta: { email, role },
    },
  });

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email,
      role,
      token,
      expiresAt,
    },
  }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const invitations = await db.invitation.findMany({
    where: { workspaceId: id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invitations });
}
