import path from 'path';

/**
 * Returns the profile directory for a workspace's platform browser context.
 * Structure: profiles/{scopeId}/{platform}/
 * scopeId can be workspaceId or userId (for backward compat).
 */
export function getProfileDir(scopeId: string, platform: string, accountIndex = 0): string {
  const suffix = accountIndex > 0 ? `-${accountIndex}` : '';
  return path.join(process.cwd(), 'profiles', scopeId, `${platform}${suffix}`);
}
