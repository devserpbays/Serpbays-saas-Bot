import mongoose, { Schema } from 'mongoose';

const TonePerformanceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, required: true },
  tone: { type: String, required: true },
  totalPosts: { type: Number, default: 0 },
  totalLikes: { type: Number, default: 0 },
  totalReplies: { type: Number, default: 0 },
  avgEngagementScore: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

TonePerformanceSchema.index({ userId: 1, platform: 1, tone: 1 }, { unique: true });

export default mongoose.models.TonePerformance || mongoose.model('TonePerformance', TonePerformanceSchema);
