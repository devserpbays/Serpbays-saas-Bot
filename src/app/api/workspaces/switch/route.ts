import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import { getApiUserId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { workspaceId } = await req.json();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  await connectDB();

  // Verify membership
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    'members.userId': userId,
  }).lean();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found or not a member' }, { status: 404 });
  }

  // Update user's active workspace
  await User.updateOne(
    { _id: userId },
    { $set: { activeWorkspaceId: workspaceId } }
  );

  return NextResponse.json({
    success: true,
    workspaceId,
    workspaceName: workspace.name,
  });
}
