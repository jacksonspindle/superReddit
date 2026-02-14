'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  PenLine,
  ChevronDown,
  Compass,
  Shuffle,
  Library,
  PenTool,
  MessageSquare,
  Bookmark,
  Scissors,
  LogOut,
  Target,
  Radio,
  BarChart3,
  Users,
  Settings,
  Github,
  Bot,
  Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import type { Project } from '@/types';

export function ProjectSidebar({ project }: { project: Project }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/projects/${project.id}`;
  const [createExpanded, setCreateExpanded] = useState(true);
  const [outreachExpanded, setOutreachExpanded] = useState(true);
  const [contextExpanded, setContextExpanded] = useState(true);

  const topItems = [
    { href: base, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  ];

  const createChildren = [
    { href: `${base}/inspiration`, label: 'Inspiration', icon: Compass },
    { href: `${base}/splicer`, label: 'Splicer', icon: Scissors },
    { href: `${base}/daily-mix`, label: 'Your Feed', icon: Shuffle },
    { href: `${base}/chat`, label: 'AI Chat', icon: MessageSquare },
    { href: `${base}/viral-library`, label: 'Viral Library', icon: Library },
  ];

  const outreachChildren = [
    { href: `${base}/outreach/signals`, label: 'Signals', icon: Radio },
    { href: `${base}/outreach/tracker`, label: 'Tracker', icon: BarChart3 },
    { href: `${base}/outreach/competitors`, label: 'Competitors', icon: Users },
    { href: `${base}/outreach/dms`, label: 'DMs', icon: Mail },
  ];

  const contextChildren = [
    { href: `${base}/context/profile`, label: 'Profile', icon: Settings },
    { href: `${base}/context/github`, label: 'GitHub', icon: Github },
    { href: `${base}/context/claude`, label: 'Claude', icon: Bot },
  ];

  const bottomItems = [
    { href: `${base}/canvas`, label: 'Canvas', icon: PenTool },
    { href: `${base}/bookmarks`, label: 'Bookmarks', icon: Bookmark },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const renderNavLink = (item: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }, indented?: boolean) => {
    const isActive = item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href);
    return (
      <motion.div key={item.href} variants={staggerItemVariants}>
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            indented && 'pl-9',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      </motion.div>
    );
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      {/* Back to Projects */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/projects"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>

      {/* Project name */}
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-sm truncate">{project.name}</h2>
        <p className="text-xs text-muted-foreground truncate">{project.product_name}</p>
      </div>

      {/* Nav items */}
      <motion.nav
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 space-y-1 p-3"
      >
        {/* Top items */}
        {topItems.map((item) => renderNavLink(item))}

        {/* Create section */}
        <motion.div variants={staggerItemVariants}>
          <button
            onClick={() => setCreateExpanded((prev) => !prev)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <PenLine className="h-4 w-4" />
            Create
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 transition-transform duration-200',
                !createExpanded && '-rotate-90'
              )}
            />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {createExpanded && (
            <motion.div
              key="create-children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="space-y-1">
                {createChildren.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors pl-9',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Outreach section */}
        <motion.div variants={staggerItemVariants}>
          <button
            onClick={() => setOutreachExpanded((prev) => !prev)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Target className="h-4 w-4" />
            Outreach
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 transition-transform duration-200',
                !outreachExpanded && '-rotate-90'
              )}
            />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {outreachExpanded && (
            <motion.div
              key="outreach-children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="space-y-1">
                {outreachChildren.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors pl-9',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context section */}
        <motion.div variants={staggerItemVariants}>
          <button
            onClick={() => setContextExpanded((prev) => !prev)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-4 w-4" />
            Context
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 transition-transform duration-200',
                !contextExpanded && '-rotate-90'
              )}
            />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {contextExpanded && (
            <motion.div
              key="context-children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="space-y-1">
                {contextChildren.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors pl-9',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav items */}
        {bottomItems.map((item) => renderNavLink(item))}
      </motion.nav>

      {/* Bottom */}
      <div className="border-t p-3 space-y-1">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
