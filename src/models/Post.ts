import mongoose, { Schema } from 'mongoose';

const PostSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url: { type: String, required: true },
  platform: { type: String, default: 'facebook' },
  author: { type: String, default: 'Unknown' },
  content: { type: String, required: true },
  scrapedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['new', 'evaluating', 'evaluated', 'approved', 'rejected', 'posted'],
    default: 'new',
  },
  aiReply: String,
  aiRelevanceScore: Number,
  aiTone: String,
  aiReasoning: String,
  keywordsMatched: [String],
  likeCount: { type: Number, default: 0 },
  retweetCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  bookmarkCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  likedByBot: { type: Boolean, default: false },
  editedReply: String,
  replyUrl: String,
  evaluatedAt: Date,
  approvedAt: Date,
  postedAt: Date,
  postedByAccount: { type: String, default: '' },
  botReplyEngagement: {
    likes: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    lastChecked: Date,
  },
  botReplyReplies: [{
    author: String,
    content: String,
    scrapedAt: { type: Date, default: Date.now },
  }],
  followUpStatus: {
    type: String,
    enum: ['none', 'pending', 'posted', 'skipped'],
    default: 'none',
  },
  followUpText: String,
  followUpPostedAt: Date,
  monitorUntil: Date,
}, { timestamps: true });

// Compound unique index: same URL can exist for different users
PostSchema.index({ userId: 1, url: 1 }, { unique: true });
PostSchema.index({ status: 1 });
PostSchema.index({ aiRelevanceScore: -1 });
PostSchema.index({ scrapedAt: -1 });
PostSchema.index({ platform: 1, postedByAccount: 1, postedAt: -1 });

export default mongoose.models.Post || mongoose.model('Post', PostSchema);
