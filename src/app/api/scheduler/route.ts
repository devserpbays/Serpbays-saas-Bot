import { NextResponse } from 'next/server';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import { startScheduler, stopScheduler, getStatus } from '@/lib/scheduler';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = getStatus(ctx.workspaceId);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { action } = await req.json();

  if (action === 'start') {
    try {
      const status = await startScheduler(ctx.workspaceId);
      return NextResponse.json(status);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  if (action === 'stop') {
    stopScheduler(ctx.workspaceId);
    const status = getStatus(ctx.workspaceId);
    return NextResponse.json(status);
  }

  return NextResponse.json({ error: 'Invalid action. Use "start" or "stop".' }, { status: 400 });
}
