/**
 * One-time slash command registration script.
 * Run: npx tsx src/bot/commands/deploy.ts
 */
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

import { data as helpCommand } from './help.js';
import { data as removeCommand } from './remove.js';
import { data as addCommand } from './add.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
}

const commands = [
  helpCommand.toJSON(),
  removeCommand.toJSON(),
  addCommand.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    console.log(`Registering ${commands.length} slash commands...`);

    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
}

deploy();
