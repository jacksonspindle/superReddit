import { NextRequest } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { buildChatSystemPrompt } from '@/lib/ai/prompts';

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
    const systemPrompt = buildChatSystemPrompt(project);

    // Build messages with optional image support
    const formattedMessages = messages.map((m: { role: string; content: string; images?: { dataUrl: string }[] }) => {
      const role = m.role as 'user' | 'assistant';

      // If message has images, use multi-content format
      if (m.images?.length && role === 'user') {
        const content: Array<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } } | { type: 'text'; text: string }> = [];

        for (const img of m.images) {
          // Parse data URL: data:image/png;base64,<data>
          const match = img.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: match[1], data: match[2] },
            });
          }
        }

        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }

        return { role, content };
      }

      return { role, content: m.content };
    });

    const stream = await client.messages.stream({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: formattedMessages,
    });

    // Return streaming response
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
        } catch (error) {
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
    console.error('AI chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
