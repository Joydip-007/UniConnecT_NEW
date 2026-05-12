import { ReactNode } from 'react';

type BadgeVariant = 'dept' | 'alumni' | 'pinned' | 'live' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  dept:    'bg-[var(--uc-indigo-bg)] text-[var(--uc-indigo-l)]',
  alumni:  'bg-[var(--uc-mint-bg)] text-[var(--uc-mint)]',
  pinned:  'bg-[var(--uc-orange-bg)] text-[var(--uc-orange-l)]',
  live:    'bg-[var(--uc-cyan-bg)] text-[var(--uc-cyan)]',
  neutral: 'bg-[var(--surface-raised)] text-[var(--text-secondary)]',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium leading-none px-[9px] py-[2px] rounded-[var(--r-pill)] ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
