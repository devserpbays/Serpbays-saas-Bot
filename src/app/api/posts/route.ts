import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import ActivityLog from '@/models/ActivityLog';
import { getApiContext, requireRole } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');
  const minScore = searchParams.get('minScore');
  const competitor = searchParams.get('competitor');
  const opportunities = searchParams.get('opportunities');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId };
  if (status) filter.status = status;
  if (platform) filter.platform = platform;
  if (minScore) filter.aiRelevanceScore = { $gte: parseInt(minScore) };
  if (competitor) filter.competitorMentioned = competitor;
  if (opportunities === 'true') filter.isCompetitorOpportunity = true;

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ scrapedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Post.countDocuments(filter),
  ]);

  return NextResponse.json({ posts, total, page, limit });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  await connectDB();

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
    const existingPost = await Post.findOne({ _id: id, workspaceId: ctx.workspaceId }).lean();
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

  const post = await Post.findOneAndUpdate(
    { _id: id, workspaceId: ctx.workspaceId },
    update,
    { new: true }
  ).lean();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Log activity
  if (status) {
    const actionMap: Record<string, string> = {
      approved: 'post.approved',
      rejected: 'post.rejected',
      posted: 'post.posted',
    };
    const action = actionMap[status];
    if (action) {
      await ActivityLog.create({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        action,
        targetType: 'post',
        targetId: id,
      });
    }
  }

  if (editedReply !== undefined) {
    await ActivityLog.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: 'post.edited',
      targetType: 'post',
      targetId: id,
    });
  }

  return NextResponse.json({ post });
}
