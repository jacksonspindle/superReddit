'use client';

import { useState } from 'react';
import { Loader2, Mail, Unplug, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { OutreachConfig } from '@/types';

interface EmailConnectProps {
  config: OutreachConfig | null;
  projectId: string;
  onDisconnect: () => void;
}

export function EmailConnect({ config, projectId, onDisconnect }: EmailConnectProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const isConnected = config?.email_connected;

  async function handleSendCode() {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/alerts/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, email: email.trim() }),
      });
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success('Verification code sent!');
        setVerifyMode(true);
      }
    } catch {
      toast.error('Failed to send verification code');
    }
    setSending(false);
  }

  async function handleVerify() {
    if (!code.trim()) {
      toast.error('Please enter the verification code');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/alerts/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, code: code.trim() }),
      });
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success('Email verified successfully!');
        window.location.reload();
      }
    } catch {
      toast.error('Failed to verify code');
    }
    setVerifying(false);
  }

  async function handlePreferenceChange(update: Record<string, unknown>) {
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/alerts/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...update }),
      });
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success('Preferences updated');
      }
    } catch {
      toast.error('Failed to update preferences');
    }
    setSavingPrefs(false);
  }

  // State 3: Connected
  if (isConnected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Email Connected</span>
              <Badge
                variant="secondary"
                className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              >
                Active
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={onDisconnect}
            >
              <Unplug className="mr-1 h-3 w-3" />
              Disconnect
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Delivering to:{' '}
            <span className="font-medium text-foreground">
              {config?.email_address}
            </span>
          </p>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={config?.email_realtime_enabled ?? false}
                onChange={(e) =>
                  handlePreferenceChange({
                    email_realtime_enabled: e.target.checked,
                  })
                }
                disabled={savingPrefs}
                className="rounded border-gray-300"
              />
              <span>Real-time alerts</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={config?.email_digest_enabled ?? false}
                onChange={(e) =>
                  handlePreferenceChange({
                    email_digest_enabled: e.target.checked,
                  })
                }
                disabled={savingPrefs}
                className="rounded border-gray-300"
              />
              <span>Digest emails</span>
            </label>

            {config?.email_digest_enabled && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-xs text-muted-foreground">Frequency:</span>
                <Button
                  variant={
                    config?.email_digest_frequency === 'daily'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  disabled={savingPrefs}
                  onClick={() =>
                    handlePreferenceChange({ email_digest_frequency: 'daily' })
                  }
                >
                  Daily
                </Button>
                <Button
                  variant={
                    config?.email_digest_frequency === 'weekly'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  disabled={savingPrefs}
                  onClick={() =>
                    handlePreferenceChange({ email_digest_frequency: 'weekly' })
                  }
                >
                  Weekly
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 2: Verifying
  if (verifyMode) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Verify Email</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code sent to{' '}
            <span className="font-medium text-foreground">{email}</span>
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-32 text-center tracking-widest"
            />
            <Button onClick={handleVerify} disabled={verifying} size="sm">
              {verifying && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Verify
            </Button>
          </div>
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline hover:text-foreground"
            onClick={() => {
              setVerifyMode(false);
              setCode('');
            }}
          >
            Use a different email
          </button>
        </CardContent>
      </Card>
    );
  }

  // State 1: Disconnected
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Email Alerts</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Receive signal alerts directly in your inbox. You can enable real-time
          notifications or daily/weekly digests.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSendCode} disabled={sending} size="sm">
            {sending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Send Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
