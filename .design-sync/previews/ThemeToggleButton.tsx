import { ThemeToggleButton } from 'web';

export function Default() {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
      <ThemeToggleButton size={28} />
      <ThemeToggleButton size={36} />
      <ThemeToggleButton size={44} />
    </div>
  );
}
