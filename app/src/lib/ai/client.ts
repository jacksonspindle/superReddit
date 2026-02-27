import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function isAIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export const AI_MODEL = 'claude-opus-4-6';
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const MAX_TOKENS = 4096;
