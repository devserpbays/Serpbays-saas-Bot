import OpenAI from 'openai';
import { connectDB } from '@/lib/mongodb';
import Post from '@/models/Post';
import Settings from '@/models/Settings';
import type { AIEvaluation, EvaluateResult } from '@/lib/types';

const DEFAULT_PROMPT_TEMPLATE = `You are a social media engagement analyst. Analyze the following social media post and determine if it describes a problem or need that "{companyName}" can help solve.

Company: {companyName}
Company Description: {companyDescription}

Social Media Post:
"""{postContent}"""

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text):
{
  "relevant": true or false,
  "score": 0 to 100,
  "suggestedReply": "A helpful, non-salesy reply that naturally mentions how {companyName} could help. Keep it conversational and genuine.",
  "tone": "helpful or empathetic or informative or casual",
  "reasoning": "Brief explanation of why this is or isn't relevant"
}`;

function buildPrompt(
  content: string,
  companyName: string,
  companyDescription: string,
  template?: string
): string {
  const tmpl = template || DEFAULT_PROMPT_TEMPLATE;
  return tmpl
    .replace(/\{postContent\}/g, content.slice(0, 1000))
    .replace(/\{companyName\}/g, companyName)
    .replace(/\{companyDescription\}/g, companyDescription);
}

export async function evaluatePost(
  content: string,
  settings: { companyName: string; companyDescription: string; promptTemplate?: string }
): Promise<AIEvaluation | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const prompt = buildPrompt(content, settings.companyName, settings.companyDescription, settings.promptTemplate);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      relevant: Boolean(parsed.relevant),
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      suggestedReply: String(parsed.suggestedReply || ''),
      tone: String(parsed.tone || 'helpful'),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch {
    return null;
  }
}

export function findMatchedKeywords(content: string, keywords: string[]): string[] {
  const lower = content.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

export async function runEvaluation(userId: string): Promise<EvaluateResult> {
  await connectDB();

  const settings = await Settings.findOne({ userId }).lean();
  if (!settings) return { evaluated: 0, total: 0 };

  const settingsObj = settings as Record<string, unknown>;
  const companyName = (settingsObj.companyName as string) || '';
  const companyDescription = (settingsObj.companyDescription as string) || '';
  const promptTemplate = (settingsObj.promptTemplate as string) || '';
  const keywords = (settingsObj.keywords as string[]) || [];

  // Find posts with status 'new', limit batch size
  const posts = await Post.find({ userId, status: 'new' })
    .sort({ scrapedAt: -1 })
    .limit(50)
    .lean();

  if (!posts.length) return { evaluated: 0, total: 0 };

  const postIds = posts.map((p) => p._id);

  // Mark all as 'evaluating' for UI progress indicator
  await Post.updateMany(
    { _id: { $in: postIds } },
    { $set: { status: 'evaluating' } }
  );

  let evaluated = 0;

  // Evaluate sequentially to respect OpenAI rate limits
  for (const post of posts) {
    try {
      const content = post.content as string;
      const result = await evaluatePost(content, { companyName, companyDescription, promptTemplate });

      if (result) {
        const matched = findMatchedKeywords(content, keywords);
        await Post.updateOne(
          { _id: post._id },
          {
            $set: {
              status: 'evaluated',
              aiRelevanceScore: result.score,
              aiReply: result.suggestedReply,
              aiTone: result.tone,
              aiReasoning: result.reasoning,
              keywordsMatched: matched,
              evaluatedAt: new Date(),
            },
          }
        );
        evaluated++;
      } else {
        // AI failure — revert to 'new' for retry
        await Post.updateOne(
          { _id: post._id },
          { $set: { status: 'new' } }
        );
      }
    } catch {
      // On error, revert to 'new'
      await Post.updateOne(
        { _id: post._id },
        { $set: { status: 'new' } }
      );
    }
  }

  return { evaluated, total: posts.length };
}
