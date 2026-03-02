import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiContext, requireRole } from '@/lib/apiAuth';
import type { SocialAccount } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  return NextResponse.json({ accounts: (settings?.socialAccounts as unknown as SocialAccount[]) ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const account: SocialAccount = await req.json();

  if (!account.id || !account.platform) {
    return NextResponse.json({ error: 'id and platform are required' }, { status: 400 });
  }

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found — save settings first' }, { status: 404 });
  }

  const currentAccounts = (settings.socialAccounts as unknown as SocialAccount[]) || [];
  const updatedAccounts = currentAccounts.filter((a) => a.id !== account.id);
  updatedAccounts.push(account);

  await db.settings.update({
    where: { workspaceId: ctx.workspaceId },
    data: { socialAccounts: updatedAccounts as unknown as import('@prisma/client').Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true, accounts: updatedAccounts });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!requireRole(ctx, 'owner', 'editor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const settings = await db.settings.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const currentAccounts = (settings.socialAccounts as unknown as SocialAccount[]) || [];
  const updatedAccounts = currentAccounts.filter((a) => a.id !== id);

  await db.settings.update({
    where: { workspaceId: ctx.workspaceId },
    data: { socialAccounts: updatedAccounts as unknown as import('@prisma/client').Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true, accounts: updatedAccounts });
}
