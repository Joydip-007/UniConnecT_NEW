import { Badge } from 'web';

export function Variants() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="dept">Computer Science</Badge>
      <Badge variant="alumni">Alumni</Badge>
      <Badge variant="pinned">Pinned</Badge>
      <Badge variant="live">Live</Badge>
      <Badge variant="neutral">Draft</Badge>
    </div>
  );
}
