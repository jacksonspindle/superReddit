export interface PostStyle {
  id: string;
  name: string;
  description: string;
  exampleTitle: string;
  exampleBody: string;
  exampleSubreddit: string;
}

// 12 Reddit post styles from research, each with a short example post
export const POST_STYLES: PostStyle[] = [
  {
    id: 'struggle-discovery',
    name: 'The Struggle & Discovery',
    description: 'Personal story with a problem-solution arc',
    exampleTitle: 'I was mass-sending cold emails for 6 months and getting zero replies. Here\'s what finally worked.',
    exampleBody: 'I run a small consultancy and honestly, my outreach was embarrassing. I was blasting 200 cold emails a week with generic templates and getting maybe 1-2 replies a month. Last month I started personalizing the first line of every email automatically. My reply rate went from under 1% to 14% in three weeks. Happy to share my exact workflow if anyone\'s interested.',
    exampleSubreddit: 'r/Entrepreneur',
  },
  {
    id: 'curious-crowd',
    name: 'The Curious Crowd',
    description: 'Question that invites community discussion',
    exampleTitle: 'Does anyone else feel like project management tools have gotten way too bloated?',
    exampleBody: 'Genuine question — I manage a team of 8 and we\'ve cycled through Asana, Monday, and ClickUp over the past year. Every single one feels like it was designed for a 500-person enterprise, not a small team. Are we the only ones drowning in feature bloat, or is this just the state of PM tools now?',
    exampleSubreddit: 'r/startups',
  },
  {
    id: 'builders-showcase',
    name: 'The Builder\'s Showcase',
    description: '"I built this" maker post with feedback ask',
    exampleTitle: 'Spent the last 4 months building a tool that turns meeting recordings into action items automatically. Would love honest feedback.',
    exampleBody: 'I\'m a PM who was sick of leaving meetings with vague notes and no follow-through. It records your calls, transcribes them, and extracts actual action items with owners and deadlines. It\'s been running on my team of 12 for a month and has genuinely changed how we operate. I\'d love brutal feedback — here\'s a 2-minute demo.',
    exampleSubreddit: 'r/SideProject',
  },
  {
    id: 'psa-drop',
    name: 'The PSA Drop',
    description: 'Urgent insider tip or public service announcement',
    exampleTitle: 'PSA: If you\'re still paying for Zapier\'s premium tier, you\'re probably overspending by 60%',
    exampleBody: 'I just did an audit of our team\'s automation stack and realized we were paying $120/month when 90% of our workflows could run on a free tier alternative. Not affiliated at all — just frustrated with the pricing hike and started looking around. Check your usage before your next billing cycle.',
    exampleSubreddit: 'r/SaaS',
  },
  {
    id: 'showdown',
    name: 'The Showdown',
    description: 'Side-by-side comparison with a clear verdict',
    exampleTitle: 'I tested Notion, Coda, and DocuFlow for 30 days each. Here\'s my brutally honest ranking.',
    exampleBody: 'My 4-person startup was drowning in docs. Notion is powerful but overkill. Coda was flexible but the learning curve lost us a week. DocuFlow was the simplest — we migrated in 2 hours and the AI search actually works. Winner for small teams: DocuFlow. Winner for power users: Notion.',
    exampleSubreddit: 'r/software',
  },
  {
    id: 'open-floor',
    name: 'The Open Floor',
    description: 'Open-ended discussion starter, product in comments',
    exampleTitle: 'What\'s your team using for async communication that actually works? Slack isn\'t cutting it anymore.',
    exampleBody: 'We\'re 15 people, fully remote, and Slack has become a nightmare. Important messages get buried, threads go nowhere. What\'s actually working for your team? Especially from other remote teams in the 10-30 person range. Not looking for "just use email" — we tried that.',
    exampleSubreddit: 'r/remotework',
  },
  {
    id: 'playbook',
    name: 'The Playbook',
    description: 'Step-by-step tutorial with product woven in',
    exampleTitle: 'How I automated 80% of my social media posting in under an hour (step-by-step)',
    exampleBody: 'I run social for three clients and was spending 10+ hours a week scheduling. Here\'s my workflow: (1) Batch-create ideas with AI. (2) Auto-generate platform-specific variations. (3) Schedule everything in one sitting. (4) 15 min/day on engagement only. Total weekly time: 10 hours → 2.',
    exampleSubreddit: 'r/marketing',
  },
  {
    id: 'contrarian',
    name: 'The Contrarian',
    description: 'Hot take that challenges conventional wisdom',
    exampleTitle: 'Unpopular opinion: Most A/B testing is a complete waste of time for startups under $1M ARR',
    exampleBody: 'I know this sub loves A/B testing everything, but hear me out. I spent 200 hours on tests and never had enough traffic for statistical significance. What actually moved the needle? Talking to 10 customers and building what they asked for. I\'m not saying it\'s bad — I\'m saying it\'s premature optimization. Fight me.',
    exampleSubreddit: 'r/Entrepreneur',
  },
  {
    id: 'experiment-log',
    name: 'The Experiment Log',
    description: 'Data-driven "I tracked X for 30 days" format',
    exampleTitle: 'I replaced our $200/month email stack with a $29 tool and tracked everything for 60 days. Here are the real numbers.',
    exampleBody: 'Open rates went from 22.1% to 24.8%. Click rates stayed roughly the same (3.1% vs 3.3%). Revenue per email actually went up 11% but I think that\'s noise. Only downside: clunkier template builder. Net savings of $171/mo for basically the same performance. Full spreadsheet in comments.',
    exampleSubreddit: 'r/SaaS',
  },
  {
    id: 'casual-drop',
    name: 'The Casual Drop',
    description: 'Natural, offhand product mention within a broader topic',
    exampleTitle: 'Remote team managers: how are you handling the "always online" burnout problem?',
    exampleBody: 'The biggest issue isn\'t productivity — it\'s that everyone feels like they need to be online all the time. We\'ve tried no-meeting Fridays and async standups through BriefKit, which helped a bit, but the real problem is cultural. Has anyone found tactics that actually shift the always-on mentality?',
    exampleSubreddit: 'r/management',
  },
  {
    id: 'confessional-ama',
    name: 'The Confessional AMA',
    description: 'Transparent founder Q&A sharing real numbers',
    exampleTitle: 'I bootstrapped a SaaS to $18K MRR in 14 months while working full-time. AMA about the messy reality.',
    exampleBody: 'I launched 14 months ago, still have my day job, and just crossed $18K MRR with zero paid marketing. I\'ve made every mistake in the book — pricing too low, building features nobody wanted, almost burning out twice. I\'m going to be brutally honest. Revenue, costs, mistakes, everything. Ask me anything.',
    exampleSubreddit: 'r/startups',
  },
  {
    id: 'empathy-hook',
    name: 'The Empathy Hook',
    description: 'Emotional validation before a gentle solution',
    exampleTitle: 'If your side project is moving slowly, it\'s probably not because you\'re lazy. It\'s because your tools are fighting you.',
    exampleBody: 'I see so many posts from people beating themselves up for not shipping faster. But half the battle is wrestling with deployment pipelines and CI/CD setups designed for 50-person teams. Sometimes the bottleneck isn\'t your motivation — it\'s your stack. Give yourself some credit.',
    exampleSubreddit: 'r/webdev',
  },
];
