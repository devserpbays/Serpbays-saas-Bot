import mongoose, { Schema } from 'mongoose';

const SocialAccountSchema = new Schema({
  id: { type: String, required: true },
  platform: { type: String, required: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  profileDir: { type: String, default: '' },
  accountIndex: { type: Number, default: 0 },
  addedAt: { type: String, default: () => new Date().toISOString() },
  active: { type: Boolean, default: true },
}, { _id: false });

const CompetitorSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, default: '' },
  description: { type: String, default: '' },
}, { _id: false });

const SettingsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  companyName: { type: String, required: true },
  companyDescription: { type: String, default: '' },
  keywords: [{ type: String }],
  platforms: [{ type: String, enum: ['twitter', 'reddit', 'facebook', 'quora', 'youtube', 'pinterest'], default: ['twitter', 'reddit'] }],
  subreddits: [{ type: String }],
  promptTemplate: { type: String, default: '' },
  socialAccounts: { type: [SocialAccountSchema], default: [] },
  facebookGroups: [{ type: String }],
  facebookKeywords: [{ type: String }],
  facebookDailyLimit: { type: Number, default: 5 },
  facebookAutoPostThreshold: { type: Number, default: 70 },
  twitterKeywords: [{ type: String }],
  twitterDailyLimit: { type: Number, default: 10 },
  twitterAutoPostThreshold: { type: Number, default: 70 },
  redditKeywords: [{ type: String }],
  redditDailyLimit: { type: Number, default: 5 },
  redditAutoPostThreshold: { type: Number, default: 70 },
  quoraKeywords: [{ type: String }],
  quoraDailyLimit: { type: Number, default: 3 },
  quoraAutoPostThreshold: { type: Number, default: 70 },
  youtubeKeywords: [{ type: String }],
  youtubeDailyLimit: { type: Number, default: 5 },
  youtubeAutoPostThreshold: { type: Number, default: 70 },
  pinterestKeywords: [{ type: String }],
  pinterestDailyLimit: { type: Number, default: 5 },
  pinterestAutoPostThreshold: { type: Number, default: 70 },
  platformSchedules: {
    type: Map,
    of: new Schema({
      timezone: { type: String, default: 'Asia/Kolkata' },
      days: [{ type: Number }],
      startHour: { type: Number, default: 9 },
      endHour: { type: Number, default: 18 },
      cronInterval: { type: String, default: '*/15 * * * *' },
    }, { _id: false }),
    default: {},
  },
  // Competitor Intelligence
  competitors: { type: [CompetitorSchema], default: [] },
  competitorAlertThreshold: { type: Number, default: 60 },
  // Keyword Discovery
  suggestedKeywords: [{ type: String }],
  keywordSuggestionsLastRun: { type: Date },
  // A/B Testing
  abTestingEnabled: { type: Boolean, default: true },
  abVariationCount: { type: Number, default: 3, min: 2, max: 5 },
  abTonePresets: { type: [String], default: ['helpful', 'professional', 'witty'] },
  abAutoOptimize: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
