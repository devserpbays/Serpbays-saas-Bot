import mongoose, { Schema } from 'mongoose';

const InvitationSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  email: { type: String, required: true, lowercase: true },
  role: { type: String, enum: ['owner', 'editor', 'reviewer'], required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending' },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

InvitationSchema.index({ email: 1, status: 1 });
InvitationSchema.index({ token: 1 });

export default mongoose.models.Invitation || mongoose.model('Invitation', InvitationSchema);
