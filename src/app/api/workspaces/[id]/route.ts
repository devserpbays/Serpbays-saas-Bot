import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Workspace from '@/models/Workspace';
import Settings from '@/models/Settings';
import Post from '@/models/Post';
import ActivityLog from '@/models/ActivityLog';
import { getApiUserId } from '@/lib/apiAuth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const workspace = await Workspace.findOne({
    _id: id,
    'members.userId': userId,
  }).lean();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const workspace = await Workspace.findOne({
    _id: id,
    'members.userId': userId,
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const member = workspace.members.find(
    (m: { userId: { toString(): string }; role: string }) => m.userId.toString() === userId
  );
  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update workspace' }, { status: 403 });
  }

  const { name } = await req.json();
  if (name) workspace.name = name;

  await workspace.save();

  await ActivityLog.create({
    workspaceId: id,
    userId,
    action: 'workspace.updated',
    targetType: 'workspace',
    targetId: id,
    meta: { name },
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
  await connectDB();

  const workspace = await Workspace.findOne({ _id: id });
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (workspace.ownerId.toString() !== userId) {
    return NextResponse.json({ error: 'Only the owner can delete a workspace' }, { status: 403 });
  }

  // Delete associated data
  await Promise.all([
    Settings.deleteMany({ workspaceId: id }),
    Post.deleteMany({ workspaceId: id }),
    ActivityLog.deleteMany({ workspaceId: id }),
    Workspace.deleteOne({ _id: id }),
  ]);

  return NextResponse.json({ success: true });
}
