import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { getApiUserId } from '@/lib/apiAuth';
import type { SocialAccount } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const settings = await Settings.findOne({ userId }).lean() as { socialAccounts?: SocialAccount[] } | null;
  return NextResponse.json({ accounts: settings?.socialAccounts ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const account: SocialAccount = await req.json();

  if (!account.id || !account.platform) {
    return NextResponse.json({ error: 'id and platform are required' }, { status: 400 });
  }

  const settings = await Settings.findOne({ userId });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found — save settings first' }, { status: 404 });
  }

  settings.socialAccounts = (settings.socialAccounts || []).filter(
    (a: SocialAccount) => a.id !== account.id
  );
  settings.socialAccounts.push(account);
  await settings.save();

  return NextResponse.json({ success: true, accounts: settings.socialAccounts });
}

export async function DELETE(req: NextRequest) {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const settings = await Settings.findOne({ userId });
  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  settings.socialAccounts = (settings.socialAccounts || []).filter(
    (a: SocialAccount) => a.id !== id
  );
  await settings.save();

  return NextResponse.json({ success: true, accounts: settings.socialAccounts });
}
