import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
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

  // Enrich members with user info
  const memberUserIds = (workspace.members as Array<{ userId: { toString(): string } }>).map(m => m.userId.toString());
  const users = await User.find({ _id: { $in: memberUserIds } }).select('name email').lean();
  const userMap = new Map(users.map(u => [(u._id as { toString(): string }).toString(), u]));

  const members = (workspace.members as Array<{ userId: { toString(): string }; role: string; joinedAt?: Date }>).map(m => {
    const user = userMap.get(m.userId.toString());
    return {
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
      name: (user as { name?: string })?.name || '',
      email: (user as { email?: string })?.email || '',
    };
  });

  return NextResponse.json({ members });
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

  const currentMember = workspace.members.find(
    (m: { userId: { toString(): string } }) => m.userId.toString() === userId
  );
  if (!currentMember || currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 });
  }

  const { memberId, role } = await req.json();
  if (!memberId || !role) {
    return NextResponse.json({ error: 'memberId and role are required' }, { status: 400 });
  }

  if (!['editor', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const target = workspace.members.find(
    (m: { userId: { toString(): string } }) => m.userId.toString() === memberId
  );
  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  target.role = role;
  await workspace.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
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

  const currentMember = workspace.members.find(
    (m: { userId: { toString(): string } }) => m.userId.toString() === userId
  );
  if (!currentMember || currentMember.role !== 'owner') {
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

  workspace.members = workspace.members.filter(
    (m: { userId: { toString(): string } }) => m.userId.toString() !== memberId
  );
  await workspace.save();

  await ActivityLog.create({
    workspaceId: id,
    userId,
    action: 'member.removed',
    targetType: 'user',
    targetId: memberId,
  });

  return NextResponse.json({ success: true });
}
