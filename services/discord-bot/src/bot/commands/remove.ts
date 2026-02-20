import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { inAlertChannel } from '../checks.js';
import { supabase } from '../../db/supabase.js';
import { parseDuration, formatDuration } from '../../utils/duration.js';
import { normalizeText } from '../../utils/normalize.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a phrase from keyword monitoring')
  .addStringOption((option) =>
    option
      .setName('keyword')
      .setDescription('The phrase to remove')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('duration')
      .setDescription('Temporary silence duration (e.g., "20m", "1h", "2d"). Omit for permanent removal.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const config = await inAlertChannel(interaction);
  if (!config) return;

  const phrase = normalizeText(interaction.options.getString('keyword', true));
  const durationStr = interaction.options.getString('duration');

  // Find keyword groups containing this phrase
  const { data: keywords, error } = await supabase
    .from('alert_keywords')
    .select('*')
    .eq('project_id', config.project_id)
    .eq('is_active', true);

  if (error || !keywords?.length) {
    await interaction.reply({
      content: `No active keywords found for this project.`,
      ephemeral: true,
    });
    return;
  }

  // Find the keyword group that contains this phrase
  const targetKeyword = keywords.find((kw) =>
    kw.phrases.some(
      (p: string) => normalizeText(p) === phrase
    )
  );

  if (!targetKeyword) {
    await interaction.reply({
      content: `Phrase "${phrase}" not found in any active keyword group.`,
      ephemeral: true,
    });
    return;
  }

  if (durationStr) {
    // Temporary silence: remove phrase from array and schedule restore
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      await interaction.reply({
        content: `Invalid duration format. Use something like "20m", "1h", or "2d".`,
        ephemeral: true,
      });
      return;
    }

    const restoreAt = new Date(Date.now() + durationMs);

    // Remove phrase from the keyword's phrases array
    const updatedPhrases = targetKeyword.phrases.filter(
      (p: string) => normalizeText(p) !== phrase
    );

    await supabase
      .from('alert_keywords')
      .update({ phrases: updatedPhrases })
      .eq('id', targetKeyword.id);

    // Write silenced_phrases row for restart recovery
    await supabase
      .from('silenced_phrases')
      .insert({
        keyword_id: targetKeyword.id,
        phrase,
        restore_at: restoreAt.toISOString(),
      });

    // Schedule in-memory restore via setTimeout
    scheduleRestore(targetKeyword.id, phrase, durationMs);

    await interaction.reply({
      content: `Silenced "${phrase}" for ${formatDuration(durationMs)}. It will be restored at <t:${Math.floor(restoreAt.getTime() / 1000)}:R>.`,
      ephemeral: false,
    });
  } else {
    // Permanent removal: remove phrase from array
    const updatedPhrases = targetKeyword.phrases.filter(
      (p: string) => normalizeText(p) !== phrase
    );

    if (updatedPhrases.length === 0) {
      // If no phrases left, deactivate the entire keyword group
      await supabase
        .from('alert_keywords')
        .update({ is_active: false, phrases: updatedPhrases })
        .eq('id', targetKeyword.id);
    } else {
      await supabase
        .from('alert_keywords')
        .update({ phrases: updatedPhrases })
        .eq('id', targetKeyword.id);
    }

    await interaction.reply({
      content: `Permanently removed "${phrase}" from monitoring.`,
      ephemeral: false,
    });
  }
}

/**
 * Schedule a phrase to be restored after a timeout.
 * Also used by restart recovery in client.ts.
 */
export function scheduleRestore(keywordId: string, phrase: string, delayMs: number) {
  setTimeout(async () => {
    try {
      // Re-add phrase to keyword
      const { data: keyword } = await supabase
        .from('alert_keywords')
        .select('phrases')
        .eq('id', keywordId)
        .single();

      if (keyword && !keyword.phrases.includes(phrase)) {
        await supabase
          .from('alert_keywords')
          .update({ phrases: [...keyword.phrases, phrase] })
          .eq('id', keywordId);
      }

      // Remove the silenced_phrases row
      await supabase
        .from('silenced_phrases')
        .delete()
        .eq('keyword_id', keywordId)
        .eq('phrase', phrase);

      console.log(`Restored phrase "${phrase}" to keyword ${keywordId}`);
    } catch (err) {
      console.error(`Failed to restore phrase "${phrase}":`, err);
    }
  }, delayMs);
}
