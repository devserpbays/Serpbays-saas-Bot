import mongoose, { Schema } from 'mongoose';

const ActivityLogSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: [
      'post.approved', 'post.auto_approved', 'post.rejected', 'post.edited', 'post.posted',
      'settings.updated',
      'member.invited', 'member.joined', 'member.removed',
      'workspace.created', 'workspace.updated',
    ],
    required: true,
  },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
