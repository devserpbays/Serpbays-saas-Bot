import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import Settings from '@/models/Settings';
import KeywordMetric from '@/models/KeywordMetric';
import TonePerformance from '@/models/TonePerformance';
import ActivityLog from '@/models/ActivityLog';
import type { AIEvaluation, EvaluateResult, Competitor, KeywordSuggestion } from '@/lib/types';

const execAsync = promisify(exec);

const OPENCLAW_HOST = process.env.OPENCLAW_HOST || '127.0.0.1';
const OPENCLAW_PORT = process.env.OPENCLAW_PORT || '18789';

// --- Build the evaluation prompt ---
function buildPrompt(
  postContent: string,
  companyName: string,
  companyDescription: string,
  promptTemplate?: string,
  competitors?: Competitor[],
  tones?: string[],
  toneHints?: string
): string {
  // If custom template, use it directly (single-reply mode)
  if (promptTemplate) {
    return promptTemplate
      .replace(/\{postContent\}/g, postContent.slice(0, 1000))
      .replace(/\{companyName\}/g, companyName)
      .replace(/\{companyDescription\}/g, companyDescription);
  }

  const competitorSection = competitors && competitors.length > 0
    ? `\nCompetitors to watch for: ${competitors.map(c => c.name).join(', ')}\nIf the post mentions any of these competitors, identify which one and assess the sentiment toward them.`
    : '';

  const competitorFields = competitors && competitors.length > 0
    ? `\n  "competitorMentioned": "competitor name or empty string",\n  "competitorSentiment": "positive, negative, neutral, or empty string",\n  "competitorOpportunityScore": 0 to 100 (how good an opportunity to position against the competitor),`
    : '';

  // A/B Testing: multiple variations
  if (tones && tones.length > 1) {
    const toneHintSection = toneHints ? `\n\nHistorical tone performance data:\n${toneHints}\nUse this data to craft better variations for the higher-performing tones.` : '';

    return `You are a social media engagement analyst. Analyze the following social media post and determine if it describes a problem or need that "${companyName}" can help solve.

Company: ${companyName}
Company Description: ${companyDescription}
${competitorSection}

Social Media Post:
"""
${postContent.slice(0, 1000)}
"""
${toneHintSection}

Generate ${tones.length} reply variations, one for each tone: ${tones.join(', ')}.

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text):
{
  "relevant": true or false,
  "score": 0 to 100,
  "suggestedReply": "Copy of the first variation text for backward compatibility",
  "tone": "${tones[0]}",
  "reasoning": "Brief explanation of why this is or isn't relevant",${competitorFields}
  "variations": [
${tones.map(t => `    { "text": "A helpful, non-salesy reply in a ${t} tone that naturally mentions how ${companyName} could help.", "tone": "${t}" }`).join(',\n')}
  ]
}`;
  }

  // Single reply mode
  return `You are a social media engagement analyst. Analyze the following social media post and determine if it describes a problem or need that "${companyName}" can help solve.

Company: ${companyName}
Company Description: ${companyDescription}
${competitorSection}

Social Media Post:
"""
${postContent.slice(0, 1000)}
"""

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text):
{
  "relevant": true or false,
  "score": 0 to 100,
  "suggestedReply": "A helpful, non-salesy reply that naturally mentions how ${companyName} could help. Keep it conversational and genuine.",
  "tone": "helpful or empathetic or informative or casual",
  "reasoning": "Brief explanation of why this is or isn't relevant"${competitorFields}
}`;
}

// --- Parse AI evaluation from raw text ---
function parseEvaluation(text: string): AIEvaluation | null {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if ('relevant' in parsed && 'score' in parsed) {
      const result = parsed as AIEvaluation;
      // Back-fill suggestedReply/tone from variations[0] if present
      if (result.variations && result.variations.length > 0 && !result.suggestedReply) {
        result.suggestedReply = result.variations[0].text;
        result.tone = result.variations[0].tone;
      }
      return result;
    }
  } catch {
    // not direct JSON
  }

  // Extract JSON from markdown code blocks or mixed text
  const jsonMatch = text.match(/\{[\s\S]*?"relevant"[\s\S]*?"reasoning"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]) as AIEvaluation;
      if (result.variations && result.variations.length > 0 && !result.suggestedReply) {
        result.suggestedReply = result.variations[0].text;
        result.tone = result.variations[0].tone;
      }
      return result;
    } catch {
      // malformed JSON
    }
  }

  return null;
}

