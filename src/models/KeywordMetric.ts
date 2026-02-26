import mongoose, { Schema } from 'mongoose';

const KeywordMetricSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  keyword: { type: String, required: true },
  date: { type: Date, required: true },
  postsFound: { type: Number, default: 0 },
  highRelevanceCount: { type: Number, default: 0 },
  avgRelevanceScore: { type: Number, default: 0 },
  platforms: { type: Map, of: Number, default: {} },
}, { timestamps: true });

KeywordMetricSchema.index({ userId: 1, keyword: 1, date: 1 }, { unique: true });

export default mongoose.models.KeywordMetric || mongoose.model('KeywordMetric', KeywordMetricSchema);
