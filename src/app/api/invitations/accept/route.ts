import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Invitation from '@/models/Invitation';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import ActivityLog from '@/models/ActivityLog';
import { getApiUserId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
  }

  await connectDB();

  const invitation = await Invitation.findOne({ token, status: 'pending' });
  if (!invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  if (new Date() > invitation.expiresAt) {
    invitation.status = 'expired';
    await invitation.save();
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  // Verify email matches
  const user = await User.findById(userId).lean();
  if (!user || (user as { email: string }).email !== invitation.email) {
    return NextResponse.json({ error: 'Invitation was sent to a different email' }, { status: 403 });
  }

  // Add to workspace
  const workspace = await Workspace.findById(invitation.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace no longer exists' }, { status: 404 });
  }

  // Check if already a member
  const alreadyMember = workspace.members.some(
    (m: { userId: { toString(): string } }) => m.userId.toString() === userId
  );
  if (alreadyMember) {
    invitation.status = 'accepted';
    await invitation.save();
    return NextResponse.json({ success: true, workspaceId: workspace._id, message: 'Already a member' });
  }

  workspace.members.push({
    userId,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
    invitedAt: invitation.createdAt,
    joinedAt: new Date(),
  });
  await workspace.save();

  invitation.status = 'accepted';
  await invitation.save();

  await ActivityLog.create({
    workspaceId: workspace._id,
    userId,
    action: 'member.joined',
    targetType: 'user',
    targetId: userId,
    meta: { role: invitation.role },
  });

  return NextResponse.json({
    success: true,
    workspaceId: workspace._id,
    workspaceName: workspace.name,
    role: invitation.role,
  });
}
