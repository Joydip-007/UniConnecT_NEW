import { RadialOrbitalTimeline } from 'web';
import type { OrbitalNode } from 'web';
import { Users, Briefcase, Calendar, MessageSquare, GraduationCap } from 'lucide-react';

const nodes: OrbitalNode[] = [
  {
    id: 1,
    title: 'Connect',
    subtitle: 'Network',
    content: 'Build your professional network with alumni, faculty, and fellow students across campus.',
    icon: Users,
    relatedIds: [2, 4],
    accent: 'var(--uc-indigo-l)',
    accentBg: 'var(--uc-indigo-bg)',
    accentBdr: 'var(--uc-indigo-bdr)',
    energy: 82,
  },
  {
    id: 2,
    title: 'Careers',
    subtitle: 'Jobs',
    content: 'Discover job and internship postings shared by alumni working across the industry.',
    icon: Briefcase,
    relatedIds: [1, 5],
    accent: 'var(--uc-orange)',
    accentBg: 'var(--uc-orange-bg)',
    accentBdr: 'var(--uc-orange-bdr)',
    energy: 65,
  },
  {
    id: 3,
    title: 'Events',
    subtitle: 'Campus life',
    content: 'RSVP to campus events, workshops, and alumni meetups happening near you.',
    icon: Calendar,
    relatedIds: [4],
    accent: 'var(--uc-mint)',
    accentBg: 'var(--uc-mint-bg)',
    accentBdr: 'var(--uc-mint-bdr)',
    energy: 48,
  },
  {
    id: 4,
    title: 'Messages',
    subtitle: 'Chat',
    content: 'Message connections directly, or join group conversations tied to your clubs and courses.',
    icon: MessageSquare,
    relatedIds: [1, 3],
    accent: 'var(--uc-cyan)',
    accentBg: 'var(--uc-cyan-bg)',
    accentBdr: 'var(--uc-cyan-bdr)',
    energy: 71,
  },
  {
    id: 5,
    title: 'Mentorship',
    subtitle: 'Growth',
    content: 'Get matched with an alumni mentor for guided career sessions and points-based rewards.',
    icon: GraduationCap,
    relatedIds: [2],
    accent: 'var(--uc-red)',
    accentBg: 'var(--uc-red-bg)',
    accentBdr: 'var(--uc-red-bdr)',
    energy: 55,
  },
];

export function Default() {
  return (
    <div style={{ padding: 24 }}>
      <RadialOrbitalTimeline nodes={nodes} height={480} />
    </div>
  );
}
