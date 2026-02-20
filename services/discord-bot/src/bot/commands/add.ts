import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { inAlertChannel } from '../checks.js';
import { supabase } from '../../db/supabase.js';
import { normalizeSubreddit } from '../../utils/normalize.js';

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Add a keyword or subreddit to monitor')
  .addSubcommand((sub) =>
    sub
      .setName('keyword')
      .setDescription('Add a keyword group to monitor')
      .addStringOption((option) =>
        option
          .setName('phrases')
          .setDescription('Comma-separated phrases to monitor (e.g., "saas,startup,indie hacker")')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('subreddit')
      .setDescription('Add a subreddit to monitor')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Subreddit name (e.g., "entrepreneur" or "r/entrepreneur")')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const config = await inAlertChannel(interaction);
  if (!config) return;

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'keyword') {
    await handleAddKeyword(interaction, config.project_id);
  } else if (subcommand === 'subreddit') {
    await handleAddSubreddit(interaction, config.project_id);
  }
}

async function handleAddKeyword(
  interaction: ChatInputCommandInteraction,
  projectId: string
) {
  const phrasesInput = interaction.options.getString('phrases', true);
  const phrases = phrasesInput
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  if (phrases.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one phrase.',
      ephemeral: true,
    });
    return;
  }

  // Check for duplicate phrases in existing keywords
  const { data: existing } = await supabase
    .from('alert_keywords')
    .select('phrases')
    .eq('project_id', projectId)
    .eq('is_active', true);

  const existingPhrases = new Set(
    (existing || []).flatMap((kw) => kw.phrases.map((p: string) => p.toLowerCase()))
  );

  const duplicates = phrases.filter((p) => existingPhrases.has(p));
  const newPhrases = phrases.filter((p) => !existingPhrases.has(p));

  if (newPhrases.length === 0) {
    await interaction.reply({
      content: `All phrases are already being monitored: ${duplicates.join(', ')}`,
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('alert_keywords').insert({
    project_id: projectId,
    phrases: newPhrases,
  });

  if (error) {
    console.error('Failed to add keyword:', error);
    await interaction.reply({
      content: 'Failed to add keyword. Please try again.',
      ephemeral: true,
    });
    return;
  }

  let message = `Added keyword group: **${newPhrases.join(', ')}**`;
  if (duplicates.length > 0) {
    message += `\nSkipped duplicates: ${duplicates.join(', ')}`;
  }

  await interaction.reply({ content: message, ephemeral: false });
}

async function handleAddSubreddit(
  interaction: ChatInputCommandInteraction,
  projectId: string
) {
  const rawName = interaction.options.getString('name', true);
  const name = normalizeSubreddit(rawName);

  if (!name) {
    await interaction.reply({
      content: 'Please provide a valid subreddit name.',
      ephemeral: true,
    });
    return;
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('alert_subreddits')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', name)
    .single();

  if (existing) {
    await interaction.reply({
      content: `r/${name} is already being monitored.`,
      ephemeral: true,
    });
    return;
  }

  const { error } = await supabase.from('alert_subreddits').insert({
    project_id: projectId,
    name,
  });

  if (error) {
    console.error('Failed to add subreddit:', error);
    await interaction.reply({
      content: 'Failed to add subreddit. Please try again.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Now monitoring **r/${name}**.`,
    ephemeral: false,
  });
}
