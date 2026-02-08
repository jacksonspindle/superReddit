import type { Node, Edge } from '@xyflow/react';

// ---- Database types ----

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
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
