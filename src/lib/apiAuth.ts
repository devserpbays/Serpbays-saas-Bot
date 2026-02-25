import { auth } from '@/lib/auth';

/**
 * Extracts the userId from the current session.
 * Returns null if not authenticated.
 */
export async function getApiUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
