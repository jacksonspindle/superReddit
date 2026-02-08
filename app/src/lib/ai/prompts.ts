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

export function buildGeneratePrompt(
  product: { name: string; description: string; url?: string; audience?: string; tone: string },
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

  return `## Product Context
- **Product:** ${product.name}
- **Description:** ${product.description}
${product.url ? `- **URL:** ${product.url}` : ''}
${product.audience ? `- **Target Audience:** ${product.audience}` : ''}
- **Desired Tone:** ${product.tone}

## Successful Example Posts
These posts performed well in their subreddits. Study their structure, tone, and engagement patterns:

${examplesText}

## Task
Generate ${count} Reddit posts that promote "${product.name}" while matching the style and approach of the examples above.

For each post, provide:
1. **Title** — Attention-grabbing, fits the subreddit style
2. **Body** — Full post body in Reddit markdown
3. **Strategy Note** — Brief explanation of why this approach works (1-2 sentences)

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

export const SUGGEST_SUBREDDITS_SYSTEM_PROMPT = `You are an expert Reddit strategist with deep knowledge of Reddit's subreddit ecosystem. You help product creators find the best subreddits to market their products authentically.

Your recommendations should:
- Include a mix of large (>100K), medium (10K-100K), and niche (<10K) subreddits
- Prioritize subreddits where self-promotion posts can succeed (not just pure discussion subs)
- Consider the product's audience, tone, and category
- Warn about subreddits with strict anti-promotion rules
- Include subreddits people wouldn't think of (adjacent communities, hobby-specific, regional)

Always return real subreddits that actually exist on Reddit.`;

export function buildSuggestSubredditsPrompt(product: {
  name: string;
  description: string;
  url?: string;
  audience?: string;
  tone: string;
}): string {
  return `## Product
- **Name:** ${product.name}
- **Description:** ${product.description}
${product.url ? `- **URL:** ${product.url}` : ''}
${product.audience ? `- **Target Audience:** ${product.audience}` : ''}
- **Tone:** ${product.tone}

## Task
Suggest 10-12 subreddits where this product could be authentically promoted. For each subreddit, provide:
1. The subreddit name (without r/ prefix)
2. Why it's a good fit (1 sentence)
3. A recommended approach for that specific community (1 sentence)
4. Risk level: "low" (self-promo friendly), "medium" (allowed with value-add), or "high" (strict rules, tread carefully)

Format as JSON:
{
  "subreddits": [
    {
      "name": "subredditname",
      "reason": "Why this subreddit fits...",
      "approach": "How to post here...",
      "risk": "low"
    }
  ]
}`;
}

export interface SuggestedSubreddit {
  name: string;
  reason: string;
  approach: string;
  risk: 'low' | 'medium' | 'high';
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
