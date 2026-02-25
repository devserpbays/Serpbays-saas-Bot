import path from 'path';

/**
 * Returns the profile directory for a user's platform browser context.
 * Structure: profiles/{userId}/{platform}/
 */
export function getProfileDir(userId: string, platform: string, _accountIndex = 0): string {
  return path.join(process.cwd(), 'profiles', userId, platform);
}
