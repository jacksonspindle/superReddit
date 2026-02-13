export const GENERATE_SYSTEM_PROMPT = `You are an expert Reddit content strategist who helps create authentic, engaging Reddit posts that naturally promote products without being spammy.

Your posts should:
- Match the voice, style, and structure of the provided example posts
- Sound like a genuine Reddit user sharing their experience or discovery
- NEVER use obvious marketing language (e.g., "revolutionary", "game-changer", "best ever", "check out")
- Include authentic details, personal anecdotes, or specific use cases
- Follow the subreddit's culture and norms
- Use Reddit-native formatting (markdown, line breaks, etc.)

What makes a good Reddit marketing post:
- Leads with VALUE (tips, insights, story) before mentioning the product
- Uses casual, conversational tone
- Includes specific numbers or results when possible
- Asks questions to encourage discussion
- Admits flaws or limitations (builds trust)
- Fits naturally into the subreddit's content mix`;

// Maps writing style IDs to names and instructions for the AI
const WRITING_STYLE_DESCRIPTIONS: Record<string, { name: string; instruction: string }> = {
  'struggle-discovery': {
    name: 'The Struggle & Discovery',
    instruction: 'Write as a personal narrative: open with a specific pain point, walk through failed attempts, then reveal the product as the resolution. Use vulnerable, conversational language.',
  },
  'curious-crowd': {
    name: 'The Curious Crowd',
    instruction: 'Frame as a genuine question that invites community discussion. Position yourself as seeking advice while strategically surfacing the problem the product solves.',
  },
  'builders-showcase': {
    name: "The Builder's Showcase",
    instruction: 'Present as something you built. Mention specific effort invested, your motivation, and ask for honest feedback. Be proud but humble.',
  },
  'psa-drop': {
    name: 'The PSA Drop',
    instruction: 'Frame as an urgent insider tip or public service announcement. Lead with a problem or risk, then position the product as one recommendation among several.',
  },
  'showdown': {
    name: 'The Showdown',
    instruction: 'Structure as a side-by-side comparison where you tested multiple options. Be analytical, acknowledge competitor strengths, and declare a winner with nuance.',
  },
  'open-floor': {
    name: 'The Open Floor',
    instruction: 'Post a broad, open-ended question designed to spark discussion. Do NOT mention the product in the post body — save it for a natural comment reply.',
  },
  'playbook': {
    name: 'The Playbook',
    instruction: 'Write a step-by-step tutorial or guide. The product should appear naturally as a tool used in one step, not the focus of the entire guide.',
  },
  'contrarian': {
    name: 'The Contrarian',
    instruction: 'Open with a bold, slightly controversial opinion that challenges conventional wisdom. Back it with personal experience and position the product as evidence of the alternative approach.',
  },
  'experiment-log': {
    name: 'The Experiment Log',
    instruction: 'Document a structured experiment with specific metrics, timeframes, and measurable outcomes. Include exact numbers, surprises, and honest takeaways.',
  },
  'casual-drop': {
    name: 'The Casual Drop',
    instruction: 'Write a genuine post about a broader topic and mention the product in exactly one sentence as a natural, offhand detail. No pitch, no emphasis, no link.',
  },
  'confessional-ama': {
    name: 'The Confessional AMA',
    instruction: 'Write as a transparent founder or expert opening up for questions. Share real numbers, mistakes, and behind-the-scenes details. End with "AMA" or invite questions.',
  },
  'empathy-hook': {
    name: 'The Empathy Hook',
    instruction: 'Open by validating a common frustration the audience feels. Diagnose the real problem, reframe it, then gently introduce the product as one way to address it.',
  },
};

