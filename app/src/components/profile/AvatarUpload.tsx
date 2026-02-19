'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useProfileStore } from '@/stores/profile-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AvatarUploadProps {
  size?: 'sm' | 'default' | 'lg';
  showName?: boolean;
}

export function AvatarUpload({ size = 'default', showName = false }: AvatarUploadProps) {
  const { email, avatarUrl, fetchProfile, setAvatarUrl } = useProfileStore();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fallback = email ? email[0].toUpperCase() : 'U';

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }

      setAvatarUrl(data.avatar_url);
      toast.success('Profile image updated');
      setOpen(false);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to remove image');
        return;
      }
      setAvatarUrl('');
      toast.success('Profile image removed');
      setOpen(false);
    } catch {
      toast.error('Failed to remove image');
    } finally {
      setUploading(false);
    }
  }

  const sizeClasses = {
    sm: 'h-6 w-6',
    default: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                showName ? 'flex items-center gap-3' : '',
                sizeClasses[size],
                showName && 'w-auto h-auto',
              )}
            >
              <Avatar size={size} className={sizeClasses[size]}>
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
              </Avatar>
              {showName && (
                <span className="text-sm font-medium truncate">{email}</span>
              )}
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-64 border-white/20 bg-white/10 backdrop-blur-xl dark:bg-black/20 dark:border-white/10 shadow-xl rounded-xl p-4"
        >
          <div className="flex flex-col items-center gap-3">
            {/* Large preview */}
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
              <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
            </Avatar>

            <p className="text-sm font-medium truncate max-w-full">{email}</p>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs gap-1.5 bg-white/10 border-white/20 backdrop-blur-sm hover:bg-white/20 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {avatarUrl ? 'Change' : 'Upload'}
              </Button>
              {avatarUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 bg-white/10 border-white/20 backdrop-blur-sm hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 dark:bg-white/5 dark:border-white/10"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/** Read-only avatar display that pulls from the shared profile store */
export function ProfileAvatar({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const { email, avatarUrl, fetchProfile } = useProfileStore();

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fallback = email ? email[0].toUpperCase() : 'U';
  const sizeClasses = { sm: 'h-6 w-6', default: 'h-8 w-8', lg: 'h-10 w-10' };

  return (
    <Avatar size={size} className={sizeClasses[size]}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
      <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
    </Avatar>
  );
}
