import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import Settings from '@/models/Settings';
import Invitation from '@/models/Invitation';
import ActivityLog from '@/models/ActivityLog';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const userId = user._id;

    // Auto-create default workspace
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      slug,
      ownerId: userId,
      members: [{
        userId,
        role: 'owner',
        joinedAt: new Date(),
      }],
    });

    // Create default settings for the workspace
    await Settings.create({
      userId,
      workspaceId: workspace._id,
      companyName: name,
      companyDescription: '',
      keywords: [],
      platforms: ['twitter', 'reddit'],
      subreddits: [],
      promptTemplate: '',
    });

    // Set active workspace
    user.activeWorkspaceId = workspace._id;
    await user.save();

    // Log activity
    await ActivityLog.create({
      workspaceId: workspace._id,
      userId,
      action: 'workspace.created',
      targetType: 'workspace',
      targetId: workspace._id.toString(),
      meta: { name: workspace.name },
    });

    // Check for pending invitations for this email
    const pendingInvitations = await Invitation.find({
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).lean();

    return NextResponse.json(
      {
        message: 'User created',
        userId: userId.toString(),
        workspaceId: workspace._id.toString(),
        pendingInvitations: pendingInvitations.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