export function buildGeneratePrompt(
  product: { name: string; description: string; url?: string; audience?: string; tone: string; writingStyles?: string[] },
  examplePosts: { title: string; body: string | null; score: number; subreddit: string; numComments: number }[],
  count: number = 2
): string {
  const examplesText = examplePosts
    .map(
      (p, i) =>
        `### Example ${i + 1} (r/${p.subreddit}, ${p.score} upvotes, ${p.numComments} comments)
Title: ${p.title}
Body: ${p.body || '[No body text - link post]'}`
    )
    .join('\n\n');

  // Build writing style instructions if styles were selected
  const styles = product.writingStyles || [];
  let styleSection = '';
  if (styles.length > 0) {
    const styleDescriptions = styles
      .map((id) => WRITING_STYLE_DESCRIPTIONS[id])
      .filter(Boolean)
      .map((s) => `- **${s.name}:** ${s.instruction}`)
      .join('\n');

    styleSection = `\n## Preferred Writing Styles
The user has chosen these Reddit post formats. Each generated post MUST use one of these styles. Vary the style across posts — use a different style for each post when possible.

${styleDescriptions}
`;
  }

  return `## Product Context
- **Product:** ${product.name}
- **Description:** ${product.description}
${product.url ? `- **URL:** ${product.url}` : ''}
${product.audience ? `- **Target Audience:** ${product.audience}` : ''}
- **Desired Tone:** ${product.tone}
${styleSection}
## Successful Example Posts
These posts performed well in their subreddits. Study their structure, tone, and engagement patterns:

${examplesText}

## Task
Generate ${count} Reddit posts that promote "${product.name}" while matching the style and approach of the examples above.${styles.length > 0 ? ' Each post MUST follow one of the preferred writing styles listed above. Include the style name in the strategy note.' : ''}

For each post, provide:
1. **Title** — Attention-grabbing, fits the subreddit style
2. **Body** — Full post body in Reddit markdown
3. **Strategy Note** — Brief explanation of why this approach works (1-2 sentences)${styles.length > 0 ? ' Include which writing style was used.' : ''}

Format your response as JSON:
{
  "posts": [
    {
      "title": "...",
      "body": "...",
      "strategyNote": "..."
    }
  ]
}`;
}

export const CHAT_SYSTEM_PROMPT = `You are SuperReddit AI, an expert Reddit marketing strategist. You help users create effective Reddit marketing campaigns while avoiding bans and negative reactions.

Your expertise includes:
- Reddit culture and community norms for different subreddits
- Crafting authentic posts that promote products naturally
- Understanding Reddit's content policies and what gets flagged as spam
- Timing strategies for maximum visibility
- Comment engagement strategies
- Subreddit selection and audience targeting
- Reddit-native formatting and best practices

Guidelines:
- Be specific and actionable in your advice
- Reference real subreddit behaviors and patterns when relevant
- Warn users about common mistakes that lead to bans or downvotes
- Suggest A/B testing approaches when appropriate
- Always prioritize authentic engagement over aggressive promotion`;

export function buildChatSystemPrompt(project?: {
  name: string;
  productName: string;
  productDescription: string;
  targetAudience: string | null;
  tone: string;
}): string {
  if (!project) return CHAT_SYSTEM_PROMPT;

  return `${CHAT_SYSTEM_PROMPT}

## Current Project Context
- **Project:** ${project.name}
- **Product:** ${project.productName}
- **Description:** ${project.productDescription}
${project.targetAudience ? `- **Target Audience:** ${project.targetAudience}` : ''}
- **Tone:** ${project.tone}

Use this context to give more relevant and specific advice.`;
}

// ---- Subreddit Discovery ----

export const SUGGEST_SUBREDDITS_SYSTEM_PROMPT = `You are an expert Reddit strategist. You help product creators find the best subreddits to market their products authentically.

CRITICAL RULES:
- The TARGET AUDIENCE field is your #1 signal. These are the exact communities the user wants to reach. Find subreddits where those people actually congregate.
- ONLY recommend subreddits that are directly relevant to the product's SPECIFIC niche. Do NOT suggest adjacent or tangential communities for other markets, games, or categories unless the product explicitly covers them.
- If the product is about one specific thing (e.g. One Piece), do NOT suggest subreddits for other things in the same broader category (e.g. Pokemon, Magic: The Gathering).
- NEVER suggest generic "showcase your project" subreddits (e.g. InternetIsBeautiful, SideProject, etc.) — only suggest communities where the target audience already exists.
- Niche subreddits with small but highly targeted audiences are MORE valuable than large generic ones. Prioritize specificity over size.
- NEVER suggest subreddits with fewer than 1,000 members. They are too small to be useful for promotion.
- For match quality: "best" = the target audience IS this community, "good" = strong overlap with the target audience, "relevant" = related community worth trying.`;

