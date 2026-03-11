import { getAnthropicClient, HAIKU_MODEL } from '@/lib/ai/client';

// ---- Constants ----
const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';
const REDDIT_BASE = 'https://www.reddit.com';

// ---- Types ----

export interface DiscoverySignalSource {
  nameSearch: boolean;
  postSearch: boolean;
  similarApi: boolean;
  sidebar: boolean;
  competitorSearch: boolean;
}

export interface CandidateSubreddit {
  name: string;
  subscribers: number;
  description: string;
  activeUsers: number | null;
  engagementRatio: number | null;
  postSearchHits: number;
  sources: DiscoverySignalSource;
  discoveryScore: number;
}

export interface DiscoveryResult {
  candidates: CandidateSubreddit[];
  expandedKeywords: string[];
}

interface SubredditAccumulator {
  name: string;
  subscribers: number;
  description: string;
  postSearchHits: number;
  sources: DiscoverySignalSource;
}

// ---- Reddit Fetch Helper (no rate limiter — we control concurrency manually) ----

async function fetchRedditJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }
  return response.json();
}

// ---- Signal 1: Global Post Search → Subreddit Frequency ----

async function searchPostsForSubreddits(
  keywords: string[]
): Promise<Map<string, number>> {
  const subredditHits = new Map<string, number>();
  // Limit to 5 keywords, fetch 25 results each (not 100) for speed
  const limited = keywords.slice(0, 5);

  console.log(`[discover] Signal 1: Post search with ${limited.length} keywords`);
  const results = await Promise.allSettled(
    limited.map(async (keyword) => {
      try {
        const url = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(keyword)}&limit=25&sort=relevance&raw_json=1`;
        const json = (await fetchRedditJson(url)) as {
          data: { children: { data: { subreddit: string } }[] };
        };
        for (const child of json.data.children) {
          const sub = child.data.subreddit;
          subredditHits.set(sub, (subredditHits.get(sub) || 0) + 1);
        }
      } catch {
        // silently skip
      }
    })
  );
  console.log(`[discover] Signal 1 done: ${subredditHits.size} unique subreddits from post search`);
  return subredditHits;
}

// ---- Signal 2: Similar Subreddits API ----

async function fetchSimilarSubreddits(
  existingSubreddits: string[]
): Promise<string[]> {
  if (existingSubreddits.length === 0) return [];

  console.log(`[discover] Signal 2: Fetching similar subreddits for ${existingSubreddits.length} existing`);
  try {
    // Fetch fullnames in parallel
    const fullnameResults = await Promise.allSettled(
      existingSubreddits.slice(0, 5).map(async (sub) => {
        const json = (await fetchRedditJson(
          `${REDDIT_BASE}/r/${sub}/about.json`
        )) as { data: { name: string } };
        return json.data?.name;
      })
    );
    const fullnames = fullnameResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
      .map((r) => r.value);

    if (fullnames.length === 0) return [];

    const url = `${REDDIT_BASE}/api/similar_subreddits.json?sr_fullnames=${fullnames.join(',')}&max_recs=15`;
    const json = (await fetchRedditJson(url)) as {
      subreddits?: { name: string }[];
      data?: { children?: { data: { display_name: string } }[] };
    };

    if (json.subreddits) return json.subreddits.map((s) => s.name);
    if (json.data?.children) return json.data.children.map((c) => c.data.display_name);
    return [];
  } catch {
    console.log(`[discover] Signal 2: similar_subreddits endpoint failed (may need OAuth), skipping`);
    return [];
  }
}

// ---- Signal 3: Sidebar Parsing ----

async function parseSidebarsForSubreddits(
  existingSubreddits: string[]
): Promise<string[]> {
  if (existingSubreddits.length === 0) return [];

  console.log(`[discover] Signal 3: Parsing sidebars for ${existingSubreddits.length} subreddits`);
  const mentioned = new Set<string>();

  const results = await Promise.allSettled(
    existingSubreddits.slice(0, 5).map(async (sub) => {
      const json = (await fetchRedditJson(
        `${REDDIT_BASE}/r/${sub}/about.json`
      )) as { data: { description: string } };
      const description = json.data?.description || '';
      const matches = [...description.matchAll(/\/?r\/([a-zA-Z0-9_]{2,21})/g)];
      for (const match of matches) {
        const name = match[1];
        if (name.toLowerCase() !== sub.toLowerCase()) {
          mentioned.add(name);
        }
      }
    })
  );

  console.log(`[discover] Signal 3 done: ${mentioned.size} subreddits from sidebars`);
  return Array.from(mentioned);
}

// ---- Signal 4: Name-Based Search ----

async function searchSubredditsByName(
  terms: string[]
): Promise<{ name: string; subscribers: number; description: string }[]> {
  const results: { name: string; subscribers: number; description: string }[] = [];
  const seen = new Set<string>();
  // Limit to 6 terms for speed
  const limited = terms.slice(0, 6);

  console.log(`[discover] Signal 4: Name search with ${limited.length} terms`);
  await Promise.allSettled(
    limited.map(async (term) => {
      try {
        const url = `${REDDIT_BASE}/subreddits/search.json?q=${encodeURIComponent(term)}&limit=10&raw_json=1`;
        const json = (await fetchRedditJson(url)) as {
          data: {
            children: {
              data: {
                display_name: string;
                subscribers: number;
                public_description: string;
              };
            }[];
          };
        };
        for (const child of json.data.children) {
          const d = child.data;
          const key = d.display_name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              name: d.display_name,
              subscribers: d.subscribers || 0,
              description: (d.public_description || '').slice(0, 200),
            });
          }
        }
      } catch {
        // skip
      }
    })
  );

  console.log(`[discover] Signal 4 done: ${results.length} subreddits from name search`);
  return results;
}

// ---- Signal 5: LLM Keyword Expansion ----

async function expandKeywordsWithLLM(
  productName: string,
  productDescription: string,
  targetAudience: string | null
): Promise<string[]> {
  console.log(`[discover] Signal 5: LLM keyword expansion starting...`);
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Given this product, generate 8-10 Reddit search phrases people would type when they have the problems this product solves.

Product: ${productName}
Description: ${productDescription}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}

Include pain-point phrases, use-case keywords, and audience jargon. Return ONLY JSON:
{"keywords": ["phrase1", "phrase2", ...]}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { keywords: string[] };
      const keywords = parsed.keywords || [];
      console.log(`[discover] Signal 5 done: ${keywords.length} expanded keywords`);
      return keywords;
    }
    return [];
  } catch (err) {
    console.log(`[discover] Signal 5 failed:`, err);
    return [];
  }
}

// ---- Signal 6: Competitor-Based Discovery ----

async function searchCompetitorSubreddits(
  competitors: string[]
): Promise<Map<string, number>> {
  if (competitors.length === 0) return new Map();

  console.log(`[discover] Signal 6: Competitor search for ${competitors.length} competitors`);
  const subredditHits = new Map<string, number>();

  await Promise.allSettled(
    competitors.slice(0, 3).map(async (competitor) => {
      try {
        const url = `${REDDIT_BASE}/search.json?q=${encodeURIComponent(competitor)}&limit=25&sort=relevance&raw_json=1`;
        const json = (await fetchRedditJson(url)) as {
          data: { children: { data: { subreddit: string } }[] };
        };
        for (const child of json.data.children) {
          const sub = child.data.subreddit;
          subredditHits.set(sub, (subredditHits.get(sub) || 0) + 1);
        }
      } catch {
        // skip
      }
    })
  );

  console.log(`[discover] Signal 6 done: ${subredditHits.size} subreddits from competitor search`);
  return subredditHits;
}

// ---- Signal 7: Engagement Enrichment ----
// Only enrich the top candidates (by source signal count) to limit API calls

async function enrichWithEngagement(
  candidates: Map<string, SubredditAccumulator>
): Promise<CandidateSubreddit[]> {
  // Sort by source count to prioritize multi-signal candidates
  const sorted = Array.from(candidates.values()).sort((a, b) => {
    const aCount = Object.values(a.sources).filter(Boolean).length + a.postSearchHits;
    const bCount = Object.values(b.sources).filter(Boolean).length + b.postSearchHits;
    return bCount - aCount;
  });

  // Only fetch about.json for top 5 candidates that lack subscriber data
  const needsEnrichment: SubredditAccumulator[] = [];
  const alreadyHaveData: SubredditAccumulator[] = [];
  for (const acc of sorted) {
    if (needsEnrichment.length < 5 && acc.subscribers === 0) {
      needsEnrichment.push(acc);
    } else {
      alreadyHaveData.push(acc);
    }
  }
  const toEnrich = needsEnrichment;
  const rest = alreadyHaveData;

  console.log(`[discover] Signal 7: Enriching ${toEnrich.length} candidates with engagement data (${rest.length} skipped)`);

  const enriched: CandidateSubreddit[] = [];

  // Fetch in parallel (all at once — Reddit can handle 25 concurrent about.json calls)
  const results = await Promise.allSettled(
    toEnrich.map(async (acc) => {
      try {
        const json = (await fetchRedditJson(
          `${REDDIT_BASE}/r/${acc.name}/about.json`
        )) as {
          data: {
            display_name: string;
            subscribers: number;
            public_description: string;
            active_user_count: number | null;
          };
        };
        const d = json.data;
        const subscribers = d.subscribers || 0;
        const activeUsers = d.active_user_count || null;
        const engagementRatio =
          activeUsers && subscribers > 0 ? activeUsers / subscribers : null;

        return {
          name: d.display_name || acc.name,
          subscribers,
          description: (d.public_description || '').slice(0, 200),
          activeUsers,
          engagementRatio,
          postSearchHits: acc.postSearchHits,
          sources: acc.sources,
          discoveryScore: 0,
        };
      } catch {
        // Use whatever data we have from name search
        return {
          name: acc.name,
          subscribers: acc.subscribers || 0,
          description: acc.description || '',
          activeUsers: null,
          engagementRatio: null,
          postSearchHits: acc.postSearchHits,
          sources: acc.sources,
          discoveryScore: 0,
        };
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      enriched.push(result.value);
    }
  }

  // Add the rest without enrichment
  for (const acc of rest) {
    enriched.push({
      name: acc.name,
      subscribers: acc.subscribers || 0,
      description: acc.description || '',
      activeUsers: null,
      engagementRatio: null,
      postSearchHits: acc.postSearchHits,
      sources: acc.sources,
      discoveryScore: 0,
    });
  }

  console.log(`[discover] Signal 7 done: ${enriched.length} total candidates enriched`);
  return enriched;
}

// ---- Scoring Function ----

function computeDiscoveryScore(candidate: CandidateSubreddit): number {
  let score = 0;

  if (candidate.sources.nameSearch) score += 1;
  if (candidate.sources.postSearch) score += 2;
  if (candidate.sources.similarApi) score += 2;
  if (candidate.sources.sidebar) score += 1.5;
  if (candidate.sources.competitorSearch) score += 2.5;

  if (candidate.engagementRatio !== null) {
    if (candidate.engagementRatio > 0.03) score += 2;
    else if (candidate.engagementRatio > 0.01) score += 1;
  }

  const subs = candidate.subscribers;
  if (subs >= 1000 && subs < 10000) score += 2;
  else if (subs >= 10000 && subs < 50000) score += 1.5;
  else if (subs >= 50000) score += 0.5;

  score += Math.min(candidate.postSearchHits / 5, 2);

  return score;
}

// ---- Main Discovery Function ----

export async function discoverSubreddits(
  product: {
    name: string;
    description: string;
    url?: string;
    audience?: string;
    tone: string;
  },
  existingSubreddits: string[] = [],
  competitors: string[] = []
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  console.log(`[discover] Starting multi-signal discovery for "${product.name}"`);

  // Step 1: LLM keyword expansion + base terms in parallel
  // Build base terms while LLM runs
  const baseTerms: string[] = [];
  if (product.audience) {
    const segments = product.audience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    baseTerms.push(...segments);
    segments.forEach((seg) => {
      const condensed = seg.replace(/\s+/g, '');
      if (condensed !== seg) baseTerms.push(condensed);
    });
  }
  baseTerms.push(product.name);
  const condensedName = product.name.replace(/\s+/g, '');
  if (condensedName !== product.name) baseTerms.push(condensedName);

  // Run discovery signals in parallel (skip LLM keyword expansion — the route
  // already calls Haiku for ranking, so a second LLM call is redundant and slow)
  const [nameSearchResults, postSearchHits, competitorHits] =
    await Promise.all([
      searchSubredditsByName(baseTerms.slice(0, 4)), // Signal 4 (limit terms)
      searchPostsForSubreddits(baseTerms.slice(0, 3)), // Signal 1 (limit keywords)
      searchCompetitorSubreddits(competitors), // Signal 6
    ]);
  const expandedKeywords: string[] = [];

  console.log(`[discover] All signals complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Step 3: Aggregate all candidates into a single map
  const candidates = new Map<string, SubredditAccumulator>();

  function getOrCreate(name: string): SubredditAccumulator {
    const key = name.toLowerCase();
    if (!candidates.has(key)) {
      candidates.set(key, {
        name,
        subscribers: 0,
        description: '',
        postSearchHits: 0,
        sources: {
          nameSearch: false,
          postSearch: false,
          similarApi: false,
          sidebar: false,
          competitorSearch: false,
        },
      });
    }
    return candidates.get(key)!;
  }

  // Signal 1: Post search hits
  for (const [subName, hits] of postSearchHits) {
    const acc = getOrCreate(subName);
    acc.sources.postSearch = true;
    acc.postSearchHits += hits;
  }

  // Signal 4: Name search (also store subscriber/description data)
  for (const sub of nameSearchResults) {
    const acc = getOrCreate(sub.name);
    acc.sources.nameSearch = true;
    acc.subscribers = sub.subscribers;
    acc.description = sub.description;
  }

  // Signal 6: Competitor search
  for (const [subName, hits] of competitorHits) {
    const acc = getOrCreate(subName);
    acc.sources.competitorSearch = true;
    acc.postSearchHits += hits;
  }

  // Remove existing subreddits from candidates
  const existingLower = new Set(existingSubreddits.map((s) => s.toLowerCase()));
  for (const key of candidates.keys()) {
    if (existingLower.has(key)) {
      candidates.delete(key);
    }
  }

  console.log(`[discover] ${candidates.size} unique candidates after aggregation`);

  // Step 4: Enrich top candidates with engagement data (Signal 7)
  const enrichedAll = await enrichWithEngagement(candidates);

  // Filter: minimum 1,000 subscribers
  const enriched = enrichedAll.filter((c) => c.subscribers >= 1000);

  // Step 5: Score and sort
  for (const candidate of enriched) {
    candidate.discoveryScore = computeDiscoveryScore(candidate);
  }

  enriched.sort((a, b) => b.discoveryScore - a.discoveryScore);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[discover] Complete: ${enriched.length} candidates (${enrichedAll.length - enriched.length} filtered <1K subs) in ${totalTime}s`);

  return {
    candidates: enriched.slice(0, 40),
    expandedKeywords,
  };
}
