'use client';

import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { useProfileStore } from '@/stores/profile-store';
import { useEffect } from 'react';

export function Header({ title }: { title?: string }) {
  const { email, fetchProfile } = useProfileStore();

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">{title || 'SuperReddit'}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <AvatarUpload />
      </div>
    </header>
  );
}
