import { AiPathDialog } from 'web';

// "Draft with AI" for learning paths. Owns its own form state, so the open card
// shows the real resting form (empty topic, beginner, 8 units, quiz on).

export function Open() {
  return <AiPathDialog open onClose={() => {}} onGenerated={() => {}} />;
}
