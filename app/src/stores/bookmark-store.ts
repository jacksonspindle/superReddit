import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Bookmark, RedditPost } from '@/types';

interface BookmarkStore {
  bookmarks: Bookmark[];
  loading: boolean;
  loaded: boolean;

  fetchBookmarks: () => Promise<void>;
  addBookmark: (post: RedditPost) => Promise<void>;
  removeBookmark: (redditId: string) => Promise<void>;
  isBookmarked: (redditId: string) => boolean;
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],
  loading: false,
  loaded: false,

  fetchBookmarks: async () => {
    if (get().loaded) return;
    set({ loading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });
    set({ bookmarks: data || [], loading: false, loaded: true });
  },

  addBookmark: async (post: RedditPost) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        user_id: user.id,
        reddit_id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        body: post.selftext || null,
        author: post.author,
        score: post.score,
        num_comments: post.num_comments,
        url: post.url,
        permalink: post.permalink,
        created_utc: post.created_utc,
        link_flair_text: post.link_flair_text || null,
        thumbnail: post.thumbnail || null,
      })
      .select()
      .single();

    if (error) return;
    if (data) {
      set((state) => ({ bookmarks: [data, ...state.bookmarks] }));
    }
  },

  removeBookmark: async (redditId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('reddit_id', redditId);

    if (error) return;
    set((state) => ({
      bookmarks: state.bookmarks.filter((b) => b.reddit_id !== redditId),
    }));
  },

  isBookmarked: (redditId: string) => {
    return get().bookmarks.some((b) => b.reddit_id === redditId);
  },
}));
