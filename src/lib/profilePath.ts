import path from 'path';

/**
 * Returns the profile directory for a user's platform browser context.
 * Structure: profiles/{userId}/{platform}/
 */
export function getProfileDir(userId: string, platform: string, accountIndex = 0): string {
  const suffix = accountIndex > 0 ? `-${accountIndex}` : '';
  return path.join(process.cwd(), 'profiles', userId, `${platform}${suffix}`);
}
