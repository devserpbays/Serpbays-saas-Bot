import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUserId } from '@/lib/apiAuth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const myMembership = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
  });

  if (!myMembership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: id },
    include: { user: { select: { name: true, email: true } } },
  });

  const enrichedMembers = members.map(m => ({
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    name: m.user.name,
    email: m.user.email,
  }));

  return NextResponse.json({ members: enrichedMembers });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const myMember = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
  });

  if (!myMember) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (myMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 });
  }

  const { memberId, role } = await req.json();
  if (!memberId || !role) {
    return NextResponse.json({ error: 'memberId and role are required' }, { status: 400 });
  }

  if (!['editor', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const target = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId: memberId },
  });
  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: id, userId: memberId } },
    data: { role },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const myMember = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
  });

  if (!myMember) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (myMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can remove members' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId query param required' }, { status: 400 });
  }

  if (memberId === userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: id, userId: memberId } },
  });

  await db.activityLog.create({
    data: {
      workspaceId: id,
      userId,
      action: 'member.removed',
      targetType: 'user',
      targetId: memberId,
    },
  });

  return NextResponse.json({ success: true });
}
