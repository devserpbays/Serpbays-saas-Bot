-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyDescription" TEXT NOT NULL DEFAULT '',
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "subreddits" JSONB NOT NULL DEFAULT '[]',
    "promptTemplate" TEXT NOT NULL DEFAULT '',
    "socialAccounts" JSONB NOT NULL DEFAULT '[]',
    "facebookGroups" JSONB NOT NULL DEFAULT '[]',
    "facebookKeywords" JSONB NOT NULL DEFAULT '[]',
    "facebookDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "facebookAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "twitterKeywords" JSONB NOT NULL DEFAULT '[]',
    "twitterDailyLimit" INTEGER NOT NULL DEFAULT 10,
    "twitterAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "redditKeywords" JSONB NOT NULL DEFAULT '[]',
    "redditDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "redditAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "quoraKeywords" JSONB NOT NULL DEFAULT '[]',
    "quoraDailyLimit" INTEGER NOT NULL DEFAULT 3,
    "quoraAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "youtubeKeywords" JSONB NOT NULL DEFAULT '[]',
    "youtubeDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "youtubeAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "pinterestKeywords" JSONB NOT NULL DEFAULT '[]',
    "pinterestDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "pinterestAutoPostThreshold" INTEGER NOT NULL DEFAULT 70,
    "platformSchedules" JSONB NOT NULL DEFAULT '{}',
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "competitorAlertThreshold" INTEGER NOT NULL DEFAULT 60,
    "suggestedKeywords" JSONB NOT NULL DEFAULT '[]',
    "keywordSuggestionsLastRun" TIMESTAMP(3),
    "abTestingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "abVariationCount" INTEGER NOT NULL DEFAULT 3,
    "abTonePresets" JSONB NOT NULL DEFAULT '["helpful","professional","witty"]',
    "abAutoOptimize" BOOLEAN NOT NULL DEFAULT false,
    "autoPostingPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "author" TEXT NOT NULL DEFAULT 'Unknown',
    "content" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "aiReply" TEXT,
    "aiRelevanceScore" DOUBLE PRECISION,
    "aiTone" TEXT,
    "aiReasoning" TEXT,
    "keywordsMatched" JSONB NOT NULL DEFAULT '[]',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "retweetCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likedByBot" BOOLEAN NOT NULL DEFAULT false,
    "editedReply" TEXT,
    "replyUrl" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedAt" TIMESTAMP(3),
    "autoRejected" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "autoPosted" BOOLEAN NOT NULL DEFAULT false,
    "postedByAccount" TEXT NOT NULL DEFAULT '',
    "botReplyEngagement" JSONB NOT NULL DEFAULT '{"likes":0,"replies":0,"lastChecked":null}',
    "botReplyReplies" JSONB NOT NULL DEFAULT '[]',
    "followUpStatus" TEXT NOT NULL DEFAULT 'none',
    "followUpText" TEXT,
    "followUpPostedAt" TIMESTAMP(3),
    "monitorUntil" TIMESTAMP(3),
    "competitorMentioned" TEXT NOT NULL DEFAULT '',
    "competitorSentiment" TEXT NOT NULL DEFAULT '',
    "competitorOpportunityScore" INTEGER NOT NULL DEFAULT 0,
    "isCompetitorOpportunity" BOOLEAN NOT NULL DEFAULT false,
    "aiReplies" JSONB NOT NULL DEFAULT '[]',
    "selectedVariationIndex" INTEGER NOT NULL DEFAULT -1,
    "postedTone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "postsFound" INTEGER NOT NULL DEFAULT 0,
    "highRelevanceCount" INTEGER NOT NULL DEFAULT 0,
    "avgRelevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platforms" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TonePerformance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TonePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_workspaceId_key" ON "Settings"("workspaceId");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Post_scrapedAt_idx" ON "Post"("scrapedAt" DESC);

-- CreateIndex
CREATE INDEX "Post_platform_postedByAccount_postedAt_idx" ON "Post"("platform", "postedByAccount", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Post_workspaceId_competitorMentioned_competitorSentiment_idx" ON "Post"("workspaceId", "competitorMentioned", "competitorSentiment");

-- CreateIndex
CREATE INDEX "Post_workspaceId_isCompetitorOpportunity_scrapedAt_idx" ON "Post"("workspaceId", "isCompetitorOpportunity", "scrapedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Post_workspaceId_url_key" ON "Post"("workspaceId", "url");

-- CreateIndex
CREATE INDEX "ActivityLog_workspaceId_createdAt_idx" ON "ActivityLog"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeywordMetric_userId_keyword_date_key" ON "KeywordMetric"("userId", "keyword", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TonePerformance_userId_platform_tone_key" ON "TonePerformance"("userId", "platform", "tone");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordMetric" ADD CONSTRAINT "KeywordMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TonePerformance" ADD CONSTRAINT "TonePerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
