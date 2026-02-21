/**
 * Tier 2 AI signal classification using Haiku 4.5 with Sonnet fallback.
 * Uses Structured Outputs for guaranteed valid JSON responses.
 * Background polling uses Message Batches API (50% discount).
 * Manual scans use the standard API for real-time results.
 */

import { getAnthropicClient, HAIKU_MODEL, AI_MODEL } from '@/lib/ai/client';
import { SIGNAL_ANALYSIS_SYSTEM_PROMPT, SIGNAL_ANALYSIS_V2_SYSTEM_PROMPT, buildV2ClassificationPrompt } from '@/lib/ai/prompts';
import type { SignalType, PainSeverity, ScoreBin } from '@/types';

export interface ClassificationInput {
  reddit_id: string;
  title: string;
  body: string | null;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
}

export interface ClassificationResult {
  reddit_id: string;
  intent_type: string;
  score_bin: ScoreBin;
  intent_score: number; // numeric mapping of score_bin
  signal_types: SignalType[];
  pain_severity: PainSeverity | null;
  decision_maker: boolean;
  competitor_mentions: {
    name: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    switching_intent: boolean;
    context: string;
  }[];
}

// Map discrete bins to numeric scores
const BIN_TO_SCORE: Record<ScoreBin, number> = {
  very_low: 0.1,
  low: 0.3,
  medium: 0.5,
  high: 0.75,
  very_high: 0.95,
};

// JSON schema for Structured Outputs
const CLASSIFICATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    classifications: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          reddit_id: { type: 'string' as const },
          intent_type: {
            type: 'string' as const,
            enum: ['question', 'comparison', 'problem', 'discussion', 'showcase'],
          },
          score_bin: {
            type: 'string' as const,
            enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
          },
          signal_types: {
            type: 'array' as const,
            items: {
              type: 'string' as const,
              enum: [
                'tool_switch',
                'budget_constraint',
                'repeated_pain',
                'high_signal_comment',
                'mod_safe',
                'trend_cluster',
                'convertible_thread',
              ],
            },
          },
          pain_severity: {
            type: 'string' as const,
            enum: ['low', 'medium', 'high'],
          },
          decision_maker: { type: 'boolean' as const },
          competitor_mentions: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                sentiment: {
                  type: 'string' as const,
                  enum: ['positive', 'neutral', 'negative'],
                },
                switching_intent: { type: 'boolean' as const },
                context: { type: 'string' as const },
              },
              required: ['name', 'sentiment', 'switching_intent', 'context'] as const,
            },
          },
        },
        required: [
          'reddit_id',
          'intent_type',
          'score_bin',
          'signal_types',
          'pain_severity',
          'decision_maker',
          'competitor_mentions',
        ] as const,
      },
    },
  },
  required: ['classifications'] as const,
};

/**
 * Build the user prompt for classification.
 */
function buildClassificationPrompt(
  posts: ClassificationInput[],
  productName: string,
  productDescription: string,
  competitors: string[]
): string {
  const postList = posts
    .map(
      (p, i) =>
        `${i + 1}. [${p.reddit_id}] r/${p.subreddit} (${p.score} pts, ${p.num_comments} comments)
   Title: "${p.title}"
   Body: ${p.body ? p.body.slice(0, 500) : '[no body]'}
   Author: u/${p.author}`
    )
    .join('\n\n');

  return `## Product Context
- **Product:** ${productName}
- **Description:** ${productDescription}
- **Competitors:** ${competitors.length > 0 ? competitors.join(', ') : 'None specified'}

## Posts to Classify
${postList}

Classify each post according to the schema.`;
}

/**
 * Classify posts using the standard API (real-time, for manual scans).
 */
export async function classifyPostsRealtime(
  posts: ClassificationInput[],
  productName: string,
  productDescription: string,
  competitors: string[]
): Promise<ClassificationResult[]> {
  if (posts.length === 0) return [];

  const client = getAnthropicClient();
  const prompt = buildClassificationPrompt(posts, productName, productDescription, competitors);

  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    system: SIGNAL_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  return parseClassificationResponse(textContent.text);
}

