import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { SUGGEST_SUBREDDITS_SYSTEM_PROMPT, buildSuggestSubredditsPrompt } from '@/lib/ai/prompts';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'web:superreddit:v1.0.0 (by /u/superreddit_app)';

function extractSearchTerms(name: string, description: string, audience?: string): string[] {
  const terms: string[] = [];
  if (audience) {
    const segments = audience.split(',').map((s) => s.trim()).filter((s) => s.length > 2);
    segments.forEach((seg) => terms.push(seg));
    segments.forEach((seg) => {
      const condensed = seg.replace(/\s+/g, '');
      if (condensed !== seg) terms.push(condensed);
    });
  }
  terms.push(name);
  const condensedName = name.replace(/\s+/g, '');
  if (condensedName !== name) terms.push(condensedName);

  const capitalMatches = description.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (capitalMatches) {
    const stopPhrases = new Set(['the', 'this', 'that', 'with', 'from', 'into', 'also']);
    capitalMatches.forEach((m) => {
      if (m.length > 3 && !stopPhrases.has(m.toLowerCase())) terms.push(m);
    });
  }

  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

async function searchRedditSubreddits(query: string) {
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
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Step 1: Search Reddit for subreddits
    const searchTerms = extractSearchTerms(
      project.product_name,
      project.product_description || '',
      project.target_audience || undefined
    );

    const searchResults = await Promise.all(
      searchTerms.map((term) => searchRedditSubreddits(term))
    );

    const seen = new Set<string>();
    const allResults = searchResults
      .flat()
      .filter((s) => {
        const key = s.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return s.subscribers >= 1000;
      });

    const large = allResults.filter((s) => s.subscribers >= 100000).sort((a, b) => b.subscribers - a.subscribers);
    const medium = allResults.filter((s) => s.subscribers >= 5000 && s.subscribers < 100000).sort((a, b) => b.subscribers - a.subscribers);
    const niche = allResults.filter((s) => s.subscribers >= 1000 && s.subscribers < 5000).sort((a, b) => b.subscribers - a.subscribers);

    const discoveredSubreddits = [
      ...niche,
      ...medium.slice(0, 8),
      ...large.slice(0, 6),
    ].slice(0, 25);

    // Step 2: Ask Claude for best subreddits
    const client = getAnthropicClient();
    const prompt = buildSuggestSubredditsPrompt(
      {
        name: project.product_name,
        description: project.product_description || '',
        url: project.product_url || '',
        audience: project.target_audience || '',
        tone: project.tone || 'Professional',
      },
      discoveredSubreddits,
      []
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: SUGGEST_SUBREDDITS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    let subreddits: { name: string; reason: string; approach: string; match: string }[] = [];

    if (textContent && textContent.type === 'text') {
      let responseText = textContent.text.trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(responseText);

      if (parsed.subreddits?.length) {
        // Verify AI-suggested subreddits exist
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

        subreddits = parsed.subreddits.filter(
          (s: { name: string }) => !nonExistent.has(s.name.toLowerCase())
        );
      }
    }

    // Step 3: Auto-select top subreddits (best + good match, up to 5)
    const autoSelect = subreddits
      .filter((s) => s.match === 'best' || s.match === 'good')
      .slice(0, 5);

    const subNames = autoSelect.map((s) => s.name);

    // Step 4: Build canvas state (same as onboarding)
    const productNodeId = 'product-node';
    const writingStyles = project.writing_styles || [];

    const nodes = [
      {
        id: productNodeId,
        type: 'product',
        position: { x: 0, y: Math.max(0, (subNames.length * 420 - 300) / 2) },
        data: {
          type: 'product',
          name: project.product_name,
          description: project.product_description || '',
          url: project.product_url || '',
          audience: project.target_audience || '',
          tone: project.tone || 'Professional',
          writingStyles,
        },
      },
      ...subNames.map((subName, i) => ({
        id: `subreddit-${subName}`,
        type: 'subreddit',
        position: { x: 420, y: i * 420 },
        data: {
          type: 'subreddit',
          name: subName,
          subscribers: null,
          description: null,
          posts: [],
          loading: false,
          sortBy: 'hot',
        },
      })),
    ];

    const edges = subNames.map((subName) => ({
      id: `e-${productNodeId}-subreddit-${subName}`,
      source: productNodeId,
      target: `subreddit-${subName}`,
      animated: true,
    }));

    // Step 5: Save canvas state
    await supabase.from('canvas_states').upsert({
      project_id: projectId,
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 0.8 },
    }, { onConflict: 'project_id' });

    // Step 6: Add subreddits to subreddits table
    if (subNames.length > 0) {
      await supabase.from('subreddits').insert(
        subNames.map((name) => ({
          project_id: projectId,
          name,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      subreddits: subNames,
      totalSuggestions: subreddits.length,
    });
  } catch (error) {
    console.error('Project bootstrap error:', error);
    return NextResponse.json({ error: 'Failed to bootstrap project' }, { status: 500 });
  }
}
