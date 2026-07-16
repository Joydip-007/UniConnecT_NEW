import { ReactionChip } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16 }}>
      <ReactionChip counts={{ like: 12, love: 4, haha: 1 }} myReaction={null} />
      <ReactionChip counts={{ like: 8, love: 2 }} myReaction="like" />
      <ReactionChip counts={{ love: 1, wow: 3, angry: 2 }} myReaction="wow" />
    </div>
  );
}
