import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/apiAuth';
import { runEvaluation } from '@/lib/ai';

export async function POST() {
  const userId = await getApiUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await runEvaluation(userId);
  return NextResponse.json(result);
}
