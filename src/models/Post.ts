import mongoose, { Schema } from 'mongoose';

const ReplyVariationSchema = new Schema({
  text: { type: String, required: true },
  tone: { type: String, required: true },
  selected: { type: Boolean, default: false },
}, { _id: false });

const PostSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
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
  autoApproved: { type: Boolean, default: false },
  postedAt: Date,
  autoPosted: { type: Boolean, default: false },
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
  // Competitor Intelligence
  competitorMentioned: { type: String, default: '' },
  competitorSentiment: { type: String, enum: ['', 'positive', 'negative', 'neutral'], default: '' },
  competitorOpportunityScore: { type: Number, default: 0 },
  isCompetitorOpportunity: { type: Boolean, default: false },
  // A/B Testing
  aiReplies: { type: [ReplyVariationSchema], default: [] },
  selectedVariationIndex: { type: Number, default: -1 },
  postedTone: { type: String, default: '' },
}, { timestamps: true });

// Compound unique index: same URL can exist for different workspaces
PostSchema.index({ workspaceId: 1, url: 1 }, { unique: true, sparse: true });
PostSchema.index({ userId: 1, url: 1 }, { unique: true });
PostSchema.index({ status: 1 });
PostSchema.index({ aiRelevanceScore: -1 });
PostSchema.index({ scrapedAt: -1 });
PostSchema.index({ platform: 1, postedByAccount: 1, postedAt: -1 });
PostSchema.index({ workspaceId: 1, competitorMentioned: 1, competitorSentiment: 1 });
PostSchema.index({ workspaceId: 1, isCompetitorOpportunity: 1, scrapedAt: -1 });

export default mongoose.models.Post || mongoose.model('Post', PostSchema);
