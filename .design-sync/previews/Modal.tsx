import { Modal } from 'web';

export function Default() {
  return (
    <Modal isOpen onClose={() => {}} title="Confirm action">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        This will permanently remove the item from your saved list. This action cannot be undone.
      </p>
    </Modal>
  );
}
