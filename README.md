# Serpbays SaaS

A social media engagement automation platform that monitors social platforms for relevant conversations, uses AI to evaluate and generate replies, and posts them — turning social listening into actionable engagement at scale.

## How It Works

Serpbays follows a 6-stage pipeline for every discovered post:

```
Scrape -> Evaluate -> Review -> Approve/Reject -> Post -> Track
```

1. **Scrape** — Crawl social platforms for posts matching your target keywords
2. **Evaluate** — AI scores each post for relevance (0–100), analyzes tone, and generates a suggested reply
3. **Review** — Review AI suggestions in the dashboard, edit replies as needed
4. **Approve / Reject** — Approve or reject each post
5. **Post** — Reply is posted to the platform via connected bot accounts
6. **Track** — Monitor engagement (likes, replies, follow-ups) on posted replies

## Supported Platforms

- Twitter / X
- Facebook
- Reddit
- Quora
- YouTube
- Pinterest

## Features

### Authentication & Multi-Tenancy
- Email/password registration and sign-in
- JWT-based stateless sessions (NextAuth v5)
- Edge-safe middleware for route protection
- Workspace-scoped data isolation — every post, setting, and account is scoped to a workspace
- Role-based access control: `owner`, `editor`, `reviewer` per workspace
- Compound unique index on `(workspaceId, url)` so multiple workspaces can independently track the same content
- Auto-creates default workspace + settings on user registration

### Dashboard
- Workspace switcher dropdown with inline workspace creation
- Real-time stats bar showing counts for each pipeline stage (New, Evaluating, Evaluated, Approved, Rejected, Posted)
- Per-platform breakdown with post counts and posted badges
- Connected social account avatars displayed per platform
- Competitor opportunities alert card with count badge
- Keyword performance table with trend arrows
- A/B tone performance horizontal bars
- Activity feed toggle showing team actions
- Auto-polling every 10 seconds for live data updates
- Status filter tabs (All / New / Evaluated / Approved / Rejected / Posted) + Opportunities filter
- Platform filter buttons
- Paginated post list (20 per page)
- One-click pipeline controls:
  - **Start Job** — runs the full scrape + evaluate pipeline
  - **Scrape Only** — triggers scraping alone
  - **Evaluate Only** — triggers AI evaluation alone
- Pipeline result summary: scraped / new / evaluated / skipped counts with error details

### Post Cards
- Author, platform, scrape date, and link to original post
- Color-coded AI relevance score (green >= 70, yellow >= 40, red < 40)
- AI tone analysis and reasoning
- Matched keywords displayed as tags
- Competitor mention badges with sentiment color-coding (positive/negative/neutral)
- Competitor opportunity pill for high-score opportunities
- A/B variation selector with selectable tone cards
- AI-suggested reply with inline editing before approval
- Per-status action buttons:
  - `evaluated` / `new`: Approve, Edit Reply, Reject
  - `approved`: Platform-specific "Post to X/Facebook/Reddit/..." buttons, Copy Reply, Mark as Posted
- Role-aware rendering (reviewers see read-only views)
- Posted reply display with engagement tracking