// --- Method 1: OpenClaw Gateway HTTP API ---
async function evaluateViaHTTP(prompt: string): Promise<string> {
  const sessionId = `social-bot-eval-${Date.now()}`;
  const gatewayUrl = `http://${OPENCLAW_HOST}:${OPENCLAW_PORT}`;

  const res = await fetch(`${gatewayUrl}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: prompt,
      sessionId,
      json: true,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    throw new Error(`OpenClaw HTTP API returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  return data?.payloads?.[0]?.text
    || data?.result?.content
    || data?.content
    || data?.message
    || (typeof data === 'string' ? data : JSON.stringify(data));
}

// --- Method 2: OpenClaw CLI (fallback) ---
async function evaluateViaCLI(prompt: string): Promise<string> {
  const tmpFile = join(tmpdir(), `openclaw-prompt-${randomUUID()}.txt`);
  await writeFile(tmpFile, prompt, 'utf-8');

  try {
    const sessionId = `social-bot-eval-${Date.now()}`;
    const { stdout } = await execAsync(
      `openclaw agent --local --session-id "${sessionId}" --message "$(cat '${tmpFile}')" --json`,
      { timeout: 120000, maxBuffer: 1024 * 1024 }
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          const aiText = parsed?.payloads?.[0]?.text
            || parsed?.result?.content
            || parsed?.content
            || parsed?.message;
          if (aiText) return typeof aiText === 'string' ? aiText : JSON.stringify(aiText);
        } catch {
          continue;
        }
      }
    }

    const jsonMatch = stdout.match(/\{[\s\S]*"payloads"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const aiText = parsed?.payloads?.[0]?.text || parsed?.content;
      if (aiText) return typeof aiText === 'string' ? aiText : JSON.stringify(aiText);
    }

    return stdout;
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

// --- Main evaluation function ---
export async function evaluatePost(
  postContent: string,
  companyName: string,
  companyDescription: string,
  promptTemplate?: string,
  competitors?: Competitor[],
  tones?: string[],
  toneHints?: string
): Promise<AIEvaluation> {
  const prompt = buildPrompt(postContent, companyName, companyDescription, promptTemplate, competitors, tones, toneHints);

  let rawResponse: string;

  // Try HTTP API first, fall back to CLI
  try {
    rawResponse = await evaluateViaHTTP(prompt);
  } catch (httpErr) {
    console.warn('OpenClaw HTTP API failed, falling back to CLI:', (httpErr as Error).message);
    try {
      rawResponse = await evaluateViaCLI(prompt);
    } catch (cliErr) {
      console.error('OpenClaw CLI also failed:', (cliErr as Error).message);
      return {
        relevant: false,
        score: 0,
        suggestedReply: '',
        tone: 'helpful',
        reasoning: `OpenClaw evaluation failed: ${(cliErr as Error).message}`,
      };
    }
  }

  const evaluation = parseEvaluation(rawResponse);
  if (evaluation) {
    return evaluation;
  }

  return {
    relevant: false,
    score: 0,
    suggestedReply: '',
    tone: 'helpful',
    reasoning: `Could not parse AI response: ${rawResponse.slice(0, 200)}`,
  };
}

// --- Direct OpenClaw agent call (for general-purpose AI tasks) ---
export async function askOpenClaw(message: string, sessionId?: string): Promise<string> {
  const sid = sessionId || `social-bot-${Date.now()}`;

  try {
    const gatewayUrl = `http://${OPENCLAW_HOST}:${OPENCLAW_PORT}`;
    const res = await fetch(`${gatewayUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: sid, json: true }),
      signal: AbortSignal.timeout(120000),
    });

    if (res.ok) {
      const data = await res.json();
      return data?.payloads?.[0]?.text || data?.content || data?.message || JSON.stringify(data);
    }
  } catch {
    // fall through to CLI
  }

  const tmpFile = join(tmpdir(), `openclaw-msg-${randomUUID()}.txt`);
  await writeFile(tmpFile, message, 'utf-8');

  try {
    const { stdout } = await execAsync(
      `openclaw agent --local --session-id "${sid}" --message "$(cat '${tmpFile}')" --json`,
      { timeout: 120000, maxBuffer: 1024 * 1024 }
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return parsed?.payloads?.[0]?.text || parsed?.content || parsed?.message || trimmed;
        } catch {
          continue;
        }
      }
    }
    return stdout.trim();
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

export function findMatchedKeywords(content: string, keywords: string[]): string[] {
  const lower = content.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

// --- Build tone performance hints for auto-optimize ---
function buildPlatformToneHints(
  perfData: Array<{ platform: string; tone: string; avgEngagementScore: number; totalPosts: number }>,
  platform: string
): string {
  const platformData = perfData.filter(p => p.platform === platform);
  if (platformData.length === 0) return '';

  return platformData
    .sort((a, b) => b.avgEngagementScore - a.avgEngagementScore)
    .map(d => `- "${d.tone}" tone: avg engagement ${d.avgEngagementScore.toFixed(1)}, ${d.totalPosts} posts`)
    .join('\n');
}

// --- Keyword suggestions via AI ---
export async function suggestKeywords(
  companyName: string,
  companyDescription: string,
  existingKeywords: string[],
  competitors?: Competitor[]
): Promise<KeywordSuggestion[]> {
  const competitorContext = competitors && competitors.length > 0
    ? `\nCompetitors: ${competitors.map(c => c.name).join(', ')}`
    : '';

  const prompt = `You are a keyword research expert. Suggest 10-15 keywords for social media monitoring.

Company: ${companyName}
Description: ${companyDescription}
Existing Keywords: ${existingKeywords.join(', ') || 'none'}${competitorContext}

Suggest keywords that would help find social media posts where people discuss problems this company solves.
Include a mix of: pain point keywords, product category keywords, competitor-related keywords, and question keywords.
Do NOT repeat any existing keywords.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "suggestions": [
    { "keyword": "example keyword", "reason": "Why this keyword is relevant", "confidence": 85 }
  ]
}`;

  try {
    const response = await askOpenClaw(prompt);
    const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || response);
    return (parsed.suggestions || []) as KeywordSuggestion[];
  } catch {
    return [];
  }
}

// --- Related keyword suggestions ---
export async function suggestRelatedKeywords(
  keyword: string,
  companyDescription: string
): Promise<KeywordSuggestion[]> {
  const prompt = `Suggest 5 keywords closely related to "${keyword}" for a company that: ${companyDescription}

Respond ONLY with valid JSON:
{
  "suggestions": [
    { "keyword": "related keyword", "reason": "Why related", "confidence": 80 }
  ]
}`;

  try {
    const response = await askOpenClaw(prompt);
    const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || response);
    return (parsed.suggestions || []) as KeywordSuggestion[];
  } catch {
    return [];
  }
}

// --- Update keyword metrics ---
export async function updateKeywordMetrics(
  userId: string,
  evaluatedPosts: Array<{ keywordsMatched: string[]; aiRelevanceScore: number; platform: string }>
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const metrics: Record<string, {
    postsFound: number;
    highRelevanceCount: number;
    totalScore: number;
    platforms: Record<string, number>;
  }> = {};

  for (const post of evaluatedPosts) {
    for (const kw of post.keywordsMatched) {
      if (!metrics[kw]) {
        metrics[kw] = { postsFound: 0, highRelevanceCount: 0, totalScore: 0, platforms: {} };
      }
      metrics[kw].postsFound++;
      metrics[kw].totalScore += post.aiRelevanceScore;
      if (post.aiRelevanceScore >= 70) metrics[kw].highRelevanceCount++;
      metrics[kw].platforms[post.platform] = (metrics[kw].platforms[post.platform] || 0) + 1;
    }
  }

  const ops = Object.entries(metrics).map(([keyword, data]) => ({
    updateOne: {
      filter: { userId, keyword, date: today },
      update: {
        $inc: {
          postsFound: data.postsFound,
          highRelevanceCount: data.highRelevanceCount,
        },
        $set: {
          avgRelevanceScore: data.totalScore / data.postsFound,
          platforms: data.platforms,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await KeywordMetric.bulkWrite(ops, { ordered: false });
  }
}

export async function runEvaluation(workspaceId: string): Promise<EvaluateResult> {
  await connectDB();

  const settings = await Settings.findOne({ workspaceId }).lean();
  if (!settings) return { evaluated: 0, total: 0, autoApproved: 0 };

  const settingsObj = settings as Record<string, unknown>;
  const companyName = (settingsObj.companyName as string) || '';
  const companyDescription = (settingsObj.companyDescription as string) || '';
  const promptTemplate = (settingsObj.promptTemplate as string) || '';
  const keywords = (settingsObj.keywords as string[]) || [];
  const competitors = (settingsObj.competitors as Competitor[]) || [];
  const abTestingEnabled = settingsObj.abTestingEnabled !== false;
  const abTonePresets = (settingsObj.abTonePresets as string[]) || ['helpful', 'professional', 'witty'];
  const abAutoOptimize = settingsObj.abAutoOptimize === true;
  const competitorAlertThreshold = (settingsObj.competitorAlertThreshold as number) || 60;
  const userId = (settingsObj.userId as { toString(): string }).toString();
  const workspaceIdStr = (settingsObj.workspaceId as { toString(): string })?.toString() || '';

  // Per-platform auto-approve thresholds
  const autoPostThresholds: Record<string, number> = {
    facebook: (settingsObj.facebookAutoPostThreshold as number) ?? 70,
    twitter: (settingsObj.twitterAutoPostThreshold as number) ?? 70,
    reddit: (settingsObj.redditAutoPostThreshold as number) ?? 70,
    quora: (settingsObj.quoraAutoPostThreshold as number) ?? 70,
    youtube: (settingsObj.youtubeAutoPostThreshold as number) ?? 70,
    pinterest: (settingsObj.pinterestAutoPostThreshold as number) ?? 70,
  };

  // Find posts with status 'new', limit batch size
  const posts = await Post.find({ workspaceId, status: 'new' })
    .sort({ scrapedAt: -1 })
    .limit(50)
    .lean();

  if (!posts.length) return { evaluated: 0, total: 0, autoApproved: 0 };

  const postIds = posts.map((p) => p._id);

  // Mark all as 'evaluating' for UI progress indicator
  await Post.updateMany(
    { _id: { $in: postIds } },
    { $set: { status: 'evaluating' } }
  );

  // Load tone performance data for auto-optimize
  let toneHints = '';
  if (abTestingEnabled && abAutoOptimize) {
    const perfData = await TonePerformance.find({ userId }).lean();
    const perfArray = (perfData as Array<{ platform: string; tone: string; avgEngagementScore: number; totalPosts: number }>);
    if (perfArray.length > 0) {
      // Build hints for each platform that has data
      const platforms = [...new Set(perfArray.map(p => p.platform))];
      toneHints = platforms.map(p => `${p}:\n${buildPlatformToneHints(perfArray, p)}`).join('\n\n');
    }
  }

  // Determine tones for A/B testing
  const tones = abTestingEnabled && !promptTemplate ? abTonePresets : undefined;

  let evaluated = 0;
  let autoApproved = 0;
  const evaluatedPostsForMetrics: Array<{ keywordsMatched: string[]; aiRelevanceScore: number; platform: string }> = [];

  for (const post of posts) {
    try {
      const content = post.content as string;
      const result = await evaluatePost(
        content,
        companyName,
        companyDescription,
        promptTemplate || undefined,
        competitors.length > 0 ? competitors : undefined,
        tones,
        toneHints || undefined
      );

      const matched = findMatchedKeywords(content, keywords);

      // Check auto-approve threshold for this platform
      const platform = post.platform as string;
      const threshold = autoPostThresholds[platform] ?? 70;
      const shouldAutoApprove = result.relevant && result.score >= threshold;

      const updateData: Record<string, unknown> = {
        status: shouldAutoApprove ? 'approved' : 'evaluated',
        aiRelevanceScore: result.score,
        aiReply: result.suggestedReply,
        aiTone: result.tone,
        aiReasoning: result.reasoning,
        keywordsMatched: matched,
        evaluatedAt: new Date(),
      };

      if (shouldAutoApprove) {
        updateData.approvedAt = new Date();
        autoApproved++;
      }

      // Competitor fields
      if (result.competitorMentioned) {
        updateData.competitorMentioned = result.competitorMentioned;
        updateData.competitorSentiment = result.competitorSentiment || '';
        updateData.competitorOpportunityScore = result.competitorOpportunityScore || 0;
        updateData.isCompetitorOpportunity =
          (result.competitorOpportunityScore || 0) >= competitorAlertThreshold &&
          result.competitorSentiment === 'negative';
      }

      // A/B Testing variations
      if (result.variations && result.variations.length > 0) {
        updateData.aiReplies = result.variations.map(v => ({
          text: v.text,
          tone: v.tone,
          selected: false,
        }));
      }

      await Post.updateOne(
        { _id: post._id },
        { $set: updateData }
      );

      // Log auto-approval to activity feed
      if (shouldAutoApprove && workspaceIdStr) {
        try {
          await ActivityLog.create({
            workspaceId: workspaceIdStr,
            userId,
            action: 'post.auto_approved',
            targetType: 'post',
            targetId: (post._id as { toString(): string }).toString(),
            meta: { score: result.score, threshold, platform },
          });
        } catch { /* silent — don't fail pipeline for logging */ }
      }

      evaluatedPostsForMetrics.push({
        keywordsMatched: matched,
        aiRelevanceScore: result.score,
        platform: post.platform as string,
      });

      evaluated++;
    } catch (err) {
      console.error(`Failed to evaluate post ${post._id}:`, err);
      // On error, revert to 'new'
      await Post.updateOne(
        { _id: post._id },
        { $set: { status: 'new' } }
      );
    }
  }

  // Update keyword metrics
  if (evaluatedPostsForMetrics.length > 0) {
    try {
      await updateKeywordMetrics(userId, evaluatedPostsForMetrics);
    } catch (err) {
      console.error('Failed to update keyword metrics:', err);
    }
  }

  return { evaluated, total: posts.length, autoApproved };
}
