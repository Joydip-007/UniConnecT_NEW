import { MessageReactionGroup } from 'web';

export function Default() {
  return (
    <div style={{ width: 260, padding: 16 }}>
      <MessageReactionGroup
        myUserId="u1"
        onReactionClick={() => {}}
        reactions={{
          like: [
            { userId: 'u1', fullName: 'Jamie Doe' },
            { userId: 'u2', fullName: 'Morgan Kelly' },
          ],
          love: [{ userId: 'u3', fullName: 'Riley Stone' }],
          haha: [
            { userId: 'u4', fullName: 'Sam Lee' },
            { userId: 'u5', fullName: 'Priya Nair' },
            { userId: 'u6', fullName: 'Alex Chan' },
          ],
        }}
      />
    </div>
  );
}
