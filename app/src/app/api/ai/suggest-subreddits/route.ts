import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, isAIConfigured, HAIKU_MODEL } from '@/lib/ai/client';
import { SUGGEST_SUBREDDITS_SYSTEM_PROMPT, buildSuggestSubredditsPrompt } from '@/lib/ai/prompts';
import { discoverSubreddits } from '@/lib/reddit/discover';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: 'Product name and description are required' },
        { status: 400 }
      );
    }

    const existingSubreddits: string[] = body.existingSubreddits || [];
    const competitors: string[] = body.competitors || [];

    // Step 1: Run multi-signal discovery
    const discovery = await discoverSubreddits(
      {
        name: body.name,
        description: body.description,
        url: body.url,
        audience: body.audience,
        tone: body.tone || 'Professional',
      },
      existingSubreddits,
      competitors
    );

    // Step 2: Ask Claude to rank and filter using top candidates (limit to 25 for speed)
    if (!isAIConfigured()) {
      return NextResponse.json({ error: 'AI features are not configured.' }, { status: 503 });
    }

    const topCandidates = discovery.candidates.slice(0, 15);

    const client = getAnthropicClient();
    const prompt = buildSuggestSubredditsPrompt(
      {
        name: body.name,
        description: body.description,
        url: body.url,
        audience: body.audience,
        tone: body.tone || 'Professional',
      },
      topCandidates,
      existingSubreddits,
      competitors
    );

    const message = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system: SUGGEST_SUBREDDITS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    // Extract just the JSON object — Haiku sometimes appends extra text after it
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      responseText = responseText.slice(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(responseText);

    // Step 3: Only keep subreddits that were in our discovery results (already verified to exist)
    if (parsed.subreddits?.length) {
      const discoveredNames = new Set(
        discovery.candidates.map((s) => s.name.toLowerCase())
      );
      parsed.subreddits = parsed.subreddits.filter(
        (s: { name: string }) => discoveredNames.has(s.name.toLowerCase())
      );
    }

    // Step 4: Auto-include discovered subreddits with high post search hits
    // that Claude may have overlooked
    if (parsed.subreddits?.length) {
      const aiSuggestedNames = new Set(
        parsed.subreddits.map((s: { name: string }) => s.name.toLowerCase())
      );

      for (const candidate of discovery.candidates) {
        if (aiSuggestedNames.has(candidate.name.toLowerCase())) continue;

        // Auto-include if found via multiple signals or high post search hits
        const sourceCount = Object.values(candidate.sources).filter(Boolean).length;
        const shouldAutoInclude =
          (candidate.postSearchHits >= 5 && sourceCount >= 2) ||
          (body.audience && (() => {
            const audienceKeywords = body.audience
              .toLowerCase()
              .split(/[\s,]+/)
              .filter((w: string) => w.length > 2);
            const text = `${candidate.name} ${candidate.description}`.toLowerCase();
            const matchCount = audienceKeywords.filter((kw: string) => text.includes(kw)).length;
            return matchCount / audienceKeywords.length >= 0.4 && matchCount >= 2;
          })());

        if (shouldAutoInclude) {
          parsed.subreddits.push({
            name: candidate.name,
            reason: candidate.description || 'Matches your target audience keywords',
            approach: 'This subreddit closely matches your target audience.',
            match: 'best',
          });
        }
      }
    }

    // Step 5: Filter out user's existing subreddits from final results
    if (existingSubreddits.length > 0 && parsed.subreddits?.length) {
      const existingNames = new Set(existingSubreddits.map((n) => n.toLowerCase()));
      parsed.subreddits = parsed.subreddits.filter(
        (s: { name: string }) => !existingNames.has(s.name.toLowerCase())
      );
    }

    // Step 6: Enrich suggestions with subscriber + active user counts from discovery data
    const candidateMap = new Map(
      discovery.candidates.map((c) => [c.name.toLowerCase(), c])
    );

    parsed.subreddits = (parsed.subreddits || []).map(
      (s: { name: string; reason: string; approach: string; match: string }) => {
        const candidate = candidateMap.get(s.name.toLowerCase());
        return {
          ...s,
          subscribers: candidate?.subscribers || 0,
          activeUsers: candidate?.activeUsers || null,
        };
      }
    );

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI suggest-subreddits error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest subreddits. Please try again.' },
      { status: 500 }
    );
  }
}
