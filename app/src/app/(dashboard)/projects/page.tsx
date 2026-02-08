'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { PageTransition } from '@/components/motion';
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
  const router = useRouter();

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

  async function handleCreateOrUpdate(formData: FormData) {
    const name = formData.get('name') as string;
    const product_name = formData.get('product_name') as string;
    const product_description = formData.get('product_description') as string;
    const product_url = formData.get('product_url') as string;
    const target_audience = formData.get('target_audience') as string;
    const tone = formData.get('tone') as string;

    if (!name.trim() || !product_name.trim()) {
      toast.error('Project name and product name are required');
      return;
    }

    if (editingProject) {
      const { error } = await supabase
        .from('projects')
        .update({ name, product_name, product_description, product_url, target_audience, tone })
        .eq('id', editingProject.id);

      if (error) {
        toast.error('Failed to update project');
        return;
      }
      toast.success('Project updated');
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('projects').insert({
        user_id: user.id,
        name,
        product_name,
        product_description,
        product_url: product_url || null,
        target_audience: target_audience || null,
        tone,
      });

      if (error) {
        toast.error('Failed to create project');
        return;
      }
      toast.success('Project created');
    }

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

  return (
    <PageTransition>
      <div className="flex flex-col h-full">
        <Header title="Projects" />
        <div className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Your Projects</h2>
              <p className="text-sm text-muted-foreground">
                Each project is a marketing campaign with its own canvas
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProject(null); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
                  <DialogDescription>
                    {editingProject ? 'Update your project details.' : 'Set up a new Reddit marketing project.'}
                  </DialogDescription>
                </DialogHeader>
                <form action={handleCreateOrUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input id="name" name="name" defaultValue={editingProject?.name || ''} placeholder="My SaaS Launch" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_name">Product Name</Label>
                    <Input id="product_name" name="product_name" defaultValue={editingProject?.product_name || ''} placeholder="ProductName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_description">Product Description</Label>
                    <Textarea id="product_description" name="product_description" defaultValue={editingProject?.product_description || ''} placeholder="What does your product do?" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_url">Product URL</Label>
                    <Input id="product_url" name="product_url" defaultValue={editingProject?.product_url || ''} placeholder="https://yourproduct.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_audience">Target Audience</Label>
                    <Input id="target_audience" name="target_audience" defaultValue={editingProject?.target_audience || ''} placeholder="Indie hackers, SaaS founders..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Select name="tone" defaultValue={editingProject?.tone || 'Professional'}>
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
                  <Button type="submit" className="w-full">
                    {editingProject ? 'Update Project' : 'Create Project'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <FadeIn>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="mb-4 text-muted-foreground">No projects yet. Create your first one!</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
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
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  variants={staggerItemVariants}
                  whileHover={cardHover}
                  whileTap={cardTap}
                >
                  <Card className="group relative cursor-pointer transition-shadow hover:shadow-md">
                    <div onClick={() => router.push(`/projects/${project.id}`)}>
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
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingProject(project); setDialogOpen(true); }}>
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
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
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
    </PageTransition>
  );
}
