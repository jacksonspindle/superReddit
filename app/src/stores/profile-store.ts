import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

interface ProfileStore {
  email: string;
  avatarUrl: string | null;
  loaded: boolean;
  fetchProfile: () => Promise<void>;
  setAvatarUrl: (url: string) => void;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  email: '',
  avatarUrl: null,
  loaded: false,

  fetchProfile: async () => {
    if (get().loaded) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ email: user.email || '' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    set({
      avatarUrl: profile?.avatar_url || null,
      loaded: true,
    });
  },

  setAvatarUrl: (url) => set({ avatarUrl: url }),
}));
