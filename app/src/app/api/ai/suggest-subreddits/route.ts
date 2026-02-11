import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { SUGGEST_SUBREDDITS_SYSTEM_PROMPT, buildSuggestSubredditsPrompt } from '@/lib/ai/prompts';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';

// Extract search terms from product info for Reddit subreddit search
// Target audience terms come first since they describe the actual communities we're looking for
function extractSearchTerms(name: string, description: string, audience?: string): string[] {
  const terms: string[] = [];

  // Target audience is the highest priority — these are the communities we want to find
  if (audience) {
    // Split by commas to get each audience segment, then use each as a search term
    const segments = audience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    segments.forEach((seg) => terms.push(seg));

    // Also create condensed no-space versions of audience segments (matches subreddit names like "OnePieceTCGFinance")
    segments.forEach((seg) => {
      const condensed = seg.replace(/\s+/g, '');
      if (condensed !== seg) terms.push(condensed);
    });
  }

  // Product name + condensed version
  terms.push(name);
  const condensedName = name.replace(/\s+/g, '');
  if (condensedName !== name) terms.push(condensedName);

  // Extract capitalized phrases from description (proper nouns, brand names, etc.)
  const capitalMatches = description.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (capitalMatches) {
    const stopPhrases = new Set(['the', 'this', 'that', 'with', 'from', 'into', 'also']);
    capitalMatches.forEach((m) => {
      if (m.length > 3 && !stopPhrases.has(m.toLowerCase())) {
        terms.push(m);
      }
    });
  }

  // Dedupe (case-insensitive) and take up to 15 terms
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

async function searchRedditSubreddits(query: string): Promise<{ name: string; subscribers: number; description: string }[]> {
  try {
    const url = `${REDDIT_BASE}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=10&raw_json=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data: { children: Array<{ data: Record<string, unknown> }> } };
    return json.data.children.map((c) => ({
      name: c.data.display_name as string,
      subscribers: (c.data.subscribers as number) || 0,
      description: ((c.data.public_description as string) || '').slice(0, 200),
    }));
  } catch {
    return [];
  }
}

async function verifySubredditExists(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${REDDIT_BASE}/r/${name}/about.json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: 'Product name and description are required' },
        { status: 400 }
      );
    }

    // Step 1: Search Reddit for real subreddits
    // If user already picked subreddits, use those as primary search terms to find related communities
    const existingSubreddits: string[] = body.existingSubreddits || [];
    const searchTerms = existingSubreddits.length > 0
      ? [...existingSubreddits, ...extractSearchTerms(body.name, body.description, body.audience).slice(0, 5)]
      : extractSearchTerms(body.name, body.description, body.audience);

    const searchResults = await Promise.all(
      searchTerms.map((term) => searchRedditSubreddits(term))
    );

    // Dedupe all results and exclude user's existing picks
    const existingNames = new Set(existingSubreddits.map((n) => n.toLowerCase()));
    const seen = new Set<string>();
    const allResults = searchResults
      .flat()
      .filter((s) => {
        const key = s.name.toLowerCase();
        if (seen.has(key)) return false;
        if (existingNames.has(key)) return false;
        seen.add(key);
        return s.subscribers >= 1000;
      });

    // Split into size buckets to ensure a mix of large, medium, and niche subreddits
    const large = allResults.filter((s) => s.subscribers >= 100000).sort((a, b) => b.subscribers - a.subscribers);
    const medium = allResults.filter((s) => s.subscribers >= 5000 && s.subscribers < 100000).sort((a, b) => b.subscribers - a.subscribers);
    const niche = allResults.filter((s) => s.subscribers >= 1000 && s.subscribers < 5000).sort((a, b) => b.subscribers - a.subscribers);

    // Take a balanced mix: up to 6 large, 8 medium, all niche (these are the most valuable)
    const discoveredSubreddits = [
      ...niche,
      ...medium.slice(0, 8),
      ...large.slice(0, 6),
    ].slice(0, 25);

    // Step 2: Ask Claude — feed it the real subreddits so it can pick the best ones + add its own
    const client = getAnthropicClient();
    const prompt = buildSuggestSubredditsPrompt(
      {
        name: body.name,
        description: body.description,
        url: body.url,
        audience: body.audience,
        tone: body.tone || 'Professional',
      },
      discoveredSubreddits,
      existingSubreddits
    );

    const message = await client.messages.create({
      model: AI_MODEL,
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

    const parsed = JSON.parse(responseText);

    // Step 3: Verify AI-suggested subreddits actually exist on Reddit
    if (parsed.subreddits?.length) {
      const discoveredNames = new Set(discoveredSubreddits.map((s) => s.name.toLowerCase()));
      const toVerify = parsed.subreddits.filter(
        (s: { name: string }) => !discoveredNames.has(s.name.toLowerCase())
      );

      const verifications = await Promise.all(
        toVerify.map(async (s: { name: string }) => ({
          name: s.name,
          exists: await verifySubredditExists(s.name),
        }))
      );

      const nonExistent = new Set(
        verifications.filter((v) => !v.exists).map((v) => v.name.toLowerCase())
      );

      parsed.subreddits = parsed.subreddits.filter(
        (s: { name: string }) => !nonExistent.has(s.name.toLowerCase())
      );
    }

    // Step 4: Auto-include discovered subreddits that strongly match the target audience
    // This catches subreddits Claude overlooked despite obvious keyword matches
    if (body.audience && parsed.subreddits?.length) {
      const audienceKeywords = body.audience
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((w: string) => w.length > 2);

      const aiSuggestedNames = new Set(
        parsed.subreddits.map((s: { name: string }) => s.name.toLowerCase())
      );

      for (const sub of discoveredSubreddits) {
        if (aiSuggestedNames.has(sub.name.toLowerCase())) continue;

        // Check if the subreddit's name or description contains audience keywords
        const text = `${sub.name} ${sub.description}`.toLowerCase();
        const matchCount = audienceKeywords.filter((kw: string) => text.includes(kw)).length;
        const matchRatio = matchCount / audienceKeywords.length;

        // If more than 40% of audience keywords appear in the subreddit, auto-include it
        if (matchRatio >= 0.4 && matchCount >= 2) {
          parsed.subreddits.push({
            name: sub.name,
            reason: sub.description || `Matches your target audience keywords`,
            approach: 'This subreddit closely matches your target audience.',
            match: 'best',
          });
        }
      }
    }

    // Step 5: Filter out user's existing subreddits from final results (in case Claude included them)
    if (existingSubreddits.length > 0 && parsed.subreddits?.length) {
      parsed.subreddits = parsed.subreddits.filter(
        (s: { name: string }) => !existingNames.has(s.name.toLowerCase())
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI suggest-subreddits error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest subreddits. Please try again.' },
      { status: 500 }
    );
  }
}
