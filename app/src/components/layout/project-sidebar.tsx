'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, MessageSquare, Compass, Bookmark, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import type { Project } from '@/types';

export function ProjectSidebar({ project }: { project: Project }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/projects/${project.id}`;

  const navItems = [
    { href: base, label: 'Canvas', icon: LayoutDashboard, exact: true },
    { href: `${base}/chat`, label: 'AI Chat', icon: MessageSquare },
    { href: `${base}/inspiration`, label: 'Inspiration', icon: Compass },
    { href: `${base}/bookmarks`, label: 'Bookmarks', icon: Bookmark },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
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
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <motion.div key={item.href} variants={staggerItemVariants}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
        })}
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
