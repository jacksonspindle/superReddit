import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { supabase } from '../db/supabase.js';
import { scheduleRestore } from './commands/remove.js';

import * as helpCommand from './commands/help.js';
import * as removeCommand from './commands/remove.js';
import * as addCommand from './commands/add.js';

interface Command {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();
commands.set(helpCommand.data.name, helpCommand);
commands.set(removeCommand.data.name, removeCommand);
commands.set(addCommand.data.name, addCommand);

export function createBot(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Bot ready as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} guild(s)`);
    await recoverSilencedPhrases();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      console.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);
      const reply = {
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  return client;
}

/**
 * Restart recovery: check silenced_phrases and reschedule restores.
 * - Expired ones: restore immediately
 * - Future ones: schedule via setTimeout
 */
async function recoverSilencedPhrases() {
  const { data: silenced, error } = await supabase
    .from('silenced_phrases')
    .select('*');

  if (error || !silenced?.length) {
    if (silenced?.length === 0) console.log('No silenced phrases to recover.');
    return;
  }

  console.log(`Recovering ${silenced.length} silenced phrase(s)...`);
  const now = Date.now();

  for (const entry of silenced) {
    const restoreAt = new Date(entry.restore_at).getTime();
    const remaining = restoreAt - now;

    if (remaining <= 0) {
      // Expired: restore immediately
      scheduleRestore(entry.keyword_id, entry.phrase, 0);
    } else {
      // Future: schedule restore
      scheduleRestore(entry.keyword_id, entry.phrase, remaining);
    }
  }
}