### Settings Panel
- **Company Profile** — name and description used as AI prompt context
- **Platform Selection** — enable/disable each of the 6 platforms
- **Social Account Management** — connect accounts by pasting browser cookies (verified against each platform's API), view connected accounts with avatars, remove accounts individually
- **Global Keywords** — keywords to monitor across all platforms
- **Subreddits** — Reddit-specific subreddit list (shown when Reddit is enabled)
- **Custom Prompt Template** — define your own AI prompt with variables: `{postContent}`, `{companyName}`, `{companyDescription}`
- **Per-Platform Advanced Config** — daily posting limits, auto-post score thresholds, platform-specific keywords
- **Platform Scheduling** — per-platform cron schedules with timezone, active days, and posting time windows
- **Team Management** — member list with role display, invite form (email + role), role-based input restrictions
- **Competitors** — chip-based competitor input with name/URL/description
- **Keyword Discovery** — one-click AI keyword suggestions, add/skip chips for suggested keywords
- **A/B Testing** — enable toggle, variation count slider (2–5), tone presets as tags, auto-optimize checkbox

### Cookie Verification & Account Connection (Phase 1)
- Multi-format cookie parsing: JSON array (Cookie Editor extension), `key=value` string, flat object
- Per-platform cookie validation (e.g. `auth_token` + `ct0` for Twitter, `c_user` + `xs` for Facebook)
- Headless Playwright verification — launches browser, injects cookies, navigates to platform, confirms login state
- Extracts username and display name from DOM or cookies
- Persistent browser profiles with `.verified` marker files storing cookie state
- Anti-bot browser args (`--no-sandbox`, `--disable-blink-features=AutomationControlled`)
- Multi-account support via `accountIndex` parameter

### Scraping Pipeline (Phase 2)
- Per-platform scrapers using native `fetch` or Playwright DOM scraping
- Twitter: adaptive search API with bearer token + CSRF headers
- Reddit: public JSON API (no cookies required), supports subreddit-specific search
- Facebook: Playwright DOM scraping of group posts
- Quora: Playwright DOM scraping of search results
- YouTube: Data API v3 (with API key) or innertube API fallback
- Pinterest: resource API with CSRF token
- Parallel scraping across all enabled platforms via `Promise.all`
- Bulk upsert with `$setOnInsert` for deduplication (existing posts untouched)
- Per-platform keyword resolution (platform-specific keywords → global fallback)
- Cookie state loaded from `.verified` files for authenticated scrapers

### AI Evaluation (Phase 2)
- Powered by OpenClaw AI gateway (HTTP API primary, CLI fallback)
- Customizable prompt templates with variable substitution
- JSON-structured responses: relevance score, suggested reply, tone, reasoning
- Robust response parsing (direct JSON, markdown code blocks, embedded JSON)
- Batch evaluation with `evaluating` status indicator for UI progress
- Failed evaluations revert to `new` for automatic retry
- Multi-variation generation for A/B testing (configurable 2–5 variations per post)
- Competitor mention detection with sentiment analysis and opportunity scoring
- Tone hints from historical performance for auto-optimize mode

### Multi-Brand Workspaces
- Create and manage multiple workspaces (brands)
- Switch between workspaces via dashboard dropdown
- All data (posts, settings, accounts) scoped per workspace
- Default workspace auto-created on registration
- Slug-based workspace identification

### Team Collaboration
- Invite team members via email with role assignment (owner / editor / reviewer)
- Token-based invitation acceptance flow
- Role-based access control on all API routes
- Activity feed logging all team actions (approvals, rejections, edits, posts, settings changes)
- Pending invitation auto-detection on new user registration

### Competitor Intelligence
- Track competitors by name, URL, and description
- AI detects competitor mentions during post evaluation
- Sentiment analysis (positive / negative / neutral) per mention
- Opportunity scoring for competitor-related posts
- Competitor stats aggregation API with sentiment breakdowns
- Alert threshold configuration for high-opportunity posts

### Keyword Discovery & Trending
- AI-powered keyword suggestions based on company profile and existing keywords
- Related keyword expansion via `/api/keyword-related`
- Keyword performance metrics: posts found, high-relevance count, average score
- Per-platform keyword breakdown stored in `KeywordMetric` model
- Trend visualization with directional arrows in dashboard

### A/B Testing for Replies
- Generate multiple reply variations per post with different tones
- Selectable variation cards in PostCard UI
- Tone performance tracking across platforms (likes, replies, engagement score)
- Auto-optimize mode: AI uses historical tone performance to weight future variations
- Configurable tone presets (e.g. helpful, professional, witty)
- Per-platform tone performance stored in `TonePerformance` model

### Platform Posting (Phase 3)
- Post AI-generated replies back to all 6 platforms from the dashboard
- Shared posting infrastructure: validates post status, resolves reply text (edited > A/B variation > AI), loads cookies, updates post record and activity log
- **Twitter/X** — API-based posting via `statuses/update.json` with `in_reply_to_status_id`
- **Reddit** — Playwright DOM automation on old.reddit.com (textarea + submit)
- **Facebook** — Playwright DOM automation (contenteditable comment box + Enter to submit)
- **Quora** — Playwright DOM automation (Answer button → editor → Post button)
- **YouTube** — Playwright DOM automation (scroll to comments → placeholder → editor → submit)
- **Pinterest** — API-based posting via `PinCommentResource/create/` with CSRF token
- Posts updated to `posted` status with `replyUrl`, `postedAt`, `postedByAccount`, `postedTone`
- Activity logging for all posted replies

### Engagement Tracking
- Track likes and replies on bot-posted replies
- Store reply threads from users responding to bot comments
- Follow-up message system (pending / posted / skipped)
- Configurable monitoring duration per conversation thread

### Browser Profile System
- Persistent browser profiles per workspace per platform (`profiles/{workspaceId}/{platform}/`)
- Cookie-based authentication for headless browser automation
- Isolated browser state across workspaces and platforms
- Multi-account support: `profiles/{workspaceId}/{platform}-{index}/` for additional accounts
- Legacy userId-based path fallback for backward compatibility

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Auth | NextAuth.js v5 (credentials provider, JWT sessions) |
| Database | MongoDB (Mongoose 9) |
| Browser Automation | Playwright (Chromium) |
| AI Engine | OpenClaw Gateway (HTTP API + CLI fallback) |
| Password Hashing | bcryptjs (cost factor 12) |
| Font | Geist Sans + Geist Mono |

## Project Structure

```
src/
  app/
    layout.tsx                        # Root layout with SessionProvider
    page.tsx                          # Root redirect -> /dashboard or /sign-in
    dashboard/page.tsx                # Dashboard page
    sign-in/page.tsx                  # Login form
    sign-up/page.tsx                  # Registration form
    api/
      auth/[...nextauth]/route.ts     # NextAuth handler
      auth/register/route.ts          # User registration + workspace setup
      posts/route.ts                  # GET (list/filter) + PATCH (update) posts
      settings/route.ts               # GET + PUT workspace settings
      social-accounts/route.ts        # GET + POST + DELETE social accounts
      stats/route.ts                  # Aggregated status/platform/competitor counts
      scrape/route.ts                 # Trigger scraping job
      evaluate/route.ts               # Trigger AI evaluation
      run-pipeline/route.ts           # Full scrape + evaluate pipeline
      set-twitter-cookies/route.ts    # Verify & store Twitter cookies
      set-reddit-cookies/route.ts     # Verify & store Reddit cookies
      set-fb-cookies/route.ts         # Verify & store Facebook cookies
      set-quora-cookies/route.ts      # Verify & store Quora cookies
      set-youtube-cookies/route.ts    # Verify & store YouTube cookies
      set-pinterest-cookies/route.ts  # Verify & store Pinterest cookies
      post-reply/route.ts             # Post reply to Twitter/X
      fb-post-reply/route.ts          # Post reply to Facebook
      rd-post-reply/route.ts          # Post reply to Reddit
      qa-post-reply/route.ts          # Post reply to Quora
      yt-post-reply/route.ts          # Post reply to YouTube
      pin-post-reply/route.ts         # Post reply to Pinterest
      workspaces/route.ts             # GET + POST workspaces
      workspaces/[id]/route.ts        # PATCH + DELETE workspace
      workspaces/[id]/invite/route.ts # POST invite member
      workspaces/[id]/members/route.ts # GET + PATCH + DELETE members
      workspaces/switch/route.ts      # POST switch active workspace
      invitations/accept/route.ts     # POST accept invitation
      activity/route.ts               # GET activity feed
      competitor-stats/route.ts       # GET competitor intelligence stats
      keyword-suggestions/route.ts    # POST AI keyword suggestions
      keyword-related/route.ts        # POST related keyword expansion
      keyword-metrics/route.ts        # GET keyword performance metrics
      ab-stats/route.ts               # GET A/B tone performance stats
      update-engagement/route.ts      # POST update engagement metrics
  components/
    Dashboard.tsx                     # Main dashboard UI + workspace switcher
    SettingsPanel.tsx                 # Settings drawer + team/competitor/AB sections
    PostCard.tsx                      # Post card with A/B variations + posting
    ActivityFeed.tsx                  # Team activity feed component
    StatusBadge.tsx                   # Colored status pill
    Providers.tsx                     # NextAuth SessionProvider wrapper
  lib/
    auth.ts                           # Full NextAuth config
    auth.config.ts                    # Edge-safe auth config (middleware)
    mongodb.ts                        # Mongoose connection singleton
    apiAuth.ts                        # Workspace-scoped auth context + role checks
    profilePath.ts                    # Browser profile directory helper
    cookies.ts                        # Multi-format cookie parser
    scraper.ts                        # Scrape orchestrator (workspace-scoped)
    ai.ts                             # AI evaluation + keyword suggestions + tone hints
    postReply.ts                      # Shared posting helper (resolve post + finalize)
    types.ts                          # TypeScript interfaces
    platforms/
      types.ts                        # Shared platform types + posting interfaces
      twitter.ts                      # Twitter verifier + scraper + poster
      reddit.ts                       # Reddit verifier + scraper + poster
      facebook.ts                     # Facebook verifier + scraper + poster
      quora.ts                        # Quora verifier + scraper + poster
      youtube.ts                      # YouTube verifier + scraper + poster
      pinterest.ts                    # Pinterest verifier + scraper + poster
  models/
    User.ts                           # User model (email, password, name, activeWorkspaceId)
    Post.ts                           # Post model (scrape + AI + reply + competitor + AB)
    Settings.ts                       # Settings model (company + platform + competitor + AB)
    Workspace.ts                      # Workspace model (name, slug, members + roles)
    Invitation.ts                     # Invitation model (email, token, role, status)
    ActivityLog.ts                    # Activity log model (workspace actions)
    KeywordMetric.ts                  # Keyword performance metrics per day
    TonePerformance.ts                # A/B tone performance per platform
  types/
    next-auth.d.ts                    # Extended NextAuth types (workspace, role)
  middleware.ts                       # Edge middleware for route protection
scripts/
  migrate-workspaces.ts              # Migration: userId-scoped data -> workspaceId
```

## API Endpoints

All API routes (except auth) require authentication and workspace membership. Write operations require `owner` or `editor` role.

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/auth/[...nextauth]` | NextAuth sign-in, sign-out, session |
| POST | `/api/auth/register` | Create account + default workspace |
| GET | `/api/posts` | List posts (filters: `status`, `platform`, `minScore`, `opportunities`, `page`) |
| PATCH | `/api/posts` | Update post status, edited reply, or selected variation |
| GET | `/api/settings` | Get workspace settings |
| PUT | `/api/settings` | Update settings (company, platforms, competitors, AB config) |
| GET | `/api/social-accounts` | List connected social accounts |
| POST | `/api/social-accounts` | Add a social account |
| DELETE | `/api/social-accounts?id=` | Remove a social account |
| GET | `/api/stats` | Counts by status, platform, competitors, tone performance |
| POST | `/api/scrape` | Trigger scraping across all enabled platforms |
| POST | `/api/evaluate` | Trigger AI evaluation on new posts |
| POST | `/api/run-pipeline` | Run full scrape + evaluate pipeline |
| POST | `/api/set-twitter-cookies` | Verify and store Twitter cookies |
| POST | `/api/set-reddit-cookies` | Verify and store Reddit cookies |
| POST | `/api/set-fb-cookies` | Verify and store Facebook cookies |
| POST | `/api/set-quora-cookies` | Verify and store Quora cookies |
| POST | `/api/set-youtube-cookies` | Verify and store YouTube cookies |
| POST | `/api/set-pinterest-cookies` | Verify and store Pinterest cookies |
| POST | `/api/post-reply` | Post reply to Twitter/X |
| POST | `/api/fb-post-reply` | Post reply to Facebook |
| POST | `/api/rd-post-reply` | Post reply to Reddit |
| POST | `/api/qa-post-reply` | Post reply to Quora |
| POST | `/api/yt-post-reply` | Post reply to YouTube |
| POST | `/api/pin-post-reply` | Post reply to Pinterest |
| GET, POST | `/api/workspaces` | List or create workspaces |
| PATCH, DELETE | `/api/workspaces/[id]` | Update or delete workspace |
| POST | `/api/workspaces/[id]/invite` | Invite member by email |
| GET, PATCH, DELETE | `/api/workspaces/[id]/members` | Manage workspace members |
| POST | `/api/workspaces/switch` | Switch active workspace |
| POST | `/api/invitations/accept` | Accept workspace invitation |
| GET | `/api/activity` | Workspace activity feed |
| GET | `/api/competitor-stats` | Competitor mention stats + sentiment |
| POST | `/api/keyword-suggestions` | AI-powered keyword suggestions |
| POST | `/api/keyword-related` | Related keyword expansion |
| GET | `/api/keyword-metrics` | Keyword performance metrics |
| GET | `/api/ab-stats` | A/B tone performance stats |
| POST | `/api/update-engagement` | Update engagement metrics on posted replies |

## Database Models

### User
- `email` — unique, lowercase
- `password` — bcrypt hashed
- `name`
- `activeWorkspaceId` — reference to current workspace
- Timestamps (createdAt, updatedAt)

### Workspace
- `name`, `slug` (unique)
- `ownerId` — reference to User
- `members[]` — array of `{ userId, role, invitedBy, joinedAt }`
- Roles: `owner`, `editor`, `reviewer`
- Indexes on `members.userId` and `slug`

### Post
- `userId`, `workspaceId` — scoped to workspace
- `url` — unique per workspace
- `platform` — twitter / reddit / facebook / quora / youtube / pinterest
- `author`, `content`, `scrapedAt`
- `status` — new / evaluating / evaluated / approved / rejected / posted
- `aiReply`, `aiRelevanceScore`, `aiTone`, `aiReasoning`
- `keywordsMatched` — array of matched keywords
- `editedReply`, `replyUrl`, `postedAt`, `postedByAccount`, `postedTone`
- Social metrics: `likeCount`, `retweetCount`, `replyCount`, `bookmarkCount`, `viewCount`
- Bot engagement tracking: `botReplyEngagement`, `botReplyReplies`
- Follow-up system: `followUpStatus`, `followUpText`, `followUpPostedAt`
- `monitorUntil` — conversation monitoring window
- Competitor fields: `competitorMentioned`, `competitorSentiment`, `competitorOpportunityScore`, `isCompetitorOpportunity`
- A/B Testing: `aiReplies[]` (text + tone + selected), `selectedVariationIndex`, `postedTone`

### Settings
- `userId`, `workspaceId` — scoped to workspace
- `companyName`, `companyDescription`
- `keywords`, `platforms`, `subreddits`
- `promptTemplate` — custom AI prompt
- `socialAccounts` — connected platform accounts with cookies
- Per-platform config (keywords, daily limits, auto-post thresholds)
- `platformSchedules` — per-platform cron schedules with timezone support
- Competitor intelligence: `competitors[]` (name, url, description), `competitorAlertThreshold`
- Keyword discovery: `suggestedKeywords[]`, `keywordSuggestionsLastRun`
- A/B Testing: `abTestingEnabled`, `abVariationCount`, `abTonePresets[]`, `abAutoOptimize`

### Invitation
- `workspaceId`, `email`, `role`, `invitedBy`
- `token` — unique invitation token
- `status` — pending / accepted / expired
- `expiresAt` — auto-expiration date

### ActivityLog
- `workspaceId`, `userId`
- `action` — post.approved / post.rejected / post.edited / post.posted / settings.updated / member.invited / member.joined / member.removed / workspace.created / workspace.updated
- `targetType`, `targetId`, `meta`

### KeywordMetric
- `userId`, `keyword`, `date`
- `postsFound`, `highRelevanceCount`, `avgRelevanceScore`
- `platforms` — Map of per-platform stats
- Unique index on `(userId, keyword, date)`

### TonePerformance
- `userId`, `platform`, `tone`
- `totalPosts`, `totalLikes`, `totalReplies`, `avgEngagementScore`
- Unique index on `(userId, platform, tone)`

## Getting Started

### Prerequisites

- Node.js 22+
- MongoDB instance
- Playwright Chromium (`npx playwright install chromium`)
- OpenClaw AI gateway (for AI evaluation)

### Environment Variables

Create a `.env.local` file in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/serpbays-saas
AUTH_SECRET=your-random-secret-here
AUTH_TRUST_HOST=true
PORT=3006

# OpenClaw AI Gateway (required for /api/evaluate)
OPENCLAW_HOST=127.0.0.1
OPENCLAW_PORT=18789

# YouTube Data API (optional, falls back to innertube)
YOUTUBE_API_KEY=
```

Generate `AUTH_SECRET` with:
```bash
openssl rand -base64 32
```

### Installation

```bash
npm install
npx playwright install chromium
```

### Development

```bash
npm run dev
```

The app will be available at [http://localhost:3006](http://localhost:3006).

### Production Build

```bash
npm run build
npm start -- -p 3006
```

### Docker

Build and run with Docker:

```bash
docker build -t serpbays-saas .
docker run -d \
  --name serpbays \
  -p 3006:3006 \
  -v serpbays-profiles:/app/profiles \
  --env-file .env.local \
  serpbays-saas
```

The `profiles` volume persists browser state (Playwright sessions, `.verified` cookie files) across container restarts. This is required for platform posting — without it, cookie verification is lost on restart.

MongoDB must be accessible from inside the container — use `host.docker.internal` or a network alias:

```env
MONGODB_URI=mongodb://host.docker.internal:27017/serpbays-saas
```

#### Migration (existing installs)

If upgrading from a userId-scoped installation to workspace-scoped, run the migration script:

```bash
# Outside Docker
npx tsx scripts/migrate-workspaces.ts

# Inside Docker
docker exec serpbays npx tsx scripts/migrate-workspaces.ts
```

This creates a default workspace for each user and migrates all posts/settings to workspace scope.

### Docker Compose (with MongoDB)

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3006:3006"
    volumes:
      - profiles:/app/profiles
    environment:
      MONGODB_URI: mongodb://mongo:27017/serpbays-saas
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_TRUST_HOST: "true"
      PORT: "3006"
      OPENCLAW_HOST: ${OPENCLAW_HOST:-host.docker.internal}
      OPENCLAW_PORT: ${OPENCLAW_PORT:-18789}
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  profiles:
  mongo-data:
```

## Architecture Notes

- **Edge Middleware** — Route protection runs on the Edge Runtime using a lightweight auth config (`auth.config.ts`) that avoids Node.js-only dependencies (bcrypt, mongoose). Full auth with DB lookups runs only in Node.js API routes.
- **Workspace-Scoped Multi-Tenancy** — All data is workspace-scoped. Users can belong to multiple workspaces with different roles. The active workspace is stored in the JWT session and used by `getApiContext()` to scope every API call.
- **Role-Based Access Control** — `owner` has full access, `editor` can create/modify/post, `reviewer` has read-only access. Enforced via `requireRole()` on every write endpoint.
- **Cookie Verification** — Each platform verifier launches a headless Playwright browser, injects user-provided cookies, navigates to the platform, and confirms login state by checking for redirect patterns. Verified cookie state is persisted in `.verified` files for use by scrapers and posters.
- **Scraping Pipeline** — The scrape orchestrator loads per-platform settings (keywords, limits, cookie state), runs all enabled platform scrapers in parallel, and bulk-upserts discovered posts with deduplication via compound unique index.
- **AI Evaluation** — Posts are evaluated via the OpenClaw AI gateway (HTTP API primary, CLI fallback). The system builds a prompt with company context, competitor awareness, and tone performance hints. Supports multi-variation generation for A/B testing and competitor mention detection with sentiment scoring.
- **Platform Posting** — A shared posting helper (`postReply.ts`) resolves the reply text (edited > A/B variation > AI reply), loads cookies from `.verified` files, and delegates to platform-specific posters. API-based platforms (Twitter, Pinterest) use direct HTTP calls. DOM-based platforms (Facebook, Quora, Reddit, YouTube) use Playwright browser automation. All routes update post status and log activity.
- **Browser Automation** — Uses persistent browser profiles with cookie-based auth for headless browser automation. Anti-bot measures include custom user agents and disabled automation detection flags. Profiles are workspace-scoped under `profiles/{workspaceId}/{platform}/`.
- **Activity Logging** — All team actions (approvals, rejections, edits, posts, settings changes, member management) are logged to `ActivityLog` for audit trail and team collaboration visibility.

## Implementation Status

- **Phase 0** — Auth, multi-tenancy, dashboard UI, settings, post CRUD, stats
- **Phase 1** — Cookie verification & account connection (6 platforms)
- **Phase 2** — Scraping & AI evaluation pipeline (scrape, evaluate, run-pipeline)
- **Growth Features** — Multi-brand workspaces, team collaboration, competitor intelligence, keyword discovery, A/B testing
- **Phase 3** — Platform posting (6 reply endpoints: Twitter, Facebook, Reddit, Quora, YouTube, Pinterest)

## License

Private — All rights reserved.
