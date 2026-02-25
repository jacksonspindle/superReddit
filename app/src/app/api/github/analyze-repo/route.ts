import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, HAIKU_MODEL } from '@/lib/ai/client';

export const maxDuration = 60;

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const cleaned = url.trim().replace(/\/+$/,  '');
  const ghMatch = cleaned.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (ghMatch) return { owner: ghMatch[1], repo: ghMatch[2] };
  return null;
}

// Config files that reveal what a project does (checked in priority order)
const CONFIG_FILES = [
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'Gemfile',
  'build.gradle',
  'pom.xml',
  'setup.py',
  'requirements.txt',
  'composer.json',
  'mix.exs',
  'pubspec.yaml',
  'deno.json',
];

// Entry-point patterns ranked by signal value
const ENTRY_PATTERNS = [
  /^src\/(index|main|app)\.[jt]sx?$/,
  /^src\/(lib|core)\/(index|main)\.[jt]sx?$/,
  /^app\/(page|layout)\.[jt]sx?$/,
  /^(index|main|app)\.[jt]sx?$/,
  /^src\/main\.(rs|go|py)$/,
  /^(main|app)\.(rs|go|py|rb)$/,
  /^lib\/[^/]+\.(rb|ex)$/,
  /^cmd\/[^/]+\/main\.go$/,
];

// Files to skip even if they match entry patterns
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'Gemfile.lock', 'composer.lock', 'poetry.lock',
]);

const MAX_FILE_CHARS = 2000;
const MAX_CODE_FILES = 5;

async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  headers: Record<string, string>,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { headers },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.encoding !== 'base64' || !data.content) return null;
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content.length > MAX_FILE_CHARS
      ? content.slice(0, MAX_FILE_CHARS) + '\n[truncated]'
      : content;
  } catch {
    return null;
  }
}

async function fetchFileTree(
  owner: string,
  repo: string,
  defaultBranch: string,
  headers: Record<string, string>,
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tree || [])
      .filter((item: { type: string }) => item.type === 'blob')
      .map((item: { path: string }) => item.path);
  } catch {
    return [];
  }
}

function pickKeyFiles(filePaths: string[]): string[] {
  const picked: string[] = [];

  // 1. Config files (first match only — one config tells us the stack)
  for (const cfg of CONFIG_FILES) {
    const match = filePaths.find(
      (f) => f === cfg || f === `src/${cfg}` || f === `app/${cfg}`,
    );
    if (match) {
      picked.push(match);
      break;
    }
  }

  // 2. Entry points
  for (const pattern of ENTRY_PATTERNS) {
    if (picked.length >= MAX_CODE_FILES) break;
    const match = filePaths.find((f) => pattern.test(f) && !SKIP_FILES.has(f.split('/').pop()!));
    if (match && !picked.includes(match)) {
      picked.push(match);
    }
  }

  // 3. If still under budget, grab route/API files (great signal for web apps)
  const routeFiles = filePaths.filter(
    (f) =>
      (f.includes('/api/') || f.includes('/routes/') || f.includes('/pages/')) &&
      /\.(ts|js|tsx|jsx)$/.test(f) &&
      !SKIP_FILES.has(f.split('/').pop()!),
  );
  for (const rf of routeFiles.slice(0, 3)) {
    if (picked.length >= MAX_CODE_FILES) break;
    if (!picked.includes(rf)) picked.push(rf);
  }

  // 4. If still under budget, grab top-level source files
  const topSource = filePaths.filter(
    (f) =>
      /^(src|lib|app)\/[^/]+\.[jt]sx?$/.test(f) &&
      !picked.includes(f) &&
      !SKIP_FILES.has(f.split('/').pop()!),
  );
  for (const tf of topSource.slice(0, 2)) {
    if (picked.length >= MAX_CODE_FILES) break;
    picked.push(tf);
  }

  return picked;
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
        { status: 404 },
      );
    }

    const repoData = await repoRes.json();

    let readmeContent = '';
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json();
      if (readmeData.content) {
        readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        if (readmeContent.length > 8000) {
          readmeContent = readmeContent.slice(0, 8000) + '\n\n[README truncated]';
        }
      }
    }

    // Always do deep analysis — fetch file tree + key source files
    let codeContext = '';
    const defaultBranch = repoData.default_branch || 'main';
    const filePaths = await fetchFileTree(owner, repo, defaultBranch, ghHeaders);

    if (filePaths.length > 0) {
      const keyFiles = pickKeyFiles(filePaths);

      // Fetch key files in parallel
      const fileContents = await Promise.all(
        keyFiles.map(async (path) => {
          const content = await fetchGitHubFile(owner, repo, path, ghHeaders);
          return content ? { path, content } : null;
        }),
      );

      const validFiles = fileContents.filter(Boolean) as { path: string; content: string }[];

      // Build a truncated file tree overview (top 3 levels)
      const treeSummary = filePaths
        .filter((f) => f.split('/').length <= 3)
        .slice(0, 60)
        .join('\n');

      codeContext = [
        `\n## File Tree (top-level)\n${treeSummary}`,
        ...validFiles.map((f) => `\n## ${f.path}\n\`\`\`\n${f.content}\n\`\`\``),
      ].join('\n');
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
      codeContext,
    ]
      .filter(Boolean)
      .join('\n');

    // Derive a human-friendly name from the repo name
    const friendlyName = repoData.name
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

    const systemPrompt = `You analyze GitHub repositories and extract product information for marketing purposes. You are given repo metadata, the README (if any), the file tree, and key source files. Use ALL of these sources to understand what the project does — the README alone may be auto-generated or incomplete. Analyze dependencies, code structure, entry points, and route definitions to build an accurate picture. Always respond in valid JSON.`;

    const userPrompt = `Analyze this GitHub repository and extract product information I can use for Reddit marketing.

${repoContext}

Use everything provided — metadata, README, file tree, and source code — to understand what this project actually does. The README may be auto-generated or unhelpful, so rely heavily on the code itself:
- Dependencies in config files reveal the tech stack and purpose
- Entry points and route definitions reveal features
- File structure reveals the architecture

Return JSON with these fields:
{
  "productName": "The product/project name (human-friendly, not the repo slug)",
  "productDescription": "A 2-3 sentence description of what this product does and who it's for, based on what the code and docs reveal.",
  "productUrl": "The best URL for the product (homepage if available, otherwise the GitHub URL)",
  "targetAudience": "A brief description of who would use this product (e.g. 'developers building React apps', 'data scientists')"
}`;

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
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

    const err = error as { status?: number; message?: string; error?: { type?: string } };

    if (err?.status === 401 || err?.error?.type === 'authentication_error') {
      return NextResponse.json(
        { error: 'AI service authentication failed. Check the ANTHROPIC_API_KEY.' },
        { status: 500 },
      );
    }

    if (err?.status === 404 || err?.error?.type === 'not_found_error') {
      return NextResponse.json(
        { error: 'AI model not found. The configured model may be unavailable.' },
        { status: 500 },
      );
    }

    if (err?.message?.includes('timed out') || err?.message?.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'Analysis timed out. Please try again.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze repository. Please try again.' },
      { status: 500 },
    );
  }
}