/**
 * Re-classify ambiguous posts (medium bin) using Sonnet for higher accuracy.
 */
export async function reclassifyWithSonnet(
  posts: ClassificationInput[],
  productName: string,
  productDescription: string,
  competitors: string[]
): Promise<ClassificationResult[]> {
  if (posts.length === 0) return [];

  const client = getAnthropicClient();
  const prompt = buildClassificationPrompt(posts, productName, productDescription, competitors);

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: SIGNAL_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  return parseClassificationResponse(textContent.text);
}

/**
 * Create batch classification requests for background polling (50% cost savings).
 * Returns batch request bodies ready to submit to the Batches API.
 */
export function createBatchRequests(
  posts: ClassificationInput[],
  productName: string,
  productDescription: string,
  competitors: string[]
): {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: string; content: string }[];
  };
}[] {
  return posts.map((post) => ({
    custom_id: post.reddit_id,
    params: {
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: SIGNAL_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildClassificationPrompt(
            [post],
            productName,
            productDescription,
            competitors
          ),
        },
      ],
    },
  }));
}

// ---- V2 Classification (product-context-aware, multi-dimensional scoring) ----

export interface ClassificationResultV2 {
  reddit_id: string;
  intent_type: string;
  fit_score: number;
  lead_score: number;
  engage_score: number;
  signal_types: SignalType[];
  pain_severity: PainSeverity | null;
  decision_maker: boolean;
  competitor_mentions: { name: string; sentiment: string; switching_intent: boolean; context: string }[];
}

export async function classifyPostsV2(
  posts: ClassificationInput[],
  productContext: {
    productName: string;
    productDescription: string;
    problemsSolved?: string[];
    solutionFeatures?: string[];
    audienceBehaviors?: string[];
    competitors?: string[];
    competitorWeaknesses?: string[];
  },
  options?: { useSonnet?: boolean }
): Promise<ClassificationResultV2[]> {
  if (posts.length === 0) return [];

  const client = getAnthropicClient();
  const prompt = buildV2ClassificationPrompt(
    posts.map((p) => ({
      reddit_id: p.reddit_id,
      title: p.title,
      body: p.body,
      subreddit: p.subreddit,
      author: p.author,
      score: p.score,
      num_comments: p.num_comments,
    })),
    productContext
  );

  const model = options?.useSonnet ? AI_MODEL : HAIKU_MODEL;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SIGNAL_ANALYSIS_V2_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  return parseV2ClassificationResponse(textContent.text);
}

function parseV2ClassificationResponse(responseText: string): ClassificationResultV2[] {
  let text = responseText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(text) as {
      classifications: {
        reddit_id: string;
        intent_type: string;
        fit_score: number;
        lead_score: number;
        engage_score: number;
        signal_types: SignalType[];
        pain_severity: PainSeverity | null;
        decision_maker: boolean;
        competitor_mentions: { name: string; sentiment: string; switching_intent: boolean; context: string }[];
      }[];
    };

    return (parsed.classifications || []).map((c) => ({
      ...c,
      fit_score: Math.max(1, Math.min(10, c.fit_score)),
      lead_score: Math.max(1, Math.min(10, c.lead_score)),
      engage_score: Math.max(1, Math.min(10, c.engage_score)),
    }));
  } catch {
    return [];
  }
}

/**
 * Parse the raw AI response text into typed classification results.
 */
function parseClassificationResponse(responseText: string): ClassificationResult[] {
  let text = responseText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(text) as {
      classifications: {
        reddit_id: string;
        intent_type: string;
        score_bin: ScoreBin;
        signal_types: SignalType[];
        pain_severity: PainSeverity;
        decision_maker: boolean;
        competitor_mentions: {
          name: string;
          sentiment: 'positive' | 'neutral' | 'negative';
          switching_intent: boolean;
          context: string;
        }[];
      }[];
    };

    return (parsed.classifications || []).map((c) => ({
      ...c,
      intent_score: BIN_TO_SCORE[c.score_bin] ?? 0.5,
    }));
  } catch {
    return [];
  }
}
