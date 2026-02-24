'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  PenLine,
  ChevronDown,
  LogOut,
  Target,
  Radio,
  Bell,
  Users,
  Settings,
  Send,
  GitPullRequestArrow,
  PieChart,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Globe,
  Puzzle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import type { Project } from '@/types';

export function ProjectSidebar({ project }: { project: Project }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/projects/${project.id}`;
  const COLLAPSED_WIDTH = 56;
  const DEFAULT_WIDTH = 240;
  const MIN_WIDTH = 160;
  const MAX_WIDTH = 400;
  const SNAP_THRESHOLD = 100;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const lastExpandedWidth = useRef(DEFAULT_WIDTH);
  const dragging = useRef(false);

  const [createExpanded, setCreateExpanded] = useState(true);
  const [outreachExpanded, setOutreachExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [contextExpanded, setContextExpanded] = useState(true);

  const handleToggleCollapse = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setSidebarWidth(lastExpandedWidth.current);
    } else {
      lastExpandedWidth.current = sidebarWidth;
      setCollapsed(true);
      setSidebarWidth(COLLAPSED_WIDTH);
    }
  }, [collapsed, sidebarWidth]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const x = e.clientX;

      if (x < SNAP_THRESHOLD) {
        if (!collapsed) {
          lastExpandedWidth.current = sidebarWidth > MIN_WIDTH ? sidebarWidth : DEFAULT_WIDTH;
          setCollapsed(true);
          setSidebarWidth(COLLAPSED_WIDTH);
        }
      } else {
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, x));
        if (collapsed) setCollapsed(false);
        setSidebarWidth(clamped);
      }
    }

    function handleMouseUp() {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [collapsed, sidebarWidth]);

  const topItems = [
    { href: base, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  ];

  const createChildren = [
    { href: `${base}/create`, label: 'Create', icon: PenLine },
    { href: `${base}/drafts`, label: 'Drafts', icon: FileText },
    { href: `${base}/subreddits`, label: 'Subreddits', icon: Globe },
  ];

  const outreachChildren = [
    { href: `${base}/outreach/signals`, label: 'Signals', icon: Radio },
    { href: `${base}/outreach/alerts`, label: 'Alerts', icon: Bell },
    { href: `${base}/outreach/competitors`, label: 'Competitors', icon: Users },
  ];

  const dmsChildren = [
    { href: `${base}/dms/pipeline`, label: 'Pipeline', icon: GitPullRequestArrow },
    { href: `${base}/dms`, label: 'Analytics', icon: PieChart },
  ];

  const contextChildren = [
    { href: `${base}/context/profile`, label: 'Profile', icon: Settings },
    { href: `${base}/context/extension`, label: 'Extension', icon: Puzzle },
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

    const link = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : 'gap-3',
          indented && !collapsed && 'pl-9',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && item.label}
      </Link>
    );

    return (
      <motion.div key={item.href} variants={staggerItemVariants}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
      </motion.div>
    );
  };

  const renderSectionHeader = (
    label: string,
    icon: React.ComponentType<{ className?: string }>,
    expanded: boolean,
    toggle: () => void,
  ) => {
    const Icon = icon;
    if (collapsed) {
      return (
        <motion.div variants={staggerItemVariants}>
          <div className="my-1 border-t border-border/50" />
        </motion.div>
      );
    }
    return (
      <motion.div variants={staggerItemVariants}>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Icon className="h-4 w-4" />
          {label}
          <ChevronDown
            className={cn(
              'ml-auto h-4 w-4 transition-transform duration-200',
              !expanded && '-rotate-90'
            )}
          />
        </button>
      </motion.div>
    );
  };

  const renderSectionChildren = (
    key: string,
    expanded: boolean,
    children: typeof createChildren,
  ) => {
    // When collapsed, always show icons
    const shouldShow = collapsed || expanded;
    return (
      <AnimatePresence initial={false}>
        {shouldShow && (
          <motion.div
            key={key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-1">
              {children.map((item) => {
                const isActive = pathname === item.href || pathname === item.href + '/';
                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : 'gap-3 pl-9',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
                return (
                  <div key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className="relative flex h-screen flex-col border-r bg-card shrink-0 overflow-hidden"
        style={{ width: sidebarWidth, transition: dragging.current ? 'none' : 'width 200ms ease' }}
      >
        {/* Back to Projects + Collapse toggle */}
        <div className="flex h-14 items-center border-b px-3 justify-between">
          {!collapsed && (
            <Link
              href="/projects"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
          )}
          <button
            onClick={handleToggleCollapse}
            className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Project name */}
        {!collapsed && (
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-sm truncate">{project.name}</h2>
            <p className="text-xs text-muted-foreground truncate">{project.product_name}</p>
          </div>
        )}

        {/* Nav items */}
        <motion.nav
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className={cn('flex-1 overflow-y-auto space-y-1', collapsed ? 'p-1.5' : 'p-3')}
        >
          {topItems.map((item) => renderNavLink(item))}

          {renderSectionHeader('Create', PenLine, createExpanded, () => setCreateExpanded(p => !p))}
          {renderSectionChildren('create-children', createExpanded, createChildren)}

          {renderSectionHeader('Outreach', Target, outreachExpanded, () => setOutreachExpanded(p => !p))}
          {renderSectionChildren('outreach-children', outreachExpanded, outreachChildren)}

          {renderSectionHeader('DMs', Send, dmsExpanded, () => setDmsExpanded(p => !p))}
          {renderSectionChildren('dms-children', dmsExpanded, dmsChildren)}

          {renderSectionHeader('Context', Settings, contextExpanded, () => setContextExpanded(p => !p))}
          {renderSectionChildren('context-children', contextExpanded, contextChildren)}
        </motion.nav>

        {/* Bottom */}
        <div className={cn('border-t space-y-1', collapsed ? 'p-1.5' : 'p-3')}>
          {/* Avatar */}
          {collapsed ? (
            <div className="flex justify-center py-1">
              <AvatarUpload size="sm" />
            </div>
          ) : (
            <div className="rounded-lg px-3 py-2">
              <AvatarUpload showName />
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-1">
                  <ThemeToggle />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Theme</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          )}
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
        />
      </aside>
    </TooltipProvider>
  );
}
