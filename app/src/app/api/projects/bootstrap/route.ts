import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { SUGGEST_SUBREDDITS_SYSTEM_PROMPT, buildSuggestSubredditsPrompt } from '@/lib/ai/prompts';
import { discoverSubreddits } from '@/lib/reddit/discover';
import { fetchSubredditInfo } from '@/lib/reddit/fetcher';

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

    // Step 1: Run multi-signal discovery
    const discovery = await discoverSubreddits(
      {
        name: project.product_name,
        description: project.product_description || '',
        url: project.product_url || undefined,
        audience: project.target_audience || undefined,
        tone: project.tone || 'Professional',
      },
      [],
      []
    );

    // Step 2: Ask Claude for best subreddits using enriched candidates
    const client = getAnthropicClient();
    const prompt = buildSuggestSubredditsPrompt(
      {
        name: project.product_name,
        description: project.product_description || '',
        url: project.product_url || '',
        audience: project.target_audience || '',
        tone: project.tone || 'Professional',
      },
      discovery.candidates,
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
        const discoveredNames = new Set(
          discovery.candidates.map((s) => s.name.toLowerCase())
        );
        const toVerify = parsed.subreddits.filter(
          (s: { name: string }) => !discoveredNames.has(s.name.toLowerCase())
        );

        const verifications = await Promise.all(
          toVerify.map(async (s: { name: string }) => ({
            name: s.name,
            exists: (await fetchSubredditInfo(s.name)) !== null,
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
