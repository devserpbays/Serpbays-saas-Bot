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
- Full data isolation per user — every post, setting, and account is scoped to the authenticated user
- Compound unique index on `(userId, url)` so multiple users can independently track the same content

### Dashboard
- Real-time stats bar showing counts for each pipeline stage (New, Evaluating, Evaluated, Approved, Rejected, Posted)
- Per-platform breakdown with post counts and posted badges
- Connected social account avatars displayed per platform
- Auto-polling every 10 seconds for live data updates
- Status filter tabs (All / New / Evaluated / Approved / Rejected / Posted)
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
- AI-suggested reply with inline editing before approval
- Per-status action buttons:
  - `evaluated` / `new`: Approve, Edit Reply, Reject
  - `approved`: Platform-specific "Post to X/Facebook/Reddit/..." buttons, Copy Reply, Mark as Posted
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

### Engagement Tracking
- Track likes and replies on bot-posted replies
- Store reply threads from users responding to bot comments
- Follow-up message system (pending / posted / skipped)
- Configurable monitoring duration per conversation thread

### Browser Profile System
- Persistent browser profiles per user per platform (`profiles/{userId}/{platform}/`)
- Cookie-based authentication for headless browser automation
- Isolated browser state across users and platforms

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Auth | NextAuth.js v5 (credentials provider, JWT sessions) |
| Database | MongoDB (Mongoose 9) |
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
      auth/register/route.ts          # User registration
      posts/route.ts                  # GET (list/filter) + PATCH (update) posts
      settings/route.ts               # GET + PUT user settings
      social-accounts/route.ts        # GET + POST + DELETE social accounts
      stats/route.ts                  # Aggregated status/platform counts
  components/
    Dashboard.tsx                     # Main dashboard UI
    SettingsPanel.tsx                 # Settings slide-out drawer
    PostCard.tsx                      # Post card with actions
    StatusBadge.tsx                   # Colored status pill
    Providers.tsx                     # NextAuth SessionProvider wrapper
  lib/
    auth.ts                           # Full NextAuth config
    auth.config.ts                    # Edge-safe auth config (middleware)
    mongodb.ts                        # Mongoose connection singleton
    apiAuth.ts                        # Extract userId from session
    profilePath.ts                    # Browser profile directory helper
    types.ts                          # TypeScript interfaces
  models/
    User.ts                           # User model (email, password, name)
    Post.ts                           # Post model (scrape + AI + reply schema)
    Settings.ts                       # Settings model (company + platform configs)
  middleware.ts                       # Edge middleware for route protection
```

## API Endpoints

### Implemented

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/auth/[...nextauth]` | NextAuth sign-in, sign-out, session |
| POST | `/api/auth/register` | Create new user account |
| GET | `/api/posts` | List posts (filters: `status`, `platform`, `minScore`, `page`, `limit`) |
| PATCH | `/api/posts` | Update post status and/or edited reply |
| GET | `/api/settings` | Get current user's settings |
| PUT | `/api/settings` | Create or update settings (upsert) |
| GET | `/api/social-accounts` | List connected social accounts |
| POST | `/api/social-accounts` | Add a social account |
| DELETE | `/api/social-accounts?id=` | Remove a social account |
| GET | `/api/stats` | Aggregated counts by status and platform |

### Bot Service Endpoints (called from frontend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/scrape` | Trigger scraping job |
| POST | `/api/evaluate` | Trigger AI evaluation |
| POST | `/api/run-pipeline` | Run full scrape + evaluate pipeline |
| POST | `/api/post-reply` | Post reply to Twitter/X |
| POST | `/api/fb-post-reply` | Post reply to Facebook |
| POST | `/api/rd-post-reply` | Post reply to Reddit |
| POST | `/api/qa-post-reply` | Post reply to Quora |
| POST | `/api/yt-post-reply` | Post reply to YouTube |
| POST | `/api/pin-post-reply` | Post reply to Pinterest |
| POST | `/api/set-twitter-cookies` | Verify and store Twitter cookies |
| POST | `/api/set-reddit-cookies` | Verify and store Reddit cookies |
| POST | `/api/set-fb-cookies` | Verify and store Facebook cookies |
| POST | `/api/set-quora-cookies` | Verify and store Quora cookies |
| POST | `/api/set-youtube-cookies` | Verify and store YouTube cookies |
| POST | `/api/set-pinterest-cookies` | Verify and store Pinterest cookies |

## Database Models

### User
- `email` — unique, lowercase
- `password` — bcrypt hashed
- `name`
- Timestamps (createdAt, updatedAt)

### Post
- `userId` — scoped to user
- `url` — unique per user
- `platform` — twitter / reddit / facebook / quora / youtube / pinterest
- `author`, `content`, `scrapedAt`
- `status` — new / evaluating / evaluated / approved / rejected / posted
- `aiReply`, `aiRelevanceScore`, `aiTone`, `aiReasoning`
- `keywordsMatched` — array of matched keywords
- `editedReply`, `replyUrl`
- Social metrics: `likeCount`, `retweetCount`, `replyCount`, `bookmarkCount`, `viewCount`
- Bot engagement tracking: `botReplyEngagement`, `botReplyReplies`
- Follow-up system: `followUpStatus`, `followUpText`, `followUpPostedAt`
- `monitorUntil` — conversation monitoring window

### Settings
- `userId` — scoped to user
- `companyName`, `companyDescription`
- `keywords`, `platforms`, `subreddits`
- `promptTemplate` — custom AI prompt
- `socialAccounts` — connected platform accounts with cookies
- Per-platform config (keywords, daily limits, auto-post thresholds)
- `platformSchedules` — per-platform cron schedules with timezone support

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance

### Environment Variables

Create a `.env.local` file in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/serpbays-saas
AUTH_SECRET=your-random-secret-here
AUTH_TRUST_HOST=true
PORT=3006
```

Generate `AUTH_SECRET` with:
```bash
openssl rand -base64 32
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at [http://localhost:3006](http://localhost:3006).

### Production Build

```bash
npm run build
npm start
```

## Architecture Notes

- **Edge Middleware** — Route protection runs on the Edge Runtime using a lightweight auth config (`auth.config.ts`) that avoids Node.js-only dependencies (bcrypt, mongoose). Full auth with DB lookups runs only in Node.js API routes.
- **Multi-Tenancy** — All data is user-scoped from day one. No shared state between users.
- **Bot Service** — The scraping, AI evaluation, and platform posting automation is handled by a separate bot/worker service that communicates with this app's API. The Next.js app serves as the dashboard, data layer, and REST API.
- **Browser Automation** — Uses persistent browser profiles with cookie-based auth for headless browser posting to each platform.

## License

Private — All rights reserved.
