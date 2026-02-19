'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { FadeIn } from '@/components/motion';
import { staggerContainerVariants, staggerItemVariants, cardHover, cardTap } from '@/lib/motion';
import type { Project } from '@/types';
import { toast } from 'sonner';

const TONES = ['Professional', 'Casual', 'Humorous', 'Technical', 'Storytelling', 'Educational'];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Edit form state
  const [formName, setFormName] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formProductDescription, setFormProductDescription] = useState('');
  const [formProductUrl, setFormProductUrl] = useState('');
  const [formTargetAudience, setFormTargetAudience] = useState('');
  const [formTone, setFormTone] = useState('Professional');

  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Failed to load projects');
      return;
    }
    setProjects(data || []);
    setLoading(false);
  }

  function resetForm(project?: Project | null) {
    setFormName(project?.name || '');
    setFormProductName(project?.product_name || '');
    setFormProductDescription(project?.product_description || '');
    setFormProductUrl(project?.product_url || '');
    setFormTargetAudience(project?.target_audience || '');
    setFormTone(project?.tone || 'Professional');
  }

  function openEditDialog(project: Project) {
    setEditingProject(project);
    resetForm(project);
    setDialogOpen(true);
  }

  async function handleUpdate() {
    if (!editingProject || !formName.trim() || !formProductName.trim()) {
      toast.error('Project name and product name are required');
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({
        name: formName,
        product_name: formProductName,
        product_description: formProductDescription,
        product_url: formProductUrl,
        target_audience: formTargetAudience,
        tone: formTone,
      })
      .eq('id', editingProject.id);

    if (error) {
      toast.error('Failed to update project');
      return;
    }
    toast.success('Project updated');
    setDialogOpen(false);
    setEditingProject(null);
    loadProjects();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete project');
      return;
    }
    toast.success('Project deleted');
    loadProjects();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.product_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
            SR
          </div>
          <span className="font-semibold text-lg">SuperReddit</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AvatarUpload />
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-8">
          {/* Heading */}
          <h1 className="text-2xl font-bold mb-6">Projects</h1>

          {/* Search + New Project row */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-9"
              />
            </div>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => router.push('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>

            {/* Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingProject(null); resetForm(); } }}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                  <DialogDescription>
                    Update your project details.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My SaaS Launch" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_name">Product Name</Label>
                    <Input id="product_name" value={formProductName} onChange={(e) => setFormProductName(e.target.value)} placeholder="ProductName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_description">Product Description</Label>
                    <Textarea id="product_description" value={formProductDescription} onChange={(e) => setFormProductDescription(e.target.value)} placeholder="What does your product do?" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_url">Product URL</Label>
                    <Input id="product_url" value={formProductUrl} onChange={(e) => setFormProductUrl(e.target.value)} placeholder="https://yourproduct.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_audience">Target Audience</Label>
                    <Input id="target_audience" value={formTargetAudience} onChange={(e) => setFormTargetAudience(e.target.value)} placeholder="Indie hackers, SaaS founders..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Select value={formTone} onValueChange={setFormTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleUpdate} className="w-full">
                    Update Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Project grid */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <FadeIn>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="mb-4 text-muted-foreground">
                    {searchQuery ? 'No projects match your search.' : 'No projects yet. Create your first one!'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => router.push('/projects/new')} className="bg-green-600 hover:bg-green-700 text-white">
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                    </Button>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          ) : (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  variants={staggerItemVariants}
                  whileHover={cardHover}
                  whileTap={cardTap}
                >
                  <Card className="group relative h-full cursor-pointer transition-shadow hover:shadow-md">
                    <div onClick={() => router.push(`/projects/${project.id}`)} className="flex h-full flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(project); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <CardDescription>{project.product_name}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col">
                        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                          {project.product_description || 'No description'}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            {project.tone}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Updated {new Date(project.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
