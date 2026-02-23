import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';

export const maxDuration = 60;

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const cleaned = url.trim().replace(/\/+$/, '');
  const ghMatch = cleaned.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (ghMatch) return { owner: ghMatch[1], repo: ghMatch[2] };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, accessToken } = await request.json();
    if (!repoUrl) {
      return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 });
    }

    const { owner, repo } = parsed;

    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SuperReddit',
    };
    if (accessToken) {
      ghHeaders.Authorization = `Bearer ${accessToken}`;
    }

    // Fetch repo metadata + README in parallel
    const [repoRes, readmeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: ghHeaders }),
    ]);

    if (!repoRes.ok) {
      return NextResponse.json(
        { error: 'Repository not found. Make sure it\u2019s a public repo.' },
        { status: 404 }
      );
    }

    const repoData = await repoRes.json();

    let readmeContent = '';
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json();
      if (readmeData.content) {
        readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        // Truncate very long READMEs
        if (readmeContent.length > 8000) {
          readmeContent = readmeContent.slice(0, 8000) + '\n\n[README truncated]';
        }
      }
    }

    // Build context for Claude
    const repoContext = [
      `Repository: ${repoData.full_name}`,
      repoData.description ? `Description: ${repoData.description}` : '',
      repoData.homepage ? `Homepage: ${repoData.homepage}` : '',
      `Language: ${repoData.language || 'Unknown'}`,
      `Stars: ${repoData.stargazers_count}`,
      repoData.topics?.length ? `Topics: ${repoData.topics.join(', ')}` : '',
      readmeContent ? `\n## README\n${readmeContent}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Derive a human-friendly name from the repo name (e.g. "my-cool-app" → "My Cool App")
    const friendlyName =
      repoData.name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const productUrl = repoData.homepage || repoData.html_url;

    // If no Anthropic key, fall back to GitHub metadata directly
    if (!process.env.ANTHROPIC_API_KEY) {
      const description =
        repoData.description ||
        (readmeContent ? readmeContent.slice(0, 300).split('\n').filter(Boolean)[0] : '') ||
        '';

      return NextResponse.json({
        productName: friendlyName,
        productDescription: description,
        productUrl,
      });
    }

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system: `You analyze GitHub repositories and extract product information for marketing purposes. You MUST base your description strictly on what the README and repo metadata explicitly state. Never generalize, assume, or add categories, markets, or features that are not specifically mentioned in the source material. Always respond in valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this GitHub repository and extract product information I can use for Reddit marketing.

${repoContext}

IMPORTANT: Only describe what is explicitly stated in the README and repo metadata. Do not generalize or broaden the scope. If the README says the product is for one specific market, category, or use case, only mention that one — do not list adjacent or similar markets.

Return JSON with these fields:
{
  "productName": "The product/project name (human-friendly, not the repo slug)",
  "productDescription": "A 2-3 sentence description of what this product does and who it's for. Only include details that are explicitly mentioned in the README. Do not infer or add features, markets, or categories beyond what is stated.",
  "productUrl": "The best URL for the product (homepage if available, otherwise the GitHub URL)"
}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(responseText);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('GitHub analyze error:', error);

    // Surface specific error messages instead of a generic catch-all
    const err = error as { status?: number; message?: string; error?: { type?: string } };

    if (err?.status === 401 || err?.error?.type === 'authentication_error') {
      return NextResponse.json(
        { error: 'AI service authentication failed. Check the ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }

    if (err?.status === 404 || err?.error?.type === 'not_found_error') {
      return NextResponse.json(
        { error: 'AI model not found. The configured model may be unavailable.' },
        { status: 500 }
      );
    }

    if (err?.message?.includes('timed out') || err?.message?.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'Analysis timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze repository. Please try again.' },
      { status: 500 }
    );
  }
}
