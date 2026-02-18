'use client';

import { useEffect, useState, useMemo } from 'react';
import { FileText, Search, Trash2, PenLine, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { useProject } from '@/contexts/project-context';
import { useCreateStore } from '@/stores/create-store';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface DraftImage {
  id: string;
  dataUrl: string;
  name: string;
}

interface Draft {
  id: string;
  title: string;
  body: string;
  tone: string;
  status: string;
  images: DraftImage[] | null;
  link_url: string | null;
  created_at: string;
  updated_at: string;
}

type SortOption = 'newest' | 'oldest';

export default function DraftsPage() {
  const { project } = useProject();
  const router = useRouter();
  const { setTitle, setBody, setTone, setDraftId, setLinkUrl, addImages } = useCreateStore();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    async function fetchDrafts() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('generated_posts')
        .select('id, title, body, tone, status, images, link_url, created_at, updated_at')
        .eq('project_id', project.id)
        .order('updated_at', { ascending: false });

      if (error) {
        toast.error('Failed to load drafts');
      } else {
        setDrafts(data || []);
      }
      setLoading(false);
    }
    fetchDrafts();
  }, [project.id]);

  const filtered = useMemo(() => {
    let result = [...drafts];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [drafts, searchQuery, statusFilter, sortBy]);

  function handleEdit(draft: Draft) {
    setTitle(draft.title);
    setBody(draft.body);
    setTone(draft.tone);
    setDraftId(draft.id);
    setLinkUrl(draft.link_url || '');
    if (draft.images?.length) {
      addImages(draft.images);
    }
    router.push(`/projects/${project.id}/create`);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('generated_posts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete draft');
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    toast.success('Draft deleted');
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-500',
    edited: 'bg-blue-500/10 text-blue-500',
    posted: 'bg-green-500/10 text-green-500',
  };

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Drafts" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drafts..."
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="edited">Edited</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Count */}
            <span className="text-sm text-muted-foreground">
              {filtered.length} draft{filtered.length !== 1 ? 's' : ''}
            </span>

            {/* List */}
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading drafts...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="font-medium">No drafts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {drafts.length === 0
                    ? 'Create a post and save it as a draft to see it here.'
                    : 'No drafts match your current filters.'}
                </p>
              </div>
            ) : (
              <StaggerList className="space-y-2">
                {filtered.map((draft) => (
                  <StaggerItem key={draft.id}>
                    <Card
                      className="transition-shadow hover:shadow-md cursor-pointer"
                      onClick={() => handleEdit(draft)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {/* Image thumbnail */}
                          {draft.images && draft.images.length > 0 && (
                            <div className="shrink-0">
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                <img
                                  src={draft.images[0].dataUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                                {draft.images.length > 1 && (
                                  <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-tl-md">
                                    +{draft.images.length - 1}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm leading-snug flex-1 min-w-0 truncate">
                                {draft.title || 'Untitled draft'}
                              </h3>
                              <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColor[draft.status] || ''}`}>
                                {draft.status}
                              </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {draft.body}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(draft.updated_at)}
                              </span>
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{draft.tone}</span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(draft.id); }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
