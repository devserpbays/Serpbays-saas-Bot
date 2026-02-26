import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Workspace from '@/models/Workspace';
import type { ApiContext, WorkspaceRole } from '@/lib/types';

/**
 * Extracts the userId from the current session.
 * Returns null if not authenticated.
 * @deprecated Use getApiContext() for workspace-scoped operations
 */
export async function getApiUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns the full API context: userId, workspaceId, and role.
 * Validates workspace membership. Returns null if not authenticated
 * or not a member of the active workspace.
 */
export async function getApiContext(): Promise<ApiContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const workspaceId = session.user.activeWorkspaceId;

  if (!workspaceId) return null;

  await connectDB();

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    'members.userId': userId,
  }).lean();

  if (!workspace) return null;

  const members = workspace.members as Array<{ userId: { toString(): string }; role: string }>;
  const member = members.find(
    (m) => m.userId.toString() === userId
  );

  if (!member) return null;

  return {
    userId,
    workspaceId,
    role: member.role as WorkspaceRole,
  };
}

/**
 * Checks if the context has one of the required roles.
 * Returns true if allowed, false otherwise.
 */
export function requireRole(ctx: ApiContext, ...allowedRoles: WorkspaceRole[]): boolean {
  return allowedRoles.includes(ctx.role);
}
