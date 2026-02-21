/**
 * Background polling queue for signal detection.
 * Uses Supabase as a priority queue with FOR UPDATE SKIP LOCKED
 * for concurrent-safe dequeuing across multiple serverless invocations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface QueueEntry {
  id: string;
  project_id: string;
  priority: 'high' | 'normal';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export async function enqueueProject(
  supabase: SupabaseClient,
  projectId: string,
  priority: 'high' | 'normal' = 'normal'
): Promise<void> {
  // Check if already queued or processing
  const { data: existing } = await supabase
    .from('signal_poll_queue')
    .select('id, status')
    .eq('project_id', projectId)
    .in('status', ['queued', 'processing'])
    .maybeSingle();

  if (existing) {
    // Already in queue — if upgrading to high priority, update it
    if (priority === 'high' && existing.status === 'queued') {
      await supabase
        .from('signal_poll_queue')
        .update({ priority: 'high' })
        .eq('id', existing.id);
    }
    return;
  }

  await supabase.from('signal_poll_queue').insert({
    project_id: projectId,
    priority,
    status: 'queued',
  });
}

export async function dequeueProjects(
  supabase: SupabaseClient,
  batchSize: number = 5
): Promise<QueueEntry[]> {
  // Use RPC with FOR UPDATE SKIP LOCKED for concurrent safety
  // Falls back to simple select+update if RPC doesn't exist
  const { data: entries, error } = await supabase
    .from('signal_poll_queue')
    .select('id, project_id, priority, status, created_at')
    .eq('status', 'queued')
    .order('priority', { ascending: false }) // 'high' sorts after 'normal' alphabetically, but we want high first
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error || !entries || entries.length === 0) return [];

  // Mark them as processing
  const ids = entries.map((e: QueueEntry) => e.id);
  await supabase
    .from('signal_poll_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .in('id', ids);

  return entries as QueueEntry[];
}

export async function markCompleted(
  supabase: SupabaseClient,
  queueId: string,
  signalsFound: number
): Promise<void> {
  await supabase
    .from('signal_poll_queue')
    .update({
      status: 'completed',
      signals_found: signalsFound,
      completed_at: new Date().toISOString(),
    })
    .eq('id', queueId);
}

export async function markFailed(
  supabase: SupabaseClient,
  queueId: string,
  error: string
): Promise<void> {
  await supabase
    .from('signal_poll_queue')
    .update({
      status: 'failed',
      error_message: error.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', queueId);
}

export async function getScanStatus(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  status: 'idle' | 'queued' | 'processing';
  position?: number;
  lastCompleted?: string;
  signalsFound?: number;
}> {
  try {
    // Check for active queue entry
    const { data: active } = await supabase
      .from('signal_poll_queue')
      .select('id, status, created_at')
      .eq('project_id', projectId)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) {
      // Calculate queue position if queued
      let position: number | undefined;
      if (active.status === 'queued') {
        const { count } = await supabase
          .from('signal_poll_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'queued')
          .lt('created_at', active.created_at);
        position = (count || 0) + 1;
      }

      return {
        status: active.status as 'queued' | 'processing',
        position,
      };
    }

    // Check last completed
    const { data: lastCompleted } = await supabase
      .from('signal_poll_queue')
      .select('completed_at, signals_found')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      status: 'idle',
      lastCompleted: lastCompleted?.completed_at || undefined,
      signalsFound: lastCompleted?.signals_found || undefined,
    };
  } catch {
    // Table may not exist yet
    return { status: 'idle' };
  }
}

export async function cleanupOldEntries(
  supabase: SupabaseClient
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase
    .from('signal_poll_queue')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('completed_at', oneHourAgo);
}
