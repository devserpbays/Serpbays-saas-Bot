import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  activeWorkspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
