import mongoose, { Schema } from 'mongoose';

const MemberSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'editor', 'reviewer'], required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invitedAt: { type: Date },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const WorkspaceSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: { type: [MemberSchema], default: [] },
}, { timestamps: true });

WorkspaceSchema.index({ 'members.userId': 1 });
WorkspaceSchema.index({ slug: 1 });

export default mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema);
