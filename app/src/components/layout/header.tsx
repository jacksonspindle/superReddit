'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Header({ title }: { title?: string }) {
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setEmail(data.user.email || '');
    });
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">{title || 'SuperReddit'}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {email ? email[0].toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