export function buildSuggestSubredditsPrompt(
  product: {
    name: string;
    description: string;
    url?: string;
    audience?: string;
    tone: string;
  },
  discoveredSubreddits?: { name: string; subscribers: number; description: string }[],
  existingSubreddits?: string[]
): string {
  const hasExisting = existingSubreddits && existingSubreddits.length > 0;

  const existingSection = hasExisting
    ? `\n## Subreddits Already Chosen by the User\nThe user has already added these subreddits to their campaign:\n${existingSubreddits.map((s) => `- r/${s}`).join('\n')}\n\nSuggest subreddits that are RELATED to or overlap with these communities. Think about: sister subreddits, adjacent interest communities, and subreddits where the same audience also participates. Do NOT suggest any of these subreddits — they are already added.\n`
    : '';

  const discoveredSection = discoveredSubreddits?.length
    ? `\n## Real Subreddits Found on Reddit\nThese were found by searching Reddit directly. Include any that are relevant and add your own suggestions:\n${discoveredSubreddits.map((s) => `- r/${s.name} (${s.subscribers.toLocaleString()} members): ${s.description}`).join('\n')}\n`
    : '';

  const taskDescription = hasExisting
    ? `Suggest 8-10 additional subreddits that complement the user's existing picks. Focus on communities that share the same audience as the subreddits they already chose — sister communities, related interest groups, and niche offshoots.`
    : `Suggest 10-12 subreddits where this product's TARGET AUDIENCE actually spends time. Every suggestion must be a community where the people described above are active members — not just a subreddit where you could theoretically post about the product.`;

  return `## Product
- **Name:** ${product.name}
- **Description:** ${product.description}
${product.url ? `- **URL:** ${product.url}` : ''}
- **Tone:** ${product.tone}

${product.audience ? `## Target Audience${!hasExisting ? ' (HIGHEST PRIORITY)' : ''}\nThese are the exact people we want to reach. Every subreddit you suggest should contain these people:\n**${product.audience}**\n\nFind subreddits where these specific groups gather. Niche communities that perfectly match these audiences are far more valuable than large generic ones.\n` : ''}
${existingSection}
${discoveredSection}
## Task
${taskDescription}

IMPORTANT: Include a mix of subreddit sizes. At least 3-4 should be small niche communities (1K-10K members) that are highly specific to the target audience. These tight-knit communities are often the most valuable for authentic promotion. Do not only suggest large popular subreddits. Never suggest subreddits with fewer than 1,000 members.

${discoveredSubreddits?.length ? 'Prioritize the real subreddits found above if they match the target audience, then add your own. ' : ''}For each subreddit, provide:
1. The subreddit name (without r/ prefix)
2. Why it's a good fit (1 sentence)
3. A recommended approach for that specific community (1 sentence)
4. Match quality: "best" (core niche community), "good" (strong audience overlap), or "relevant" (tangentially related but worth targeting). Order results by match quality, best first.

Format as JSON:
{
  "subreddits": [
    {
      "name": "subredditname",
      "reason": "Why this subreddit fits...",
      "approach": "How to post here...",
      "match": "best"
    }
  ]
}`;
}

export interface SuggestedSubreddit {
  name: string;
  reason: string;
  approach: string;
  match: 'best' | 'good' | 'relevant';
}

// ---- Subreddit Analysis ----

export const ANALYZE_SUBREDDIT_SYSTEM_PROMPT = `You are an expert Reddit growth marketer who specializes in identifying posts that successfully drive user signups and paid conversions. You analyze subreddit posts to find patterns in what converts browsers into users and customers.

You understand:
- The difference between posts that get upvotes vs posts that actually drive traffic and signups
- How storytelling, social proof, and problem-solution framing convert readers into users
- What makes someone click through, sign up, and eventually pay
- How to spot "stealth marketing" posts that look organic but are actually promotional
- The signals that indicate a post drove real business results (comments asking "where can I try this?", "link?", "how much does it cost?")`;

export function buildAnalyzeSubredditPrompt(
  subredditName: string,
  posts: { title: string; body: string | null; score: number; num_comments: number; author: string }[],
  product?: { name: string; description: string; audience?: string }
): string {
  const postsText = posts
    .map(
      (p, i) =>
        `${i + 1}. [${p.score} pts, ${p.num_comments} comments] "${p.title}"
   Body: ${p.body ? p.body.slice(0, 500) : '[link post / no body]'}
   Author: u/${p.author}`
    )
    .join('\n\n');

  return `## Subreddit: r/${subredditName}

## Posts
${postsText}

${product ? `## Product Context
- **Product:** ${product.name}
- **Description:** ${product.description}
${product.audience ? `- **Target Audience:** ${product.audience}` : ''}` : ''}

## Task
Analyze these posts and identify which ones were most successful at driving user acquisition or could serve as templates for promotional posts. Focus on:

1. **High-conversion posts** — Posts that appear to have driven signups, traffic, or purchases. Look for: product mentions getting positive reception, comments asking for links/pricing, "I built this" or "I found this" framing, problem-solution narratives with a product as the solution.

2. **Winning patterns** — What content strategies work in this subreddit for getting users? (e.g., personal stories, show-and-tell, asking for feedback, sharing results)

3. **Conversion signals** — What engagement patterns suggest real business impact vs just upvotes?

${product ? `4. **Tailored recommendation** — Specifically how "${product.name}" should approach this subreddit to maximize signups and paid conversions.` : ''}

Format as JSON:
{
  "conversionPosts": [
    {
      "title": "exact post title",
      "score": 123,
      "why": "Why this post likely drove signups/conversions (1-2 sentences)",
      "strategy": "The specific tactic used (e.g., 'problem-solution story', 'show HN style', 'disguised case study')"
    }
  ],
  "winningPatterns": [
    {
      "pattern": "Pattern name (e.g., 'Personal struggle story')",
      "description": "How this pattern works and why it converts (1-2 sentences)",
      "example": "Brief example of how to use this pattern"
    }
  ],
  "subredditInsight": "2-3 sentence summary of how this subreddit's culture affects what promotional content succeeds"${product ? `,
  "recommendation": "2-3 sentence specific recommendation for how ${product.name} should post here to maximize user acquisition"` : ''}
}`;
}

export interface SubredditAnalysis {
  conversionPosts: {
    title: string;
    score: number;
    why: string;
    strategy: string;
  }[];
  winningPatterns: {
    pattern: string;
    description: string;
    example: string;
  }[];
  subredditInsight: string;
  recommendation?: string;
}

// ---- Splicer ----

export const SPLICE_SYSTEM_PROMPT = `You are an expert Reddit ghostwriter who blends the writing DNA of successful posts with a product's context to create new, authentic Reddit posts.

Your process:
1. ANALYZE each source post for: opening hook style, narrative structure, tone/voice, formatting patterns, engagement triggers (questions, calls-to-action), and what made it successful
2. EXTRACT the strategic elements — don't copy words, copy the underlying patterns
3. SYNTHESIZE a new post that weaves these patterns together with the product context, creating something that feels native to the target subreddit

Rules:
- The output must feel like a single cohesive post, not a Frankenstein of sources
- Match the casualness level and jargon of the target subreddit
- NEVER use obvious marketing language ("revolutionary", "game-changer", "check out")
- Lead with value, story, or insight — the product mention should feel earned
- Use Reddit-native markdown formatting
- The title should be scroll-stopping but not clickbait`;

export function buildSplicePrompt(
  product: { name: string; description: string; url?: string; audience?: string; tone: string },
  selectedPosts: { title: string; body: string | null; score: number; subreddit: string; numComments: number }[],
  controls: { tone: 'casual' | 'professional' | 'edgy'; length: 'short' | 'medium' | 'long'; targetSubreddit: string; additionalPrompt?: string }
): string {
  const toneGuide: Record<string, string> = {
    casual: 'Write like a regular Reddit user chatting with friends. Use contractions, informal language, and Reddit slang where appropriate.',
    professional: 'Write with authority and expertise. Use clear, polished language while still sounding human — not corporate.',
    edgy: 'Write with bold opinions and sharp wit. Be provocative without being offensive. Challenge assumptions.',
  };

  const lengthGuide: Record<string, string> = {
    short: 'Keep the post under 200 words. Punchy and to the point.',
    medium: 'Aim for 200-400 words. Enough detail to be compelling without losing attention.',
    long: 'Write 400-600 words. Deep, detailed, and story-driven.',
  };

  const postsText = selectedPosts
    .map(
      (p, i) =>
        `### Source Post ${i + 1} (r/${p.subreddit}, ${p.score} upvotes, ${p.numComments} comments)
Title: ${p.title}
Body: ${p.body || '[No body text - link/image post]'}

Extract from this post: hook style, narrative arc, formatting choices, and what made it engaging.`
    )
    .join('\n\n');

  return `## Product Context
- **Product:** ${product.name}
- **Description:** ${product.description}
${product.url ? `- **URL:** ${product.url}` : ''}
${product.audience ? `- **Target Audience:** ${product.audience}` : ''}
- **Brand Tone:** ${product.tone}

## Source Posts to Splice
Analyze each post's writing DNA — hooks, structure, tone, formatting — then blend these elements into a new post.

${postsText}

## Controls
- **Voice:** ${controls.tone} — ${toneGuide[controls.tone]}
- **Length:** ${controls.length} — ${lengthGuide[controls.length]}
- **Target Subreddit:** r/${controls.targetSubreddit}
${controls.additionalPrompt ? `- **Additional Directions:** ${controls.additionalPrompt}` : ''}

## Task
Synthesize a single new Reddit post that:
1. Blends the writing patterns from the source posts above
2. Naturally incorporates the product context
3. Fits the culture of r/${controls.targetSubreddit}
4. Matches the requested voice and length

Format your response as JSON:
{
  "title": "Your post title here",
  "body": "Your full post body here in Reddit markdown"
}`;
}

export const REWRITE_SYSTEM_PROMPT = `You are a writing expert who rewrites text for Reddit posts. Maintain the core message while adjusting the style as requested. Output ONLY the rewritten text, no explanations.`;

export function buildRewritePrompt(text: string, tone: string, context?: string): string {
  const toneInstructions: Record<string, string> = {
    'Engaging': 'Make it more engaging and attention-grabbing. Add hooks and make readers want to keep reading.',
    'Humorous': 'Add humor and wit. Use Reddit-style humor (self-deprecating, observational, slightly sarcastic).',
    'Creative': 'Make it more creative and unique. Use unexpected angles or metaphors.',
    'Sarcastic': 'Add tasteful sarcasm and irony. Not mean-spirited, but cleverly sardonic.',
    'Inspirational': 'Make it inspiring and motivational. Focus on the positive impact and transformation.',
    'Concise': 'Make it more concise and punchy. Remove unnecessary words. Every sentence should earn its place.',
    'Improve grammar': 'Fix grammar, spelling, and punctuation. Improve sentence structure while keeping the same voice.',
    'Engaging hook': 'Rewrite the opening to be a stronger hook that grabs attention immediately.',
    'More details': 'Expand with more specific details, examples, and supporting points.',
  };

  return `${toneInstructions[tone] || `Rewrite in a ${tone} tone.`}

${context ? `Context: ${context}\n` : ''}
Text to rewrite:
${text}`;
}
