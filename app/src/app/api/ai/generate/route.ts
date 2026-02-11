import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { GENERATE_SYSTEM_PROMPT, buildGeneratePrompt } from '@/lib/ai/prompts';
import type { GenerateRequest, GenerateResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.productContext?.name || !body.productContext?.description) {
      return NextResponse.json(
        { error: 'Product name and description are required' },
        { status: 400 }
      );
    }

    if (!body.examplePosts?.length) {
      return NextResponse.json(
        { error: 'At least one example post is required' },
        { status: 400 }
      );
    }

    const client = getAnthropicClient();
    const prompt = buildGeneratePrompt(
      {
        ...body.productContext,
        writingStyles: body.productContext.writingStyles,
      },
      body.examplePosts,
      body.count || 2
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed: GenerateResponse = JSON.parse(responseText);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate posts. Please try again.' },
      { status: 500 }
    );
  }
}
