import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

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

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    const userId = user.id;

    // Auto-create default workspace
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const workspace = await db.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        },
      },
    });

    // Create default settings for the workspace
    await db.settings.create({
      data: {
        userId,
        workspaceId: workspace.id,
        companyName: name,
        companyDescription: '',
        keywords: [],
        platforms: ['twitter', 'reddit'],
        subreddits: [],
        promptTemplate: '',
      },
    });

    // Set active workspace
    await db.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: workspace.id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        action: 'workspace.created',
        targetType: 'workspace',
        targetId: workspace.id,
        meta: { name: workspace.name },
      },
    });

    // Check for pending invitations for this email
    const pendingInvitations = await db.invitation.count({
      where: {
        email: email.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    return NextResponse.json(
      {
        message: 'User created',
        userId,
        workspaceId: workspace.id,
        pendingInvitations,
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
