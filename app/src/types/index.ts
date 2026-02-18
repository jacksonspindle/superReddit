import type { Node, Edge } from '@xyflow/react';

// ---- Database types ----

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  product_name: string;
  product_description: string;
  product_url: string | null;
  target_audience: string | null;
  tone: string;
  writing_styles: string[];
  created_at: string;
  updated_at: string;
}

export interface Subreddit {
  id: string;
  project_id: string;
  name: string;
  subscribers: number | null;
  description: string | null;
  created_at: string;
}

export interface DiscoveredPost {
  id: string;
  project_id: string;
  subreddit_name: string;
  reddit_id: string;
  title: string;
  body: string | null;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  fetched_at: string;
}

export interface GeneratedPost {
  id: string;
  project_id: string;
  title: string;
  body: string;
  tone: string;
  strategy_note: string | null;
  status: 'draft' | 'edited' | 'posted';
  based_on_post_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  reddit_id: string;
  subreddit: string;
  title: string;
  body: string | null;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  link_flair_text: string | null;
  thumbnail: string | null;
  created_at: string;
}

export interface CanvasState {
  id: string;
  project_id: string;
  nodes: CanvasNode[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  updated_at: string;
}

// ---- Canvas Node types ----

export interface ProductNodeData {
  type: 'product';
  name: string;
  description: string;
  url: string;
  audience: string;
  tone: string;
  writingStyles?: string[];
  [key: string]: unknown;
}

export interface SubredditNodeData {
  type: 'subreddit';
  name: string;
  subscribers: number | null;
  description: string | null;
  posts: RedditPost[];
  loading: boolean;
  sortBy: 'hot' | 'top' | 'rising';
  [key: string]: unknown;
}

export interface ExamplePostNodeData {
  type: 'example-post';
  redditId: string;
  title: string;
  body: string | null;
  author: string;
  score: number;
  numComments: number;
  subreddit: string;
  permalink: string;
  selected: boolean;
  [key: string]: unknown;
}

export interface GeneratedPostNodeData {
  type: 'generated-post';
  title: string;
  body: string;
  tone: string;
  strategyNote: string | null;
  status: 'draft' | 'edited' | 'posted';
  basedOnPostIds: string[];
  generating: boolean;
  [key: string]: unknown;
}

export type CanvasNodeData = ProductNodeData | SubredditNodeData | ExamplePostNodeData | GeneratedPostNodeData;
export type CanvasNode = Node<CanvasNodeData>;

// ---- Reddit API types ----

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
  link_flair_text: string | null;
  is_self: boolean;
  thumbnail: string | null;
  preview_url: string | null;
  post_hint: string | null;
}

export interface RedditSubredditInfo {
  name: string;
  title: string;
  subscribers: number;
  active_user_count: number | null;
  public_description: string;
  description: string;
  icon_img: string | null;
  banner_background_image: string | null;
}

export interface RedditApiResponse {
  posts: RedditPost[];
  subredditInfo?: RedditSubredditInfo;
  after?: string | null;
  error?: string;
}

// ---- AI types ----

export interface GenerateRequest {
  productContext: {
    name: string;
    description: string;
    url?: string;
    audience?: string;
    tone: string;
    writingStyles?: string[];
  };
  examplePosts: {
    title: string;
    body: string | null;
    score: number;
    subreddit: string;
    numComments: number;
  }[];
  count?: number;
}

export interface GenerateResponse {
  posts: {
    title: string;
    body: string;
    strategyNote: string;
  }[];
}

export interface RewriteRequest {
  text: string;
  tone: string;
  context?: string;
}

export interface RewriteResponse {
  text: string;
}

export type AiTone = 'Engaging' | 'Humorous' | 'Creative' | 'Sarcastic' | 'Inspirational' | 'Concise';
export type RewriteOption = AiTone | 'Improve grammar' | 'Engaging hook' | 'More details';

// ---- Outreach types ----

export interface OutreachConfig {
  id: string;
  project_id: string;
  reddit_username: string | null;
  keywords: string[];
  competitors: string[];
  webhook_url: string | null;
  webhook_type: string | null;
  subreddit_limit: number;
  polling_enabled: boolean;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutreachSignal {
  id: string;
  project_id: string;
  reddit_id: string;
  subreddit: string;
  title: string;
  body: string | null;
  author: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  intent_type: string | null;
  intent_score: number;
  combined_score: number;
  matched_keywords: string[];
  competitor_mentioned: boolean;
  status: 'new' | 'replied' | 'dismissed' | 'converted';
  fetched_at: string;
}

export interface OutreachReply {
  id: string;
  project_id: string;
  signal_id: string | null;
  thread_permalink: string | null;
  draft_text: string | null;
  reply_mode: string | null;
  reddit_comment_id: string | null;
  posted_at: string | null;
  current_score: number | null;
  reply_count: number;
  op_replied: boolean;
  last_checked_at: string | null;
  status: 'draft' | 'copied' | 'posted' | 'tracking';
  created_at: string;
  updated_at: string;
}

export interface SubredditRule {
  id: string;
  subreddit: string;
  rules_json: Record<string, unknown>[];
  compliance_profile: {
    selfPromoAllowed: boolean;
    linkPostsAllowed: boolean;
    minAccountAge: number | null;
    minKarma: number | null;
    flairRequired: boolean;
    restrictedKeywords: string[];
  };
  safety_score: number | null;
  analyzed_at: string;
}

// ---- DM Workflow types ----

export type DmPipelineStage =
  | 'detected'
  | 'dm_ready'
  | 'draft_generated'
  | 'dm_sent'
  | 'responded'
  | 'converted'
  | 'closed';

export type PermissionType = 'explicit_dm_request' | 'positive_reply' | 'passive_commenter';

export interface OutreachDM {
  id: string;
  project_id: string;
  reddit_username: string;
  comment_text: string | null;
  comment_permalink: string | null;
  source_thread_permalink: string;
  source_signal_id: string | null;
  permission_type: PermissionType;
  permission_score: number;
  matched_pattern: string | null;
  pipeline_stage: DmPipelineStage;
  dm_subject: string | null;
  dm_body: string | null;
  dm_template_id: string | null;
  dm_sent_at: string | null;
  follow_up_due: string | null;
  touch_number: number;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  signal?: {
    title: string;
    subreddit: string;
    permalink: string;
    score: number;
    num_comments: number;
  } | null;
}

export interface DmTemplate {
  id: string;
  name: string;
  description: string;
  subject_hint: string;
  body_hint: string;
}

export interface ThreadComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  parent_id: string;
}

// ---- GitHub types ----

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubConnection {
  id: string;
  project_id: string;
  repo_url: string;
  owner: string;
  repo_name: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  readme_summary: string | null;
  recent_commits: GitHubCommit[];
  access_token: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
