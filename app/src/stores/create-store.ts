import { create } from 'zustand';
import type { RedditPost } from '@/types';

export interface ReferencePost {
  id: string;
  title: string;
  body: string | null;
  score: number;
  subreddit: string;
  numComments: number;
  thumbnail: string | null;
  permalink: string;
}

export interface PostImage {
  id: string;
  dataUrl: string;
  name: string;
}

export interface SearchAction {
  query: string;
  subreddit?: string;
  sort?: 'hot' | 'top' | 'rising' | 'new';
  timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

type SidebarTab = 'search' | 'feed' | 'bookmarks';

export interface AISearchResult {
  query: string;
  subreddit?: string;
  posts: RedditPost[];
}

interface CreateStore {
  title: string;
  body: string;
  targetSubreddit: string;
  tone: string;
  status: 'draft' | 'edited' | 'posted';
  draftId: string | null;
  referencePosts: ReferencePost[];
  images: PostImage[];
  linkUrl: string;
  generating: boolean;
  activeTab: SidebarTab;
  pendingSearch: SearchAction | null;
  aiSearchResults: AISearchResult | null;

  setTitle: (title: string) => void;
  setBody: (body: string) => void;
  setTargetSubreddit: (sub: string) => void;
  setTone: (tone: string) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setPendingSearch: (search: SearchAction | null) => void;
  setAISearchResults: (results: AISearchResult | null) => void;
  setStatus: (status: 'draft' | 'edited' | 'posted') => void;
  setGenerating: (generating: boolean) => void;
  setDraftId: (id: string | null) => void;
  setLinkUrl: (url: string) => void;
  addImages: (images: PostImage[]) => void;
  removeImage: (id: string) => void;

  usePost: (post: RedditPost) => void;
  removeReference: (id: string) => void;
  clearReferences: () => void;
  reset: () => void;
}

const initialState = {
  title: '',
  body: '',
  targetSubreddit: '',
  tone: 'Adaptive',
  status: 'draft' as const,
  draftId: null,
  referencePosts: [] as ReferencePost[],
  images: [] as PostImage[],
  linkUrl: '',
  generating: false,
  activeTab: 'feed' as SidebarTab,
  pendingSearch: null as SearchAction | null,
  aiSearchResults: null as AISearchResult | null,
};

export const useCreateStore = create<CreateStore>((set, get) => ({
  ...initialState,

  setTitle: (title) => set({ title }),
  setBody: (body) => set({ body }),
  setTargetSubreddit: (targetSubreddit) => set({ targetSubreddit }),
  setTone: (tone) => set({ tone }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setPendingSearch: (pendingSearch) => set({ pendingSearch }),
  setAISearchResults: (aiSearchResults) => set({ aiSearchResults }),
  setStatus: (status) => set({ status }),
  setGenerating: (generating) => set({ generating }),
  setDraftId: (draftId) => set({ draftId }),
  setLinkUrl: (linkUrl) => set({ linkUrl }),
  addImages: (newImages) => set((state) => ({ images: [...state.images, ...newImages] })),
  removeImage: (id) => set((state) => ({ images: state.images.filter((img) => img.id !== id) })),

  usePost: (post: RedditPost) => {
    const existing = get().referencePosts;
    if (existing.some((r) => r.id === post.id)) return;

    const thumb = post.preview_url || post.thumbnail;
    const ref: ReferencePost = {
      id: post.id,
      title: post.title,
      body: post.selftext || null,
      score: post.score,
      subreddit: post.subreddit,
      numComments: post.num_comments,
      thumbnail: thumb && !['self', 'default', 'nsfw', 'spoiler', ''].includes(thumb) ? thumb : null,
      permalink: post.permalink,
    };

    set({
      referencePosts: [...existing, ref],
      targetSubreddit: get().targetSubreddit || post.subreddit,
    });
  },

  removeReference: (id) =>
    set((state) => ({
      referencePosts: state.referencePosts.filter((r) => r.id !== id),
    })),

  clearReferences: () => set({ referencePosts: [] }),

  reset: () => set(initialState),
}));
