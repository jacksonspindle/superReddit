'use client';

import {
  Download,
  FolderOpen,
  Puzzle,
  ToggleRight,
  Upload,
  CheckCircle2,
  Globe,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Shield,
  Monitor,
  HardDrive,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRedditBridge } from '@/hooks/useRedditBridge';

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            {step}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold mb-2">{title}</h3>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {question}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function ExtensionPage() {
  const { status } = useRedditBridge();

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Chrome Extension</h1>
            <p className="text-sm text-muted-foreground">
              Connect your Reddit account to SuperReddit
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status.extensionInstalled ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {status.extensionInstalled
                    ? 'Extension connected'
                    : 'Extension not detected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.extensionInstalled
                    ? status.redditLoggedIn
                      ? `Logged in as u/${status.redditUsername}`
                      : 'Reddit not logged in — open reddit.com and sign in'
                    : 'Follow the steps below to install'}
                </p>
              </div>
            </div>
            <Badge
              variant={status.extensionInstalled ? 'default' : 'secondary'}
              className={cn(
                status.extensionInstalled && 'bg-green-500/10 text-green-500 border-green-500/20'
              )}
            >
              {status.extensionInstalled ? 'Connected' : 'Not installed'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What does the extension do?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: MessageSquare,
                label: 'Syncs Reddit conversations',
                desc: 'Automatically loads chat histories into your pipeline',
              },
              {
                icon: Monitor,
                label: 'One-click DM sending',
                desc: 'Open Reddit chat directly from the send queue',
              },
              {
                icon: Globe,
                label: 'Real-time updates',
                desc: 'See new replies the moment they arrive',
              },
              {
                icon: Shield,
                label: 'Privacy-first',
                desc: 'Data stays in your browser — nothing sent to third parties',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              'Google Chrome browser (version 100 or later)',
              'A Reddit account logged in to Chrome',
              'Access to the SuperReddit dashboard',
            ].map((req) => (
              <div key={req} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <p className="text-sm">{req}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Installation steps */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Installation</h2>
        <div className="space-y-3">
          <StepCard step={1} title="Download the Extension">
            <p className="text-sm text-muted-foreground mb-3">
              Download the extension package and save it somewhere easy to find.
            </p>
            <a
              href="/SuperReddit-Extension-v1.6.0.zip"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Extension v1.6.0
            </a>
          </StepCard>

          <StepCard step={2} title="Unzip the File">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-medium text-foreground">Mac:</span>
                <span>Double-click the zip file — it auto-extracts into a folder</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium text-foreground">Windows:</span>
                <span>Right-click the zip &rarr; &quot;Extract All...&quot; &rarr; Choose a location &rarr; Click &quot;Extract&quot;</span>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Don&apos;t delete this folder after installing — Chrome needs it to run the extension.
              </p>
            </div>
          </StepCard>

          <StepCard step={3} title="Open Chrome Extensions">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Type{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  chrome://extensions
                </code>{' '}
                in the address bar and press Enter.
              </p>
              <p className="text-xs">
                Or: three-dot menu (top right) &rarr; Extensions &rarr; Manage Extensions
              </p>
            </div>
          </StepCard>

          <StepCard step={4} title="Enable Developer Mode">
            <p className="text-sm text-muted-foreground mb-3">
              In the top-right corner of the extensions page, toggle{' '}
              <span className="font-medium text-foreground">Developer mode</span> ON.
            </p>
            <div className="inline-flex items-center gap-3 rounded-lg bg-muted px-4 py-2.5">
              <span className="text-sm font-medium">Developer mode</span>
              <div className="flex h-6 w-10 items-center rounded-full bg-primary px-1">
                <div className="ml-auto h-4 w-4 rounded-full bg-white" />
              </div>
            </div>
          </StepCard>

          <StepCard step={5} title="Load the Extension">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Click the <span className="font-medium text-foreground">&quot;Load unpacked&quot;</span> button (top-left area)</p>
              <p>2. Select the <span className="font-medium text-foreground">unzipped extension folder</span> from Step 2</p>
              <p>3. Click <span className="font-medium text-foreground">&quot;Select&quot;</span> (Mac) or <span className="font-medium text-foreground">&quot;Select Folder&quot;</span> (Windows)</p>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs">The extension installs immediately. No restart needed.</p>
            </div>
          </StepCard>

          <StepCard step={6} title="Verify Installation">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <p><span className="font-medium text-foreground">&quot;SuperReddit DM Bridge&quot;</span> appears on the extensions page</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <p>The SuperReddit icon appears in your Chrome toolbar</p>
              </div>
              <p className="text-xs mt-1">
                Tip: Click the puzzle piece icon in the toolbar to pin the extension for easy access.
              </p>
            </div>
          </StepCard>
        </div>
      </div>

      {/* Connect to Reddit */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Connect to Reddit</CardTitle>
          <CardDescription>Final step — link your Reddit account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Go to <a href="https://www.reddit.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">reddit.com</a> and make sure you&apos;re signed in</p>
            <p>2. Come back to this dashboard</p>
            <p>3. The status above will update to <span className="font-medium text-green-500">&quot;Connected&quot;</span> when the extension is detected</p>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Troubleshooting</h2>
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-5">
              <h4 className="text-sm font-semibold text-yellow-500 mb-2">Extension not showing up?</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Make sure Developer mode is ON</li>
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Select the correct folder (must contain <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">manifest.json</code> at the root)</li>
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Click the refresh icon on the extension card</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h4 className="text-sm font-semibold text-yellow-500 mb-2">Dashboard says &quot;Extension not detected&quot;?</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Refresh this page</li>
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Check the extension is enabled (toggle is blue) in <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">chrome://extensions</code></li>
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Only works in Chrome (not Safari, Firefox, etc.)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h4 className="text-sm font-semibold text-yellow-500 mb-2">Reddit chat not syncing?</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Make sure you&apos;re logged into Reddit in the same Chrome profile</li>
                <li className="flex items-start gap-2"><span className="text-primary">&#x25B8;</span>Open <a href="https://www.reddit.com/chat" target="_blank" rel="noopener noreferrer" className="text-primary underline">reddit.com/chat</a> in a tab for initial sync</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h4 className="text-sm font-semibold mb-2">Need to update?</h4>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>1. Download the new version zip</p>
                <p>2. Unzip it, replacing the old folder</p>
                <p>3. Click the refresh icon on the extension card in <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">chrome://extensions</code></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-semibold mb-4">FAQ</h2>
        <div className="space-y-2">
          <FaqItem
            question="Will this affect my Reddit account?"
            answer="No. The extension only reads your chat conversations and sidebar data. It does not post, comment, or modify anything on Reddit automatically."
          />
          <FaqItem
            question="Does the extension work when Chrome is closed?"
            answer="No. The extension runs inside Chrome and needs the browser open. It also needs at least one Reddit tab open for real-time syncing."
          />
          <FaqItem
            question="Can I use this on multiple computers?"
            answer="Yes. Install the extension on each computer following the same steps. Your SuperReddit dashboard data syncs through the cloud — the extension just bridges the local Reddit session."
          />
          <FaqItem
            question="Is my data secure?"
            answer="The extension only communicates between your local Reddit session and the SuperReddit dashboard. No data is sent to third-party servers. All conversation data stays in your browser and your SuperReddit account."
          />
        </div>
      </div>
    </div>
  );
}
