import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { resolvePostForReply, finalizePostedReply } from '@/lib/postReply';
import { postFacebookReply } from '@/lib/platforms/facebook';

export async function POST(req: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!requireRole(ctx, 'owner', 'editor')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

    const resolved = await resolvePostForReply(ctx, id, 'facebook');
    if (typeof resolved === 'string') {
      return NextResponse.json({ error: resolved }, { status: 400 });
    }

    const result = await postFacebookReply({
      postUrl: resolved.postUrl,
      replyText: resolved.replyText,
      cookieMap: resolved.cookieMap,
      cookieList: resolved.cookieList,
      profileDir: resolved.profileDir,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await finalizePostedReply(ctx, resolved.postId, result, resolved.accountId, resolved.postedTone);

    return NextResponse.json({ success: true, replyUrl: result.replyUrl });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
