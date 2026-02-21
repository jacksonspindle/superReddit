/**
 * Shared L2 cache backed by Supabase.
 * Sits between the in-memory L1 cache (fetcher.ts) and the Reddit/PullPush APIs.
 * Multiple users/serverless instances share cached search results, reducing
 * redundant API calls against the shared IP rate limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedditPost } from '@/types';
import { createHash } from 'crypto';

const DEFAULT_TTL_MINUTES = 15;

export function buildCacheKey(
  subreddits: string[],
  keywords: string[],
  timeFilter: string,
  source: string = 'reddit'
): string {
  const normalized = [
    source,
    [...subreddits].sort().join('+'),
    [...keywords].sort().map((k) => k.toLowerCase().trim()).join('|'),
    timeFilter,
  ].join('::');

  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export async function getCachedSearch(
  supabase: SupabaseClient,
  cacheKey: string
): Promise<RedditPost[] | null> {
  try {
    const { data, error } = await supabase
      .from('signal_search_cache')
      .select('posts, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
      // Lazily clean up expired entry
      await supabase
        .from('signal_search_cache')
        .delete()
        .eq('cache_key', cacheKey);
      return null;
    }

    return data.posts as RedditPost[];
  } catch {
    // Table may not exist yet
    return null;
  }
}

export async function setCachedSearch(
  supabase: SupabaseClient,
  cacheKey: string,
  posts: RedditPost[],
  source: string = 'reddit',
  ttlMinutes: number = DEFAULT_TTL_MINUTES
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    await supabase
      .from('signal_search_cache')
      .upsert(
        {
          cache_key: cacheKey,
          posts: JSON.parse(JSON.stringify(posts)),
          source,
          expires_at: expiresAt,
        },
        { onConflict: 'cache_key' }
      );
  } catch {
    // Cache write failure is non-fatal — just log and continue
    console.warn('Failed to write to signal_search_cache');
  }
}
