export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function isFollowUpDue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() <= Date.now();
}

export function followUpStatus(dateStr: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) {
    const overdueSec = Math.abs(diff) / 1000;
    if (overdueSec < 3600) return { label: `Overdue by ${Math.floor(overdueSec / 60)}m`, overdue: true };
    if (overdueSec < 86400) return { label: `Overdue by ${Math.floor(overdueSec / 3600)}h`, overdue: true };
    return { label: `Overdue by ${Math.floor(overdueSec / 86400)}d`, overdue: true };
  }
  if (diff < 3600000) return { label: `Due in ${Math.floor(diff / 60000)}m`, overdue: false };
  if (diff < 86400000) return { label: `Due in ${Math.floor(diff / 3600000)}h`, overdue: false };
  return { label: `Due in ${Math.floor(diff / 86400000)}d`, overdue: false };
}
