import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');
  const minScore = searchParams.get('minScore');
  const competitor = searchParams.get('competitor');
  const opportunities = searchParams.get('opportunities');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const where: Prisma.PostWhereInput = { workspaceId: ctx.workspaceId };
  if (status) {
    where.status = status;
  } else {
    where.status = { not: 'rejected' };
  }
  if (platform) where.platform = platform;
  if (minScore) where.aiRelevanceScore = { gte: parseInt(minScore) };
  if (competitor) where.competitorMentioned = competitor;
  if (opportunities === 'true') where.isCompetitorOpportunity = true;

  const [posts, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { scrapedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.post.count({ where }),
  ]);

  return NextResponse.json({ posts, total, page, limit });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const { id, status, editedReply, selectedVariationIndex } = body;

  if (!id) {
    return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status) {
    update.status = status;
    if (status === 'approved') update.approvedAt = new Date();
    if (status === 'posted') update.postedAt = new Date();
  }
  if (editedReply !== undefined) update.editedReply = editedReply;

  // A/B Testing: handle variation selection
  if (selectedVariationIndex !== undefined && selectedVariationIndex >= 0) {
    update.selectedVariationIndex = selectedVariationIndex;
    // Load the post to get the selected variation's tone
    const existingPost = await db.post.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (existingPost) {
      const replies = existingPost.aiReplies as Array<{ text: string; tone: string }> | undefined;
      if (replies && replies[selectedVariationIndex]) {
        update.postedTone = replies[selectedVariationIndex].tone;
        // Set selected flag on the chosen variation
        update.aiReplies = replies.map((r, i) => ({
          ...r,
          selected: i === selectedVariationIndex,
        }));
      }
    }
  }

  const post = await db.post.updateMany({
    where: { id, workspaceId: ctx.workspaceId },
    data: update,
  });

  if (post.count === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const updatedPost = await db.post.findUnique({ where: { id } });

  // Log activity
  if (status) {
    const actionMap: Record<string, string> = {
      approved: 'post.approved',
      rejected: 'post.rejected',
      posted: 'post.posted',
    };
    const action = actionMap[status];
    if (action) {
      await db.activityLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          action,
          targetType: 'post',
          targetId: id,
        },
      });
    }
  }

  if (editedReply !== undefined) {
    await db.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        action: 'post.edited',
        targetType: 'post',
        targetId: id,
      },
    });
  }

  return NextResponse.json({ post: updatedPost });
}
