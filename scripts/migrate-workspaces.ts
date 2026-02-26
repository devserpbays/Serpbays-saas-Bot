/**
 * Migration script: Create default workspaces for existing users.
 *
 * Usage: npx tsx scripts/migrate-workspaces.ts
 *
 * This script:
 * 1. For each User → creates a default Workspace
 * 2. Updates all Settings docs with workspaceId
 * 3. Updates all Post docs with workspaceId
 * 4. Sets User.activeWorkspaceId
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/serpbays-saas';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const db = mongoose.connection.db!;
  const usersCol = db.collection('users');
  const workspacesCol = db.collection('workspaces');
  const settingsCol = db.collection('settings');
  const postsCol = db.collection('posts');

  const users = await usersCol.find({}).toArray();
  console.log(`Found ${users.length} users to migrate.`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const userId = user._id;

    // Check if user already has an active workspace
    if (user.activeWorkspaceId) {
      console.log(`  Skipping user ${user.email} — already has activeWorkspaceId`);
      skipped++;
      continue;
    }

    // Check if workspace already exists for this user
    const existingWorkspace = await workspacesCol.findOne({ ownerId: userId });
    if (existingWorkspace) {
      console.log(`  Skipping user ${user.email} — workspace already exists`);

      // Still set activeWorkspaceId if not set
      await usersCol.updateOne(
        { _id: userId },
        { $set: { activeWorkspaceId: existingWorkspace._id } }
      );

      // Update settings and posts that don't have workspaceId
      await settingsCol.updateMany(
        { userId, workspaceId: { $exists: false } },
        { $set: { workspaceId: existingWorkspace._id } }
      );
      await postsCol.updateMany(
        { userId, workspaceId: { $exists: false } },
        { $set: { workspaceId: existingWorkspace._id } }
      );

      skipped++;
      continue;
    }

    console.log(`  Migrating user ${user.email}...`);

    const name = user.name || 'My Workspace';
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;

    // Create workspace
    const result = await workspacesCol.insertOne({
      name: `${name}'s Workspace`,
      slug,
      ownerId: userId,
      members: [{
        userId,
        role: 'owner',
        joinedAt: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const workspaceId = result.insertedId;

    // Update all settings for this user
    const settingsResult = await settingsCol.updateMany(
      { userId },
      { $set: { workspaceId } }
    );

    // Update all posts for this user
    const postsResult = await postsCol.updateMany(
      { userId },
      { $set: { workspaceId } }
    );

    // Set active workspace
    await usersCol.updateOne(
      { _id: userId },
      { $set: { activeWorkspaceId: workspaceId } }
    );

    console.log(`    Created workspace "${name}'s Workspace" (${workspaceId})`);
    console.log(`    Updated ${settingsResult.modifiedCount} settings, ${postsResult.modifiedCount} posts`);

    migrated++;
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped.`);

  // Try to drop old userId_url unique index if it exists (optional)
  try {
    const indexes = await postsCol.indexes();
    const oldIndex = indexes.find(idx => {
      const key = idx.key as Record<string, number>;
      return key.userId && key.url && !key.workspaceId;
    });
    if (oldIndex && oldIndex.name) {
      console.log(`Dropping old index: ${oldIndex.name}`);
      await postsCol.dropIndex(oldIndex.name);
    }
  } catch (err) {
    console.log('Note: Could not drop old index (may not exist):', (err as Error).message);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
