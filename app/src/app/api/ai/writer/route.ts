import { NextRequest } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';

const WRITER_SYSTEM_PROMPT = `You are an expert Reddit post writer. You help users draft authentic, high-performing Reddit posts that promote their product naturally.

Your writing approach:
- Lead with VALUE — a story, insight, tip, or question — before any product mention
- Sound like a real Reddit user, not a marketer
- Match the culture and norms of the target subreddit
- Use Reddit-native markdown formatting
- NEVER use obvious marketing language ("revolutionary", "game-changer", "check out", "amazing tool")
- Include authentic details, personal anecdotes, and specific numbers when possible
- Admit flaws or limitations to build trust
- Ask questions to encourage discussion

When the user asks you to write a post:
1. Ask clarifying questions if needed (target subreddit, angle, tone)
2. Write the full post with a title and body
3. Explain your strategy briefly afterward

When giving feedback on drafts:
- Be specific about what works and what doesn't
- Suggest concrete rewrites, not vague advice
- Flag anything that sounds too promotional or could get flagged as spam

Format posts clearly with:
**Title:** [the title]

**Body:**
[the full post body in Reddit markdown]

**Strategy:** [1-2 sentence explanation of the approach]`;

function buildWriterSystemPrompt(project?: {
  name: string;
  productName: string;
  productDescription: string;
  targetAudience: string | null;
  tone: string;
  writingStyles?: string[];
}): string {
  if (!project) return WRITER_SYSTEM_PROMPT;

  return `${WRITER_SYSTEM_PROMPT}

## Product Context
- **Product:** ${project.productName}
- **Description:** ${project.productDescription}
${project.targetAudience ? `- **Target Audience:** ${project.targetAudience}` : ''}
- **Tone:** ${project.tone}

Use this product context in every post you write. The user should not have to re-explain their product.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, project } = body;

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = getAnthropicClient();
    const systemPrompt = buildWriterSystemPrompt(project);

    const stream = await client.messages.stream({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI writer error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process message.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
