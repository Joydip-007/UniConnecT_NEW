import { PasswordInput } from 'web';
import type { CSSProperties } from 'react';

const inputStyle: CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const wrapperStyle: CSSProperties = {
  width: 320,
  padding: 20,
  background: 'var(--surface-page)',
  borderRadius: 'var(--r-lg)',
};

export function Empty() {
  return (
    <div style={wrapperStyle}>
      <PasswordInput placeholder="Enter your password" style={inputStyle} />
    </div>
  );
}

export function Filled() {
  return (
    <div style={wrapperStyle}>
      <PasswordInput defaultValue="hunter2" style={inputStyle} />
    </div>
  );
}
