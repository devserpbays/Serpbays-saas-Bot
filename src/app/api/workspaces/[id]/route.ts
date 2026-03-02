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

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: id, userId },
    include: { workspace: true },
  });

  if (!member) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({ workspace: member.workspace });
}

export async function PATCH(
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

  if (member.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update workspace' }, { status: 403 });
  }

  const { name } = await req.json();

  const workspace = await db.workspace.update({
    where: { id },
    data: name ? { name } : {},
  });

  await db.activityLog.create({
    data: {
      workspaceId: id,
      userId,
      action: 'workspace.updated',
      targetType: 'workspace',
      targetId: id,
      meta: { name },
    },
  });

  return NextResponse.json({ workspace });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const workspace = await db.workspace.findUnique({ where: { id } });
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (workspace.ownerId !== userId) {
    return NextResponse.json({ error: 'Only the owner can delete a workspace' }, { status: 403 });
  }

  // Cascade deletion handled by Prisma schema (onDelete: Cascade)
  await db.workspace.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
