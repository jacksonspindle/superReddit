import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Bookmark, RedditPost } from '@/types';

interface BookmarkStore {
  bookmarks: Bookmark[];
  loading: boolean;
  loaded: boolean;

  fetchBookmarks: () => Promise<void>;
  addBookmark: (post: RedditPost) => Promise<boolean>;
  removeBookmark: (redditId: string) => Promise<boolean>;
  isBookmarked: (redditId: string) => boolean;
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],
  loading: false,
  loaded: false,

  fetchBookmarks: async () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch bookmarks:', error.message);
      }
      set({ bookmarks: data || [], loading: false, loaded: true });
    } catch (e) {
      console.error('Bookmark fetch error:', e);
      set({ loading: false, loaded: true });
    }
  },

  addBookmark: async (post: RedditPost) => {
    // Check if already bookmarked locally
    if (get().bookmarks.some((b) => b.reddit_id === post.id)) {
      return true;
    }

    // Optimistic local bookmark (used immediately for UI)
    const optimistic: Bookmark = {
      id: `local-${post.id}`,
      user_id: '',
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
      created_at: new Date().toISOString(),
    };

    // Add to local state immediately
    set((state) => ({ bookmarks: [optimistic, ...state.bookmarks] }));

    // Try to persist to Supabase
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return true; // Keep local bookmark even without auth

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

      if (error) {
        console.error('Failed to save bookmark to DB:', error.message);
        // Keep the optimistic bookmark in local state anyway
        return true;
      }

      // Replace optimistic entry with real DB entry
      if (data) {
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.reddit_id === post.id && b.id.startsWith('local-') ? data : b
          ),
        }));
      }
      return true;
    } catch (e) {
      console.error('Bookmark save error:', e);
      return true; // Keep local bookmark
    }
  },

  removeBookmark: async (redditId: string) => {
    // Optimistic removal
    const prev = get().bookmarks;
    set((state) => ({
      bookmarks: state.bookmarks.filter((b) => b.reddit_id !== redditId),
    }));

    // Try to remove from Supabase
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('reddit_id', redditId);

      if (error) {
        console.error('Failed to remove bookmark from DB:', error.message);
      }
      return true;
    } catch (e) {
      console.error('Bookmark remove error:', e);
      // Restore on failure
      set({ bookmarks: prev });
      return false;
    }
  },

  isBookmarked: (redditId: string) => {
    return get().bookmarks.some((b) => b.reddit_id === redditId);
  },
}));
