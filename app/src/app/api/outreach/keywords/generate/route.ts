import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, isAIConfigured, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { KEYWORD_GEN_SYSTEM_PROMPT, buildKeywordGenPrompt } from '@/lib/ai/prompts';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, productDescription, targetAudience } = body;

    if (!productName || !productDescription) {
      return NextResponse.json(
        { error: 'productName and productDescription are required' },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json({ error: 'AI features are not configured.' }, { status: 503 });
    }

    const client = getAnthropicClient();
    const prompt = buildKeywordGenPrompt(productName, productDescription, targetAudience || null);

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: KEYWORD_GEN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(responseText) as { keywords: string[] };
    return NextResponse.json({ keywords: parsed.keywords });
  } catch (error) {
    console.error('Keyword generation error:', error);
    return NextResponse.json({ error: 'Failed to generate keywords' }, { status: 500 });
  }
}
