import type { DmTemplate } from '@/types';

export const DM_TEMPLATES: DmTemplate[] = [
  {
    id: 'resource-delivery',
    name: 'Resource Delivery',
    description: "Share a resource they asked about — checklist, guide, link, etc.",
    subject_hint: "Here's the [resource] you asked about",
    body_hint: "Hey! Saw your comment about [topic]. Here's [specific resource]. [Brief value prop]. Let me know if you have any questions!",
  },
  {
    id: 'follow-up',
    name: 'Follow-up',
    description: 'Continue a conversation that started in the thread.',
    subject_hint: 'Following up on our chat in r/[subreddit]',
    body_hint: "Hey, we were chatting in [thread]. Wanted to share the full version / more details. [Expand on the thread conversation]. Hope this helps!",
  },
  {
    id: 'qualification',
    name: 'Qualification',
    description: 'Ask a qualifying question to gauge fit before pitching.',
    subject_hint: 'Quick question about [their situation]',
    body_hint: "Hey! Saw your comment about [problem]. Quick q — [qualifying question about timeline/budget/stack/team size]? I might have something that could help depending on your answer.",
  },
  {
    id: 'meeting-bridge',
    name: 'Meeting Bridge',
    description: 'Offer a quick call to walk through something complex.',
    subject_hint: 'Easier to walk through this live — 10 min?',
    body_hint: "Hey! Your question about [topic] has a few moving parts. Easier to walk through live than type it all out. Would a quick 10-min call work? I can show you [specific thing]. No pressure either way!",
  },
  {
    id: 'close-loop',
    name: 'Close Loop',
    description: 'Follow up on a previous DM that got no response.',
    subject_hint: 'Still relevant, or should I close this out?',
    body_hint: "Hey! I reached out [X days] ago about [topic]. Totally understand if the timing isn't right — just wanted to check if this is still relevant or if I should close this out. Either way, no worries!",
  },
];

export function getTemplate(id: string): DmTemplate | undefined {
  return DM_TEMPLATES.find((t) => t.id === id);
}
