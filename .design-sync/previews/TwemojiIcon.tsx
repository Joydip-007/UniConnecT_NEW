import { TwemojiIcon } from 'web';

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
      <TwemojiIcon codepoint="1f44d" label="Like" size={16} />
      <TwemojiIcon codepoint="2764" label="Love" size={24} />
      <TwemojiIcon codepoint="1f602" label="Haha" size={32} />
      <TwemojiIcon codepoint="1f621" label="Angry" size={40} />
    </div>
  );
}
