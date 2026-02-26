export type PostStatus = 'new' | 'evaluating' | 'evaluated' | 'approved' | 'rejected' | 'posted';

export type WorkspaceRole = 'owner' | 'editor' | 'reviewer';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type ActivityAction =
  | 'post.approved' | 'post.rejected' | 'post.edited' | 'post.posted'
  | 'settings.updated'
  | 'member.invited' | 'member.joined' | 'member.removed'
  | 'workspace.created' | 'workspace.updated';

export type CompetitorSentiment = '' | 'positive' | 'negative' | 'neutral';

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
}

export interface IWorkspace {
  _id?: string;
  name: string;
  slug: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IInvitation {
  _id?: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt?: Date;
}

export interface IActivityLog {
  _id?: string;
  workspaceId: string;
  userId: string;
  action: ActivityAction;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  createdAt?: Date;
}

export interface Competitor {
  name: string;
  url?: string;
  description?: string;
}

export interface ReplyVariation {
  text: string;
  tone: string;
  selected: boolean;
}

export interface IPost {
  _id?: string;
  userId: string;
  workspaceId?: string;
  url: string;
  platform: string;
  author: string;
  content: string;
  scrapedAt: Date;
  status: PostStatus;
  aiReply?: string;
  aiRelevanceScore?: number;
  aiTone?: string;
  aiReasoning?: string;
  keywordsMatched?: string[];
  editedReply?: string;
  replyUrl?: string;
  evaluatedAt?: Date;
  approvedAt?: Date;
  postedAt?: Date;
  competitorMentioned?: string;
  competitorSentiment?: CompetitorSentiment;
  competitorOpportunityScore?: number;
  isCompetitorOpportunity?: boolean;
  aiReplies?: ReplyVariation[];
  selectedVariationIndex?: number;
  postedTone?: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileDir: string;
  accountIndex: number;
  addedAt: string;
  active?: boolean;
}

export interface ISettings {
  _id?: string;
  userId: string;
  workspaceId?: string;
  companyName: string;
  companyDescription: string;
  keywords: string[];
  platforms: string[];
  subreddits: string[];
  promptTemplate: string;
  socialAccounts?: SocialAccount[];
  facebookGroups?: string[];
  facebookKeywords?: string[];
  facebookDailyLimit?: number;
  facebookAutoPostThreshold?: number;
  twitterKeywords?: string[];
  twitterDailyLimit?: number;
  twitterAutoPostThreshold?: number;
  redditKeywords?: string[];
  redditDailyLimit?: number;
  redditAutoPostThreshold?: number;
  quoraKeywords?: string[];
  quoraDailyLimit?: number;
  quoraAutoPostThreshold?: number;
  youtubeKeywords?: string[];
  youtubeDailyLimit?: number;
  youtubeAutoPostThreshold?: number;
  pinterestKeywords?: string[];
  pinterestDailyLimit?: number;
  pinterestAutoPostThreshold?: number;
  competitors?: Competitor[];
  competitorAlertThreshold?: number;
  suggestedKeywords?: string[];
  keywordSuggestionsLastRun?: Date;
  abTestingEnabled?: boolean;
  abVariationCount?: number;
  abTonePresets?: string[];
  abAutoOptimize?: boolean;
}

export interface KeywordSuggestion {
  keyword: string;
  reason: string;
  confidence: number;
}

export interface IKeywordMetric {
  _id?: string;
  userId: string;
  keyword: string;
  date: Date;
  postsFound: number;
  highRelevanceCount: number;
  avgRelevanceScore: number;
  platforms: Record<string, number>;
}

export interface ITonePerformance {
  _id?: string;
  userId: string;
  platform: string;
  tone: string;
  totalPosts: number;
  totalLikes: number;
  totalReplies: number;
  avgEngagementScore: number;
  lastUpdated: Date;
}

export interface AIEvaluation {
  relevant: boolean;
  score: number;
  suggestedReply: string;
  tone: string;
  reasoning: string;
  competitorMentioned?: string;
  competitorSentiment?: CompetitorSentiment;
  competitorOpportunityScore?: number;
  variations?: ReplyVariation[];
}

export interface ScrapedPost {
  url: string;
  platform: string;
  author: string;
  content: string;
  scrapedAt: Date;
  likeCount?: number;
  replyCount?: number;
  viewCount?: number;
}

export interface ScrapeResult {
  totalScraped: number;
  newPosts: number;
  errors: string[];
}

export interface EvaluateResult {
  evaluated: number;
  total: number;
}

export interface PipelineResult {
  scraped: number;
  newPosts: number;
  evaluated: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

export interface ApiContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}
