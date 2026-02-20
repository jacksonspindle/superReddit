/**
 * Parse a human-readable duration string into milliseconds.
 * Supports: "20m", "1h", "2d", "30s", "1h30m", etc.
 * Ported from Reddalert implementation.
 */
export function parseDuration(input: string): number | null {
  if (!input || typeof input !== 'string') return null;

  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  let totalMs = 0;
  let matched = false;

  const regex = /(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    matched = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
      case 'sec':
      case 'second':
      case 'seconds':
        totalMs += value * 1000;
        break;
      case 'm':
      case 'min':
      case 'minute':
      case 'minutes':
        totalMs += value * 60 * 1000;
        break;
      case 'h':
      case 'hr':
      case 'hour':
      case 'hours':
        totalMs += value * 60 * 60 * 1000;
        break;
      case 'd':
      case 'day':
      case 'days':
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
    }
  }

  return matched ? totalMs : null;
}

/**
 * Format milliseconds into a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
}
