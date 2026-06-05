import { ButtonHTMLAttributes, ReactNode } from 'react';

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-[7px] text-[13px] font-medium cursor-pointer transition-[opacity,transform] duration-150 ease-out ' +
  'hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--uc-indigo-xl)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]';

export function PrimaryBtn({ className = '', ...props }: BaseProps) {
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-pill)] px-5 py-[9px] bg-[var(--uc-indigo)] text-[var(--on-accent)] border-none ${className}`}
    />
  );
}

export function OrangeBtn({ className = '', ...props }: BaseProps) {
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-pill)] px-5 py-[9px] bg-[var(--uc-orange)] text-[var(--on-accent)] border-none ${className}`}
    />
  );
}

export function MintBtn({ className = '', ...props }: BaseProps) {
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-pill)] px-5 py-[9px] bg-[var(--uc-mint)] text-[var(--on-accent)] border-none ${className}`}
    />
  );
}

export function GhostBtn({ className = '', ...props }: BaseProps) {
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-pill)] px-[18px] py-2 bg-transparent border-[0.5px] border-[var(--border-hover)] text-[var(--text-secondary)] ${className}`}
    />
  );
}

type ContextualBtnProps = BaseProps & { icon?: ReactNode };

export function ContextualBtn({ icon, children, className = '', ...props }: ContextualBtnProps) {
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-pill)] px-4 py-2 bg-[var(--surface-raised)] border-[0.5px] border-[var(--border-default)] text-[var(--text-secondary)] ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

type ReactionBtnProps = BaseProps & { active?: boolean; activeTone?: 'indigo' | 'orange' };

export function ReactionBtn({ active = false, activeTone = 'indigo', className = '', ...props }: ReactionBtnProps) {
  const activeColor = active
    ? activeTone === 'orange'
      ? 'text-[var(--uc-orange-l)]'
      : 'text-[var(--uc-indigo)]'
    : '';
  return (
    <button
      {...props}
      className={`${base} rounded-[var(--r-sm)] px-[10px] py-[6px] bg-transparent border-none text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] ${activeColor} ${className}`}
    />
  );
}
