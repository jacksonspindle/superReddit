import 'dotenv/config';
import { createBot } from './bot/client.js';
import { startPoller } from './services/poller.js';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_BOT_TOKEN environment variable');
}

async function main() {
  console.log('Starting SuperReddit Discord Bot...');

  // Start the Discord bot
  const bot = createBot();
  await bot.login(token);

  // Start the Reddit polling service
  startPoller();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    bot.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    bot.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
