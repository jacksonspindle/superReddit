import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropicClient, isAIConfigured, HAIKU_MODEL } from '@/lib/ai/client';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: project } = await supabase
      .from('projects')
      .select('product_name, product_description, product_url, target_audience')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!isAIConfigured()) {
      return NextResponse.json({ error: 'AI features are not configured.' }, { status: 503 });
    }

    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a marketing strategist. Based on this product and target audience, generate targeting suggestions.

Product: ${project.product_name}
Description: ${project.product_description || 'N/A'}
URL: ${project.product_url || 'N/A'}
Target Audience: ${project.target_audience || 'N/A'}

Generate JSON with exactly these fields:
- "activities": 5-7 specific activities the target audience does regularly (things they actively do, buy, track, research — be specific to this niche)
- "pain_points": 5-7 specific problems/frustrations the target audience experiences that this product could solve
- "customer_goals": 4-6 specific goals/outcomes the target audience is trying to achieve

Be very specific to this product's niche. Avoid generic items. Each item should be a short phrase (3-8 words).

Respond with ONLY valid JSON, no markdown fences.`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    let parsed;
    try {
      let text = textContent.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({
      activities: parsed.activities || [],
      pain_points: parsed.pain_points || [],
      customer_goals: parsed.customer_goals || [],
    });
  } catch (error) {
    console.error('Suggest targeting error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
